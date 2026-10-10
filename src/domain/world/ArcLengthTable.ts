import {
  profileGrade,
  profileHeightU,
  type TrackProfile,
} from './TrackProfile.ts';

/** Track point in world units: x right, y up; grade = dy/dx. */
export interface TrackSample {
  x: number;
  y: number;
  grade: number;
}

/** Samples of one chunk with cumulative length along the curve (doc 03 §5). */
export interface ArcLengthTable {
  chunkIndex: number;
  xs: readonly number[];
  ys: readonly number[];
  grades: readonly number[];
  cumulativeArcU: readonly number[];
  lengthU: number;
}

export function buildArcLengthTable(
  profile: TrackProfile,
  chunkIndex: number,
  chunkWidthU: number,
  maxSpacingU: number,
): ArcLengthTable {
  const segments = Math.ceil(chunkWidthU / maxSpacingU);
  const originX = chunkIndex * chunkWidthU;
  const xs: number[] = [];
  const ys: number[] = [];
  const grades: number[] = [];
  const cumulativeArcU: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const localX = i === segments ? chunkWidthU : (i * chunkWidthU) / segments;
    const y = profileHeightU(profile, localX);
    if (i === 0) cumulativeArcU.push(0);
    else {
      const previous = cumulativeArcU[i - 1] ?? 0;
      const dx = localX - ((xs[i - 1] ?? originX) - originX);
      cumulativeArcU.push(previous + Math.hypot(dx, y - (ys[i - 1] ?? y)));
    }
    xs.push(originX + localX);
    ys.push(y);
    grades.push(profileGrade(profile, localX));
  }
  return {
    chunkIndex,
    xs,
    ys,
    grades,
    cumulativeArcU,
    lengthU: cumulativeArcU[segments] ?? 0,
  };
}

/** Position at `arcU` along the chunk, clamped to its ends. */
export function sampleArcLengthTable(
  table: ArcLengthTable,
  arcU: number,
): TrackSample {
  const last = table.xs.length - 1;
  const at = (i: number): TrackSample => ({
    x: table.xs[i] ?? Number.NaN,
    y: table.ys[i] ?? Number.NaN,
    grade: table.grades[i] ?? Number.NaN,
  });
  if (!(arcU > 0)) return at(0);
  if (arcU >= table.lengthU) return at(last);
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((table.cumulativeArcU[middle] ?? 0) <= arcU) low = middle;
    else high = middle;
  }
  const a = at(low);
  const b = at(high);
  const startArc = table.cumulativeArcU[low] ?? 0;
  const f = (arcU - startArc) / ((table.cumulativeArcU[high] ?? 0) - startArc);
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    grade: a.grade + (b.grade - a.grade) * f,
  };
}

/** Arc offset of the point with chunk-global `x` (inverse lookup). */
export function arcAtX(table: ArcLengthTable, x: number): number {
  const last = table.xs.length - 1;
  if (!(x > (table.xs[0] ?? 0))) return 0;
  if (x >= (table.xs[last] ?? 0)) return table.lengthU;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((table.xs[middle] ?? 0) <= x) low = middle;
    else high = middle;
  }
  const x0 = table.xs[low] ?? 0;
  const f = (x - x0) / ((table.xs[high] ?? 0) - x0);
  const a0 = table.cumulativeArcU[low] ?? 0;
  return a0 + ((table.cumulativeArcU[high] ?? 0) - a0) * f;
}

/**
 * Rail height at chunk-global `x`, straight between the samples (as the
 * track is drawn); clamped to the chunk's ends.
 */
export function heightAtX(table: ArcLengthTable, x: number): number {
  const last = table.xs.length - 1;
  if (!(x > (table.xs[0] ?? 0))) return table.ys[0] ?? 0;
  if (x >= (table.xs[last] ?? 0)) return table.ys[last] ?? 0;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((table.xs[middle] ?? 0) <= x) low = middle;
    else high = middle;
  }
  const x0 = table.xs[low] ?? 0;
  const f = (x - x0) / ((table.xs[high] ?? 0) - x0);
  const y0 = table.ys[low] ?? 0;
  return y0 + ((table.ys[high] ?? 0) - y0) * f;
}
