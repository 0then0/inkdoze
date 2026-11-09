import type { OutputFormat } from '../catalog/types.ts';
import { AbortedError } from '../io/queue.ts';
import type { RenderJob } from '../pipeline/types.ts';
import type { WorkerRequest, WorkerResponse } from './protocol.ts';

type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: unknown) => void };
type Distributive<T> = T extends unknown ? Omit<T, 'reqId'> : never;

export class WorkerError extends Error {
  readonly code: string;
  readonly detail: string | undefined;

  constructor(code: string, detail?: string) {
    super(`${code}${detail ? `: ${detail}` : ''}`);
    this.name = 'WorkerError';
    this.code = code;
    this.detail = detail;
  }
}

/** Promise wrapper around the render worker. Abandoned results are released. */
export class RenderClient {
  private readonly worker: Worker;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL('./render.worker.ts', import.meta.url), { type: 'module', name: 'inkdoze-render' });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.reqId);
      if (!p) {
        if (msg.type === 'preview') msg.bitmap.close();
        return;
      }
      this.pending.delete(msg.reqId);
      if (msg.type === 'error') p.reject(new WorkerError(msg.code, msg.detail));
      else p.resolve(msg);
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new WorkerError('render', e.message));
      this.pending.clear();
    };
  }

  private request(msg: Distributive<WorkerRequest>, signal?: AbortSignal): Promise<WorkerResponse> {
    if (signal?.aborted) return Promise.reject(new AbortedError());
    const reqId = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      signal?.addEventListener(
        'abort',
        () => {
          if (this.pending.delete(reqId)) reject(new AbortedError());
        },
        { once: true },
      );
      this.worker.postMessage({ ...msg, reqId } as WorkerRequest);
    });
  }

  async load(imageId: string, file: Blob, signal?: AbortSignal) {
    const r = await this.request({ type: 'load', imageId, file }, signal);
    if (r.type !== 'loaded') throw new WorkerError('render');
    return r;
  }

  async preview(imageId: string, job: RenderJob, signal?: AbortSignal) {
    const r = await this.request({ type: 'preview', imageId, job }, signal);
    if (r.type !== 'preview') throw new WorkerError('render');
    return r;
  }

  async export(imageId: string, job: RenderJob, format: OutputFormat, jpegQuality: number, signal?: AbortSignal) {
    const r = await this.request({ type: 'export', imageId, job, format, jpegQuality }, signal);
    if (r.type !== 'exported') throw new WorkerError('render');
    return r;
  }

  release(imageId: string): void {
    void this.request({ type: 'release', imageId }).catch(() => undefined);
  }
}
