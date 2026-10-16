import { immutableTexture } from './immutableTexture.ts';
import { copyAtlasFrame } from './copyAtlasFrame.ts';
import { gpuAtlasPage, atlasUploadTiles } from './atlasGpu.ts';
import { svgSource } from './svgSource.ts';
import { TextureMemory } from './TextureMemory.ts';
import type { AtlasMetrics } from './AtlasMetrics.ts';
import type Phaser from 'phaser';
import {
  ART_MAX_PX_PER_U,
  ATLAS_PADDING_PX,
  MAX_ATLAS_EDGE_PX,
  artAtlasItems,
  artScaleFor,
  framesWithMargin,
  packAtlas,
  worldPagePlanning,
  atlasDecodeBatch,
} from './atlasPacking.ts';

const SOURCE_PREFIX = 'art-source:';

export interface ArtAtlasOptions {
  /** Finest raster scale, px per u. */
  maxPxPerU: number;
  decodeOnDemand?: boolean;
  prefetchText?: boolean;
  /** Moving rides yield to rendering; paused/debug owners can use bounded message tasks. */
  yieldToFrame?: boolean | (() => boolean);
  gpuOnly?: boolean;
  singlePage?: boolean;
  metrics?: AtlasMetrics;
  memory?: TextureMemory;
  /** Texture key prefix; one prefix per atlas. */
  texturePrefix: string;
}

export interface ArtAtlasInfo {
  width: number;
  height: number;
  frames: number;
  /** Raster scale of the current atlas, px per u. */
  pxPerU: number;
}

interface AtlasPage {
  key: string;
  info: ArtAtlasInfo;
  frames: readonly string[];
}

type TextResult = { text: string } | { error: string };

type SourceImage = HTMLImageElement | HTMLCanvasElement;

/** One SVG part for the atlas: frame key, build URL, size in u. */
export interface ArtSource {
  key: string;
  url: string;
  widthU: number;
  heightU: number;
}

/**
 * Queues every art part on the scene loader. The loader sets the SVG size
 * before decoding, at the largest raster scale, so a browser that
 * rasterises at the intrinsic size still has enough pixels.
 */
export function preloadArt(
  scene: Phaser.Scene,
  sources: readonly ArtSource[],
  maxPxPerU: number = ART_MAX_PX_PER_U,
): void {
  for (const source of sources) {
    scene.load.svg(`${SOURCE_PREFIX}${source.key}`, source.url, {
      scale: maxPxPerU,
    });
  }
  // Keys are frame names in an atlas: never twice.
  if (new Set(sources.map((s) => s.key)).size !== sources.length)
    throw new Error('duplicate art keys');
}

/** Decoded SVG sources still held as textures (diagnostics, D-011). */
export function artSourceTextureCount(scene: Phaser.Scene): number {
  return scene.textures
    .getTextureKeys()
    .filter((key) => key.startsWith(SOURCE_PREFIX)).length;
}

/**
 * Owned immutable atlas pages. Journey, world and backdrop owners decode
 * temporary bitmaps on demand and retarget images before releasing old pages.
 * The synchronous API remains available for callers with preloaded sources.
 */
export class ArtAtlas {
  readonly #scene: Phaser.Scene;
  readonly #options: ArtAtlasOptions;
  readonly #parts: Readonly<Record<string, ArtSource>>;
  readonly #memory: TextureMemory;
  readonly #textLife = new AbortController();
  readonly #texts = new Map<string, Promise<TextResult>>();
  readonly #sources = new Map<string, SourceImage>();
  #selectedParts: Readonly<Record<string, ArtSource>>;
  #version = 0;
  readonly #owned = new Set<string>();
  readonly #rasterBytes = new Map<AbortController, number>();
  #pages: AtlasPage[] = [];
  #ready: AtlasPage[] | undefined;
  #build: AbortController | undefined;
  /** Settles when the latest build, cancelled or not, has finished its cleanup. */
  #settled: Promise<void> = Promise.resolve();
  #unsettled = 0;
  #textureKey: string | undefined;
  #info: ArtAtlasInfo | undefined;
  /** Raster scale whose rasterisation failed; never retried. */
  #failedPxPerU: number | undefined;

