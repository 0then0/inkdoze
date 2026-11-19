/// <reference lib="webworker" />
/**
 * HEIC decoding inside the render worker. The browser's own decoder is used when a
 * real decode of a known sample works in this worker, with the right orientation;
 * otherwise, or when it rejects a particular photo, the photo goes to a separate
 * worker running libheif compiled to WebAssembly. That worker and its code are
 * loaded on first use only, and shut down when idle or when its photo is removed.
 */
import { LIMITS } from '../io/limits.ts';
import type { HeicDecoder, HeicRequest, HeicResponse, LoadError } from './protocol.ts';
import { HEIC_SAMPLE_BASE64, HEIC_SAMPLE_SIZE } from './heic-sample.ts';

export class LoadFailure extends Error {
  readonly code: LoadError | 'missing';
  readonly detail: string | undefined;

  constructor(code: LoadError | 'missing', detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'LoadFailure';
    this.code = code;
    this.detail = detail;
  }
}

const BITMAP_OPTIONS: ImageBitmapOptions = { imageOrientation: 'from-image', premultiplyAlpha: 'none' };

function sampleBlob(): Blob {
  const bin = atob(HEIC_SAMPLE_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/heic' });
}

/** Decode the sample with `createImageBitmap` here and check its size and orientation. */
async function testNativeDecoding(): Promise<boolean> {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(sampleBlob(), BITMAP_OPTIONS);
    if (bitmap.width !== HEIC_SAMPLE_SIZE.width || bitmap.height !== HEIC_SAMPLE_SIZE.height) return false;
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0);
    const [r1, , b1] = ctx.getImageData(8, 4, 1, 1).data;
    const [r2, , b2] = ctx.getImageData(8, 28, 1, 1).data;
    // Red on top and blue at the bottom: rotated once, clockwise, not mirrored.
    return r1! > 150 && b1! < 100 && b2! > 150 && r2! < 100;
  } catch {
    return false;
  } finally {
    bitmap?.close();
  }
}

let nativeSupport: Promise<boolean> | undefined;

/** Whether the browser decodes HEIC in this worker. Tested once, on the first HEIC file. */
export function nativeHeicWorks(): Promise<boolean> {
  return (nativeSupport ??= testNativeDecoding());
}

/** Decode with the browser. Returns null when it rejects the photo or gets its size wrong. */
async function decodeNative(file: Blob, expected: { width: number; height: number }, premultiplyAlpha: 'none' | 'premultiply'): Promise<ImageBitmap | null> {
  let bitmap: ImageBitmap;
  try {
    // Give the decoder the type the sample was tested with; user files often have none.
    bitmap = await createImageBitmap(new Blob([file], { type: 'image/heic' }), { ...BITMAP_OPTIONS, premultiplyAlpha });
  } catch {
    return null;
  }
  // A different size means rotation was skipped or applied twice.
  if (bitmap.width !== expected.width || bitmap.height !== expected.height) {
    bitmap.close();
    return null;
  }
  return bitmap;
}

interface Job {
  id: number;
  imageId: string;
  file: Blob;
  resolve: (r: Extract<HeicResponse, { ok: true }>) => void;
  reject: (e: LoadFailure) => void;
}

/** Runs one decode at a time in a lazily created worker; WebAssembly decoding cannot be interrupted otherwise. */
class WasmHeic {
  private worker: Worker | null = null;
  private current: Job | null = null;
  private readonly queue: Job[] = [];
  private nextId = 1;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

  decode(imageId: string, file: Blob): Promise<Extract<HeicResponse, { ok: true }>> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, imageId, file, resolve, reject });
      this.pump();
    });
  }

  /** Drop the image's queued decode, or stop the worker if it is decoding that image. */
  cancel(imageId: string) {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      if (this.queue[i]!.imageId === imageId) this.queue.splice(i, 1)[0]!.reject(new LoadFailure('missing'));
    }
    if (this.current?.imageId === imageId) {
      const job = this.current;
      this.stop();
      job.reject(new LoadFailure('missing'));
      this.pump();
    }
  }

  private pump() {
    clearTimeout(this.idleTimer);
    if (this.current) return;
    const job = this.queue.shift();
    if (!job) {
      this.idleTimer = setTimeout(() => this.stop(), LIMITS.heicDecoderIdleMs);
      return;
    }
    let worker: Worker;
    try {
      worker = this.worker ??= this.start();
    } catch (e) {
      job.reject(new LoadFailure('wasmUnavailable', String(e)));
      this.pump();
      return;
    }
    this.current = job;
    worker.postMessage({ id: job.id, file: job.file } satisfies HeicRequest);
  }

  private start(): Worker {
    const worker = new Worker(new URL('./heic.worker.ts', import.meta.url), { type: 'module', name: 'inkdoze-heic' });
    worker.onmessage = (e: MessageEvent<HeicResponse>) => {
      const job = this.current;
      if (!job || e.data.id !== job.id) return;
      this.current = null;
      const msg = e.data;
      if (msg.ok) job.resolve(msg);
      else {
        // After a WebAssembly trap or allocation failure the instance cannot be reused.
        if (msg.fatal) this.stop();
        job.reject(new LoadFailure(msg.code, msg.detail));
      }
      this.pump();
    };
    // The worker script or the decoder chunk failed to load.
    worker.onerror = (e) => {
      e.preventDefault();
      const job = this.current;
      this.current = null;
      this.stop();
      job?.reject(new LoadFailure('wasmUnavailable', e.message));
      this.pump();
    };
    return worker;
  }

  private stop() {
    clearTimeout(this.idleTimer);
    this.worker?.terminate();
    this.worker = null;
    this.current = null;
  }
}

const wasm = new WasmHeic();

/** Forget a removed image's pending WebAssembly work. */
export function cancelHeic(imageId: string) {
  wasm.cancel(imageId);
}

/**
 * Decode a HEIC photo whose container was already checked. The browser is tried
 * first when it passed the capability test; if it rejects this photo, the
 * WebAssembly decoder gets one attempt. `isReleased` stops the second attempt for a
 * photo removed meanwhile.
 */
export async function decodeHeic(
  imageId: string,
  file: Blob,
  expected: { width: number; height: number },
  isReleased: () => boolean,
  premultiplyAlpha: 'none' | 'premultiply' = 'none',
): Promise<{ bitmap: ImageBitmap; decoder: HeicDecoder }> {
  if (await nativeHeicWorks()) {
    const bitmap = await decodeNative(file, expected, premultiplyAlpha);
    if (bitmap) return { bitmap, decoder: 'native' };
  }
  if (isReleased()) throw new LoadFailure('missing');
  const r = await wasm.decode(imageId, file);
  const pixels = new ImageData(new Uint8ClampedArray(r.data), r.width, r.height);
  const bitmap = await createImageBitmap(pixels, { premultiplyAlpha });
  return { bitmap, decoder: 'wasm' };
}
