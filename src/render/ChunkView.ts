import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig.ts';
import {
  TRACK_BED_DEPTH_U,
  TRACK_TILE_STEP_U,
  trackTileParts,
  worldParts,
} from '../content/worldArt.ts';
import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { embankmentU } from '../domain/world/Terrain.ts';
import { trackTilePlacements } from './trackTiles.ts';

const CHUNK_WIDTH_U = gameConfig.world.chunkWidthU;
/** How far below the rail the ground reaches; below any screen. */
const GROUND_DEPTH_U = 1200;
/**
 * Each chunk's ground reaches this far into the next one: abutting
 * anti-aliased polygon edges leave a light seam column on Canvas.
 */
const GROUND_OVERLAP_U = 4;

/** Countryside colours of the ground around the track. */
const GROUND = {
  /** Embankment face; matches the bottom row of the track tiles. */
  bank: 0x5f9a34,
  bankShade: 0x4c8228,
  /** Meadow bands from the bank foot towards the viewer. */
  meadow: [
    { fromU: 0, color: 0x8ecd60 },
    { fromU: 24, color: 0x8ac95c },
    { fromU: 52, color: 0x85c457 },
    { fromU: 86, color: 0x80bf52 },
    { fromU: 126, color: 0x7aba4d },
    { fromU: 172, color: 0x74b448 },
    { fromU: 226, color: 0x6eae43 },
  ],
} as const;

/** Atlas the track tiles are drawn from. */
export interface ChunkArt {
  texture: string;
  pxPerU: number;
}

/**
 * Ground and track of one chunk (doc 07 §3 layers 5–6): embankment face and
 * meadow bands (Graphics, behind the track) and the rotated track tiles
 * (atlas images). Owns its game objects; `destroy` releases all of them.
 * Coordinates are chunk-local; `setX` places the chunk on screen.
 */
export class ChunkView {
  readonly #ground: Phaser.GameObjects.Graphics;
  readonly #track: Phaser.GameObjects.Container | Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    table: ArcLengthTable,
    seed: number,
    art: ChunkArt | undefined,
    depths: { ground: number; track: number },
  ) {
    this.#ground = scene.add.graphics().setDepth(depths.ground);
    paintGround(this.#ground, table, seed);
    this.#track = art
      ? trackTiles(scene, table, art).setDepth(depths.track)
      : plainTrack(scene, table).setDepth(depths.track);
  }

  setX(x: number): void {
    this.#ground.setPosition(x, 0);
    this.#track.setPosition(x, 0);
  }

  destroy(): void {
    this.#ground.destroy();
    this.#track.destroy();
  }
}

/** Height of the meadow below the rail at chunk sample `i`, render y. */
function meadowTop(table: ArcLengthTable, seed: number, i: number): number {
  const railY = -(table.ys[i] ?? 0);
  return railY + TRACK_BED_DEPTH_U + embankmentU(seed, table.xs[i] ?? 0);
}

/**
 * Every how many track samples the ground outlines take a vertex. Graphics
 * paths are triangulated every frame, so the smooth ground uses coarser
 * outlines than the track (32 u at 8 u samples); the track tiles overlap
 * the bank top by more than the chord error.
 */
const GROUND_SAMPLE_STRIDE = 4;

/** Sample indices of the ground outlines, always with both chunk ends. */
function groundSamples(table: ArcLengthTable): number[] {
  const last = table.xs.length - 1;
  const indices: number[] = [];
  for (let i = 0; i < last; i += GROUND_SAMPLE_STRIDE) indices.push(i);
  indices.push(last);
  return indices;
}

/** Polygon between two lines over the chunk samples, past the right edge. */
function band(
  table: ArcLengthTable,
  top: (i: number) => number,
  bottom: (i: number) => number,
): Phaser.Math.Vector2[] {
  const x0 = table.xs[0] ?? 0;
  const samples = groundSamples(table);
  const last = table.xs.length - 1;
  const line = (y: (i: number) => number) => [
    ...samples.map(
      (i) => new Phaser.Math.Vector2((table.xs[i] ?? x0) - x0, y(i)),
    ),
    new Phaser.Math.Vector2(CHUNK_WIDTH_U + GROUND_OVERLAP_U, y(last)),
  ];
  return [...line(top), ...line(bottom).reverse()];
}

function paintGround(
  g: Phaser.GameObjects.Graphics,
  table: ArcLengthTable,
  seed: number,
): void {
  const railY = (i: number) => -(table.ys[i] ?? 0);
  const meadow = (i: number) => meadowTop(table, seed, i);
  // Embankment face from under the track tiles down to the meadow.
  g.fillStyle(GROUND.bank, 1);
  g.fillPoints(
    band(
      table,
      (i) => railY(i) + TRACK_BED_DEPTH_U - 2,
      (i) => meadow(i) + 1,
    ),
    true,
  );
  // Meadow in bands that darken towards the viewer.
  GROUND.meadow.forEach((stripe, n) => {
    const next = GROUND.meadow[n + 1];
    g.fillStyle(stripe.color, 1);
    g.fillPoints(
      band(
        table,
        (i) => meadow(i) + stripe.fromU,
        (i) => (next ? meadow(i) + next.fromU + 1 : GROUND_DEPTH_U),
      ),
      true,
    );
  });
  // Soft shadow where the bank meets the meadow.
  const x0 = table.xs[0] ?? 0;
  g.lineStyle(1.6, GROUND.bankShade, 0.7);
  g.strokePoints(
    groundSamples(table).map(
      (i) => new Phaser.Math.Vector2((table.xs[i] ?? x0) - x0, meadow(i)),
    ),
    false,
    false,
  );
}

function trackTiles(
  scene: Phaser.Scene,
  table: ArcLengthTable,
  art: ChunkArt,
): Phaser.GameObjects.Container {
  const container = scene.add.container(0, 0);
  for (const tile of trackTilePlacements(
    table,
    trackTileParts,
    TRACK_TILE_STEP_U,
  )) {
    const part = worldParts[tile.part];
    const image = scene.add.image(tile.x, tile.y, art.texture, tile.part);
    image
      .setOrigin(
        (part.pivotU.x * art.pxPerU) / image.frame.width,
        (part.pivotU.y * art.pxPerU) / image.frame.height,
      )
      .setScale(1 / art.pxPerU)
      .setRotation(tile.rotation);
    container.add(image);
  }
  return container;
}

/** Fallback without art: sleepers and a rail line. */
function plainTrack(
  scene: Phaser.Scene,
  table: ArcLengthTable,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
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
  return g;
}
