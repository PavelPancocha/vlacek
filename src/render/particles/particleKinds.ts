import type { ParticleKind } from './ParticleField.ts';

/**
 * Particle kinds of the ride (doc 14 §4), sizes in u and times in seconds
 * of simulation time. Smoke and steam rise (negative gravity) and slow
 * down in the air, so behind a moving train the puffs trail to the left;
 * sparks fall fast; leaves flutter down; snow is a short spray.
 */
const KINDS = {
  smoke: {
    frames: ['fx.smoke'],
    lifeSec: [2, 3],
    speedU: [50, 70],
    directionDeg: [-100, -80],
    gravityU: -14,
    dragPerSec: 0.9,
    windU: -14,
    sizeU: [14, 52],
    alpha: 0.8,
    spinDegPerSec: [-30, 30],
  },
  steam: {
    frames: ['fx.steam'],
    lifeSec: [1.1, 1.7],
    speedU: [35, 55],
    directionDeg: [-105, -75],
    gravityU: -8,
    dragPerSec: 1.2,
    windU: -10,
    sizeU: [12, 42],
    alpha: 0.85,
    spinDegPerSec: [-40, 40],
  },
  diesel: {
    frames: ['fx.diesel'],
    lifeSec: [0.8, 1.3],
    speedU: [20, 30],
    directionDeg: [-100, -80],
    gravityU: -4,
    dragPerSec: 1.5,
    windU: -12,
    sizeU: [8, 26],
    alpha: 0.6,
    spinDegPerSec: [-20, 20],
  },
  star: {
    frames: ['fx.star'],
    lifeSec: [1.8, 2.6],
    speedU: [14, 26],
    directionDeg: [-120, -60],
    gravityU: -2,
    dragPerSec: 0.4,
    windU: -6,
    sizeU: [9, 14],
    alpha: 1,
    spinDegPerSec: [-120, 120],
  },
  spark: {
    frames: ['fx.spark'],
    lifeSec: [0.2, 0.4],
    speedU: [60, 110],
    directionDeg: [-175, -140],
    gravityU: 260,
    dragPerSec: 0.5,
    windU: 0,
    sizeU: [5, 3],
    alpha: 1,
    spinDegPerSec: [0, 0],
    alignToMotion: true,
  },
  leaf: {
    frames: ['fx.leaf-a', 'fx.leaf-b', 'fx.leaf-c'],
    lifeSec: [1.6, 2.6],
    speedU: [30, 70],
    directionDeg: [-160, -100],
    gravityU: 40,
    dragPerSec: 1.6,
    windU: -8,
    sizeU: [8, 8],
    alpha: 1,
    spinDegPerSec: [-360, 360],
    wobble: { ampU: 6, hz: 1.2 },
  },
  snow: {
    frames: ['fx.snow'],
    lifeSec: [0.6, 1.1],
    speedU: [60, 120],
    directionDeg: [-165, -110],
    gravityU: 90,
    dragPerSec: 1.2,
    windU: -10,
    sizeU: [5, 10],
    alpha: 0.95,
    spinDegPerSec: [0, 0],
  },
  bird: {
    frames: ['fx.bird-up', 'fx.bird-down'],
    frameHz: 7,
    lifeSec: [14, 18],
    speedU: [110, 140],
    directionDeg: [-186, -178],
    gravityU: 0,
    dragPerSec: 0,
    windU: 0,
    sizeU: [14, 14],
    alpha: 1,
    spinDegPerSec: [0, 0],
    wobble: { ampU: 3, hz: 0.5 },
  },
  'butterfly-a': {
    frames: ['fx.butterfly-a-open', 'fx.butterfly-a-closed'],
    frameHz: 9,
    lifeSec: [6, 9],
    speedU: [8, 16],
    directionDeg: [-180, 0],
    gravityU: 0,
    dragPerSec: 0,
    windU: 0,
    sizeU: [9, 9],
    alpha: 1,
    spinDegPerSec: [0, 0],
    wobble: { ampU: 12, hz: 0.6 },
  },
  'butterfly-b': {
    frames: ['fx.butterfly-b-open', 'fx.butterfly-b-closed'],
    frameHz: 9,
    lifeSec: [6, 9],
    speedU: [8, 16],
    directionDeg: [-180, 0],
    gravityU: 0,
    dragPerSec: 0,
    windU: 0,
    sizeU: [9, 9],
    alpha: 1,
    spinDegPerSec: [0, 0],
    wobble: { ampU: 12, hz: 0.6 },
  },
} satisfies Record<string, ParticleKind>;

export type ParticleKindName = keyof typeof KINDS;

const NAMES = [
  'smoke',
  'steam',
  'diesel',
  'star',
  'spark',
  'leaf',
  'snow',
  'bird',
  'butterfly-a',
  'butterfly-b',
] as const satisfies readonly ParticleKindName[];
// Compile-time: every kind above is in the list.
const everyKindListed: [
  Exclude<ParticleKindName, (typeof NAMES)[number]>,
] extends [never]
  ? true
  : never = true;
void everyKindListed;

/** Kinds in a fixed order; a particle stores its kind's index. */
export const PARTICLE_KINDS: readonly ParticleKind[] = NAMES.map(
  (name) => KINDS[name],
);

/** Index of a kind by name, −1 if unknown. */
export function kindIndex(name: string): number {
  return NAMES.findIndex((kind) => kind === name);
}

/** Name of a kind by index. */
export function kindName(index: number): ParticleKindName | undefined {
  return NAMES[index];
}

/** Every atlas frame the particles use (for the art usage check). */
export const PARTICLE_FRAMES: readonly string[] = [
  ...new Set(PARTICLE_KINDS.flatMap((kind) => kind.frames)),
];
