/**
 * Small, constant motion of the scenery (doc 14 §4): meadow plants sway
 * in the wind, trees barely move, water glints flash now and then. Pure
 * functions of simulation time, so everything stands still in pause.
 */

/** Plants that sway, by art key prefix, and their amplitude (rad). */
const SWAYING: readonly (readonly [string, number])[] = [
  ['near.grass-', 0.05],
  ['near.tall-grass', 0.045],
  ['near.wildflowers', 0.03],
  ['near.flowers-', 0.04],
  ['near.poppies', 0.04],
  ['near.reeds', 0.05],
  ['near.dune-grass', 0.05],
  ['near.fern', 0.03],
  ['back.reeds', 0.03],
  ['tree.', 0.012],
];

/** How far a scenery part sways (rad); 0 for anything rigid. */
export function swayAmplitudeRad(kind: string): number {
  return SWAYING.find(([prefix]) => kind.startsWith(prefix))?.[1] ?? 0;
}

/**
 * Sway angle now: a slow swing with a faster flutter on top, phase per
 * prop (0 … 1) so neighbours do not move in step.
 */
export function swayAngle(
  kind: string,
  timeSec: number,
  phase: number,
): number {
  const amplitude = swayAmplitudeRad(kind);
  if (amplitude === 0) return 0;
  const slow = Math.sin(2 * Math.PI * (0.35 * timeSec + phase));
  const fast = Math.sin(2 * Math.PI * (1.1 * timeSec + phase * 3));
  return amplitude * (0.75 * slow + 0.25 * fast);
}

/** Peak opacity of a water glint. */
const GLINT_PEAK = 0.8;

/** Opacity of a water glint now: short flashes, dark most of the time. */
export function glintAlpha(timeSec: number, phase: number): number {
  const wave = Math.sin(2 * Math.PI * (0.45 * timeSec + phase));
  return wave <= 0.6 ? 0 : GLINT_PEAK * ((wave - 0.6) / 0.4) ** 2;
}
