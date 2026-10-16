import { hash32 } from './Hash.ts';
import type { Biome } from './Biomes.ts';

export const REGION_BLOCK_U = 8192;
export const REGION_TRANSITION_U = 8192;
export const REGION_CYCLE_BLOCKS = 60;
export const REGION_LENGTHS = [3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 7, 7] as const;
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'rain' | 'wind' | 'snow';
export interface ClimatePreset {
  season: Season;
  weather: Weather;
}
export interface RegionPlan extends ClimatePreset {
  id: string;
  index: number;
  landscape: Biome;
  fromXU: number;
  toXU: number;
}
const TEMPERATE_PRESETS: readonly ClimatePreset[] = [
  { season: 'spring', weather: 'clear' },
  { season: 'summer', weather: 'clear' },
  { season: 'summer', weather: 'rain' },
  { season: 'autumn', weather: 'clear' },
  { season: 'autumn', weather: 'wind' },
  { season: 'winter', weather: 'clear' },
  { season: 'winter', weather: 'snow' },
];
export const ALLOWED_PRESETS: Readonly<
  Record<Biome, readonly ClimatePreset[]>
> = {
  countryside: TEMPERATE_PRESETS,
  forest: TEMPERATE_PRESETS,
  foothills: TEMPERATE_PRESETS,
  town: TEMPERATE_PRESETS,
  lakes: TEMPERATE_PRESETS,
  mountains: [
    { season: 'summer', weather: 'clear' },
    { season: 'winter', weather: 'clear' },
    { season: 'winter', weather: 'snow' },
  ],
  coast: [
    { season: 'summer', weather: 'clear' },
    { season: 'summer', weather: 'wind' },
  ],
  dunes: [
    { season: 'summer', weather: 'clear' },
    { season: 'summer', weather: 'wind' },
  ],
};
export const REGION_ROUTES: readonly (readonly Biome[])[] = [
  [
    'countryside',
    'town',
    'countryside',
    'forest',
    'foothills',
    'mountains',
    'foothills',
    'lakes',
    'coast',
    'dunes',
    'coast',
    'lakes',
  ],
  [
    'countryside',
    'forest',
    'foothills',
    'mountains',
    'foothills',
    'town',
    'countryside',
    'lakes',
    'coast',
    'dunes',
    'coast',
    'lakes',
  ],
];
export const REGION_NEIGHBOURS: Readonly<Record<Biome, readonly Biome[]>> = {
  countryside: ['town', 'forest', 'lakes', 'dunes'],
  town: ['countryside', 'foothills'],
  forest: ['countryside', 'foothills', 'lakes'],
  foothills: ['mountains', 'lakes', 'town', 'countryside'],
  mountains: ['foothills'],
  lakes: ['coast', 'forest', 'foothills', 'countryside'],
  coast: ['lakes', 'dunes'],
  dunes: ['coast', 'countryside'],
};

/** A common supported preset for the whole 2–3-region group, including cycle seams. */
function climateAt(seed: number, index: number): ClimatePreset {
  const period = Math.floor(index / 5),
    start = period * 5 + (index - period * 5 >= 2 ? 2 : 0),
    count = start - period * 5 === 2 ? 3 : 2;
  const landscapes = Array.from({ length: count }, (_, i) => {
    const k = start + i,
      cycle = Math.floor(k / 12),
      route =
        REGION_ROUTES[
          hash32(seed, 'regions-v2:route', cycle) % REGION_ROUTES.length
        ];
    const landscape = route?.[k - cycle * 12];
    if (!landscape) throw new Error('missing climate landscape');
    return landscape;
  });
  const first = landscapes[0];
  if (!first) throw new Error('empty climate group');
  const common = ALLOWED_PRESETS[first].filter((preset) =>
    landscapes.every((landscape) =>
      ALLOWED_PRESETS[landscape].some(
        (p) => p.season === preset.season && p.weather === preset.weather,
      ),
    ),
  );
  const seasons = [...new Set(common.map((p) => p.season))];
  const season =
    start === 0
      ? 'summer'
      : seasons[hash32(seed, 'regions-v2:season', start) % seasons.length];
  const choices = common.filter((p) => p.season === season);
  const climate =
    start === 0
      ? choices.find((p) => p.weather === 'clear')
      : choices[hash32(seed, 'regions-v2:weather', start) % choices.length];
  if (!climate) throw new Error('unsupported climate group');
  return climate;
}

/** Eight cycle descriptions at most; memoization never advances planning state. */
const cycleCache = new Map<string, readonly RegionPlan[]>();
function regionCycle(seed: number, cycle: number): readonly RegionPlan[] {
  const key = `${seed}/${cycle}`;
  const cached = cycleCache.get(key);
  if (cached) return cached;
  const route =
    REGION_ROUTES[
      hash32(seed, 'regions-v2:route', cycle) % REGION_ROUTES.length
    ];
  if (!route) throw new Error('missing route');
  const lengths = REGION_LENGTHS.map((length, index) => ({
    length,
    index,
    key: hash32(seed, 'regions-v2:length', cycle, index),
  })).sort((a, b) => a.key - b.key || a.index - b.index);
  let fromXU = cycle * REGION_CYCLE_BLOCKS * REGION_BLOCK_U;
  const regions = lengths.map((entry, i) => {
    const landscape = route[i];
    if (!landscape) throw new Error('missing landscape');
    const index = cycle * 12 + i;
    const climate = climateAt(seed, index);
    const toXU = fromXU + entry.length * REGION_BLOCK_U;
    const r: RegionPlan = Object.freeze({
      id: `g2:region:${index}`,
      index,
      landscape,
      fromXU,
      toXU,
      ...climate,
    });
    fromXU = toXU;
    return r;
  });
  if (cycleCache.size === 8) {
    const first = cycleCache.keys().next().value;
    if (first !== undefined) cycleCache.delete(first);
  }
  cycleCache.set(key, regions);
  return regions;
}
/** Random access scans at most twelve half-open intervals, including negative positions. */
export function regionAt(seed: number, worldXU: number): RegionPlan {
  if (!Number.isFinite(worldXU)) throw new RangeError('non-finite world x');
  const cycle = Math.floor(worldXU / (REGION_CYCLE_BLOCKS * REGION_BLOCK_U));
  const r = regionCycle(seed, cycle).find(
    (r) => worldXU >= r.fromXU && worldXU < r.toXU,
  );
  if (!r) throw new Error('region cycle gap');
  return r;
}
export interface RegionTransition {
  from: RegionPlan;
  to: RegionPlan;
  progress: number;
}
/** Transition occupies the last block of a region, including when stopped. */
export function transitionAt(seed: number, worldXU: number): RegionTransition {
  const from = regionAt(seed, worldXU);
  const progress = Math.max(
    0,
    Math.min(
      1,
      (worldXU - (from.toXU - REGION_TRANSITION_U)) / REGION_TRANSITION_U,
    ),
  );
  return {
    from,
    to: progress > 0 ? regionAt(seed, from.toXU) : from,
    progress,
  };
}
