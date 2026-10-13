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
  arcAtX,
  sampleArcLengthTable,
  type ArcLengthTable,
} from '../domain/world/ArcLengthTable.ts';
import {
  SECONDARY_SCALE,
  secondarySiteOfChunk,
} from '../domain/world/SecondaryTrack.ts';
import { frameOrigin } from './atlasPacking.ts';
import { portalFootPoints } from './tunnelCover.ts';
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
          .setRotation(
            -Math.atan(
              sampleArcLengthTable(table, arcAtX(table, worldX)).grade,
            ),
          )
          .setScale(1 / art.pxPerU),
      );
    }
  };
  if (site.fromX >= x0 && site.fromX < x0 + chunkWidthU)
    portal(site.fromX, false);
  if (site.toX > x0 && site.toX <= x0 + chunkWidthU) portal(site.toX, true);
  return [track, mouths, hills];
}

/**
 * Close the hill's bottom against the NPC's own track, also without art.
 * The ride owns each graphic with its rendered portal chunk, independently of NPCs.
 */
export function secondaryPortalFeet(
  scene: Phaser.Scene,
  site: { fromX: number; toX: number },
  railY: (worldX: number) => number,
  depth: number,
  chunkIndex: number,
): Phaser.GameObjects.Graphics[] {
  return (
    [
      [site.fromX, false],
      [site.toX, true],
    ] as const
  )
    .filter(
      ([x, mirrored]) =>
        (mirrored
          ? Math.ceil(x / chunkWidthU) - 1
          : Math.floor(x / chunkWidthU)) === chunkIndex,
    )
    .map(([x, mirrored]) => {
      const graphics = scene.add.graphics().setDepth(depth - 0.005);
      // The domain removes the last tail at the portal centre; hide it before then.
      const angle = Math.atan((railY(x + 1) - railY(x - 1)) / 2);
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const point = (dx: number, dy: number) =>
        new Phaser.Math.Vector2(
          x + dx * cos - dy * sin,
          railY(x) + dx * sin + dy * cos,
        );
      const rearX = mirrored ? 36 : -36;
      graphics.fillStyle(0x24211e, 1);
      graphics.fillPoints(
        [point(0, -110), point(rearX, -110), point(rearX, 12), point(0, 12)],
        true,
      );
      graphics.fillStyle(0x6eae43, 1);
      graphics.fillPoints(
        portalFootPoints(x, mirrored, railY).map(
          (point) => new Phaser.Math.Vector2(point.x, point.y),
        ),
        true,
      );
      return graphics;
    });
}
