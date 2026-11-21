// The Vite build prepends these constants to the standalone classic worker.
declare const buildId: string;
declare const precache: ReadonlyArray<readonly [path: string, integrity: string]>;

const sw = globalThis as unknown as ServiceWorkerGlobalScope;
const scope = new URL(sw.registration.scope);
const entry = new URL('index.html', scope);
const files = new Map(precache.map(([path, integrity]) => [new URL(path, scope).href, integrity]));
const cacheName = `inkdoze-offline-${buildId}`;
const inkdozeCache = /^inkdoze-offline-[a-f0-9]{64}$/;

function usable(url: string, response: Response | undefined): response is Response {
  if (!response || response.status !== 200) return false;
  const mime = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (url.endsWith('.js') || url.endsWith('.mjs')) return mime === 'text/javascript' || mime === 'application/javascript';
  if (url.endsWith('.css')) return mime === 'text/css';
  if (url.endsWith('.html')) return mime === 'text/html';
  if (url.endsWith('.wasm')) return mime === 'application/wasm';
  if (url.endsWith('.svg')) return mime === 'image/svg+xml';
  return true;
}

const lookup = (url: string) => caches.match(url, { cacheName });

async function hasBuild(): Promise<boolean> {
  const present = await Promise.all(Array.from(files.keys(), async (url) => usable(url, await lookup(url))));
  return present.every(Boolean);
}

let preparation: Promise<void> | undefined;

async function saveBuild(): Promise<void> {
  if (await hasBuild()) return;
  const cache = await caches.open(cacheName);
  const download = new AbortController();
  const requests = Array.from(files, ([url, integrity]) => new Request(url, {
    integrity,
    mode: 'same-origin',
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    signal: download.signal,
  }));
  const timeout = setTimeout(() => download.abort(), 60_000);
  // addAll commits the batch together. Integrity rejects fallback HTML, stale
  // files and truncated responses even when the server replies with HTTP 200.
  try {
    await cache.addAll(requests);
    if (!await hasBuild()) throw new Error('InkDoze assets were served with unexpected headers.');
  } catch (error) {
    // Discard only this incomplete build, including batches with bad headers.
    // A complete cache of the same build can be reused on a deployment rollback.
    if (!await hasBuild().catch(() => true)) await caches.delete(cacheName).catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function prepareBuild(): Promise<void> {
  return preparation ??= saveBuild().finally(() => { preparation = undefined; });
}

sw.addEventListener('install', (event) => {
  event.waitUntil(prepareBuild());
});

sw.addEventListener('activate', (event) => {
  // There are no clients of the previous active worker at this point. Claim
  // the tab that prepared the first build so its lazy imports use this cache too.
  event.waitUntil(sw.clients.claim());
  event.waitUntil((async () => {
    const names = await caches.keys();
    // The previous worker has no clients left. A concurrent install, if any,
    // may already have staged its own cache and can do the cleanup when it activates.
    if (sw.registration.installing || sw.registration.waiting) return;
    await Promise.all(names.filter((name) => name !== cacheName && inkdozeCache.test(name)).map((name) => caches.delete(name)));
  })().catch(() => undefined));
});

sw.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isEntry = request.mode === 'navigate' && url.origin === scope.origin
    && (url.pathname === scope.pathname || url.pathname === entry.pathname);
  if (request.mode === 'navigate' && !isEntry) return;
  const key = isEntry ? entry.href : url.href;
  const integrity = files.get(key);
  if (!integrity) return;
  event.respondWith((async () => {
    const cached = await lookup(key).catch(() => undefined);
    if (usable(key, cached)) return cached;
    // A visit can recover online after eviction. A missing subresource still
    // has to match this worker's version, even if its filename is stable.
    // eslint-disable-next-line no-restricted-globals -- pass through only the matched static request
    return fetch(request, isEntry ? undefined : { integrity, redirect: 'error' });
  })());
});

sw.addEventListener('message', (event) => {
  const port = event.ports[0];
  if (!port || (event.data !== 'inkdoze-offline-status' && event.data !== 'inkdoze-offline-prepare')) return;
  event.waitUntil((async () => {
    try {
      if (event.data === 'inkdoze-offline-prepare') await prepareBuild();
      const complete = await hasBuild();
      port.postMessage(complete ? 'ready' : 'idle');
    } catch (error) {
      const storage = event.data === 'inkdoze-offline-status' || (error instanceof DOMException
        && ['QuotaExceededError', 'SecurityError', 'NotAllowedError'].includes(error.name));
      port.postMessage(storage ? 'storage' : 'error');
    }
  })());
});
