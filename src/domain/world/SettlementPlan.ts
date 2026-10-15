import { regionAt, type RegionPlan } from './Regions.ts';
export type SettlementScene =
  | 'village-entry'
  | 'village-green'
  | 'village-exit'
  | 'suburb'
  | 'street'
  | 'park'
  | 'yard';
/** One guaranteed 6144-u village in each countryside region, outside its transition. */
export function settlementScene(
  region: RegionPlan,
  index: number,
): SettlementScene | undefined {
  if (region.landscape === 'countryside' && index >= 4 && index <= 6)
    return index === 4
      ? 'village-entry'
      : index === 5
        ? 'village-green'
        : 'village-exit';
  if (region.landscape !== 'town') return undefined;
  const count = (region.toXU - region.fromXU) / 2048;
  if (index === 0 || index >= count - 4) return 'suburb';
  return index % 3 === 1 ? 'street' : index % 3 === 2 ? 'park' : 'yard';
}
export interface StationExtent {
  id: string;
  ownerChunk: number;
  size: 'halt' | 'station' | 'big';
  fromXU: number;
  toXU: number;
}
/** Planned before track slopes; ends before the block's slot-3 crossing. */
export function longStation(
  seed: number,
  block: number,
): StationExtent | undefined {
  const r = regionAt(seed, block * 8192);
  const size =
    r.landscape === 'town'
      ? 'big'
      : r.landscape === 'countryside' && block * 8192 === r.fromXU + 8192
        ? 'station'
        : undefined;
  if (!size) return undefined;
  const fromXU = block * 8192 + (size === 'big' ? 256 : 832);
  return {
    id: `g2:chunk:${block * 8 + 1}:station:0`,
    ownerChunk: block * 8 + 1,
    size,
    fromXU,
    toXU: fromXU + (size === 'big' ? 2368 : 1216),
  };
}
