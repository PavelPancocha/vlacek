import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { hash32 } from '../domain/world/Hash.ts';

/** A track tile in chunk-local render coordinates (x right, y down). */
export interface TilePlacement<K extends string = string> {
  part: K;
  /** Tile start on the rail top, chunk-local. */
  x: number;
  y: number;
  /** Clockwise on screen, radians. */
  rotation: number;
}

/**
 * Track art along a chunk (doc 14 §3): one tile every `stepU` of x from
 * the chunk start, its rail on the chunk's own samples and turned along
 * the chord to the next tile start. Grades change slowly (D-009), so the
 * chords stay within a fraction of a unit of the curve and the tiles'
 * overlap hides the joints. Variants are a cosmetic choice per chunk and
 * tile, the same on every visit.
 */
export function trackTilePlacements<K extends string>(
  table: ArcLengthTable,
  parts: readonly K[],
  stepU: number,
): TilePlacement<K>[] {
  const x0 = table.xs[0] ?? 0;
  const spacing = (table.xs[1] ?? x0 + stepU) - x0;
  const stride = Math.round(stepU / spacing);
  const tiles: TilePlacement<K>[] = [];
  for (let i = 0; i + stride < table.xs.length; i += stride) {
    const x = (table.xs[i] ?? x0) - x0;
    const y = -(table.ys[i] ?? 0);
    const nextX = (table.xs[i + stride] ?? x0) - x0;
    const nextY = -(table.ys[i + stride] ?? 0);
    const part =
      parts[hash32('track-tile', table.chunkIndex, i) % parts.length];
    if (part === undefined) throw new RangeError('no track tile parts');
    tiles.push({
      part,
      x,
      y,
      rotation: Math.atan2(nextY - y, nextX - x),
    });
  }
  return tiles;
}
