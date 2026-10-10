import Phaser from 'phaser';
import type { ArtPart } from '../content/artManifest.ts';
import { backdropParts, cloudParts, worldParts } from '../content/worldArt.ts';
import type { Biome } from '../domain/world/Biomes.ts';
import { frameOrigin } from './atlasPacking.ts';
import { BACKDROP_FILL } from './groundPalette.ts';

/** Visible world rectangle, render coordinates (y down). */
export interface ViewRect {
  /** Left edge from the render origin, for placing objects. */
  left: number;
  /**
   * The same edge in absolute world x: parallax phases come from it, so
   * they do not jump when the render origin moves.
   */
  worldLeft: number;
  top: number;
  width: number;
  height: number;
}

export interface BackdropDepths {
  sky: number;
  clouds: number;
  far: number;
  mid: number;
}

/** Parallax speeds (doc 07 §3: two to three); 1 moves with the track. */
const PARALLAX = { clouds: 0.06, far: 0.25, mid: 0.55 } as const;
/** Bottoms of the far and mid backdrops above the rails (u). */
const FAR_BASE_U = 220;
const MID_BASE_U = 170;
const BACKDROP_WIDTH_U = 1020;
/**
 * Each tile is drawn this much wider than its spacing: at fractional
 * positions the filtered edge texels of two abutting tiles let the sky
 * through as a light vertical seam.
 */
const TILE_OVERLAP_U = 2;
const CROSSFADE_SEC = 1.2;
const CLOUDS = 6;
const CLOUD_DRIFT_U_PER_SEC = 5;
const SKY_TEXTURE = 'sky-gradient';

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

interface Layer {
  /** Biome shown by the tiles, or undefined while unused. */
  biome: Biome | undefined;
  far: Phaser.GameObjects.Image[];
  mid: Phaser.GameObjects.Image[];
  fill: Phaser.GameObjects.Rectangle;
}

/**
 * Sky and distance (doc 07 §3 layers 1–3): a gradient sky, slow clouds and
 * the far and mid backdrops of the biome ahead, in parallax and tiled.
 * A change of biome crossfades instead of switching the whole screen
 * (doc 04 §5); a fill under the mid layer keeps sky out of the gaps on long
 * slopes. Owns its game objects until `destroy`.
 */
export class Backdrop {
  readonly #scene: Phaser.Scene;
  readonly #depths: BackdropDepths;
  readonly #sky: Phaser.GameObjects.Image;
  readonly #clouds: Phaser.GameObjects.Image[] = [];
  /** Diagnostics: the first mid tile's x from the view's left edge, u. */
  #midOffsetU = 0;
  readonly #layers: [Layer, Layer];
  #texture: string | undefined;
  #pxPerU = 1;
  /** 0 … 1: how far the incoming layer (index 1) has faded in. */
  #fade = 1;
  #groundTopY = 0;

