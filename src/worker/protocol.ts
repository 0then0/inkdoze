import type { OutputFormat } from '../catalog/types.ts';
import type { RenderJob } from '../pipeline/types.ts';

/**
 * - `heicVariant`: a HEIF file that is not a supported HEIC still photo.
 * - `wasmUnavailable`: the WebAssembly HEIC decoder could not be loaded or started.
 */
export type LoadError = 'unsupported' | 'corrupt' | 'tooManyPixels' | 'decode' | 'heicVariant' | 'wasmUnavailable';

/** How a HEIC photo was decoded: by the browser, or by the bundled WebAssembly decoder. */
export type HeicDecoder = 'native' | 'wasm';

export type WorkerRequest =
  | { type: 'load'; reqId: number; imageId: string; file: Blob }
  | { type: 'preview'; reqId: number; imageId: string; job: RenderJob }
  | { type: 'export'; reqId: number; imageId: string; job: RenderJob; format: OutputFormat; jpegQuality: number }
  | { type: 'release'; reqId: number; imageId: string };

export type WorkerResponse =
  | { type: 'loaded'; reqId: number; width: number; height: number; thumbnail: Blob; decoder?: HeicDecoder }
  | { type: 'preview'; reqId: number; bitmap: ImageBitmap; width: number; height: number }
  | { type: 'exported'; reqId: number; blob: Blob; width: number; height: number }
  | { type: 'released'; reqId: number }
  | { type: 'error'; reqId: number; code: LoadError | 'missing' | 'render'; detail?: string };

/** Render worker → HEIC decoder worker. */
export interface HeicRequest {
  id: number;
  file: Blob;
}

/** HEIC decoder worker → render worker. `data` is transferred RGBA, row by row without padding. */
export type HeicResponse =
  | { id: number; ok: true; width: number; height: number; data: ArrayBuffer }
  | { id: number; ok: false; code: LoadError; detail?: string; fatal?: boolean };
