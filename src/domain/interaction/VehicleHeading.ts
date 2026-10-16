import type { PointU } from '../world/SceneryGeometry.ts';

export interface VehicleHeading {
  rotationRad: number;
  flipX: boolean;
}

/** Updates caller-owned state without allocations; zero motion preserves it. */
export function vehicleHeading(
  front: PointU,
  velocityXUPerSec: number,
  velocityYUPerSec: number,
  heading: VehicleHeading,
  tangentX = 0,
  tangentY = 0,
  progressUPerSec = 0,
): VehicleHeading {
  const vx =
    velocityXUPerSec || velocityYUPerSec
      ? velocityXUPerSec
      : tangentX * progressUPerSec;
  const vy =
    velocityXUPerSec || velocityYUPerSec
      ? velocityYUPerSec
      : tangentY * progressUPerSec;
  if (vx === 0 && vy === 0) return heading;
  heading.flipX = front.xU !== 0 && vx * front.xU < 0;
  const frontX = heading.flipX ? -front.xU : front.xU;
  const angle = Math.atan2(vy, vx) - Math.atan2(front.yU, frontX);
  heading.rotationRad = Math.atan2(Math.sin(angle), Math.cos(angle));
  return heading;
}
