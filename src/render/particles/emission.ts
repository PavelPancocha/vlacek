import type {
  GroundSpan,
  NearGround,
} from '../../domain/world/sceneryTemplates.ts';

/**
 * Turns a rate (per second, or per u of travel) into whole emissions per
 * frame, carrying the fraction. After a long hitch the backlog is dropped
 * instead of bursting out later.
 */
export class EmissionClock {
  #carry = 0;

  tick(rate: number, amount: number, maxBurst = 8): number {
    if (rate <= 0 || amount <= 0) return 0;
    this.#carry += rate * amount;
    const whole = Math.floor(this.#carry);
    this.#carry -= whole;
    if (whole > maxBurst) {
      this.#carry = 0;
      return maxBurst;
    }
    return whole;
  }
}

/**
 * World point of an emitter given in a vehicle's art frame (x from the
 * rear coupler, y down from the frame top, rail at y = heightU), for the
 * vehicle's pose (centre on the rail, angle of its chord), optionally
 * mirrored and scaled like an oncoming train. Returns render coordinates
 * (y down) and the emitter's tilt in render degrees, so smoke leaves a
 * leaning chimney along its axis (doc 14 §4).
 */
export function emitterWorldPoint(
  emitter: { xU: number; yU: number },
  frame: { lengthU: number; heightU: number },
  pose: { centerX: number; centerY: number; angleRad: number },
  view: { mirrored?: boolean; scale?: number } = {},
): { x: number; y: number; tiltDeg: number } {
  // A train driving left is drawn mirrored; a deeper layer smaller.
  const scale = view.scale ?? 1;
  const lx =
    (emitter.xU - frame.lengthU / 2) * scale * (view.mirrored ? -1 : 1);
  const ly = (emitter.yU - frame.heightU) * scale;
  const cos = Math.cos(pose.angleRad);
  const sin = Math.sin(pose.angleRad);
  return {
    x: pose.centerX + lx * cos + ly * sin,
    y: -pose.centerY - lx * sin + ly * cos,
    tiltDeg: (-pose.angleRad * 180) / Math.PI,
  };
}

/** What the wheels stir up on this near ground: leaves or snow. */
export function passEffectAt(
  near: readonly GroundSpan<NearGround>[],
  localX: number,
): 'snow' | 'leaves' | undefined {
  const style = near.find(
    (span) => localX >= span.fromX && localX < span.toX,
  )?.style;
  if (style === 'snow') return 'snow';
  if (style === 'forest') return 'leaves';
  return undefined;
}
