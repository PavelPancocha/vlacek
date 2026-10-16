import type { Season } from '../domain/world/Regions.ts';
export function cablewaySupportHeights(
  xU: number,
  scale: number,
  railAt: (xU: number) => number,
) {
  const height = (offsetU: number) =>
    (railAt(xU) - railAt(xU + offsetU * scale)) / scale;
  return {
    leftStationYU: height(-35),
    rightTowerYU: height(320),
    rightStationYU: height(365),
  };
}
export interface FerryPose {
  ratio: number;
  direction: 1 | -1;
  moored: boolean;
}
export function ferryPose(
  timeSec: number,
  phase: number,
  target: FerryPose,
  season: Season,
): FerryPose {
  if (season === 'winter') {
    target.ratio = 0;
    target.direction = 1;
    target.moored = true;
    return target;
  }
  const elapsed = timeSec + phase * 76;
  const cycle = elapsed % 76;
  const reverse = cycle >= 38,
    t = reverse ? cycle - 38 : cycle;
  const progress = Math.max(0, Math.min(1, (t - 12) / 26));
  target.ratio = reverse ? 1 - progress : progress;
  target.moored = t <= 12;
  target.direction =
    target.moored && (reverse || elapsed >= 76)
      ? reverse
        ? 1
        : -1
      : reverse
        ? -1
        : 1;
  return target;
}
export function boatFlip(direction: 1 | -1, front: 'left' | 'right'): boolean {
  return (direction === 1) === (front === 'left');
}

export interface WaterMountainDiagnostic {
  id: string;
  kind: string;
  xU: number;
  yU: number;
  wheelAngleRad: number | null;
  armAngleRad: number | null;
  cabinXU: number | null;
  ferryRatio: number | null;
  moored: boolean | null;
  direction: number | null;
  frames: readonly string[];
}
