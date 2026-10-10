import type Phaser from 'phaser';
import {
  ART_MAX_PX_PER_U,
  ATLAS_PADDING_PX,
  MAX_ATLAS_EDGE_PX,
  artAtlasItems,
  artScaleFor,
  packAtlas,
} from './atlasPacking.ts';

const SOURCE_PREFIX = 'vehicle-art-source:';
const TEXTURE_PREFIX = 'vehicle-art@';

export interface ArtAtlasInfo {
  width: number;
  height: number;
  frames: number;
  /** Raster scale of the current atlas, px per u. */
  pxPerU: number;
}

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
): void {
  for (const source of sources) {
    scene.load.svg(`${SOURCE_PREFIX}${source.key}`, source.url, {
      scale: ART_MAX_PX_PER_U,
    });
  }
}

/**
 * All vehicle art in one canvas texture (doc 07 §4/§10): one texture keeps
 * every vehicle quad in one batch (D-010). The decoded SVG sources stay in
 * memory, so the atlas is re-rasterised at the camera's scale step after a
 * resize (D-011); the old texture is removed only after the scene has moved
 * its images to the new one.
 */
export class ArtAtlas {
  readonly #scene: Phaser.Scene;
  readonly #parts: Readonly<Record<string, ArtSource>>;
  readonly #sources = new Map<string, SourceImage>();
  #version = 0;
  #textureKey: string | undefined;
  #info: ArtAtlasInfo | undefined;

  /** Takes over the loaded sources; throws if a part did not load. */
  constructor(scene: Phaser.Scene, sources: readonly ArtSource[]) {
    this.#scene = scene;
    this.#parts = Object.fromEntries(
      sources.map((source) => [source.key, source]),
    );
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
    // The atlas replaces the per-part GPU textures.
    for (const { key } of sources)
      scene.textures.remove(`${SOURCE_PREFIX}${key}`);
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
    const pxPerU = artScaleFor(zoom);
    if (this.#info?.pxPerU === pxPerU) return undefined;
    const items = artAtlasItems(this.#parts, pxPerU);
    const plan = packAtlas(items, {
      maxSize: MAX_ATLAS_EDGE_PX,
      paddingPx: ATLAS_PADDING_PX,
    });
    const canvas = document.createElement('canvas');
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2D context for the art atlas');
    context.imageSmoothingQuality = 'high';
    for (const item of items) {
      const at = plan.frames.get(item.key);
      const image = this.#sources.get(item.key);
      if (at && image)
        context.drawImage(image, at.x, at.y, item.width, item.height);
    }
    this.#version += 1;
    const key = `${TEXTURE_PREFIX}${this.#version}`;
    const texture = this.#scene.textures.addCanvas(key, canvas);
    if (!texture) throw new Error('art atlas texture not created');
    for (const item of items) {
      const at = plan.frames.get(item.key);
      if (at) texture.add(item.key, 0, at.x, at.y, item.width, item.height);
    }
    const previous = this.#textureKey;
    this.#textureKey = key;
    this.#info = {
      width: plan.width,
      height: plan.height,
      frames: items.length,
      pxPerU,
    };
    return previous;
  }

  /** Removes a replaced atlas texture. */
  release(key: string): void {
    this.#scene.textures.remove(key);
  }

  destroy(): void {
    if (this.#textureKey) this.#scene.textures.remove(this.#textureKey);
    this.#textureKey = undefined;
    this.#info = undefined;
    this.#sources.clear();
  }
}
