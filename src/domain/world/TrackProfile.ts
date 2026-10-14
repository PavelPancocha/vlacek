import { gameConfig } from '../../config/gameConfig.ts';
import { regionAt } from './Regions.ts';
import { unitRandom } from './Hash.ts';

/**
 * Track generator v2 (D-023): landscape-dependent envelopes. The track is planned in blocks of
 * `blockChunks` chunks: flats and long constant grades in irregular lengths,
 * joined by short parabolic transitions (vertical curves), so the grade
 * changes only briefly and never with a kink. Every block starts and ends
 * flat at a seeded height, so any chunk is computed from its own block
 * alone, also far from the start. Version 0 (smootherstep waves of 0.1)
 * journeys are not regenerated under v1 (D-005).
 */
export const TRACK_GENERATOR_VERSION = 2;

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
  return unitRandom(seed, 1, key, ...parts);
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

/** Shared region borders are flat at zero; inner anchors retain finite random access. */
function blockStartHeightU(seed: number, b: number): number {
  const region = regionAt(seed, b * BLOCK_U),
    local = b - region.fromXU / BLOCK_U;
  if (local === 0) return 0;
  const p = gameConfig.world.landscapeProfiles[region.landscape];
  if (region.landscape === 'mountains' || region.landscape === 'foothills') {
    if (local === 1) return p.blockHeightRangeU;
    if (local === 2) return -p.blockHeightRangeU;
  }
  return Math.round(
    (2 * unitRandom(seed, 'profile-v2:boundary', b) - 1) * p.blockHeightRangeU,
  );
}

/** Shortest final slope within this landscape and the validated pantograph bound. */
function finalSlopeU(
  riseU: number,
  p: typeof gameConfig.world.profile,
): number {
  if (riseU === 0) return 0;
  return (
    Math.ceil(
      Math.max(p.slopeMinU, Math.abs(riseU) / p.gradeRangeMax) / p.lengthStepU,
    ) * p.lengthStepU
  );
}

/**
 * Vertices of block `b` from x = 0 to x = blockChunks × chunkWidthU:
 * flat, slope, flat, slope, …, flat. Random slopes are taken only while the
 * block can still reach the next block's height with one final slope.
 */
function buildBlockPlan(seed: number, b: number): ProfileVertex[] {
  const region = regionAt(seed, b * BLOCK_U);
  const landscape = gameConfig.world.landscapeProfiles[region.landscape];
  const plan = {
    ...gameConfig.world.profile,
    ...landscape,
    gradeRangeMax: Math.min(
      landscape.gradeRangeMax,
      gameConfig.world.pantographMaxTrackGrade,
      gameConfig.world.maxTrackGrade,
    ),
  };
  const target = blockStartHeightU(seed, b + 1);
  let y = blockStartHeightU(seed, b);
  // R3: slot 1 and both transition shoulders are reserved before slopes.
  let x =
    b === 0
      ? 2 * chunkWidthU + plan.transitionU / 2
      : length(seed, 'flat', b, 0, plan.flatMinU, plan.flatMaxU);
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
    const needed =
      slopeU + flatU + finalSlopeU(target - next, plan) + plan.flatMinU;
    if (Math.abs(next) > plan.maxHeightU || x + needed > BLOCK_U) break;
    x += slopeU;
    y = next;
    vertices.push({ xU: x, yU: y });
    x += flatU;
    vertices.push({ xU: x, yU: y });
  }
  const finalU = finalSlopeU(target - y, plan);
  if (finalU > 0) {
    // The last slope ends one minimal flat before the block boundary.
    x = BLOCK_U - plan.flatMinU - finalU;
    vertices[vertices.length - 1] = { xU: x, yU: y };
    vertices.push({ xU: x + finalU, yU: target });
  }
  vertices.push({ xU: BLOCK_U, yU: target });
  return vertices;
}

const blockCache = new Map<string, readonly ProfileVertex[]>();
/** Bounded, immutable memoization; cache order cannot affect geometry. */
export function blockPlan(seed: number, b: number): readonly ProfileVertex[] {
  const key = `${seed}/${b}`,
    cached = blockCache.get(key);
  if (cached) return cached;
  const plan = Object.freeze(
    buildBlockPlan(seed, b).map((vertex) => Object.freeze(vertex)),
  );
  if (blockCache.size === 128) {
    const first = blockCache.keys().next().value;
    if (first !== undefined) blockCache.delete(first);
  }
  blockCache.set(key, plan);
  return plan;
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
