import { gameConfig } from '../../config/gameConfig.ts';
import { unitRandom } from './Hash.ts';

/**
 * Provisional generator "v0" for version 0.1: the doc 04 §4 boundary heights
 * and profiles without biomes or feature reservations. The V1 generator
 * (version 1) will place stations/crossings on flat profiles, so v0 journeys
 * cannot silently continue under it (see D-005). Changing any geometry input
 * here (chunk width, grade, height scale, key names) requires a new version.
 */
export const TEST_TRACK_GENERATOR_VERSION = 0;

export interface TrackProfile {
  kind: 'smooth' | 'hill' | 'dip' | 'flat-middle';
  startHeightU: number;
  endHeightU: number;
  middleHeightU?: number;
}

const { chunkWidthU, maxTrackGrade, boundaryHeightScale } = gameConfig.world;
/** Maximum of q'(t) for the smootherstep below. */
const MAX_SMOOTHSTEP_SLOPE = 1.875;

function r(seed: number, k: number): number {
  return (
    2 * unitRandom(seed, TEST_TRACK_GENERATOR_VERSION, 'terrain-boundary', k) -
    1
  );
}

/** Height of the shared boundary between chunks k-1 and k, in [-32, 32] u. */
export function boundaryHeightU(seed: number, k: number): number {
  return (
    boundaryHeightScale * (r(seed, k - 1) + 2 * r(seed, k) + r(seed, k + 1))
  );
}

/** Largest rise of one smootherstep ramp of `lengthU` within the grade limit. */
function maxRiseU(lengthU: number): number {
  return (maxTrackGrade * lengthU) / MAX_SMOOTHSTEP_SLOPE;
}

export function generateTrackProfile(seed: number, k: number): TrackProfile {
  const startHeightU = boundaryHeightU(seed, k);
  const endHeightU = boundaryHeightU(seed, k + 1);
  const kindRoll = unitRandom(
    seed,
    TEST_TRACK_GENERATOR_VERSION,
    'profile-kind',
    k,
  );
  const middleRoll = unitRandom(
    seed,
    TEST_TRACK_GENERATOR_VERSION,
    'profile-middle',
    k,
  );
  const low = Math.min(startHeightU, endHeightU);
  const high = Math.max(startHeightU, endHeightU);
  const cap = maxRiseU(chunkWidthU / 2);
  if (kindRoll < 0.4 || high - low > cap) {
    return { kind: 'smooth', startHeightU, endHeightU };
  }
  if (kindRoll < 0.65) {
    // Feasible interval computed analytically: above both ends, within grade.
    const middleHeightU = high + (low + cap - high) * middleRoll;
    return { kind: 'hill', startHeightU, endHeightU, middleHeightU };
  }
  if (kindRoll < 0.9) {
    const middleHeightU = low - (low - (high - cap)) * middleRoll;
    return { kind: 'dip', startHeightU, endHeightU, middleHeightU };
  }
  return {
    kind: 'flat-middle',
    startHeightU,
    endHeightU,
    middleHeightU: (startHeightU + endHeightU) / 2,
  };
}

const smoothstep = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const smoothstepSlope = (t: number) => 30 * t * t * (t - 1) * (t - 1);

interface Ramp {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function rampAt(profile: TrackProfile, localX: number): Ramp {
  const w = chunkWidthU;
  const m = profile.middleHeightU ?? profile.startHeightU;
  switch (profile.kind) {
    case 'smooth':
      return { x0: 0, x1: w, y0: profile.startHeightU, y1: profile.endHeightU };
    case 'hill':
    case 'dip':
      return localX < w / 2
        ? { x0: 0, x1: w / 2, y0: profile.startHeightU, y1: m }
        : { x0: w / 2, x1: w, y0: m, y1: profile.endHeightU };
    case 'flat-middle':
      if (localX < w / 4)
        return { x0: 0, x1: w / 4, y0: profile.startHeightU, y1: m };
      if (localX < (3 * w) / 4)
        return { x0: w / 4, x1: (3 * w) / 4, y0: m, y1: m };
      return { x0: (3 * w) / 4, x1: w, y0: m, y1: profile.endHeightU };
  }
}

/** Track height at `localX` ∈ [0, chunkWidthU], world y up. */
export function profileHeightU(profile: TrackProfile, localX: number): number {
  const ramp = rampAt(profile, localX);
  const t = (localX - ramp.x0) / (ramp.x1 - ramp.x0);
  if (t <= 0) return ramp.y0;
  if (t >= 1) return ramp.y1;
  return ramp.y0 + (ramp.y1 - ramp.y0) * smoothstep(t);
}

/** Track grade dy/dx at `localX`; zero at every chunk boundary. */
export function profileGrade(profile: TrackProfile, localX: number): number {
  const ramp = rampAt(profile, localX);
  const length = ramp.x1 - ramp.x0;
  const t = Math.min(1, Math.max(0, (localX - ramp.x0) / length));
  return ((ramp.y1 - ramp.y0) * smoothstepSlope(t)) / length;
}
