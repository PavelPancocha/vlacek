/** Injected by the build from the final dist bytes; this worker has no imports. */
declare const __PRECACHE__: {
  buildId: string;
  version: string;
  base: string;
  files: { url: string; sha256: string }[];
};
// This entry runs exclusively in a service worker, with its own WebWorker TS project.
const sw = self as unknown as ServiceWorkerGlobalScope;
const bundle = __PRECACHE__;
const prefix = `vlacek:${bundle.base}:`;
const cacheName = `${prefix}${bundle.buildId}:${bundle.version}`;
const markerUrl = new URL(
  `${bundle.base}__offline_complete__`,
  sw.location.origin,
).href;
const shellUrl = `${bundle.base}index.html`;

async function digest(response: Response): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    await response.arrayBuffer(),
  );
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function complete(verifyHashes = false): Promise<boolean> {
  if (!(await caches.has(cacheName))) return false;
  const cache = await caches.open(cacheName);
  if (!(await cache.match(markerUrl))) return false;
  const keys = new Set(
    (await cache.keys()).map((key) => new URL(key.url).pathname),
  );
  if (!bundle.files.every((file) => keys.has(file.url))) return false;
  if (verifyHashes)
    for (const file of bundle.files) {
      const response = await cache.match(file.url);
      if (
        !response?.ok ||
        response.redirected ||
        (await digest(response)) !== file.sha256
      )
        return false;
    }
  return true;
}

function workerCache(worker: ServiceWorker): Promise<string | undefined> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const finish = (name?: string) => {
      clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      resolve(name);
    };
    // An older/foreign worker may not answer; unknown ownership preserves the cache.
    const timeout = setTimeout(() => finish(), 5_000);
    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      const value = event.data;
      finish(
        typeof value === 'object' &&
          value !== null &&
          'buildId' in value &&
          typeof value.buildId === 'string' &&
          'version' in value &&
          typeof value.version === 'string'
          ? `${prefix}${value.buildId}:${value.version}`
          : undefined,
      );
    };
    try {
      worker.postMessage('offline-status', [channel.port2]);
    } catch {
      finish();
    }
  });
}

async function cacheInUse(): Promise<boolean> {
  const owners = [sw.registration.active, sw.registration.waiting];
  for (const worker of owners) {
    if (!worker) continue;
    const name = await workerCache(worker);
    if (name === undefined || name === cacheName) return true;
  }
  return (
    owners[0] !== sw.registration.active ||
    owners[1] !== sw.registration.waiting
  );
}

sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const existed = await caches.has(cacheName);
      if (await complete(true)) return;
      const cache = await caches.open(cacheName);
      try {
        // Sequential downloads bound memory and make failure cleanup deterministic.
        for (const file of bundle.files) {
          const url = new URL(file.url, sw.location.origin);
          url.searchParams.set('__bundle', bundle.version);
          const response = await fetch(url, { cache: 'no-store' });
          if (
            !response.ok ||
            response.redirected ||
            (await digest(response.clone())) !== file.sha256
          )
            throw new Error(`Incomplete offline bundle: ${file.url}`);
          await cache.put(file.url, response);
        }
        await cache.put(
          markerUrl,
          new Response(
            JSON.stringify({
              buildId: bundle.buildId,
              version: bundle.version,
              completedAt: Date.now(),
            }),
          ),
        );
      } catch (error) {
        if (!existed && !(await cacheInUse()) && !(await complete()))
          await caches.delete(cacheName);
        throw error;
      }
    })(),
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (!(await complete()))
        throw new Error('Cannot activate incomplete bundle');
      const previous: { name: string; completedAt: number }[] = [];
      for (const name of await caches.keys()) {
        if (!name.startsWith(prefix) || name === cacheName) continue;
        const cache = await caches.open(name);
        const marker = await cache.match(markerUrl);
        const value: unknown = marker ? await marker.json() : undefined;
        if (
          typeof value === 'object' &&
          value !== null &&
          'completedAt' in value &&
          typeof value.completedAt === 'number'
        )
          previous.push({ name, completedAt: value.completedAt });
      }
      previous.sort((a, b) => b.completedAt - a.completedAt);
      const keep = previous[0]?.name;
      for (const name of await caches.keys())
        if (name.startsWith(prefix) && name !== cacheName && name !== keep)
          await caches.delete(name);
      // Standard waiting lifecycle: neither skipWaiting nor clients.claim.
    })(),
  );
});

async function navigation(request: Request): Promise<Response> {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request, { cache: 'no-store' });
    const shell = bundle.files.find((file) => file.url === shellUrl);
    // An old controller must never serve the new build's HTML with old assets.
    if (
      response.ok &&
      shell &&
      (await digest(response.clone())) === shell.sha256
    )
      return response;
  } catch {
    /* Offline: use this worker's matching shell. */
  }
  const cached = await cache.match(shellUrl);
  return (
    cached ?? new Response('Offline balík není dostupný.', { status: 503 })
  );
}

sw.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== sw.location.origin) return;
  if (
    event.request.mode === 'navigate' &&
    (url.pathname === bundle.base || url.pathname === shellUrl)
  ) {
    event.respondWith(navigation(event.request));
  } else if (
    event.request.method === 'GET' &&
    bundle.files.some((file) => file.url === url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(cacheName);
        return (await cache.match(url.pathname)) ?? fetch(event.request);
      })(),
    );
  }
});

sw.addEventListener('message', (event) => {
  if (event.data !== 'offline-status' || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil(
    (async () => {
      port.postMessage({
        ready: await complete(),
        buildId: bundle.buildId,
        version: bundle.version,
      });
    })(),
  );
});
