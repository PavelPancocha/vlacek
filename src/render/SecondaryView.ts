import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig.ts';
import {
  TRACK_TILE_STEP_U,
  secondaryParts,
  trackTileSets,
  worldParts,
} from '../content/worldArt.ts';
import {
  heightAtX,
  type ArcLengthTable,
} from '../domain/world/ArcLengthTable.ts';
import {
  SECONDARY_SCALE,
  secondarySiteOfChunk,
} from '../domain/world/SecondaryTrack.ts';
import { frameOrigin } from './atlasPacking.ts';
import { trackTilePlacements } from './trackTiles.ts';

const { chunkWidthU, secondaryTrackOffsetU } = gameConfig.world;

export interface SecondaryArt {
  texture: string;
  pxPerU: number;
}

/**
 * Layers of the second track, all behind the main track: its tiles, the
 * tunnel mouths, the oncoming train (drawn by the ride scene) and the
 * portal hills over it.
 */
export interface SecondaryDepths {
  track: number;
  mouth: number;
  hill: number;
}

/**
 * The second track of a chunk in its visible stretch (doc 04 §7): track
 * tiles along the main profile `secondaryTrackOffsetU` deeper, drawn at
 * the deeper layer's scale, and a tunnel portal where the stretch begins
 * (facing right) or ends (mirrored). Chunk-local coordinates like the
 * ChunkView that owns the returned containers.
 */
export function chunkSecondaryTrack(
  scene: Phaser.Scene,
  art: SecondaryArt,
  table: ArcLengthTable,
  seed: number,
  depths: SecondaryDepths,
): Phaser.GameObjects.Container[] {
  const site = secondarySiteOfChunk(seed, table.chunkIndex);
  if (!site) return [];
  const x0 = table.chunkIndex * chunkWidthU;
  const track = scene.add.container(0, 0).setDepth(depths.track);
  for (const tile of trackTilePlacements(
    table,
    () => trackTileSets.meadow,
    TRACK_TILE_STEP_U,
  )) {
    const part = worldParts[tile.part];
    const image = scene.add.image(0, 0, art.texture, tile.part);
    const origin = frameOrigin(part.pivotU, art.pxPerU, image.frame);
    track.add(
      image
        .setOrigin(origin.x, origin.y)
        .setPosition(tile.x, tile.y - secondaryTrackOffsetU)
        .setScale(1 / art.pxPerU, SECONDARY_SCALE / art.pxPerU)
        .setRotation(tile.rotation),
    );
  }
  const mouths = scene.add.container(0, 0).setDepth(depths.mouth);
  const hills = scene.add.container(0, 0).setDepth(depths.hill);
  const portal = (worldX: number, mirrored: boolean) => {
    const x = worldX - x0;
    const y = -heightAtX(table, worldX) - secondaryTrackOffsetU;
    for (const [key, layer] of [
      [secondaryParts.mouth, mouths],
      [secondaryParts.hill, hills],
    ] as const) {
      const part = worldParts[key];
      const image = scene.add.image(x, y, art.texture, key);
      // A mirrored image keeps its origin: mirror the pivot as well.
      const pivot = mirrored
        ? { x: part.widthU - part.pivotU.x, y: part.pivotU.y }
        : part.pivotU;
      const origin = frameOrigin(pivot, art.pxPerU, image.frame);
      layer.add(
        image
          .setOrigin(origin.x, origin.y)
          .setFlipX(mirrored)
          .setScale(1 / art.pxPerU),
      );
    }
  };
  if (site.fromX >= x0 && site.fromX < x0 + chunkWidthU)
    portal(site.fromX, false);
  if (site.toX > x0 && site.toX <= x0 + chunkWidthU) portal(site.toX, true);
  return [track, mouths, hills];
}
