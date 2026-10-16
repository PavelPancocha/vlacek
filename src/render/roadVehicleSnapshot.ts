export interface RoadVehicleSnapshot {
  id: string;
  kind: string;
  roadKind: string;
  worldXU: number;
  worldYU: number;
  velocityXUPerSec: number;
  velocityYUPerSec: number;
  frontX: number;
  frontY: number;
  parentScaleX: number;
  wheelAngleRad: number;
  exhaust: boolean;
  arrows: boolean;
}

/** Read-only debug observation; no UI, scenery or camera diagnostics. */
export interface RoadMotionSnapshot {
  readonly simulationTick: number;
  readonly cars: readonly RoadVehicleSnapshot[];
}
