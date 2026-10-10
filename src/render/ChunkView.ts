import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig.ts';
import type { ArtPart } from '../content/artManifest.ts';
import {
  TRACK_BED_DEPTH_U,
  TRACK_TILE_STEP_U,
  trackTileSets,
  worldParts,
} from '../content/worldArt.ts';
import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { hash32 } from '../domain/world/Hash.ts';
import {
  NEAR_DEPTH_RANGE_U,
  WATER_END_U,
  nearDepthScale,
  type ChunkScenery,
  type SceneryProp,
  type WaterBasin,
} from '../domain/world/Scenery.ts';
import type {
  BackGround,
  GroundSpan,
  NearGround,
} from '../domain/world/sceneryTemplates.ts';
import { embankmentU } from '../domain/world/Terrain.ts';
import {
  BACK_PALETTE,
  NEAR_PALETTE,
  WATER_PALETTE,
  type WaterPalette,
} from './groundPalette.ts';
import { frameOrigin } from './atlasPacking.ts';
import { trackTilePlacements } from './trackTiles.ts';

const CHUNK_WIDTH_U = gameConfig.world.chunkWidthU;
/** How far below the rail the ground reaches; below any screen. */
const GROUND_DEPTH_U = 1200;
/**
 * Each chunk's ground reaches this far into the next one: abutting
 * anti-aliased polygon edges leave a light seam column on Canvas.
 */
const GROUND_OVERLAP_U = 4;
/** Ground behind the track: from the rails up to its horizon. */
export const BACK_PLANE_U = 220;
/** Near props stand at least this far below the bank foot. */
export const NEAR_FOOT_OFFSET_U = 8;
/** Field edges lean up to this far over the depth of the back ground. */
const FIELD_EDGE_LEAN_U = 40;
/** Water keeps this far from its basin's ends (its shore lies there). */
const WATER_SIDE_U = 10;
/** A road bends away to the horizon over this many u at each end. */
const ROAD_BEND_U = 90;
/** Road width at the track (narrower with distance). */
const ROAD_WIDTH_U = 22;
/**
 * Every how many track samples the ground outlines take a vertex (32 u at
 * 8 u samples); the track tiles overlap the bank top by more than the
 * chord error.
 */
const GROUND_SAMPLE_STRIDE = 4;
/**
 * The ground is painted once per chunk into a texture (D-013): Phaser
 * re-triangulates Graphics paths every frame. Soft colour fields keep
 * their look at up to 1 px/u, which bounds texture memory per chunk.
 */
const GROUND_MAX_PX_PER_U = 1;
/** Meadow below the last band is a plain rectangle, not texture. */
const NEAR_TAIL_U = 24;

let bakedSerial = 0;

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

/** Atlas the chunk's art is drawn from. */
export interface ChunkArt {
  texture: string;
  pxPerU: number;
}

export interface ChunkDepths {
  backGround: number;
  backProps: number;
  ground: number;
  track: number;
  nearProps: number;
}

interface MovingProp {
  image: Phaser.GameObjects.Image;
  prop: SceneryProp;
}

/**
 * Everything of one chunk except the train (doc 07 §3 layers 4–6 and 8):
 * the ground behind the track and its props, the embankment and meadow,
 * the track tiles and the low props of the near meadow. Owns its game
 * objects; `destroy` releases all of them. Coordinates are chunk-local;
 * `setX` places the chunk on screen and `update` moves its tractors, cars
 * and boats by simulation time (so a paused ride stands still).
 */
