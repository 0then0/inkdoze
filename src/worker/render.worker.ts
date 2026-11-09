/// <reference lib="webworker" />
import { LIMITS } from '../io/limits.ts';
import { probeBlob } from '../io/probe.ts';
import { encodeRendered, renderPixels } from '../pipeline/render.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

interface Loaded {
  bitmap: ImageBitmap;
  width: number;
  height: number;
}

const images = new Map<string, Loaded>();
/** Images being decoded, and those released before decoding finished. */
const loading = new Set<string>();
const releasedWhileLoading = new Set<string>();

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

async function thumbnail(bitmap: ImageBitmap): Promise<Blob> {
  const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  return c.convertToBlob({ type: 'image/png' });
}

async function load(req: Extract<WorkerRequest, { type: 'load' }>) {
  loading.add(req.imageId);
  try {
    const probe = await probeBlob(req.file);
    if (probe === 'unsupported' || probe === 'corrupt') {
      post({ type: 'error', reqId: req.reqId, code: probe });
      return;
    }
    if (probe.width * probe.height > LIMITS.maxInputPixels || Math.max(probe.width, probe.height) > LIMITS.maxInputSide) {
      post({ type: 'error', reqId: req.reqId, code: 'tooManyPixels', detail: `${probe.width}x${probe.height}` });
      return;
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(req.file, { imageOrientation: 'from-image', premultiplyAlpha: 'none' });
    } catch (e) {
      post({ type: 'error', reqId: req.reqId, code: 'decode', detail: String(e) });
      return;
    }
    if (releasedWhileLoading.has(req.imageId)) {
      // The file was removed while it was decoding: free it instead of keeping it.
      bitmap.close();
      post({ type: 'error', reqId: req.reqId, code: 'missing' });
      return;
    }
    if (bitmap.width * bitmap.height > LIMITS.maxInputPixels) {
      bitmap.close();
      post({ type: 'error', reqId: req.reqId, code: 'tooManyPixels', detail: `${bitmap.width}x${bitmap.height}` });
      return;
    }
    images.get(req.imageId)?.bitmap.close();
    images.set(req.imageId, { bitmap, width: bitmap.width, height: bitmap.height });
    const thumb = await thumbnail(bitmap);
    post({ type: 'loaded', reqId: req.reqId, width: bitmap.width, height: bitmap.height, thumbnail: thumb });
  } finally {
    loading.delete(req.imageId);
    releasedWhileLoading.delete(req.imageId);
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const req = event.data;
  try {
    if (req.type === 'load') return await load(req);
    if (req.type === 'release') {
      if (loading.has(req.imageId)) releasedWhileLoading.add(req.imageId);
      images.get(req.imageId)?.bitmap.close();
      images.delete(req.imageId);
      return post({ type: 'released', reqId: req.reqId });
    }
    const img = images.get(req.imageId);
    if (!img) return post({ type: 'error', reqId: req.reqId, code: 'missing' });
    const rendered = renderPixels(img.bitmap, { width: img.width, height: img.height }, req.job);
    if (req.type === 'preview') {
      const bitmap = rendered.canvas.transferToImageBitmap();
      return post({ type: 'preview', reqId: req.reqId, bitmap, width: rendered.width, height: rendered.height }, [bitmap]);
    }
    const blob = await encodeRendered(rendered, req.format, req.jpegQuality);
    post({ type: 'exported', reqId: req.reqId, blob, width: rendered.width, height: rendered.height });
  } catch (e) {
    post({ type: 'error', reqId: req.reqId, code: 'render', detail: String(e) });
  }
};