  constructor(scene: Phaser.Scene, depths: BackdropDepths) {
    this.#scene = scene;
    this.#depths = depths;
    if (!scene.textures.exists(SKY_TEXTURE)) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (context) {
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#79bde6');
        gradient.addColorStop(0.55, '#b5def2');
        gradient.addColorStop(1, '#e4f3fa');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 256);
      }
      scene.textures.addCanvas(SKY_TEXTURE, canvas);
    }
    this.#sky = scene.add
      .image(0, 0, SKY_TEXTURE)
      .setOrigin(0, 0)
      .setDepth(depths.sky);
    const layer = (offset: number): Layer => ({
      biome: undefined,
      far: [],
      mid: [],
      fill: scene.add
        .rectangle(0, 0, 1, 1, 0x000000)
        .setOrigin(0, 0)
        .setDepth(depths.mid + offset)
        .setVisible(false),
    });
    this.#layers = [layer(0), layer(0.01)];
  }

  /** Uses a (re-rasterised) backdrop atlas; images move over to it. */
  setAtlas(texture: string, pxPerU: number): void {
    this.#texture = texture;
    this.#pxPerU = pxPerU;
    for (const cloud of this.#clouds) cloud.destroy();
    this.#clouds.length = 0;
    for (const layer of this.#layers) {
      for (const image of [...layer.far, ...layer.mid]) image.destroy();
      layer.far.length = 0;
      layer.mid.length = 0;
      layer.biome = undefined;
    }
    this.#fade = 1;
  }

  /**
   * Places everything for this frame: `horizonY` is the render y of the
   * rails under the train, `groundTopY` the lowest top edge of the ground
   * behind the track in view, `biome` the biome ahead of the train.
   */
  get midOffsetU(): number {
    return this.#midOffsetU;
  }

  update(
    view: ViewRect,
    horizonY: number,
    groundTopY: number,
    biome: Biome,
    timeSec: number,
    deltaSec: number,
  ): void {
    // Only down to the mid backdrop's foot: the ground covers the rest
    // (fill rate on low-end GPUs, D-013).
    const skyBottom = Math.min(
      view.top + view.height,
      horizonY - MID_BASE_U + 2,
    );
    this.#sky
      .setVisible(skyBottom > view.top)
      .setPosition(view.left, view.top)
      .setDisplaySize(view.width, Math.max(1, skyBottom - view.top));
    this.#groundTopY = groundTopY;
    const texture = this.#texture;
    if (texture === undefined) return;
    this.#placeClouds(texture, view, timeSec);
    const [current, incoming] = this.#layers;
    if (current.biome === undefined) this.#show(current, biome);
    else if (biome !== (this.#fade < 1 ? incoming.biome : current.biome)) {
      // A new biome ahead: fade it in over whatever is shown now.
      if (this.#fade < 1 && incoming.biome !== undefined)
        this.#show(current, incoming.biome);
      this.#show(incoming, biome);
      this.#fade = 0;
    }
    if (this.#fade < 1) {
      this.#fade = Math.min(1, this.#fade + deltaSec / CROSSFADE_SEC);
      if (this.#fade >= 1 && incoming.biome !== undefined) {
        this.#show(current, incoming.biome);
        this.#hide(incoming);
      }
    }
    this.#placeLayer(current, view, horizonY, 1);
    if (this.#fade < 1) this.#placeLayer(incoming, view, horizonY, this.#fade);
    else this.#hide(incoming);
  }

  destroy(): void {
    this.#sky.destroy();
    for (const cloud of this.#clouds) cloud.destroy();
    for (const layer of this.#layers) {
      for (const image of [...layer.far, ...layer.mid]) image.destroy();
      layer.fill.destroy();
    }
  }

  #show(layer: Layer, biome: Biome): void {
    layer.biome = biome;
    const keys = backdropParts[biome];
    for (const image of layer.far) image.setFrame(keys.far);
    for (const image of layer.mid) image.setFrame(keys.mid);
    layer.fill.setFillStyle(BACKDROP_FILL[biome]);
  }

  #hide(layer: Layer): void {
    for (const image of [...layer.far, ...layer.mid]) image.setVisible(false);
    layer.fill.setVisible(false);
    layer.biome = undefined;
  }

  #tiles(
    layer: Layer,
    which: 'far' | 'mid',
    count: number,
  ): Phaser.GameObjects.Image[] {
    const images = layer[which];
    const texture = this.#texture;
    const biome = layer.biome;
    if (texture === undefined || biome === undefined) return images;
    const key = backdropParts[biome][which];
    while (images.length < count) {
      const part = parts[key];
      const image = this.#scene.add
        .image(0, 0, texture, key)
        .setDepth(this.#depths[which] + (layer === this.#layers[1] ? 0.01 : 0));
      const origin = frameOrigin(
        part?.pivotU ?? { x: 0, y: 0 },
        this.#pxPerU,
        image.frame,
      );
      image.setOrigin(origin.x, part ? origin.y : 1);
      images.push(image);
    }
    return images;
  }

  #placeLayer(
    layer: Layer,
    view: ViewRect,
    horizonY: number,
    alpha: number,
  ): void {
    const count = Math.ceil(view.width / BACKDROP_WIDTH_U) + 2;
    for (const [which, base] of [
      ['far', FAR_BASE_U],
      ['mid', MID_BASE_U],
    ] as const) {
      const shift = view.worldLeft * PARALLAX[which];
      const first = Math.floor(shift / BACKDROP_WIDTH_U);
      if (which === 'mid' && alpha > 0)
        this.#midOffsetU = first * BACKDROP_WIDTH_U - shift;
      this.#tiles(layer, which, count).forEach((image, i) => {
        const x = view.left + (first + i) * BACKDROP_WIDTH_U - shift;
        image
          .setVisible(true)
          .setAlpha(alpha)
          .setScale(
            (1 + TILE_OVERLAP_U / BACKDROP_WIDTH_U) / this.#pxPerU,
            1 / this.#pxPerU,
          )
          .setPosition(x, horizonY - base);
      });
    }
    // Ground colour under the mid backdrop where the ground behind the
    // track dips below it; elsewhere that ground covers the gap.
    const top = horizonY - MID_BASE_U - 1;
    const bottom = Math.min(view.top + view.height, this.#groundTopY + 6);
    layer.fill
      .setVisible(bottom > top)
      .setAlpha(alpha)
      .setPosition(view.left, top)
      .setSize(view.width, Math.max(1, bottom - top));
  }

  #placeClouds(texture: string, view: ViewRect, timeSec: number): void {
    const span = view.width + 600;
    while (this.#clouds.length < CLOUDS) {
      const i = this.#clouds.length;
      const key = cloudParts[i % cloudParts.length] ?? 'cloud.a';
      const part = parts[key];
      const cloud = this.#scene.add
        .image(0, 0, texture, key)
        .setDepth(this.#depths.clouds);
      if (part) {
        const origin = frameOrigin(part.pivotU, this.#pxPerU, cloud.frame);
        cloud.setOrigin(origin.x, origin.y);
      }
      this.#clouds.push(cloud);
    }
    this.#clouds.forEach((cloud, i) => {
      const home = ((i * 0.37) % 1) * span;
      const travel =
        home -
        view.worldLeft * PARALLAX.clouds +
        timeSec * CLOUD_DRIFT_U_PER_SEC;
      const x = view.left - 300 + (((travel % span) + span) % span);
      const y = view.top + view.height * (0.1 + ((i * 0.29) % 1) * 0.22);
      cloud
        .setPosition(x, y)
        .setScale((1 + ((i * 0.53) % 1) * 0.8) / this.#pxPerU);
    });
  }
}
