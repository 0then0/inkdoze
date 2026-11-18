/// <reference lib="webworker" />
/**
 * HEIC decoding with libheif (libde265 for HEVC) compiled to WebAssembly. Started by
 * the render worker only when the browser cannot decode a photo itself. The decoder
 * module, with the WebAssembly binary embedded, is imported on the first request from
 * the app's own static files; nothing is fetched from elsewhere and pixels never leave
 * the device. One instance serves every request until the worker is terminated.
 */
import { overInputLimits } from '../io/limits.ts';
import type { HeicRequest, HeicResponse, LoadError } from './protocol.ts';
import type { LibHeif, LibHeifError } from 'libheif-js/libheif-wasm/libheif-bundle.mjs';

declare const self: DedicatedWorkerGlobalScope;

class DecodeFailure extends Error {
  readonly code: LoadError;
  readonly detail: string | undefined;

  constructor(code: LoadError, detail?: string) {
    super(detail ?? code);
    this.code = code;
    this.detail = detail;
  }
}

let library: Promise<LibHeif> | null = null;

async function loadLibrary(): Promise<LibHeif> {
  if (typeof WebAssembly !== 'object') throw new Error('WebAssembly is not available');
  const { default: factory } = await import('libheif-js/libheif-wasm/libheif-bundle.mjs');
  // The Emscripten runtime logs through these; keep the console quiet.
  return await factory({ print: () => undefined, printErr: () => undefined });
}

/** Embind enums arrive as objects with a numeric `value`; accept plain numbers too. */
const num = (v: unknown): number =>
  typeof v === 'number' ? v : typeof v === 'object' && v !== null && typeof (v as { value?: unknown }).value === 'number' ? (v as { value: number }).value : NaN;

/** Map libheif error codes (heif_error_code) to the app's load errors. */
function failure(e: LibHeifError | null | undefined, what: string): DecodeFailure {
  const code = num(e?.code);
  const detail = `${what}: ${e?.message ?? 'no result'}`;
  // 2 Invalid_input, 7 Decoder_plugin_error (damaged HEVC data).
  if (code === 2 || code === 7) return new DecodeFailure('corrupt', detail);
  // 3 Unsupported_filetype, 4 Unsupported_feature.
  if (code === 3 || code === 4) return new DecodeFailure('heicVariant', detail);
  return new DecodeFailure('decode', detail);
}

const isError = (v: unknown): v is LibHeifError => typeof v === 'object' && v !== null && 'code' in v && num(v.code) !== 0;

/** Decode the primary image to 8-bit RGBA with `irot`/`imir`/`clap` applied, freeing every libheif object. */
function decode(h: LibHeif, bytes: Uint8Array): { width: number; height: number; data: ArrayBuffer } {
  const ctx = h.heif_context_alloc();
  if (!ctx) throw new DecodeFailure('decode', 'no context');
  try {
    const read = h.heif_context_read_from_memory(ctx, bytes);
    if (isError(read)) throw failure(read, 'read');
    const handle = h.heif_js_context_get_primary_image_handle(ctx);
    if (!handle || isError(handle)) throw failure(handle, 'primary image');
    try {
      const width = h.heif_image_handle_get_width(handle);
      const height = h.heif_image_handle_get_height(handle);
      if (overInputLimits(width, height)) throw new DecodeFailure('tooManyPixels', `${width}x${height}`);
      const image = h.heif_js_decode_image2(handle, h.heif_colorspace.heif_colorspace_RGB, h.heif_chroma.heif_chroma_interleaved_RGBA);
      if (!image || isError(image)) throw failure(image, 'decode');
      try {
        const plane = image.channels.find((c) => num(c.id) === num(h.heif_channel.heif_channel_interleaved));
        if (!plane || plane.width !== width || plane.height !== height || plane.stride < width * 4) {
          throw new DecodeFailure('decode', 'unexpected pixel layout');
        }
        const out = new Uint8ClampedArray(width * height * 4);
        const row = width * 4;
        if (plane.stride === row) out.set(plane.data.subarray(0, row * height));
        else for (let y = 0; y < height; y++) out.set(plane.data.subarray(y * plane.stride, y * plane.stride + row), y * row);
        return { width, height, data: out.buffer };
      } finally {
        h.heif_image_release(image.image);
      }
    } finally {
      h.heif_image_handle_release(handle);
    }
  } finally {
    h.heif_context_free(ctx);
  }
}

function post(msg: HeicResponse, transfer: Transferable[] = []) {
  self.postMessage(msg, transfer);
}

self.onmessage = async (event: MessageEvent<HeicRequest>) => {
  const { id, file } = event.data;
  let h: LibHeif;
  try {
    h = await (library ??= loadLibrary());
  } catch (e) {
    library = null;
    return post({ id, ok: false, code: 'wasmUnavailable', detail: String(e), fatal: true });
  }
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const r = decode(h, bytes);
    post({ id, ok: true, ...r }, [r.data]);
  } catch (e) {
    if (e instanceof DecodeFailure) return post({ id, ok: false, code: e.code, detail: e.detail });
    // A WebAssembly trap or out-of-memory abort leaves the instance unusable.
    post({ id, ok: false, code: 'decode', detail: String(e), fatal: true });
  }
};