export class ChunkView {
  readonly #table: ArcLengthTable;
  readonly #seed: number;
  readonly #pxPerU: number;
  readonly #scene: Phaser.Scene;
  readonly #objects: Phaser.GameObjects.Container[] = [];
  /** Baked ground textures, removed with the chunk. */
  readonly #textures: string[] = [];
  readonly #moving: MovingProp[] = [];
  readonly #near: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    table: ArcLengthTable,
    seed: number,
    scenery: ChunkScenery,
    art: ChunkArt | undefined,
    depths: ChunkDepths,
  ) {
    this.#scene = scene;
    this.#table = table;
    this.#seed = seed;
    this.#pxPerU = art?.pxPerU ?? 1;
    const groundScale = Math.min(this.#pxPerU, GROUND_MAX_PX_PER_U);
    let lowRail = Infinity;
    let highRail = -Infinity;
    for (const y of table.ys) {
      lowRail = Math.min(lowRail, y);
      highRail = Math.max(highRail, y);
    }
    const reach = FIELD_EDGE_LEAN_U + GROUND_OVERLAP_U + 8;
    const back = this.#bake(
      (g) => {
        for (const span of scenery.back) this.#paintBack(g, span);
        for (const basin of scenery.water) {
          const middle = (basin.fromX + basin.toX) / 2;
          const coast = scenery.near.some(
            (span) =>
              span.style === 'sand' &&
              middle >= span.fromX &&
              middle < span.toX,
          );
          this.#paintWater(g, basin, WATER_PALETTE[coast ? 'sea' : 'lake']);
        }
        // Cars drive on a road (doc 04 §6: a car gets a road).
        for (const prop of scenery.props)
          if (prop.kind === 'back.car' && prop.motion) this.#paintRoad(g, prop);
      },
      {
        left: -reach,
        right: CHUNK_WIDTH_U + reach,
        top: -highRail - BACK_PLANE_U - 8,
        bottom: -lowRail + 8,
      },
      groundScale,
    ).setDepth(depths.backGround);
    // The meadow's bands end on one level line; plain colour below it.
    let meadowBottom = -Infinity;
    for (let x = 0; x <= CHUNK_WIDTH_U; x += 16)
      meadowBottom = Math.max(meadowBottom, this.#meadowTop(x));
    const bandsEnd =
      meadowBottom +
      Math.max(
        ...scenery.near.map(
          (span) => NEAR_PALETTE[span.style].bands.at(-1)?.fromU ?? 0,
        ),
      ) +
      NEAR_TAIL_U;
    const ground = this.#bake(
      (g) => {
        for (const span of scenery.near) this.#paintNear(g, span, bandsEnd);
      },
      {
        left: -4,
        right: CHUNK_WIDTH_U + GROUND_OVERLAP_U + 4,
        top: -highRail + TRACK_BED_DEPTH_U - 6,
        bottom: bandsEnd,
      },
      groundScale,
    ).setDepth(depths.ground);
    for (const span of scenery.near)
      ground.add(
        scene.add
          .rectangle(
            span.fromX,
            bandsEnd - 1,
            span.toX - span.fromX + GROUND_OVERLAP_U,
            GROUND_DEPTH_U,
            NEAR_PALETTE[span.style].bands.at(-1)?.color ?? 0x74b448,
          )
          .setOrigin(0, 0),
      );
    this.#objects.push(back, ground);
    if (!art) {
      // Baked too: without MSAA a live line would alias (D-013).
      this.#objects.push(
        this.#bake(
          (g) => paintPlainTrack(g, table),
          {
            left: -4,
            right: CHUNK_WIDTH_U + 4,
            top: -highRail - 8,
            bottom: -lowRail + 12,
          },
          groundScale,
        ).setDepth(depths.track),
      );
      return;
    }
    const nearAt = (x: number): NearGround =>
      scenery.near.find((span) => x >= span.fromX && x < span.toX)?.style ??
      'meadow';
    const track = scene.add.container(0, 0).setDepth(depths.track);
    for (const tile of trackTilePlacements(
      table,
      (x) => trackTileSets[nearAt(x)],
      TRACK_TILE_STEP_U,
    )) {
      const image = this.#image(scene, art, tile.part, false);
      image
        .setPosition(tile.x, tile.y)
        .setScale(1 / art.pxPerU)
        .setRotation(tile.rotation);
      track.add(image);
    }
    const backProps = scene.add.container(0, 0).setDepth(depths.backProps);
    const nearProps = scene.add.container(0, 0).setDepth(depths.nearProps);
    // Far props first, near ones last; nearer meadow props cover farther.
    const ordered = [...scenery.props].sort((a, b) =>
      a.layer === 'back' ? b.depth - a.depth : a.depth - b.depth,
    );
    for (const prop of ordered) {
      if (parts[prop.kind] === undefined) continue;
      const image = this.#image(scene, art, prop.kind, prop.flip);
      this.#placeProp(image, prop, prop.xU);
      (prop.layer === 'back' ? backProps : nearProps).add(image);
      if (prop.layer === 'near') this.#near.push(image);
      if (prop.motion) this.#moving.push({ image, prop });
    }
    this.#objects.push(track, backProps, nearProps);
  }

  /** Near-meadow props, for the "never covers the train" check. */
  get nearProps(): readonly Phaser.GameObjects.Image[] {
    return this.#near;
  }

  setX(x: number): void {
    for (const object of this.#objects) object.setPosition(x, 0);
  }

  /** Moves patrolling props (tractor, car, boats) to simulation time. */
  update(timeSec: number): void {
    for (const { image, prop } of this.#moving) {
      const motion = prop.motion;
      if (!motion) continue;
      // Triangle wave over the patrol range, one leg per range length.
      const legs =
        (timeSec * motion.speedUPerSec) / motion.rangeU + 2 * prop.phase;
      const t = legs - 2 * Math.floor(legs / 2);
      const forward = t < 1;
      const offset = (forward ? t : 2 - t) * motion.rangeU - motion.rangeU / 2;
      const x = Math.max(0, Math.min(CHUNK_WIDTH_U, prop.xU + offset));
      this.#placeProp(image, prop, x);
      // The art faces right; it turns round on the way back.
      image.setFlipX(!forward);
    }
  }

  destroy(): void {
    for (const object of this.#objects) object.destroy();
    this.#objects.length = 0;
    for (const key of this.#textures) this.#scene.textures.remove(key);
    this.#textures.length = 0;
    this.#moving.length = 0;
    this.#near.length = 0;
  }

  /**
   * Paints with Graphics once into a canvas texture covering `bounds`
   * (chunk-local u) at `scale` px per u; returns a container holding it.
   */
  #bake(
    paint: (g: Phaser.GameObjects.Graphics) => void,
    bounds: { left: number; top: number; right: number; bottom: number },
    scale: number,
  ): Phaser.GameObjects.Container {
    const scene = this.#scene;
    const g = scene.make.graphics({}, false);
    g.translateCanvas(-bounds.left, -bounds.top);
    paint(g);
    g.setScale(scale);
    bakedSerial += 1;
    const key = `ground:${this.#table.chunkIndex}:${bakedSerial}`;
    g.generateTexture(
      key,
      Math.max(1, Math.ceil((bounds.right - bounds.left) * scale)),
      Math.max(1, Math.ceil((bounds.bottom - bounds.top) * scale)),
    );
    g.destroy();
    this.#textures.push(key);
    const image = scene.add
      .image(bounds.left, bounds.top, key)
      .setOrigin(0, 0)
      .setScale(1 / scale);
    return scene.add.container(0, 0, [image]);
  }

  #image(
    scene: Phaser.Scene,
    art: ChunkArt,
    key: string,
    flip: boolean,
  ): Phaser.GameObjects.Image {
    const part = parts[key];
    const image = scene.add.image(0, 0, art.texture, key).setFlipX(flip);
    if (part) {
      const origin = frameOrigin(part.pivotU, art.pxPerU, image.frame);
      image.setOrigin(origin.x, origin.y);
    }
    return image;
  }

  #placeProp(
    image: Phaser.GameObjects.Image,
    prop: SceneryProp,
    x: number,
  ): void {
    // Farther back props are a little smaller, nearer meadow ones larger.
    const depthScale =
      prop.layer === 'back'
        ? 1 - 0.35 * prop.depth
        : nearDepthScale(prop.depth);
    const y =
      prop.layer === 'back'
        ? -this.#railAt(x) - prop.depth * BACK_PLANE_U
        : this.#meadowTop(x) +
          NEAR_FOOT_OFFSET_U +
          prop.depth * NEAR_DEPTH_RANGE_U;
    image.setPosition(x, y).setScale((prop.scale * depthScale) / this.#pxPerU);
  }

  /** Rail height (world, up) at a chunk-local x. */
  #railAt(x: number): number {
    const xs = this.#table.xs;
    const x0 = xs[0] ?? 0;
    const spacing = (xs[1] ?? x0 + 1) - x0;
    const i = Math.max(0, Math.min(xs.length - 2, Math.floor(x / spacing)));
    const t = (x - i * spacing) / spacing;
    const a = this.#table.ys[i] ?? 0;
    return a + ((this.#table.ys[i + 1] ?? a) - a) * t;
  }

  /** Render y of the meadow below the embankment at a chunk-local x. */
  #meadowTop(x: number): number {
    const x0 = this.#table.xs[0] ?? 0;
    return (
      -this.#railAt(x) + TRACK_BED_DEPTH_U + embankmentU(this.#seed, x0 + x)
    );
  }

  /** Coarse sample positions inside [fromX, toX], ends included. */
  #samples(fromX: number, toX: number): number[] {
    const spacing = GROUND_SAMPLE_STRIDE * gameConfig.world.arcSampleSpacingU;
    const xs = [fromX];
    for (let x = Math.ceil(fromX / spacing) * spacing; x < toX; x += spacing)
      if (x > fromX) xs.push(x);
    xs.push(toX);
    return xs;
  }

  /** Polygon between two lines over a span, reaching into its neighbour. */
  #band(
    fromX: number,
    toX: number,
    top: (x: number) => number,
    bottom: (x: number) => number,
  ): Phaser.Math.Vector2[] {
    // Spans reach into their right neighbour, so no seam column opens.
    const end = toX + GROUND_OVERLAP_U;
    const xs = this.#samples(fromX, toX);
    const line = (y: (x: number) => number) => [
      ...xs.map((x) => new Phaser.Math.Vector2(x, y(x))),
      new Phaser.Math.Vector2(end, y(toX)),
    ];
    return [...line(top), ...line(bottom).reverse()];
  }

  #paintNear(
    g: Phaser.GameObjects.Graphics,
    span: GroundSpan<NearGround>,
    bandsEnd: number,
  ): void {
    const palette = NEAR_PALETTE[span.style];
    const rail = (x: number) => -this.#railAt(x);
    const meadow = (x: number) => this.#meadowTop(x);
    // Embankment face from under the track tiles down to the meadow.
    g.fillStyle(palette.bank, 1);
    g.fillPoints(
      this.#band(
        span.fromX,
        span.toX,
        (x) => rail(x) + TRACK_BED_DEPTH_U - 2,
        (x) => meadow(x) + 1,
      ),
      true,
    );
    // Meadow in bands that darken towards the viewer.
    palette.bands.forEach((stripe, n) => {
      const next = palette.bands[n + 1];
      g.fillStyle(stripe.color, 1);
      g.fillPoints(
        this.#band(
          span.fromX,
          span.toX,
          (x) => meadow(x) + stripe.fromU,
          (x) => (next ? meadow(x) + next.fromU + 1 : bandsEnd + 2),
        ),
        true,
      );
    });
    // Soft shadow where the bank meets the meadow.
    g.lineStyle(1.6, palette.bankShade, 0.7);
    g.strokePoints(
      this.#samples(span.fromX, span.toX).map(
        (x) => new Phaser.Math.Vector2(x, meadow(x)),
      ),
      false,
      false,
    );
  }

  /**
   * Field edges recede towards the horizon instead of standing upright:
   * a boundary at world x leans by a seeded amount, the same for both
   * chunks that share it (chunk edges included).
   */
  #lean(localX: number): number {
    const worldX = Math.round((this.#table.xs[0] ?? 0) + localX);
    return (
      ((hash32('field-edge', this.#seed, worldX) % 1000) / 1000 - 0.5) *
      2 *
      FIELD_EDGE_LEAN_U
    );
  }

  #paintBack(
    g: Phaser.GameObjects.Graphics,
    span: GroundSpan<BackGround>,
  ): void {
    const palette = BACK_PALETTE[span.style];
    const rail = (x: number) => -this.#railAt(x);
    const depthY = (x: number, depth: number) => rail(x) - depth * BACK_PLANE_U;
    const leanLeft = this.#lean(span.fromX);
    const leanRight = this.#lean(span.toX);
    /** Edge x at a depth: leaning back from the near end. */
    const leftAt = (depth: number) => span.fromX + leanLeft * (2 * depth - 1);
    const rightAt = (depth: number) =>
      span.toX + leanRight * (2 * depth - 1) + GROUND_OVERLAP_U;
    /** Band between two depths, cut by the leaning edges. */
    const band = (near: number, far: number, below = 0) => {
      const line = (depth: number, dy: number) =>
        this.#samples(leftAt(depth), rightAt(depth)).map(
          (x) => new Phaser.Math.Vector2(x, depthY(x, depth) + dy),
        );
      return [...line(far, 0), ...line(near, below).reverse()];
    };
    // From a little in front of the rails (under the track tiles) up.
    g.fillStyle(palette.base, 1);
    g.fillPoints(band(0, 1, 4), true);
    // Soft patches, flatter towards the horizon (fewer on fields).
    const chunk = this.#table.chunkIndex;
    const patches = palette.rows === undefined ? 7 : 3;
    for (let i = 0; i < patches; i++) {
      const h = hash32('ground-patch', chunk, span.fromX, i);
      const depth = 0.1 + ((h % 1000) / 1000) * 0.8;
      const x =
        leftAt(depth) +
        (((h >>> 10) % 1000) / 1000) * (rightAt(depth) - leftAt(depth));
      const width = (50 + ((h >>> 20) % 90)) * (1 - 0.5 * depth);
      if (x - width < leftAt(depth) || x + width > rightAt(depth)) continue;
      g.fillStyle(
        palette.patches[i % palette.patches.length] ?? palette.base,
        0.7,
      );
      g.fillEllipse(
        x,
        depthY(x, depth),
        width * 2,
        width * 0.22 * (1 - 0.5 * depth),
      );
    }
    // A darker strip along the horizon: hedges, the far shore, drifts.
    g.fillStyle(palette.edge, 1);
    g.fillPoints(band(0.968, 1), true);
    if (palette.rows !== undefined) {
      // Crop rows, closer together and thinner towards the horizon.
      for (const depth of [0.12, 0.27, 0.42, 0.56, 0.69, 0.8, 0.9]) {
        g.lineStyle(3.2 - 2.4 * depth, palette.rows, 1);
        g.strokePoints(
          this.#samples(leftAt(depth), rightAt(depth) - GROUND_OVERLAP_U).map(
            (x) => new Phaser.Math.Vector2(x, depthY(x, depth)),
          ),
          false,
          false,
        );
      }
    }
  }

  /**
   * A village road under a patrolling car: level along its patrol at the
   * car's depth, curving away to the horizon at both ends and narrower
   * with distance; asphalt with a dashed middle line.
   */
  #paintRoad(g: Phaser.GameObjects.Graphics, prop: SceneryProp): void {
    const range = prop.motion?.rangeU ?? 0;
    const bend = ROAD_BEND_U;
    const from = Math.max(bend, prop.xU - range / 2 - 12);
    const to = Math.min(CHUNK_WIDTH_U - bend, prop.xU + range / 2 + 12);
    const rail = (x: number) => -this.#railAt(x);
    // Centre line as (x, depth): in from the horizon, straight, out again.
    const path: [number, number][] = [];
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push([
        from - bend * (1 - t),
        prop.depth + (1 - prop.depth) * (1 - t) ** 2,
      ]);
    }
    for (let x = from + 32; x < to; x += 32) path.push([x, prop.depth]);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      path.push([to + bend * t, prop.depth + (1 - prop.depth) * t ** 2]);
    }
    // The car's wheels stand on the near half of the road.
    const points = path.map(([x, depth]) => ({
      x,
      y: rail(x) - depth * BACK_PLANE_U - ROAD_WIDTH_U * 0.3 * (1 - depth),
      half: (ROAD_WIDTH_U / 2) * (1 - 0.7 * depth),
    }));
    // Offset along the screen normal, so the bends keep their width.
    const side = (sign: number, grow = 0) =>
      points.map((point, i) => {
        const before = points[Math.max(0, i - 1)] ?? point;
        const after = points[Math.min(points.length - 1, i + 1)] ?? point;
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        const length = Math.hypot(dx, dy) || 1;
        const offset = sign * (point.half + grow);
        return new Phaser.Math.Vector2(
          point.x - (dy / length) * offset,
          point.y + (dx / length) * offset,
        );
      });
    const strip = (grow: number) => [
      ...side(-1, grow),
      ...side(1, grow).reverse(),
    ];
    g.fillStyle(0x6f8f52, 0.45);
    g.fillPoints(strip(1.6), true);
    g.fillStyle(0x8e8d88, 1);
    g.fillPoints(strip(0), true);
    g.lineStyle(1, 0x6c6b66, 1);
    g.strokePoints(side(1), false, false);
    g.lineStyle(0.8, 0xb5b3ad, 1);
    g.strokePoints(side(-1), false, false);
    // Dashed middle line along the straight part.
    g.lineStyle(1.2, 0xf4f1e6, 0.9);
    const straight = points.filter((point) => point.x >= from && point.x <= to);
    for (let i = 0; i + 1 < straight.length; i++) {
      const a = straight[i];
      const b = straight[i + 1];
      if (!a || !b) continue;
      g.lineBetween(
        a.x + 6,
        a.y + ((b.y - a.y) * 6) / 32,
        a.x + 18,
        a.y + ((b.y - a.y) * 18) / 32,
      );
    }
  }

  /**
   * A level basin (WaterBasin): the far edge stays level at the height of
   * the basin's highest rail point, the near shore follows the bank behind
   * the track, and both ends curve in over WATER_END_U. Painted in bands
   * from the far edge to the near shore, with a shore ring and ripples.
   */
  #paintWater(
    g: Phaser.GameObjects.Graphics,
    basin: WaterBasin,
    palette: WaterPalette,
  ): void {
    const rail = (x: number) => -this.#railAt(x);
    const from = basin.fromX + WATER_SIDE_U;
    const to = basin.toX - WATER_SIDE_U;
    let level = Infinity;
    for (let x = from; x <= to; x += 16) level = Math.min(level, rail(x));
    const far = (x: number) =>
      Math.max(
        level - basin.farDepth * BACK_PLANE_U,
        rail(x) - BACK_PLANE_U + 4,
      );
    const near = (x: number) => rail(x) - basin.nearDepth * BACK_PLANE_U;
    // Sample densely at the curved ends, coarsely in between.
    const xs: number[] = [];
    for (let x = from; x < from + WATER_END_U; x += 6) xs.push(x);
    for (let x = from + WATER_END_U; x < to - WATER_END_U; x += 32) xs.push(x);
    for (let x = to - WATER_END_U; x < to; x += 6) xs.push(x);
    xs.push(to);
    /** How much of the depth range the water covers at x (ends curve in). */
    const open = (x: number) => {
      const end = Math.min(x - from, to - x) / (WATER_END_U - WATER_SIDE_U);
      const f = Math.max(0, Math.min(1, end));
      return Math.sqrt(1 - (1 - f) * (1 - f));
    };
    /** Outline between two fractions of the water (0 far edge … 1 near). */
    const outline = (t0: number, t1: number): Phaser.Math.Vector2[] => {
      const point = (x: number, t: number) => {
        const top = far(x);
        const bottom = near(x);
        // The curve closes towards a point a little nearer than the middle.
        const middle = top + (bottom - top) * 0.55;
        const k = open(x);
        const y = middle + (top + (bottom - top) * t - middle) * k;
        return new Phaser.Math.Vector2(x, y);
      };
      return [
        ...xs.map((x) => point(x, t0)),
        ...[...xs].reverse().map((x) => point(x, t1)),
      ];
    };
    const whole = outline(0, 1);
    g.lineStyle(9, palette.shore, 1);
    g.strokePoints(whole, true, true);
    g.lineStyle(4, palette.wetShore, 1);
    g.strokePoints(whole, true, true);
    g.fillStyle(palette.middle, 1);
    g.fillPoints(whole, true);
    g.fillStyle(palette.far, 1);
    g.fillPoints(outline(0, 0.34), true);
    g.fillStyle(palette.near, 1);
    g.fillPoints(outline(0.74, 1), true);
    g.fillStyle(palette.farEdge, 0.85);
    g.fillPoints(outline(0, 0.07), true);
    // Ripples: short level strokes, longer and brighter nearer the shore.
    const chunk = this.#table.chunkIndex;
    for (let i = 0; i < 34; i++) {
      const h = hash32('ripple', chunk, basin.fromX, i);
      const x = from + ((h % 1000) / 1000) * (to - from);
      const t = 0.12 + (((h >>> 10) % 1000) / 1000) * 0.8;
      const k = open(x);
      if (k < 0.8) continue;
      const top = far(x);
      const y = top + (near(x) - top) * t;
      const length = 6 + t * 18 + ((h >>> 20) % 10);
      g.lineStyle(0.8 + t * 1.2, palette.ripple, 0.35 + t * 0.35);
      g.lineBetween(x, y, x + length, y);
    }
  }
}

/** Fallback without art: sleepers and a rail line. */
function paintPlainTrack(
  g: Phaser.GameObjects.Graphics,
  table: ArcLengthTable,
): void {
  const x0 = table.xs[0] ?? 0;
  g.fillStyle(0x7a5c3e, 1);
  for (let i = 0; i < table.xs.length; i += 2) {
    g.fillRect((table.xs[i] ?? 0) - x0 - 3, -(table.ys[i] ?? 0) + 4, 6, 4);
  }
  g.lineStyle(4, 0x5b4a3a, 1);
  g.strokePoints(
    table.xs.map(
      (x, i) => new Phaser.Math.Vector2(x - x0, -(table.ys[i] ?? 0) + 2),
    ),
    false,
    false,
  );
}
