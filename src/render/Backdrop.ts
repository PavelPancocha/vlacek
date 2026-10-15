import type { Season } from '../domain/world/Regions.ts';
import { farmForestBackdropKey } from './farmForestBackdrop.ts';
import type { RegionTransition } from '../domain/world/Regions.ts';
import type { WorldDiagnostics } from '../domain/world/WorldValidation.ts';
import Phaser from 'phaser';
import type { ArtPart } from '../content/artManifest.ts';
import { cloudParts, worldParts } from '../content/worldArt.ts';
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
const CLOUDS = 6;
const CLOUD_DRIFT_U_PER_SEC = 5;
const SKY_TEXTURE = 'sky-gradient';

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

interface Layer {
  /** Biome shown by the tiles, or undefined while unused. */
  biome: Biome | undefined;
  season: Season | undefined;
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
  #world: WorldDiagnostics | undefined;

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
      season: undefined,
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

  /** Clears journey state while reusing the atlas and its images. */
  reset(): void {
    for (const layer of this.#layers) this.#hide(layer);
    this.#fade = 1;
    this.#midOffsetU = 0;
    this.#groundTopY = 0;
    this.#world = undefined;
  }

  /** Biomes actually drawn by both layers and their crossfade progress. */
  get state() {
    return {
      currentBiome: this.#layers[0].biome,
      incomingBiome: this.#layers[1].biome,
      fade: this.#fade,
      world: this.#world,
    };
  }

  /** Parallax phase of the mid hills, u (diagnostics). */
  get midOffsetU(): number {
    return this.#midOffsetU;
  }

  /**
   * Places everything for this frame: `horizonY` is the render y of the
   * rails under the train, `groundTopY` the lowest top edge of the ground
   * behind the track in view, `biome` the biome ahead of the train.
   * `deltaSec` is simulation time since the last frame (0 while paused),
   * so a crossfade holds still behind the pause screen.
   */
  update(
    view: ViewRect,
    horizonY: number,
    groundTopY: number,
    transition: RegionTransition,
    timeSec: number,
    world: WorldDiagnostics,
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
    this.#world = world;
    const texture = this.#texture;
    if (texture === undefined) return;
    this.#placeClouds(texture, view, timeSec);
    const [current, incoming] = this.#layers;
    const from = transition.from.landscape,
      to = transition.to.landscape;
    this.#show(current, from, transition.from.season);
    this.#fade = transition.progress === 0 ? 1 : transition.progress;
    this.#placeLayer(current, view, horizonY, 1);
    if (
      transition.progress > 0 &&
      (from !== to || transition.from.season !== transition.to.season)
    ) {
      this.#show(incoming, to, transition.to.season);
      this.#placeLayer(incoming, view, horizonY, transition.progress);
    } else this.#hide(incoming);
  }

  destroy(): void {
    this.#sky.destroy();
    for (const cloud of this.#clouds) cloud.destroy();
    for (const layer of this.#layers) {
      for (const image of [...layer.far, ...layer.mid]) image.destroy();
      layer.fill.destroy();
    }
  }

  #show(layer: Layer, biome: Biome, season: Season): void {
    if (layer.biome === biome && layer.season === season) return;
    layer.biome = biome;
    layer.season = season;
    const keys = {
      far:
        biome === 'town'
          ? 'backdrop.town-sparse'
          : farmForestBackdropKey(biome, season, 'far'),
      mid:
        biome === 'town'
          ? 'backdrop.town-dense'
          : farmForestBackdropKey(biome, season, 'mid'),
    };
    for (const which of ['far', 'mid'] as const)
      for (const image of layer[which]) {
        image.setFrame(keys[which]);
        const pivot = parts[keys[which]]?.pivotU;
        if (pivot) {
          const origin = frameOrigin(pivot, this.#pxPerU, image.frame);
          image.setOrigin(origin.x, origin.y);
        }
      }
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
    const key =
      biome === 'town'
        ? which === 'far'
          ? 'backdrop.town-sparse'
          : 'backdrop.town-dense'
        : farmForestBackdropKey(biome, layer.season ?? 'summer', which);
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
    const width = layer.biome === 'forest' ? 480 : BACKDROP_WIDTH_U;
    const count = Math.ceil(view.width / width) + 2;
    for (const [which, base] of [
      ['far', FAR_BASE_U],
      ['mid', MID_BASE_U],
    ] as const) {
      const shift = view.worldLeft * PARALLAX[which];
      const first = Math.floor(shift / width);
      if (which === 'mid' && alpha > 0)
        this.#midOffsetU = first * width - shift;
      this.#tiles(layer, which, count).forEach((image, i) => {
        const x = view.left + (first + i) * width - shift;
        image
          .setVisible(true)
          .setAlpha(alpha)
          .setScale(
            (1 + TILE_OVERLAP_U / width) / this.#pxPerU,
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
