import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { MessageChannel, type MessagePort } from 'node:worker_threads';
import { transpileModule, ScriptTarget, ModuleKind } from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { precacheBundle } from '../../../scripts/pwa/bundle.ts';

const origin = 'https://game.example';
const source = transpileModule(
  readFileSync('src/service-worker/worker.ts', 'utf8'),
  { compilerOptions: { target: ScriptTarget.ES2022, module: ModuleKind.None } },
).outputText;
const release = (id: string) => {
  const files = [
    { path: 'index.html', bytes: Buffer.from(`<h1>${id}</h1>`) },
    { path: 'assets/train.svg', bytes: Buffer.from(`<svg>${id}</svg>`) },
  ];
  const bundle = precacheBundle(files, '/vlacek/', id);
  return {
    bundle,
    cacheName: `vlacek:${bundle.base}:${id}:${bundle.version}`,
    files: new Map(files.map((file) => [bundle.base + file.path, file.bytes])),
  };
};
type Release = ReturnType<typeof release>;
type CacheKey = string | { url: string };
const cacheUrl = (key: CacheKey) =>
  new URL(typeof key === 'string' ? key : key.url, origin).href;

class MemoryCache {
  readonly entries = new Map<string, Response>();
  match(key: CacheKey) {
    return Promise.resolve(this.entries.get(cacheUrl(key))?.clone());
  }
  keys() {
    return Promise.resolve(
      [...this.entries.keys()].map((url) => new Request(url)),
    );
  }
  put(key: CacheKey, response: Response) {
    this.entries.set(cacheUrl(key), response.clone());
    return Promise.resolve();
  }
  delete(key: CacheKey) {
    return Promise.resolve(this.entries.delete(cacheUrl(key)));
  }
}

interface WorkerHandle {
  postMessage(data: unknown, ports: MessagePort[]): void;
}
interface WorkerEvent {
  waitUntil(promise: Promise<unknown>): void;
  respondWith(promise: Promise<Response>): void;
}

/** Executes the real worker; only browser storage, network and lifecycle are supplied. */
function browser() {
  const stores = new Map<string, MemoryCache>();
  const registration: {
    active: WorkerHandle | null;
    waiting: WorkerHandle | null;
  } = { active: null, waiting: null };
  let hosted = release('A');
  let fault: 'offline' | 'mismatch' | 'write' | undefined;
  const storage = {
    has: (name: string) => Promise.resolve(stores.has(name)),
    keys: () => Promise.resolve([...stores.keys()]),
    delete: vi.fn((name: string) => Promise.resolve(stores.delete(name))),
    open: (name: string) => {
      let cache = stores.get(name);
      if (!cache) {
        cache = new MemoryCache();
        stores.set(name, cache);
      }
      const target = cache;
      return Promise.resolve({
        match: target.match.bind(target),
        keys: target.keys.bind(target),
        delete: target.delete.bind(target),
        put: async (key: CacheKey, response: Response) => {
          if (fault === 'write') throw new Error('Cache write failed');
          await target.put(key, response);
        },
      });
    },
  };
  const fetch = vi.fn((input: CacheKey | URL) => {
    if (fault === 'offline')
      return Promise.reject(new Error('Network interrupted'));
    const url = new URL(
      input instanceof URL
        ? input.href
        : typeof input === 'string'
          ? input
          : input.url,
      origin,
    );
    const bytes = hosted.files.get(url.pathname);
    return Promise.resolve(
      new Response(fault === 'mismatch' ? 'Wrong release' : bytes, {
        status: bytes ? 200 : 404,
      }),
    );
  });
  const worker = (version: Release) => {
    const listeners = new Map<string, (event: WorkerEvent) => void>();
    new Script(source).runInNewContext({
      __PRECACHE__: version.bundle,
      self: {
        location: { origin },
        registration,
        addEventListener: (
          type: string,
          listener: (event: WorkerEvent) => void,
        ) => listeners.set(type, listener),
      },
      caches: storage,
      crypto: globalThis.crypto,
      URL,
      Response,
      Uint8Array,
      MessageChannel,
      setTimeout,
      clearTimeout,
      fetch,
    });
    const dispatch = async (type: string, details: object = {}) => {
      let lifetime: Promise<unknown> = Promise.resolve();
      let response: Promise<Response> | undefined;
      listeners.get(type)?.({
        ...details,
        waitUntil: (promise) => {
          lifetime = promise;
        },
        respondWith: (promise) => {
          response = promise;
        },
      });
      await lifetime;
      return response;
    };
    return {
      install: () => dispatch('install'),
      activate: () => dispatch('activate'),
      postMessage: (data: unknown, ports: MessagePort[]) => {
        void dispatch('message', { data, ports });
      },
      navigate: () =>
        dispatch('fetch', {
          request: {
            url: `${origin}/vlacek/`,
            mode: 'navigate',
            method: 'GET',
          },
        }),
    };
  };
  return {
    stores,
    storage,
    registration,
    fetch,
    worker,
    host: (version: Release) => {
      hosted = version;
    },
    fail: (value: typeof fault) => {
      fault = value;
    },
  };
}