  /**
   * Takes over the loaded sources; throws if a part did not load. Either
   * way the per-part textures are released: the atlas replaces them, and
   * a failed atlas must not keep the parts that did load (the ride falls
   * back to plain shapes).
   */
  constructor(
    scene: Phaser.Scene,
    sources: readonly ArtSource[],
    options: ArtAtlasOptions,
  ) {
    this.#scene = scene;
    this.#options = options;
    this.#memory = options.memory ?? new TextureMemory();
    this.#parts = Object.fromEntries(
      sources.map((source) => [source.key, source]),
    );
    this.#selectedParts = this.#parts;
    if (options.decodeOnDemand && options.prefetchText) {
      for (const part of sources) void this.#prefetch(part);
    }
    if (options.decodeOnDemand) return;
    try {
      for (const { key } of sources) {
        const source = `${SOURCE_PREFIX}${key}`;
        if (!scene.textures.exists(source))
          throw new Error(`art part ${key} did not load`);
        const image = scene.textures.get(source).getSourceImage();
        if (
          !(image instanceof HTMLImageElement) &&
          !(image instanceof HTMLCanvasElement)
        )
          throw new Error(`art part ${key} is not an image`);
        this.#sources.set(key, image);
      }
    } finally {
      for (const { key } of sources) {
        const source = `${SOURCE_PREFIX}${key}`;
        if (scene.textures.exists(source)) scene.textures.remove(source);
      }
    }
    this.#memory.set(`${options.texturePrefix}:sources`, {
      sources: this.sourceBytes,
    });
  }

  /** Selects journey parts after the caller has destroyed images from the old journey. */
  selectParts(keys: readonly string[]): void {
    const selected = Object.fromEntries(
      keys.map((key) => {
        const part = this.#parts[key];
        if (!part) throw new RangeError(`unknown art part ${key}`);
        return [key, part];
      }),
    );
    this.invalidate();
    this.#selectedParts = selected;
  }

  /** Texture holding the current atlas; frames are the part keys. */
  get textureKey(): string | undefined {
    return this.#textureKey;
  }

  get info(): ArtAtlasInfo | undefined {
    return this.#info;
  }

  /**
   * Rasterises the atlas for a camera zoom (game px per u) unless the scale
   * step is unchanged. Returns the replaced texture key, which the caller
   * removes with `release` once nothing shows it.
   */
  update(zoom: number): string | undefined {
    const pxPerU = artScaleFor(zoom, this.#options.maxPxPerU);
    if (this.#info?.pxPerU === pxPerU || this.#failedPxPerU === pxPerU)
      return undefined;
    try {
      return this.#rasterise(pxPerU);
    } catch (error) {
      // Throws once per scale step; the caller keeps or drops the atlas.
      this.#failedPxPerU = pxPerU;
      throw error;
    }
  }

  #rasterise(pxPerU: number): string | undefined {
    const items = artAtlasItems(this.#selectedParts, pxPerU);
    const plan = packAtlas(items, {
      maxSize: MAX_ATLAS_EDGE_PX,
      paddingPx: ATLAS_PADDING_PX,
    });
    const previous = this.#textureKey;
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const key = `${this.#options.texturePrefix}${++this.#version}`;
    this.#memory.set(`canvas:${key}`, {
      canvas: canvas.width * canvas.height * 4,
    });
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('no 2D context for the art atlas');
      context.imageSmoothingQuality = 'high';
      for (const item of items) {
        const at = plan.frames.get(item.key),
          image = this.#sources.get(item.key);
        if (at && image)
          context.drawImage(image, at.x, at.y, item.width, item.height);
      }
      const texture = this.#register(key, canvas);
      this.#owned.add(key);
      for (const [frameKey, frame] of framesWithMargin(plan, items))
        texture.add(frameKey, 0, frame.x, frame.y, frame.width, frame.height);
      this.#textureKey = key;
      this.#info = {
        width: plan.width,
        height: plan.height,
        frames: items.length,
        pxPerU,
      };
      return previous;
    } catch (error) {
      this.release(key);
      throw error;
    } finally {
      if (!this.#owned.has(key)) {
        canvas.width = 1;
        canvas.height = 1;
      }
      this.#memory.remove(`canvas:${key}`);
    }
  }

  prepareSelected(zoom: number): Promise<void> {
    return this.prepare(Object.keys(this.#selectedParts), zoom);
  }

  /** Builds off the render call, yielding between small raster slices (Canvas and WebGL). */
  async prepare(keys: readonly string[], zoom: number): Promise<void> {
    this.#build?.abort();
    this.#ready?.forEach((page) => this.release(page.key));
    this.#ready = undefined;
    const build = new AbortController();
    this.#build = build;
    // Native decoder work of a cancelled predecessor cannot be interrupted.
    // Its successor allocates nothing until it has settled; the displayed
    // pages stay meanwhile, so replacement pages never accumulate.
    const predecessor = this.#settled;
    let settle = () => {};
    this.#settled = new Promise((resolve) => {
      settle = resolve;
    });
    this.#unsettled++;
    const pages: AtlasPage[] = [];
    const canvases = new Map<string, HTMLCanvasElement>();
    const registered: string[] = [];
    // Unpublished pages (GPU, or completed Canvas pages) go back at
    // cancellation, not when late bitmaps settle.
    const releaseRegistered = () => {
      registered.forEach((key) => this.release(key));
      pages.forEach((page) => this.release(page.key));
    };
    build.signal.addEventListener('abort', releaseRegistered, { once: true });
    const decoded = new Map<string, Awaited<ReturnType<typeof svgSource>>>();
    try {
      await predecessor;
      if (build.signal.aborted) return;
      await atlasTask(build.signal);
      if (build.signal.aborted) return;
      const pxPerU = artScaleFor(zoom, this.#options.maxPxPerU);
      const selected = Object.fromEntries(
        keys.map((key) => {
          const part = this.#parts[key];
          if (!part) throw new RangeError(`unknown art part ${key}`);
          return [key, part];
        }),
      );
      // Network bytes are fetched concurrently; bitmap batches have a pixel budget.
      const xml = this.#options.decodeOnDemand
        ? new Map(
            await Promise.all(
              keys
                .filter(
                  (key) =>
                    this.#info?.pxPerU !== pxPerU || !this.textureFor(key),
                )
                .map(async (key) => {
                  const part = this.#parts[key];
                  if (!part) throw new Error(`missing source ${key}`);
                  const text = this.#options.prefetchText
                    ? await this.#text(part, build.signal)
                    : await atlasText(part, build.signal);
                  return [key, text] as const;
                }),
            ),
          )
        : undefined;
      if (build.signal.aborted) return;
      const planning = worldPagePlanning(
        artAtlasItems(selected, pxPerU),
        this.#options.singlePage,
      );
      const advance = () => {
        const started = performance.now();
        let step = planning.next();
        // Each step places at most 32 parts (D-032); a frame or message task
        // takes steps for 2 ms, so a candidate never becomes one long spike.
        while (!step.done && performance.now() - started < 2)
          step = planning.next();
        return step;
      };
      let step = this.#measure('prepare', advance, 'plan');
      while (!step.done) {
        await (this.#yieldToFrame()
          ? atlasFrame(build.signal)
          : atlasTask(build.signal));
        if (build.signal.aborted) return;
        step = this.#measure('prepare', advance, 'plan');
      }
      const plans = step.value;
      const sourceLimit = Math.max(
        0,
        ...plans.flatMap((page) =>
          page.items.map((item) => item.width * item.height * 4),
        ),
      );
      const bootstrapLimit = plans
        .flatMap((page) =>
          page.items.map((item) => item.width * item.height * 4),
        )
        .sort((a, b) => b - a)
        .slice(0, 4)
        .reduce((a, b) => a + b, 0);
      for (const { items, plan } of plans) {
        const key = `${this.#options.texturePrefix}${++this.#version}`;
        const canvas = document.createElement('canvas');
        canvases.set(key, canvas);
        const gpu = this.#options.gpuOnly
          ? gpuAtlasPage(
              this.#scene,
              key,
              plan.width,
              plan.height,
              this.#memory,
              this.#options.metrics,
            )
          : undefined;
        if (gpu) {
          this.#owned.add(key);
          registered.push(key);
        }
        canvas.width = gpu ? 1 : plan.width;
        canvas.height = gpu ? 1 : plan.height;
        this.#rasterBytes.set(build, canvas.width * canvas.height * 4);
        this.#memory.set(`canvas:${key}`, {
          canvas: canvas.width * canvas.height * 4,
        });
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no 2D context for the art atlas');
        context.imageSmoothingQuality = 'high';
        let rasterSliceMs = 0;
        const yieldSlice = async () => {
          await (this.#yieldToFrame()
            ? atlasFrame(build.signal)
            : atlasTask(build.signal));
          rasterSliceMs = 0;
        };
        for (let i = 0; i < items.length; i++) {
          if (rasterSliceMs >= 4 || (this.#yieldToFrame() && i % 4 === 0)) {
            await yieldSlice();
            if (build.signal.aborted) return;
          }
          const item = items[i];
          if (!item) continue;
          const at = plan.frames.get(item.key),
            part = this.#parts[item.key];
          if (!at || !part) throw new Error(`missing source ${item.key}`);
          const old =
            this.#info?.pxPerU === pxPerU
              ? this.textureFor(item.key)
              : undefined;
          if (old) {
            const copyFrom = performance.now();
            this.#measure(gpu ? 'upload' : 'prepare', () =>
              copyAtlasFrame(
                this.#scene,
                old,
                item.key,
                canvas,
                at.x,
                at.y,
                item.width,
                item.height,
                gpu?.copy,
              ),
            );
            rasterSliceMs += performance.now() - copyFrom;
            continue;
          }
          const decode = (part: ArtSource) => {
            const started = performance.now();
            const pending = svgSource(
              part,
              pxPerU,
              build.signal,
              xml?.get(part.key) ?? '',
              this.#options.metrics,
              this.#memory,
              `decode:${key}:${part.key}`,
            );
            // An async decoder does synchronous SVG/Image work before returning.
            rasterSliceMs += performance.now() - started;
            return pending;
          };
          if (this.#options.decodeOnDemand && !decoded.has(item.key)) {
            const pending = [];
            for (const candidate of atlasDecodeBatch(
              items,
              i,
              !this.#options.singlePage &&
                this.#pages.length &&
                (this.#yieldToFrame() || pxPerU > 1)
                ? sourceLimit
                : bootstrapLimit,
              this.#yieldToFrame() ? 4 : items.length,
            )) {
              if (
                this.#info?.pxPerU === pxPerU &&
                this.textureFor(candidate.key)
              )
                continue;
              if (rasterSliceMs >= 4) await yieldSlice();
              if (build.signal.aborted) break;
              const source = this.#parts[candidate.key];
              if (!source) throw new Error(`missing source ${candidate.key}`);
              // Observe rejection immediately, including while yielding before the next start.
              pending.push(
                Promise.allSettled([
                  decode(source).then((ready) => {
                    decoded.set(candidate.key, ready);
                  }),
                ]),
              );
            }
            const results = (await Promise.all(pending)).flat();
            const failed = results.find(
              (result) => result.status === 'rejected',
            );
            if (failed?.status === 'rejected') throw failed.reason;
            if (build.signal.aborted) return;
          }
          const disposable = this.#options.decodeOnDemand
            ? decoded.get(item.key)
            : undefined;
          if (rasterSliceMs >= 4) await yieldSlice();
          if (build.signal.aborted) return;
          const image = disposable?.image ?? this.#sources.get(item.key);
          if (!image) throw new Error(`missing source ${item.key}`);
          try {
            if (gpu) {
              for (const tile of atlasUploadTiles(
                item.width + 2 * ATLAS_PADDING_PX,
                item.height + 2 * ATLAS_PADDING_PX,
              )) {
                if (rasterSliceMs >= 4) {
                  await yieldSlice();
                  if (build.signal.aborted) return;
                }
                const tileFrom = performance.now();
                canvas.width = tile.width;
                canvas.height = tile.height;
                this.#memory.set(`canvas:${key}`, {
                  canvas: tile.width * tile.height * 4,
                });
                this.#rasterBytes.set(build, tile.width * tile.height * 4);
                this.#measure('prepare', () =>
                  context.drawImage(
                    image,
                    ATLAS_PADDING_PX - tile.x,
                    ATLAS_PADDING_PX - tile.y,
                    item.width,
                    item.height,
                  ),
                );
                this.#measure(
                  'upload',
                  () =>
                    gpu.upload(
                      canvas,
                      at.x - ATLAS_PADDING_PX + tile.x,
                      at.y - ATLAS_PADDING_PX + tile.y,
                    ),
                  `tile:${part.key}`,
                );
                rasterSliceMs += performance.now() - tileFrom;
              }
              canvas.width = 1;
              canvas.height = 1;
              this.#rasterBytes.set(build, 4);
              this.#memory.remove(`canvas:${key}`);
            } else {
              const paintFrom = performance.now();
              this.#measure('prepare', () =>
                context.drawImage(image, at.x, at.y, item.width, item.height),
              );
              rasterSliceMs += performance.now() - paintFrom;
            }
          } finally {
            disposable?.release();
            decoded.delete(item.key);
            this.#memory.remove(`decode:${key}`);
          }
        }
        if (gpu) this.#measure('upload', gpu.verify, 'verify');
        await atlasTask(build.signal);
        if (build.signal.aborted) return;
        const texture = gpu?.texture ?? this.#register(key, canvas);
        if (!texture) throw new Error('art atlas texture not created');
        this.#owned.add(key);
        this.#rasterBytes.delete(build);
        pages.push({
          key,
          info: {
            width: plan.width,
            height: plan.height,
            frames: items.length,
            pxPerU,
          },
          frames: items.map((item) => item.key),
        });
        for (const [frameKey, frame] of framesWithMargin(plan, items))
          texture.add(frameKey, 0, frame.x, frame.y, frame.width, frame.height);
      }
      this.#ready = pages;
    } catch (error) {
      if (!build.signal.aborted) throw error;
    } finally {
      build.signal.removeEventListener('abort', releaseRegistered);
      for (const source of decoded.values()) source.release();
      decoded.clear();
      for (const [key, canvas] of canvases) {
        if (!this.#owned.has(key)) {
          canvas.width = 1;
          canvas.height = 1;
        }
        this.#memory.remove(`canvas:${key}`);
        this.#memory.remove(`decode:${key}`);
      }
      this.#rasterBytes.delete(build);
      if (this.#ready !== pages) {
        pages.forEach((page) => this.release(page.key));
        registered.forEach((key) => this.release(key));
      }
      if (this.#build === build) this.#build = undefined;
      this.#unsettled--;
      settle();
    }
  }

  /** A build, possibly a cancelled one, still owns decoder or page allocations. */
  get settling(): boolean {
    return this.#unsettled > 0;
  }

  cancelPreparation(): void {
    this.#build?.abort();
    this.#ready?.forEach((page) => this.release(page.key));
    this.#ready = undefined;
  }

  /** Caller retargets images at a frame boundary, then releases the returned old pages. */
  commitPrepared(): string[] {
    if (!this.#ready) return [];
    const old = this.#pages.map((page) => page.key);
    this.#pages = this.#ready;
    this.#ready = undefined;
    this.#textureKey = this.#pages[0]?.key;
    this.#info = this.#pages[0]?.info;
    return old;
  }

  textureFor(frame: string): string | undefined {
    return this.#pages.find((page) => page.frames.includes(frame))?.key;
  }

  get pages(): readonly AtlasPage[] {
    return this.#pages;
  }
  get ready(): boolean {
    return this.#ready !== undefined;
  }
  get pendingCanvasBytes(): number {
    return [...this.#rasterBytes.values()].reduce(
      (sum, bytes) => sum + bytes,
      0,
    );
  }
  get decodedBytes(): number {
    return [...this.#pages, ...(this.#ready ?? [])].reduce(
      (sum, page) => sum + page.info.width * page.info.height * 4,
      0,
    );
  }
  get sourceBytes(): number {
    return [...this.#sources.keys()].reduce((sum, key) => {
      const part = this.#parts[key];
      if (!part) return sum;
      return (
        sum +
        Math.ceil(part.widthU * this.#options.maxPxPerU) *
          Math.ceil(part.heightU * this.#options.maxPxPerU) *
          4
      );
    }, 0);
  }

  #prefetch(part: ArtSource): Promise<TextResult> {
    const result = atlasText(part, this.#textLife.signal).then(
      (text) => ({ text }),
      (error: unknown) => ({ error: String(error) }),
    );
    this.#texts.set(part.key, result);
    return result;
  }
  async #text(part: ArtSource, signal: AbortSignal): Promise<string> {
    const pending = this.#texts.get(part.key) ?? this.#prefetch(part);
    const result = await new Promise<TextResult>((resolve, reject) => {
      const abort = () => {
        signal.removeEventListener('abort', abort);
        reject(new Error(String(signal.reason ?? 'Atlas preparation aborted')));
      };
      signal.addEventListener('abort', abort, { once: true });
      void pending.then((result) => {
        signal.removeEventListener('abort', abort);
        resolve(result);
      });
      if (signal.aborted) abort();
    });
    if ('error' in result) {
      if (this.#texts.get(part.key) === pending) this.#texts.delete(part.key);
      throw new Error(result.error);
    }
    return result.text;
  }

  #measure<T>(
    stage: 'prepare' | 'register' | 'upload',
    work: () => T,
    detail?: string,
  ): T {
    return this.#options.metrics
      ? this.#options.metrics.measure(stage, work, detail)
      : work();
  }
  #yieldToFrame(): boolean {
    const policy = this.#options.yieldToFrame;
    return (
      this.#pages.length > 0 &&
      (typeof policy === 'function' ? policy() : policy !== false)
    );
  }
  #register(key: string, canvas: HTMLCanvasElement) {
    return this.#measure('register', () =>
      immutableTexture(this.#scene, key, canvas, this.#memory),
    );
  }

  /** Removes a replaced atlas texture. */
  release(key: string): void {
    if (this.#owned.delete(key)) {
      const source = this.#scene.textures.get(key).getSourceImage();
      this.#scene.textures.remove(key);
      if (source instanceof HTMLCanvasElement) {
        source.width = 1;
        source.height = 1;
      }
    }
    this.#memory.remove(`texture:${key}`);
  }

  invalidate(): void {
    this.#build?.abort();
    for (const key of this.#owned) this.release(key);
    this.#owned.clear();
    this.#rasterBytes.clear();
    this.#ready = undefined;
    this.#pages = [];
    this.#textureKey = undefined;
    this.#info = undefined;
    this.#failedPxPerU = undefined;
  }
  destroy(): void {
    this.#textLife.abort();
    this.#texts.clear();
    this.invalidate();
    for (const source of this.#sources.values()) {
      if (source instanceof HTMLImageElement) source.removeAttribute('src');
      else {
        source.width = 1;
        source.height = 1;
      }
    }
    this.#sources.clear();
    this.#memory.remove(`${this.#options.texturePrefix}:sources`);
  }
}

/** Owned message task and abort listener; closing both ports also cancels queued work. */
function atlasTask(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const done = () => {
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      signal.removeEventListener('abort', done);
      resolve();
    };
    channel.port1.onmessage = done;
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
    else channel.port2.postMessage(null);
  });
}

/** Preparation yields to rendering; it never changes the game's frame cap. */
function atlasFrame(signal: AbortSignal): Promise<void> {
  if (typeof requestAnimationFrame === 'undefined') return atlasTask(signal);
  return new Promise((resolve) => {
    const done = () => {
      cancelAnimationFrame(id);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const id = requestAnimationFrame(done);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

/** Raw SVG bytes are not decoded textures; the owning atlas cancels pending reads. */
async function atlasText(
  part: ArtSource,
  signal: AbortSignal,
): Promise<string> {
  const response = await fetch(part.url, { signal });
  if (!response.ok)
    throw new Error(`art source ${part.key}: ${response.status}`);
  return response.text();
}
