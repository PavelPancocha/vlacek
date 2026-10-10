import type { ArtPart } from './artManifest.ts';

/**
 * World art manifest (D-011): track and scenery parts, hand-authored SVG
 * in `assets/world/` in world units, drawn from the same atlas as the
 * vehicles. Positions come from here and from the world generator.
 */
export const worldParts = {
  'track.tile-a': {
    file: 'track.tile-a.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.tile-b': {
    file: 'track.tile-b.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.tile-c': {
    file: 'track.tile-c.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
} satisfies Record<string, ArtPart>;

export type WorldPartKey = keyof typeof worldParts;

/**
 * Track tiles start every `TRACK_TILE_STEP_U` along x; their extra width
 * overlaps the next tile and hides the joints. The rail top is the pivot.
 */
export const TRACK_TILE_STEP_U = 64;
export const trackTileParts: readonly WorldPartKey[] = [
  'track.tile-a',
  'track.tile-b',
  'track.tile-c',
];

/** Track bed depth below the rail top that the tiles cover. */
export const TRACK_BED_DEPTH_U = 22;
