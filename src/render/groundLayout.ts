/** Shared projected-world geometry owner (D-023). */
export {
  BACK_PLANE_U,
  NEAR_FOOT_OFFSET_U,
} from '../domain/world/SceneryGeometry.ts';

import { spatialNearPalette } from './groundPalette.ts';
import type { NearGround } from '../domain/world/sceneryTypes.ts';
/** Shared upper bands/tail samples, in world coordinates. */
export function nearGroundStrips(
  seed: number,
  fromXU: number,
  toXU: number,
  style: NearGround,
) {
  const strips = [];
  for (let x = fromXU; x < toXU; x += 16) {
    const end = Math.min(toXU, x + 16);
    strips.push({
      fromXU: x,
      toXU: end,
      palette: spatialNearPalette(seed, (x + end) / 2, style),
    });
  }
  return strips;
}

/** Merge identical deep-fill samples; preserve the exact spatial palette. */
export function nearGroundTailStrips(
  seed: number,
  fromXU: number,
  toXU: number,
  style: NearGround,
) {
  const runs: { fromXU: number; toXU: number; color: number }[] = [];
  for (const strip of nearGroundStrips(seed, fromXU, toXU, style)) {
    const color = strip.palette.bands.at(-1)?.color ?? 0x74b448;
    const previous = runs.at(-1);
    if (previous && previous.color === color && previous.toXU === strip.fromXU)
      previous.toXU = strip.toXU;
    else runs.push({ fromXU: strip.fromXU, toXU: strip.toXU, color });
  }
  return runs;
}

/** Equal palettes share one draw path; transition samples keep their original colours. */
export function nearGroundRuns(
  seed: number,
  fromXU: number,
  toXU: number,
  style: NearGround,
) {
  const runs: ReturnType<typeof nearGroundStrips> = [];
  for (const strip of nearGroundStrips(seed, fromXU, toXU, style)) {
    const previous = runs.at(-1),
      a = previous?.palette,
      b = strip.palette;
    if (
      previous &&
      a &&
      a.bank === b.bank &&
      a.bankShade === b.bankShade &&
      a.bands.length === b.bands.length &&
      a.bands.every(
        (v, i) =>
          v.fromU === b.bands[i]?.fromU && v.color === b.bands[i]?.color,
      )
    )
      previous.toXU = strip.toXU;
    else runs.push(strip);
  }
  return runs;
}
