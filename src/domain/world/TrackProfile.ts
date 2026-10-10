import { gameConfig } from '../../config/gameConfig.ts';
import { unitRandom } from './Hash.ts';

/**
 * Track generator v1 (doc 14 §6, D-009). The track is planned in blocks of
 * `blockChunks` chunks: flats and long constant grades in irregular lengths,
 * joined by short parabolic transitions (vertical curves), so the grade
 * changes only briefly and never with a kink. Every block starts and ends
 * flat at a seeded height, so any chunk is computed from its own block
 * alone, also far from the start. Version 0 (smootherstep waves of 0.1)
 * journeys are not regenerated under v1 (D-005).
 */
export const TRACK_GENERATOR_VERSION = 1;

/** Point of the straight-line plan; x local to its block or chunk. */
export interface ProfileVertex {
  xU: number;
  yU: number;
}

/** A chunk's view of its block plan, x local to the chunk. */
export interface TrackProfile {
  vertices: readonly ProfileVertex[];
  transitionU: number;
}

const { chunkWidthU } = gameConfig.world;
const plan = gameConfig.world.profile;
const BLOCK_U = plan.blockChunks * chunkWidthU;

function random(seed: number, key: string, ...parts: number[]): number {
  return unitRandom(seed, TRACK_GENERATOR_VERSION, key, ...parts);
}

/** Seeded length in [min, max], a multiple of the length step. */
function length(
  seed: number,
  key: string,
  b: number,
  i: number,
  min: number,
  max: number,
): number {
  const steps = Math.floor((max - min) / plan.lengthStepU);
  return (
    min + Math.floor(random(seed, key, b, i) * (steps + 1)) * plan.lengthStepU
  );
}

/** Height of the boundary where block `b` starts. */
function blockStartHeightU(seed: number, b: number): number {
  const roll = random(seed, 'block-height', b);
  return Math.round((2 * roll - 1) * plan.blockHeightRangeU);
}

/** Shortest slope reaching a height difference at the steepest grade. */
function finalSlopeU(riseU: number): number {
  if (riseU === 0) return 0;
  const steps = Math.ceil(
    Math.max(plan.slopeMinU, Math.abs(riseU) / plan.gradeRangeMax) /
      plan.lengthStepU,
  );
  return steps * plan.lengthStepU;
}

/**
 * Vertices of block `b` from x = 0 to x = blockChunks × chunkWidthU:
 * flat, slope, flat, slope, …, flat. Random slopes are taken only while the
 * block can still reach the next block's height with one final slope.
 */
export function blockPlan(seed: number, b: number): ProfileVertex[] {
  const target = blockStartHeightU(seed, b + 1);
  let y = blockStartHeightU(seed, b);
  let x = length(seed, 'flat', b, 0, plan.flatMinU, plan.flatMaxU);
  const vertices: ProfileVertex[] = [
    { xU: 0, yU: y },
    { xU: x, yU: y },
  ];
  for (let i = 1; ; i++) {
    const slopeU = length(seed, 'slope', b, i, plan.slopeMinU, plan.slopeMaxU);
    const grade =
      plan.gradeRangeMin +
      (plan.gradeRangeMax - plan.gradeRangeMin) * random(seed, 'grade', b, i);
    let up = random(seed, 'direction', b, i) < 0.5;
    // Steer away from the height bounds instead of clipping the slope.
    if (y + grade * slopeU > plan.maxHeightU) up = false;
    if (y - grade * slopeU < -plan.maxHeightU) up = true;
    const next = y + (up ? grade : -grade) * slopeU;
    const flatU = length(seed, 'flat', b, i, plan.flatMinU, plan.flatMaxU);
    const needed = slopeU + flatU + finalSlopeU(target - next) + plan.flatMinU;
    if (Math.abs(next) > plan.maxHeightU || x + needed > BLOCK_U) break;
    x += slopeU;
    y = next;
    vertices.push({ xU: x, yU: y });
    x += flatU;
    vertices.push({ xU: x, yU: y });
  }
  const finalU = finalSlopeU(target - y);
  if (finalU > 0) {
    // The last slope ends one minimal flat before the block boundary.
    x = BLOCK_U - plan.flatMinU - finalU;
    vertices[vertices.length - 1] = { xU: x, yU: y };
    vertices.push({ xU: x + finalU, yU: target });
  }
  vertices.push({ xU: BLOCK_U, yU: target });
  return vertices;
}

export function generateTrackProfile(seed: number, k: number): TrackProfile {
  const b = Math.floor(k / plan.blockChunks);
  const offsetU = (k - b * plan.blockChunks) * chunkWidthU;
  return {
    vertices: blockPlan(seed, b).map((vertex) => ({
      xU: vertex.xU - offsetU,
      yU: vertex.yU,
    })),
    transitionU: plan.transitionU,
  };
}

/** Straight-line segment around `x` (first or last one beyond the ends). */
function segmentIndex(vertices: readonly ProfileVertex[], x: number): number {
  let i = 0;
  while (i < vertices.length - 2 && x >= (vertices[i + 1]?.xU ?? 0)) i++;
  return i;
}

function gradeOf(vertices: readonly ProfileVertex[], i: number): number {
  const a = vertices[i];
  const b = vertices[i + 1];
  if (!a || !b) return 0;
  return (b.yU - a.yU) / (b.xU - a.xU);
}

/**
 * Height and grade at `x`: the straight plan, except within half a
 * transition of an inner vertex, where a parabola changes the grade linearly.
 */
function evaluate(
  profile: TrackProfile,
  x: number,
): { heightU: number; grade: number } {
  const { vertices, transitionU } = profile;
  const half = transitionU / 2;
  const i = segmentIndex(vertices, x);
  for (const j of [i, i + 1]) {
    const vertex = vertices[j];
    if (!vertex || j === 0 || j === vertices.length - 1) continue;
    const s = x - (vertex.xU - half);
    if (s < 0 || s > transitionU) continue;
    const before = gradeOf(vertices, j - 1);
    const after = gradeOf(vertices, j);
    return {
      heightU:
        vertex.yU -
        before * half +
        before * s +
        ((after - before) * s * s) / (2 * transitionU),
      grade: before + ((after - before) * s) / transitionU,
    };
  }
  const start = vertices[i] ?? { xU: 0, yU: 0 };
  const grade = gradeOf(vertices, i);
  return { heightU: start.yU + grade * (x - start.xU), grade };
}

/** Track height at `localX` ∈ [0, chunkWidthU], world y up. */
export function profileHeightU(profile: TrackProfile, localX: number): number {
  return evaluate(profile, localX).heightU;
}

/** Track grade dy/dx at `localX`. */
export function profileGrade(profile: TrackProfile, localX: number): number {
  return evaluate(profile, localX).grade;
}
