import { afterEach, describe, expect, it, vi } from 'vitest';
import * as svgSources from './svgSource.ts';
import { TextureMemory } from './TextureMemory.ts';
import { ArtAtlas, type ArtAtlasOptions } from './ArtAtlas.ts';
import type Phaser from 'phaser';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
class SourceImage {
  removeAttribute = vi.fn();
}
function setup(
  sizeU = 20,
  options: Partial<ArtAtlasOptions> = {},
  smallParts = 0,
) {
  const drawImage = vi.fn();
  const canvases: { width: number; height: number }[] = [];
  const memory = new TextureMemory();
  const addCanvas = vi.fn((key: string, canvas: unknown) => {
    textures.set(key, canvas);
    return { add() {} };
  });
  vi.stubGlobal('HTMLImageElement', SourceImage);
  vi.stubGlobal('HTMLCanvasElement', SourceImage);
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = Object.assign(new SourceImage(), {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
      });
      canvases.push(canvas);
      return canvas;
    },
  });
  const textures = new Map<string, unknown>([
    ['art-source:one', new SourceImage()],
    ['art-source:two', new SourceImage()],
  ]);
  const scene = {
    game: { renderer: {} },
    textures: {
      exists: (key: string) => textures.has(key),
      get: (key: string) => ({ getSourceImage: () => textures.get(key) }),
      remove: (key: string) => textures.delete(key),
      addCanvas,
      getFrame: () => ({
        cutX: 1,
        cutY: 1,
        source: { width: 2048, height: 2048 },
      }),
      create: (key: string, canvas: unknown) => {
        textures.set(key, canvas);
        return { add() {} };
      },
    },
  };
  // Test boundary implements only the texture API consumed by ArtAtlas.
  const atlas = new ArtAtlas(
    scene as unknown as Phaser.Scene,
    [
      ...['one', 'two'].map((key) => ({
        key,
        url: key,
        widthU: sizeU,
        heightU: sizeU,
      })),
      ...Array.from({ length: smallParts }, (_, i) => ({
        key: `tiny-${i}`,
        url: `tiny-${i}`,
        widthU: 1,
        heightU: 1,
      })),
    ],
    { maxPxPerU: 2, texturePrefix: 'test@', memory, ...options },
  );
  return { atlas, textures, drawImage, memory, addCanvas, canvases };
}

describe('D-030 asynchronous atlas ownership', () => {
  it('keeps the active texture until commit and releases both buffers on destroy', async () => {
    const { atlas, textures } = setup();
    await atlas.prepare(['one'], 1);
    expect(atlas.textureKey).toBeUndefined();
    atlas.commitPrepared();
    const first = atlas.textureKey;
    expect(first).toBeDefined();
    await atlas.prepare(['one', 'two'], 1);
    expect(atlas.textureKey).toBe(first);
    expect(textures.size).toBe(2);
    const old = atlas.commitPrepared();
    expect(atlas.textureKey).not.toBe(first);
    old.forEach((key) => atlas.release(key));
    expect(textures.size).toBe(1);
    atlas.destroy();
    expect(textures.size).toBe(0);
  });
  it('releases a partially uploaded failed buffer and preserves the active page', async () => {
    const { atlas, textures, drawImage } = setup(1400);
    await atlas.prepare(['one'], 1);
    atlas.commitPrepared();
    const first = atlas.textureKey;
    drawImage
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('raster lost');
      });
    await expect(atlas.prepare(['one', 'two'], 1)).rejects.toThrow(
      'raster lost',
    );
    expect(atlas.textureKey).toBe(first);
    expect(textures.size).toBe(1);
    expect(atlas.ready).toBe(false);
    expect(atlas.pendingCanvasBytes).toBe(0);
    atlas.destroy();
    expect(textures.size).toBe(0);
  });
  it('prepares independently of throttled or unavailable timers', async () => {
    const { atlas } = setup();
    vi.stubGlobal('setTimeout', () => {
      throw new Error('timer scheduler unavailable');
    });
    await expect(atlas.prepare(['one', 'two'], 1)).resolves.toBeUndefined();
    expect(atlas.ready).toBe(true);
    atlas.destroy();
  });
  it('keeps texture ownership bounded over twenty successive windows', async () => {
    const { atlas, textures } = setup(1050);
    for (let window = 0; window < 20; window++) {
      await atlas.prepare(window % 2 ? ['one'] : ['one', 'two'], 1);
      expect(textures.size).toBeLessThanOrEqual(4);
      atlas.commitPrepared().forEach((key) => atlas.release(key));
      expect(textures.size).toBe(window % 2 ? 1 : 2);
    }
    atlas.destroy();
    expect(textures.size).toBe(0);
  });
  it('cancels an unfinished build on destroy without resurrecting textures', async () => {
    const { atlas, textures } = setup();
    const pending = atlas.prepare(['one', 'two'], 2);
    atlas.destroy();
    await pending;
    expect(textures.size).toBe(0);
  });
});

