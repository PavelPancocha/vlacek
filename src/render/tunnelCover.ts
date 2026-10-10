/**
 * The hill over a tunnel turns see-through while the train goes through
 * (doc 14 §2: the child never loses its train), showing the darkened
 * inside of the tunnel. Pure functions of positions and time.
 */

/** Opacity of the hill while the train is in or at the tunnel. */
export const TUNNEL_SEE_THROUGH_ALPHA = 0.3;
/** The hill starts to clear this far before the portal, u. */
const APPROACH_U = 80;
/** Fade rate, 1/s (about 0.4 s to clear). */
const FADE_PER_SEC = 6;

/** Target opacity of the hill for the train's x interval. */
export function tunnelCoverTarget(
  train: { minX: number; maxX: number },
  tunnel: { fromX: number; toX: number },
): number {
  const near =
    train.maxX > tunnel.fromX - APPROACH_U &&
    train.minX < tunnel.toX + APPROACH_U;
  return near ? TUNNEL_SEE_THROUGH_ALPHA : 1;
}

/** Eases the opacity towards its target over `dtSec` (0 holds still). */
export function easeAlpha(
  current: number,
  target: number,
  dtSec: number,
): number {
  return target + (current - target) * Math.exp(-FADE_PER_SEC * dtSec);
}

/** Where the train is relative to a tunnel's portals. */
export type TrainInTunnel = 'outside' | 'partly' | 'inside';

/** Whether the train's x interval is outside, partly or wholly inside. */
export function trainInTunnel(
  train: { minX: number; maxX: number },
  tunnel: { fromX: number; toX: number },
): TrainInTunnel {
  if (train.maxX <= tunnel.fromX || train.minX >= tunnel.toX) return 'outside';
  return train.minX >= tunnel.fromX && train.maxX <= tunnel.toX
    ? 'inside'
    : 'partly';
}

/**
 * The cover's opacity for this frame: eased towards the target, or right
 * at it on the first frame (a journey restored with the train inside).
 */
export function nextCoverAlpha(
  current: number | undefined,
  target: number,
  dtSec: number,
): number {
  return current === undefined ? target : easeAlpha(current, target, dtSec);
}
