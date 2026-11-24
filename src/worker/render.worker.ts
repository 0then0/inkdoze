/// <reference lib="webworker" />
import { overInputLimits } from '../io/limits.ts';
import { probeBlob, type ProbeResult } from '../io/probe.ts';
import { encodeRendered, renderPixels } from '../pipeline/render.ts';
import { LoadFailure, cancelHeic, decodeHeic } from './heic.ts';
import type { HeicDecoder, WorkerRequest, WorkerResponse } from './protocol.ts';

declare const self: DedicatedWorkerGlobalScope;

interface Loaded extends Pick<ProbeResult, 'width' | 'height' | 'heic'> {
  bitmap: ImageBitmap;
  file: Blob;
  decoder?: HeicDecoder;
}

const images = new Map<string, Loaded>();
/** Images being decoded, and those released before decoding finished. */
const loading = new Set<string>();
const releasedWhileLoading = new Set<string>();
let activeOverlay: { image: Loaded; bitmap: Promise<ImageBitmap> } | undefined;

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

function decodeBitmap(file: Blob, premultiplyAlpha: 'none' | 'premultiply'): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image', premultiplyAlpha });
}

async function decodeOverlayBitmap(imageId: string, img: Loaded): Promise<ImageBitmap> {
  // Decode premultiplied from the original. Scaling straight-alpha bitmaps can
  // sample hidden RGB, and copying those bitmaps does not repair them in WebKit.
  if (!img.decoder) return decodeBitmap(img.file, 'premultiply');
  const { bitmap } = await decodeHeic(imageId, img.file, img, () => images.get(imageId) !== img, 'premultiply');
  return bitmap;
}

function releaseOverlayBitmap() {
  const released = activeOverlay;
  activeOverlay = undefined;
  // Jobs already awaiting the bitmap render synchronously before this callback.
  void released?.bitmap.then((bitmap) => bitmap.close(), () => undefined);
}

function overlayBitmap(imageId: string, image: Loaded): Promise<ImageBitmap> {
  if (activeOverlay?.image === image) return activeOverlay.bitmap;
  releaseOverlayBitmap();
  const bitmap = decodeOverlayBitmap(imageId, image);
  const cached = { image, bitmap };
  activeOverlay = cached;
  void bitmap.catch(() => {
    if (activeOverlay === cached) activeOverlay = undefined;
  });
  return bitmap;
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
    if (typeof probe === 'string') {
      post({ type: 'error', reqId: req.reqId, code: probe });
      return;
    }
    // Limits are checked on the container before any decoder allocates memory.
    if (overInputLimits(probe.width, probe.height, probe.heic?.decodePixels)) {
      post({ type: 'error', reqId: req.reqId, code: 'tooManyPixels', detail: `${probe.width}x${probe.height}` });
      return;
    }
    let bitmap: ImageBitmap;
    let decoder: HeicDecoder | undefined;
    try {
      if (probe.kind === 'heic') {
        ({ bitmap, decoder } = await decodeHeic(req.imageId, req.file, probe, () => releasedWhileLoading.has(req.imageId)));
      } else {
        bitmap = await decodeBitmap(req.file, 'none');
      }
    } catch (e) {
      if (e instanceof LoadFailure) post({ type: 'error', reqId: req.reqId, code: e.code, ...(e.detail ? { detail: e.detail } : {}) });
      else post({ type: 'error', reqId: req.reqId, code: 'decode', detail: String(e) });
      return;
    }
    if (releasedWhileLoading.has(req.imageId)) {
      // The file was removed while it was decoding: free it instead of keeping it.
      bitmap.close();
      post({ type: 'error', reqId: req.reqId, code: 'missing' });
      return;
    }
    if (overInputLimits(bitmap.width, bitmap.height)) {
      bitmap.close();
      post({ type: 'error', reqId: req.reqId, code: 'tooManyPixels', detail: `${bitmap.width}x${bitmap.height}` });
      return;
    }
    const previous = images.get(req.imageId);
    if (activeOverlay?.image === previous) releaseOverlayBitmap();
    previous?.bitmap.close();
    images.set(req.imageId, { bitmap, file: req.file, decoder, width: bitmap.width, height: bitmap.height, heic: probe.heic });
    const thumb = await thumbnail(bitmap);
    post({ type: 'loaded', reqId: req.reqId, width: bitmap.width, height: bitmap.height, thumbnail: thumb, ...(decoder ? { decoder } : {}) });
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
      cancelHeic(req.imageId);
      const image = images.get(req.imageId);
      if (activeOverlay?.image === image) releaseOverlayBitmap();
      image?.bitmap.close();
      images.delete(req.imageId);
      return post({ type: 'released', reqId: req.reqId });
    }
    const img = images.get(req.imageId);
    if (!img) return post({ type: 'error', reqId: req.reqId, code: 'missing' });
    if (!req.job.preserveAlpha) releaseOverlayBitmap();
    const source = req.job.preserveAlpha ? await overlayBitmap(req.imageId, img) : img.bitmap;
    if (images.get(req.imageId) !== img) return post({ type: 'error', reqId: req.reqId, code: 'missing' });
    const rendered = renderPixels(source, { width: img.width, height: img.height }, req.job);
    if (req.type === 'preview') {
      const bitmap = rendered.canvas.transferToImageBitmap();
      return post({ type: 'preview', reqId: req.reqId, bitmap, width: rendered.width, height: rendered.height }, [bitmap]);
    }
    const blob = await encodeRendered(rendered, req.job.preserveAlpha ? 'png' : req.format, req.jpegQuality);
    post({ type: 'exported', reqId: req.reqId, blob, width: rendered.width, height: rendered.height });
  } catch (e) {
    post({ type: 'error', reqId: req.reqId, code: 'render', detail: String(e) });
  }
};