it('records old/new allocation overlap before release and uses immutable textures without ImageData copies', async () => {
  const { atlas, memory, addCanvas } = setup();
  await atlas.prepare(['one'], 1);
  atlas.commitPrepared();
  const first = memory.snapshot.bytes;
  await atlas.prepare(['one', 'two'], 1);
  expect(memory.snapshot.highWaterBytes).toBeGreaterThan(first);
  expect(addCanvas).not.toHaveBeenCalled();
  atlas.commitPrepared().forEach((key) => atlas.release(key));
  const high = memory.snapshot.highWaterBytes;
  expect(high).toBeGreaterThan(memory.snapshot.bytes);
  expect(memory.snapshot.imageData).toBe(0);
  atlas.destroy();
  expect(memory.snapshot.bytes).toBe(0);
});

it('copies unchanged parts from the live page instead of rasterising SVG again on a region rebuild', async () => {
  const { atlas, textures, drawImage } = setup();
  await atlas.prepare(['one'], 1);
  atlas.commitPrepared();
  const old = textures.get(atlas.textureKey ?? '');
  drawImage.mockClear();
  await atlas.prepare(['one', 'two'], 1);
  expect(drawImage.mock.calls.some((call) => call[0] === old)).toBe(true);
  atlas.destroy();
});

it('discards a synchronous vehicle paint canvas immediately after rasterisation fails', () => {
  const { atlas, drawImage, canvases, memory } = setup();
  drawImage.mockImplementationOnce(() => {
    throw new Error('paint lost');
  });
  expect(() => atlas.update(1)).toThrow('paint lost');
  expect(canvases.at(-1)).toMatchObject({ width: 1, height: 1 });
  expect(memory.snapshot.bytes).toBe(atlas.sourceBytes);
  atlas.destroy();
  expect(memory.snapshot.bytes).toBe(0);
});

it('bootstraps without depending on render frames, then yields to rendering once pages are live', async () => {
  const render = vi.fn((callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0));
    return 1;
  });
  vi.stubGlobal('requestAnimationFrame', render);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const { atlas } = setup();
  await atlas.prepare(['one'], 1);
  expect(render).not.toHaveBeenCalled();
  atlas.commitPrepared();
  await atlas.prepare(['one', 'two'], 1);
  expect(render).toHaveBeenCalled();
  atlas.destroy();
});

it('prefetches only SVG text before planning and cancels its source owner on destroy', () => {
  const signals: AbortSignal[] = [];
  const fetchText = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.signal) signals.push(init.signal);
    return Promise.resolve(new Response('<svg/>'));
  });
  vi.stubGlobal('fetch', fetchText);
  const { atlas } = setup(20, { decodeOnDemand: true, prefetchText: true });
  expect(fetchText).toHaveBeenCalledTimes(2);
  expect(atlas.sourceBytes).toBe(0);
  atlas.destroy();
  expect(signals.every((signal) => signal.aborted)).toBe(true);
});

it('continues bounded preparation through message tasks while the ride is paused', async () => {
  const frame = vi.fn((callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0));
    return 1;
  });
  vi.stubGlobal('requestAnimationFrame', frame);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const { atlas } = setup(20, { yieldToFrame: () => false });
  await atlas.prepare(['one'], 1);
  atlas.commitPrepared();
  await atlas.prepare(['one', 'two'], 1);
  expect(frame).not.toHaveBeenCalled();
  atlas.destroy();
});

