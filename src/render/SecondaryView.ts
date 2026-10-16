import { effectiveClimateAt } from '../domain/world/Seasons.ts';
import { frameTexture } from './frameTexture.ts';
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
import { setWorldPivot } from './worldImage.ts';
import { portalFootPoints } from './tunnelCover.ts';
import { trackTilePlacements } from './trackTiles.ts';

const { chunkWidthU, secondaryTrackOffsetU } = gameConfig.world;

export interface SecondaryArt {
  textureFor?: (frame: string) => string | undefined;
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
    const image = scene.add
      .image(0, 0, frameTexture(tile.part, art.texture), tile.part)
      .setData('world-part', tile.part);
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
      const image = scene.add
        .image(x, y, frameTexture(key, art.texture), key)
        .setData('world-part', key);
      // A mirrored image keeps its origin: mirror the pivot as well.
      const pivot = mirrored
        ? { x: part.widthU - part.pivotU.x, y: part.pivotU.y }
        : part.pivotU;
      layer.add(
        setWorldPivot(image, pivot, art.pxPerU)
          .setFlipX(mirrored)
          .setRotation(
            -Math.atan(
              sampleArcLengthTable(table, arcAtX(table, worldX)).grade,
            ),
          )
          .setScale(1 / art.pxPerU),
      );
    }
    const snow = effectiveClimateAt(seed, worldX).winter;
    if (snow > 0) {
      const cover = scene.add.graphics().setAlpha(snow);
      const sign = mirrored ? -1 : 1;
      const angle = -Math.atan(
        sampleArcLengthTable(table, arcAtX(table, worldX)).grade,
      );
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      const point = (dx: number, dy: number) =>
        new Phaser.Math.Vector2(
          x + sign * dx * cos - dy * sin,
          y + sign * dx * sin + dy * cos,
        );
      // Snow on the grassy flank only; masonry, arch and evergreen silhouettes keep their art.
      cover.fillStyle(0xe7f0f5, 1);
      cover.fillPoints(
        [
          point(-380, 6),
          point(-367, -44),
          point(-337, -104),
          point(-291, -146),
          point(-230, -168),
          point(-177, -175),
          point(-129, -173),
          point(-88, -165),
          point(-64, -145),
          point(-64, 6),
        ],
        true,
      );
      cover.lineStyle(3, 0xf8fbfd, 1);
      cover.strokePoints([
        point(-365, -42),
        point(-335, -101),
        point(-290, -143),
        point(-230, -165),
        point(-177, -172),
        point(-130, -170),
        point(-88, -162),
      ]);
      hills.add(cover);
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
  groundColourAt: (worldX: number) => number = () => 0x6eae43,
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
      graphics.fillStyle(groundColourAt(x), 1);
      graphics.fillPoints(
        portalFootPoints(x, mirrored, railY).map(
          (point) => new Phaser.Math.Vector2(point.x, point.y),
        ),
        true,
      );
      return graphics;
    });
}