describe('PWA-03/11 rollback cache ownership', () => {
  it('invalidates a corrupt active cache marker before a failed repair', async () => {
    const env = browser();
    const a = release('A');
    const active = env.worker(a);
    await active.install();
    env.registration.active = active;
    const cache = env.stores.get(a.cacheName);
    if (!cache) throw new Error('A cache missing');
    await cache.put('/vlacek/assets/train.svg', new Response('Corrupt'));
    env.fail('offline');

    await expect(env.worker(a).install()).rejects.toThrow(
      'Network interrupted',
    );
    expect(env.stores.get(a.cacheName)).toBe(cache);
    expect(await cache.match('/vlacek/__offline_complete__')).toBeUndefined();
    const channel = new MessageChannel();
    try {
      const status = new Promise<unknown>((resolve) =>
        channel.port1.once('message', resolve),
      );
      active.postMessage('offline-status', [channel.port2]);
      await expect(status).resolves.toMatchObject({ ready: false });
    } finally {
      channel.port1.close();
      channel.port2.close();
    }
  });

  it('activates and removes a stale cache with an unreadable completion marker', async () => {
    const env = browser();
    const a = release('A');
    await env.worker(a).install();
    const b = release('B');
    env.host(b);
    const current = env.worker(b);
    await current.install();
    const staleName = 'vlacek:/vlacek/:stale:invalid';
    for (const name of [staleName, 'another-app']) {
      const cache = await env.storage.open(name);
      await cache.put(
        '/vlacek/__offline_complete__',
        new Response('{"completedAt":'),
      );
    }

    await expect(current.activate()).resolves.toBeUndefined();
    expect(env.stores.has(staleName)).toBe(false);
    expect(env.stores.has(a.cacheName)).toBe(true);
    expect(env.stores.has(b.cacheName)).toBe(true);
    expect(env.stores.has('another-app')).toBe(true);
  });

  for (const failure of ['offline', 'mismatch', 'write'] as const)
    it(`A active → B waiting → rollback A preserves its complete cache despite ${failure}`, async () => {
      const env = browser();
      const a = release('A');
      const b = release('B');
      const active = env.worker(a);
      await active.install();
      await active.activate();
      env.registration.active = active;
      env.host(b);
      const waiting = env.worker(b);
      await waiting.install();
      env.registration.waiting = waiting;
      const original = env.stores.get(a.cacheName);
      env.host(a);
      env.fail(failure);
      env.fetch.mockClear();
      const outcome = await env
        .worker(a)
        .install()
        .then(
          () => 'installed',
          () => 'failed',
        );
      expect(env.stores.has(a.cacheName)).toBe(true);
      expect(env.stores.get(a.cacheName)).toBe(original);
      expect(outcome).toBe('installed');
      expect(env.fetch).not.toHaveBeenCalled();
      env.fail('offline');
      const response = await active.navigate();
      expect(response?.status).toBe(200);
      expect(await response?.text()).toBe('<h1>A</h1>');
      expect(env.stores.has(b.cacheName)).toBe(true);
    });

  for (const corruption of ['marker', 'missing entry', 'wrong hash'])
    it(`does not reuse a cache with ${corruption}, and failed repair preserves it`, async () => {
      const env = browser();
      const a = release('A');
      const active = env.worker(a);
      await active.install();
      env.registration.active = active;
      const cache = env.stores.get(a.cacheName);
      if (!cache) throw new Error('A cache missing');
      if (corruption === 'marker')
        cache.entries.delete(`${origin}/vlacek/__offline_complete__`);
      else if (corruption === 'missing entry')
        cache.entries.delete(`${origin}/vlacek/assets/train.svg`);
      else await cache.put('/vlacek/assets/train.svg', new Response('Corrupt'));
      env.fail('offline');
      env.fetch.mockClear();
      await expect(env.worker(a).install()).rejects.toThrow(
        'Network interrupted',
      );
      expect(env.fetch).toHaveBeenCalled();
      expect(env.stores.get(a.cacheName)).toBe(cache);
      expect(env.storage.delete).not.toHaveBeenCalledWith(a.cacheName);
    });

  for (const owner of ['active', 'waiting'] as const)
    it(`never deletes a recreated cache used by the ${owner} worker`, async () => {
      const env = browser();
      const a = release('A');
      env.registration[owner] = env.worker(a);
      env.fail('offline');
      await expect(env.worker(a).install()).rejects.toThrow(
        'Network interrupted',
      );
      expect(env.stores.has(a.cacheName)).toBe(true);
      expect(env.storage.delete).not.toHaveBeenCalledWith(a.cacheName);
    });

  it('removes its own failed new bundle and preserves the active release', async () => {
    const env = browser();
    const a = release('A');
    const active = env.worker(a);
    await active.install();
    env.registration.active = active;
    const b = release('B');
    env.host(b);
    env.fail('offline');
    await expect(env.worker(b).install()).rejects.toThrow(
      'Network interrupted',
    );
    expect(env.stores.has(b.cacheName)).toBe(false);
    expect(env.stores.has(a.cacheName)).toBe(true);
  });

  it('preserves a cache completed before a late installation failure', async () => {
    const env = browser();
    const a = release('A');
    env.fetch.mockImplementationOnce(async () => {
      const cache = await env.storage.open(a.cacheName);
      for (const [path, bytes] of a.files)
        await cache.put(path, new Response(bytes.toString()));
      await cache.put(
        '/vlacek/__offline_complete__',
        new Response(
          JSON.stringify({
            buildId: a.bundle.buildId,
            version: a.bundle.version,
            completedAt: 1,
          }),
        ),
      );
      throw new Error('Late failure');
    });
    await expect(env.worker(a).install()).rejects.toThrow('Late failure');
    expect(env.stores.has(a.cacheName)).toBe(true);
    expect(env.storage.delete).not.toHaveBeenCalled();
  });

  it('preserves the cache when an existing worker reports unknown ownership', async () => {
    const env = browser();
    const a = release('A');
    env.registration.active = {
      postMessage: (_data, ports) => ports[0]?.postMessage({}),
    };
    env.fail('offline');
    await expect(env.worker(a).install()).rejects.toThrow(
      'Network interrupted',
    );
    expect(env.stores.has(a.cacheName)).toBe(true);
    expect(env.storage.delete).not.toHaveBeenCalled();
  });

  it('bounds an unanswered ownership request and preserves the cache', async () => {
    vi.useFakeTimers();
    try {
      const env = browser();
      const a = release('A');
      env.registration.active = { postMessage: () => {} };
      env.fail('offline');
      const failed = expect(env.worker(a).install()).rejects.toThrow(
        'Network interrupted',
      );
      await vi.advanceTimersByTimeAsync(5_000);
      await failed;
      expect(env.stores.has(a.cacheName)).toBe(true);
      expect(env.storage.delete).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
