import { longStation } from './SettlementPlan.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import { generateTrackProfile, profileGrade } from './TrackProfile.ts';
import { hash32 } from './Hash.ts';
const { chunkWidthU, chunksPerBiomeBlock } = gameConfig.world;
const STATION_FLAT_U = 480,
  FLAT_STEP_U = 16;
/** Longest flat of a chunk's track, chunk-local, if long enough. */
export function stationFlat(
  seed: number,
  chunkIndex: number,
): readonly [number, number] | undefined {
  const profile = generateTrackProfile(seed, chunkIndex);
  let best: [number, number] | undefined;
  let start: number | undefined;
  for (let x = 0; x <= chunkWidthU; x += FLAT_STEP_U) {
    const flat = Math.abs(profileGrade(profile, x)) < 1e-12;
    if (flat && start === undefined) start = x;
    const end = !flat ? x - FLAT_STEP_U : x === chunkWidthU ? x : undefined;
    if (
      start !== undefined &&
      end !== undefined &&
      (!flat || x === chunkWidthU)
    ) {
      if (!best || end - start > best[1] - best[0]) best = [start, end];
      start = undefined;
    }
  }
  return best && best[1] - best[0] >= STATION_FLAT_U ? best : undefined;
}

/** Slot of the block's station, if one of slots 1–2 has a long flat. */
export function stationSlot(seed: number, block: number): number | undefined {
  if (block === 0 || longStation(seed, block)) return 1;
  const preferred = 1 + (hash32(seed, 1, 'station-slot', block) % 2);
  for (const slot of [preferred, 3 - preferred]) {
    if (stationFlat(seed, block * chunksPerBiomeBlock + slot)) return slot;
  }
  return undefined;
}