it.each(['copy', 'paint', 'decoder'] as const)(
  'yields a rendered frame before the second 5 ms %s operation on a moving ride',
  async (operation) => {
    let clockMs = 0;
    let frame = 0;
    const operations: number[] = [];
    const work = () => {
      operations.push(frame);
      clockMs += 5;
    };
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queueMicrotask(() => {
        frame++;
        callback(clockMs);
      });
      return frame + 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('fetch', () => Promise.resolve(new Response('<svg/>')));
    const decode = vi
      .spyOn(svgSources, 'svgSource')
      .mockImplementation(() =>
        Promise.resolve({ image: {} as ImageBitmap, release: vi.fn() }),
      );
    const { atlas, drawImage } = setup(20, {
      decodeOnDemand: operation === 'decoder',
    });
    await atlas.prepare(['one', 'two'], 1);
    atlas.commitPrepared();
    vi.spyOn(performance, 'now').mockImplementation(() => clockMs);
    if (operation === 'decoder') {
      decode.mockImplementation(() => {
        work();
        return Promise.resolve({ image: {} as ImageBitmap, release: vi.fn() });
      });
    } else drawImage.mockImplementation(work);
    await atlas.prepare(['one', 'two'], operation === 'copy' ? 1 : 2);
    expect(operations).toHaveLength(2);
    expect(operations[1]).toBeGreaterThan(operations[0] ?? Infinity);
    atlas.destroy();
  },
);

it('prepares a journey as one page with on-demand sources and retains no decoded catalogue', async () => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('<svg/>')));
  const release = vi.fn();
  vi.spyOn(svgSources, 'svgSource').mockResolvedValue({
    image: {} as ImageBitmap,
    release,
  });
  const { atlas } = setup(20, { decodeOnDemand: true, singlePage: true });
  atlas.selectParts(['one']);
  await atlas.prepareSelected(1);
  atlas.commitPrepared();
  expect(atlas.pages).toHaveLength(1);
  expect(atlas.pages[0]?.frames).toEqual(['one']);
  expect(release).toHaveBeenCalledOnce();
  expect(atlas.sourceBytes).toBe(0);
  atlas.destroy();
});

it('fills the cold decoder pixel budget without an unrelated 16-small-item barrier', async () => {
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('<svg/>')));
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const ready = () => ({ image: {} as ImageBitmap, release: vi.fn() }); // Opaque decoder boundary; drawing is mocked by setup.
  const pending: (() => void)[] = [];
  let release = false;
  let started: () => void = () => {};
  const firstPending = new Promise<void>((resolve) => {
    started = resolve;
  });
  vi.spyOn(svgSources, 'svgSource').mockImplementation((part) => {
    // Two large parts and the first two tiny ones fill the first bounded batch.
    if (
      release ||
      !part.key.startsWith('tiny-') ||
      Number(part.key.slice(5)) < 2
    )
      return Promise.resolve(ready());
    return new Promise((resolve) => {
      pending.push(() => resolve(ready()));
      started();
    });
  });
  const { atlas } = setup(20, { decodeOnDemand: true, singlePage: true }, 40);
  const preparation = atlas.prepareSelected(1);
  try {
    await firstPending;
    expect(pending).toHaveLength(38);
  } finally {
    release = true;
    pending.forEach((resolve) => resolve());
    await preparation;
    atlas.destroy();
  }
});

/** WebGL page boundary of atlasGpu.ts plus a deferred native bitmap decoder. */
function deferredBitmapSetup() {
  const textures = new Map<string, unknown>();
  const gl = {
    LINEAR: 1,
    CLAMP_TO_EDGE: 2,
    RGBA: 3,
    TEXTURE_2D: 4,
    UNSIGNED_BYTE: 5,
    NO_ERROR: 0,
    getError: () => 0,
    texSubImage2D: vi.fn(),
  };
  const scene = {
    game: {
      renderer: {
        gl,
        createTexture2D: () => ({}),
        deleteTexture: vi.fn(),
        glTextureUnits: { bind: vi.fn() },
        glWrapper: { updateTexturing: vi.fn() },
      },
    },
    textures: {
      exists: (key: string) => textures.has(key),
      get: (key: string) => ({ getSourceImage: () => textures.get(key) }),
      remove: (key: string) => textures.delete(key),
      addGLTexture: (key: string) => {
        const texture = { add() {} };
        textures.set(key, texture);
        return texture;
      },
    },
  };
  vi.stubGlobal('HTMLImageElement', SourceImage);
  vi.stubGlobal('HTMLCanvasElement', SourceImage);
  vi.stubGlobal('document', {
    createElement: () =>
      Object.assign(new SourceImage(), {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
      }),
  });
  // Chromium (probed): decode() never settles if src is removed while it is pending.
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode() {
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            if (this.src) resolve();
          }, 0),
        );
      }
      removeAttribute() {
        this.src = '';
      }
    },
  );
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('<svg/>')));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:part');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const bitmaps: {
    settle: () => void;
    bitmap: { close: ReturnType<typeof vi.fn> };
  }[] = [];
  const created: { close: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    'createImageBitmap',
    () =>
      new Promise((resolve) => {
        const bitmap = { close: vi.fn() };
        created.push(bitmap);
        bitmaps.push({ settle: () => resolve(bitmap), bitmap });
      }),
  );
  const memory = new TextureMemory();
  // Test boundary implements only the WebGL texture API consumed by ArtAtlas/atlasGpu.
  const atlas = new ArtAtlas(
    scene as unknown as Phaser.Scene,
    ['one', 'two'].map((key) => ({ key, url: key, widthU: 600, heightU: 300 })),
    {
      maxPxPerU: 2,
      texturePrefix: 'gpu@',
      decodeOnDemand: true,
      gpuOnly: true,
      singlePage: true,
      memory,
    },
  );
  const settled = async () => {
    for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const pages = () => [...textures.keys()];
  return { atlas, memory, bitmaps, created, settled, pages };
}

