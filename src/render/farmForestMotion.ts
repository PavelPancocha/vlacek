export interface ForestWorkPose {
  patrolRatio: number;
  travelRatio: number;
  direction: number;
  gripXU: number;
  gripYU: number;
  trunkAngleRad: number;
  holding: boolean;
  open: boolean;
  stacked: boolean;
}
/** Calm 32-second handoff: close, transfer, lay down, open, empty return. */
export function forestWorkPose(
  timeSec: number,
  phase: number,
  forwarder: boolean,
  target: ForestWorkPose = {
    patrolRatio: 0,
    travelRatio: 0,
    direction: 1,
    gripXU: 0,
    gripYU: 0,
    trunkAngleRad: 0,
    holding: false,
    open: true,
    stacked: false,
  },
): ForestWorkPose {
  const t = (((timeSec + phase * 32) % 32) + 32) % 32;
  const travel = Math.max(0, Math.min(1, (t - 4) / 16));
  const returning = Math.max(0, Math.min(1, (t - 26) / 6));
  const progress = forestPatrolRatio(timeSec, phase);
  const blend = progress;
  target.patrolRatio = progress;
  target.travelRatio =
    Math.floor((timeSec + phase * 32) / 32) * 2 +
    (t < 26
      ? travel * travel * (3 - 2 * travel)
      : 1 + returning * returning * (3 - 2 * returning));
  target.direction = t <= 4 || t > 26 ? -1 : 1;
  target.gripXU = forwarder ? -40 : 43 - 3 * blend;
  target.gripYU = forwarder
    ? -12 - 12 * Math.sin(progress * Math.PI)
    : -38 + 26 * blend;
  target.trunkAngleRad = forwarder ? Math.PI / 2 : (blend * Math.PI) / 2;
  target.holding = t >= 4 && t < 22;
  target.open = !target.holding;
  target.stacked = t >= 22 && t < 32;
  return target;
}

export interface FarmForestDiagnostic {
  id: string;
  kind: string;
  xU: number;
  flip: boolean;
  wheelAngles: readonly number[];
  armAngleRad: number | undefined;
  holding: boolean | undefined;
  stacked: boolean | undefined;
  gripU: { xU: number; yU: number } | undefined;
  bedsU: readonly { xU: number; yU: number }[];
}

function forestPatrolRatio(timeSec: number, phase: number): number {
  const t = (((timeSec + phase * 32) % 32) + 32) % 32;
  const v = Math.max(0, Math.min(1, t < 26 ? (t - 4) / 16 : (t - 26) / 6));
  const smooth = v * v * (3 - 2 * v);
  return t < 26 ? smooth : 1 - smooth;
}
export function farmPatrolOffsetU(
  prop: {
    phase: number;
    motion?: { rangeU: number; speedUPerSec: number };
    work?: string | undefined;
  },
  timeSec: number,
  patrolRatio?: number,
): number {
  if (!prop.motion) return 0;
  if (prop.work === 'forwarder')
    return (
      ((patrolRatio ?? forestPatrolRatio(timeSec, prop.phase)) - 0.5) *
      prop.motion.rangeU
    );
  const legs =
    (timeSec * prop.motion.speedUPerSec) / prop.motion.rangeU + 2 * prop.phase;
  const t = legs - 2 * Math.floor(legs / 2);
  return (t < 1 ? t : 2 - t) * prop.motion.rangeU - prop.motion.rangeU / 2;
}
