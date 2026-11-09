import type { OutputFormat } from '../catalog/types.ts';
import type { RenderJob } from '../pipeline/types.ts';

export type LoadError = 'unsupported' | 'corrupt' | 'tooManyPixels' | 'decode';

export type WorkerRequest =
  | { type: 'load'; reqId: number; imageId: string; file: Blob }
  | { type: 'preview'; reqId: number; imageId: string; job: RenderJob }
  | { type: 'export'; reqId: number; imageId: string; job: RenderJob; format: OutputFormat; jpegQuality: number }
  | { type: 'release'; reqId: number; imageId: string };

export type WorkerResponse =
  | { type: 'loaded'; reqId: number; width: number; height: number; thumbnail: Blob }
  | { type: 'preview'; reqId: number; bitmap: ImageBitmap; width: number; height: number }
  | { type: 'exported'; reqId: number; blob: Blob; width: number; height: number }
  | { type: 'released'; reqId: number }
  | { type: 'error'; reqId: number; code: LoadError | 'missing' | 'render'; detail?: string };
