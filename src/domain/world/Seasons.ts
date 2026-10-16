import { transitionAt } from './Regions.ts';
import type { ClimatePreset, Season } from './Regions.ts';

export interface EffectiveClimate extends ClimatePreset {
  from: ClimatePreset;
  to: ClimatePreset;
  progress: number;
  spring: number;
  summer: number;
  autumn: number;
  winter: number;
  snowfall: number;
  rainfall: number;
}
export function effectiveClimateAt(
  seed: number,
  worldXU: number,
): EffectiveClimate {
  const t = transitionAt(seed, worldXU);
  const p = t.progress;
  const chosen = p >= 0.5 ? t.to : t.from;
  const weight = (s: Season) =>
    (t.from.season === s ? 1 - p : 0) + (t.to.season === s ? p : 0);
  return {
    from: t.from,
    to: t.to,
    progress: p,
    season: chosen.season,
    weather: chosen.weather,
    spring: weight('spring'),
    summer: weight('summer'),
    autumn: weight('autumn'),
    winter: weight('winter'),
    snowfall:
      (t.from.weather === 'snow' ? 1 - p : 0) +
      (t.to.weather === 'snow' ? p : 0),
    rainfall:
      (t.from.weather === 'rain' ? 1 - p : 0) +
      (t.to.weather === 'rain' ? p : 0),
  };
}

/** One prevailing direction per journey; rare gentle gusts use game time. */
export function windAt(seed: number, timeSec: number): number {
  const direction = seed % 2 === 0 ? 1 : -1;
  const gust = Math.max(0, Math.sin(timeSec * 0.17 + seed)) ** 12;
  return direction * (9 + 13 * gust);
}