it('serializes resize preparations behind cancelled native bitmap work without accumulating unpublished pages', async () => {
  const { atlas, memory, bitmaps, created, settled, pages } =
    deferredBitmapSetup();
  const keys = ['one', 'two'];
  const first = atlas.prepare(keys, 0.5);
  await settled();
  bitmaps.splice(0).forEach((pending) => pending.settle());
  await first;
  atlas.commitPrepared();
  const displayed = atlas.textureKey;
  const displayedGpu = memory.snapshot.gpu;
  expect(pages()).toEqual([displayed]);

  // Each resize request arrives while the previous one awaits createImageBitmap (0.75 → 1 → 1.25 px/u).
  let peakUnpublished = 0;
  let peakGpu = 0;
  const observe = () => {
    peakUnpublished = Math.max(peakUnpublished, pages().length - 1);
    peakGpu = Math.max(peakGpu, memory.snapshot.gpu);
  };
  const requests: Promise<void>[] = [];
  let finished = 0;
  const cancelled: (typeof bitmaps)[number][] = [];
  for (const zoom of [0.75, 1, 1.25]) {
    cancelled.push(...bitmaps.splice(0));
    requests.push(atlas.prepare(keys, zoom).then(() => void finished++));
    await settled();
    observe();
  }
  expect(cancelled.length).toBeGreaterThan(0);
  // Cancelled native work stays accounted until it really settles.
  expect
    .soft(
      memory.snapshot.allocations.filter((a) => a.key.startsWith('decode:'))
        .length,
      'accounted decoders vs pending native bitmaps',
    )
    .toBe(cancelled.length + bitmaps.length);
  expect
    .soft(peakUnpublished, 'unpublished pages while decoding')
    .toBeLessThanOrEqual(1);
  // The cancelled build's GPU page is back; its successors have not allocated.
  expect
    .soft(pages(), 'pages while cancelled bitmaps are pending')
    .toEqual([displayed]);
  expect(atlas.textureKey).toBe(displayed);
  cancelled.push(...bitmaps.splice(0));
  for (let round = 0; round < 8 && cancelled.length; round++) {
    cancelled.splice(0).forEach((pending) => pending.settle());
    await settled();
    observe();
    cancelled.push(...bitmaps.splice(0));
  }
  expect(cancelled.length, 'every native decoder request settled').toBe(0);
  expect(finished, 'every request settled').toBe(3);
  await Promise.all(requests);
  observe();
  expect.soft(peakUnpublished, 'unpublished pages').toBeLessThanOrEqual(1);
  expect(atlas.ready).toBe(true);
  const old = atlas.commitPrepared();
  old.forEach((key) => atlas.release(key));
  expect(atlas.info?.pxPerU).toBe(1.25);
  // At most the one page that is finally published was ever in flight.
  expect(peakGpu - displayedGpu, 'unpublished GPU bytes').toBeLessThanOrEqual(
    (atlas.info?.width ?? 0) * (atlas.info?.height ?? 0) * 4,
  );
  expect(pages()).toEqual([atlas.textureKey]);
  expect(memory.snapshot.sources).toBe(0);
  expect(memory.snapshot.allocations.map((a) => a.key)).toEqual([
    `texture:${atlas.textureKey}`,
  ]);
  // Late results of cancelled decoders are closed, not leaked.
  expect(created.filter((bitmap) => !bitmap.close.mock.calls.length)).toEqual(
    [],
  );
  atlas.destroy();
  expect(memory.snapshot.bytes).toBe(0);
});
