import {
  regionAt,
  REGION_TRANSITION_U,
  type RegionPlan,
} from '../domain/world/Regions.ts';

/** Raster work starts a full block before even the first transition prop can enter view. */
export const WORLD_ATLAS_PREFETCH_U = 8192;
/** Includes retained render chunks and the spatial transition ahead, independent of speed. */
export function worldAtlasRegions(
  seed: number,
  leftXU: number,
  rightXU: number,
): RegionPlan[] {
  const from = Math.floor(leftXU / 1024) * 1024 - 1024;
  const to =
    Math.ceil(rightXU / 1024) * 1024 +
    1024 +
    REGION_TRANSITION_U +
    WORLD_ATLAS_PREFETCH_U;
  const regions: RegionPlan[] = [];
  for (let x = from; x <= to;) {
    const region = regionAt(seed, x);
    regions.push(region);
    x = region.toXU;
  }
  return regions;
}
