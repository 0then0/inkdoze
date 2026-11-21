const SCOPE = '/inkdoze/';
const SCRIPT = `${SCOPE}sw.js`;

type WorkerStatus = 'ready' | 'idle' | 'storage' | 'error';
export type OfflineStatus = WorkerStatus | 'unsupported' | 'waiting';

export function isOfflinePage(): boolean {
  return import.meta.env.PROD && (location.pathname === SCOPE || location.pathname === `${SCOPE}index.html`);
}

function newest(registration: ServiceWorkerRegistration): ServiceWorker | null {
  return registration.installing ?? registration.waiting ?? registration.active;
}

function activation(registration: ServiceWorkerRegistration, worker: ServiceWorker): Promise<'activated' | 'waiting'> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(), 90_000);
    function finish(state?: 'activated' | 'waiting') {
      clearTimeout(timer);
      worker.removeEventListener('statechange', check);
      if (state) resolve(state);
      else reject(new Error('Offline worker did not activate.'));
    }
    function check() {
      if (worker.state === 'activated' && registration.active === worker) finish('activated');
      else if (worker.state === 'installed' && registration.active && registration.active !== worker) finish('waiting');
      else if (worker.state === 'redundant') finish();
    }
    worker.addEventListener('statechange', check);
    check();
  });
}

function askWorker(worker: ServiceWorker, prepare: boolean): Promise<WorkerStatus> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();
    const timer = setTimeout(() => finish('error'), prepare ? 90_000 : 10_000);
    function finish(state: WorkerStatus) {
      clearTimeout(timer);
      port1.close();
      resolve(state);
    }
    port1.onmessage = ({ data }) => finish(data === 'ready' || data === 'idle' || data === 'storage' ? data : 'error');
    try {
      worker.postMessage(prepare ? 'inkdoze-offline-prepare' : 'inkdoze-offline-status', [port2]);
    } catch {
      finish('error');
    }
  });
}

export async function offlineStatus(prepare = false): Promise<OfflineStatus> {
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in globalThis) || typeof WebAssembly !== 'object') return 'unsupported';
  try {
    await caches.keys();
  } catch {
    return 'storage';
  }

  try {
    const serviceWorkers = navigator.serviceWorker;
    const existing = await serviceWorkers.getRegistration(SCOPE);
    let registration = existing?.scope === new URL(SCOPE, location.origin).href ? existing : undefined;
    let worker = registration && newest(registration);
    if (worker && worker.scriptURL !== new URL(SCRIPT, location.origin).href) return 'unsupported';

    if (prepare) {
      if (!registration || !worker) {
        registration = await serviceWorkers.register(SCRIPT, { scope: SCOPE, updateViaCache: 'none' });
        worker = newest(registration);
      } else if (worker.state === 'activated') {
        // update() can resolve before installation succeeds. Keep the candidate
        // so an install failure cannot be mistaken for readiness of the old worker.
        const current = registration;
        let candidate: ServiceWorker | null = null;
        const found = () => { candidate = current.installing; };
        current.addEventListener('updatefound', found);
        try {
          await current.update();
          worker = candidate ?? newest(current);
        } finally {
          current.removeEventListener('updatefound', found);
        }
      }
    }

    if (!registration || !worker) return prepare ? 'error' : 'idle';
    if (await activation(registration, worker) === 'waiting') return 'waiting';
    return await askWorker(worker, prepare);
  } catch (error) {
    return error instanceof DOMException && error.name === 'SecurityError' ? 'unsupported' : 'error';
  }
}
