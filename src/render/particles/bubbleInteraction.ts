import type { Particle, ParticleField } from './ParticleField.ts';
import { kindIndex } from './particleKinds.ts';

/** Only faded-in bubbles exposed by the cover geometry can be touched. */
export function visibleBubbles(
  field: ParticleField,
  canSee?: (point: { x: number; y: number }) => boolean,
): readonly Particle[] {
  return field
    .particles()
    .filter(
      (p) =>
        p.kind === kindIndex('bubble') &&
        field.alphaOf(p) >= 0.1 &&
        canSee?.(field.positionOf(p)) !== false,
    );
}

/** Radius of the drawn circle in fx.bubble.svg (10.5 of its 24 u frame). */
export function bubbleRadiusU(field: ParticleField, bubble: Particle): number {
  return (field.sizeOf(bubble) * 10.5) / 24;
}

/** Topmost visible bubble at the render-world point; y points down. */
export function bubbleAt(
  field: ParticleField,
  xU: number,
  yU: number,
  canSee?: (point: { x: number; y: number }) => boolean,
): number | undefined {
  if (canSee?.({ x: xU, y: yU }) === false) return undefined;
  const bubbles = visibleBubbles(field, canSee);
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const bubble = bubbles[i];
    if (!bubble) continue;
    const at = field.positionOf(bubble);
    if (Math.hypot(xU - at.x, yU - at.y) <= bubbleRadiusU(field, bubble))
      return bubble.id;
  }
  return undefined;
}

/** A single small pop shares the decorative cap; reduced effects shrink it. */
export function popBubble(
  field: ParticleField,
  id: number,
  rateScale: number,
  canSee?: (point: { x: number; y: number }) => boolean,
): boolean {
  const bubble = field
    .particles()
    .find((p) => p.id === id && p.kind === kindIndex('bubble'));
  if (!bubble) return false;
  const at = field.positionOf(bubble);
  if (canSee?.(at) === false) return false;
  field.remove(id);
  field.emit(kindIndex('bubble-pop'), at.x, at.y, 1, {
    sizeScale: rateScale,
    ...(bubble.depth === undefined ? {} : { depth: bubble.depth }),
  });
  return true;
}
