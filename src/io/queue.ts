export class AbortedError extends Error {
  constructor() {
    super('Aborted');
    this.name = 'AbortError';
  }
}

export function isAbort(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError';
}

/**
 * Runs async tasks with a fixed number of slots. Tasks waiting for a slot are
 * dropped when their signal aborts; running tasks receive the signal and should
 * stop at their next checkpoint.
 */
export class TaskQueue {
  private active = 0;
  private waiting: Array<{ start: () => void; signal: AbortSignal | undefined; reject: (e: unknown) => void }> = [];

  private readonly concurrency: number;

  constructor(concurrency: number) {
    if (concurrency < 1) throw new RangeError('concurrency must be >= 1');
    this.concurrency = concurrency;
  }

  get running(): number {
    return this.active;
  }

  get queued(): number {
    return this.waiting.length;
  }

  run<T>(task: (signal: AbortSignal | undefined) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) return Promise.reject(new AbortedError());
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        if (signal?.aborted) {
          reject(new AbortedError());
          this.release();
          return;
        }
        this.active++;
        task(signal)
          .then(resolve, reject)
          .finally(() => {
            this.active--;
            this.release();
          });
      };
      const entry = { start, signal, reject };
      const onAbort = () => {
        const i = this.waiting.indexOf(entry);
        if (i >= 0) {
          this.waiting.splice(i, 1);
          reject(new AbortedError());
        }
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (this.active < this.concurrency) start();
      else this.waiting.push(entry);
    });
  }

  private release() {
    while (this.active < this.concurrency && this.waiting.length > 0) {
      const next = this.waiting.shift();
      if (next && !next.signal?.aborted) {
        next.start();
        return;
      }
      next?.reject(new AbortedError());
    }
  }
}
