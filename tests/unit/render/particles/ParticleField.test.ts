import { describe, expect, it } from 'vitest';
import {
  ParticleField,
  type ParticleKind,
} from '../../../../src/render/particles/ParticleField.ts';

/** Seeded generator for repeatable tests. */
function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const still: ParticleKind = {
  frames: ['fx.smoke'],
  lifeSec: [2, 2],
  speedU: [0, 0],
  directionDeg: [0, 0],
  gravityU: 0,
  dragPerSec: 0,
  windU: 0,
  sizeU: [10, 10],
  alpha: 1,
  spinDegPerSec: [0, 0],
};

describe('ParticleField (doc 14 §4: bounded, reused, in world space)', () => {
  it('never holds more particles than its capacity', () => {
    const field = new ParticleField([still], 5, lcg(1));
    expect(field.emit(0, 0, 0, 3)).toBe(3);
    expect(field.emit(0, 0, 0, 3)).toBe(2);
    expect(field.emit(0, 0, 0, 1)).toBe(0);
    expect(field.live).toBe(5);
  });

  it('frees particles at the end of their life', () => {
    const field = new ParticleField([still], 5, lcg(1));
    field.emit(0, 0, 0, 2);
    field.step(1.9);
    expect(field.live).toBe(2);
    field.step(0.2);
    expect(field.live).toBe(0);
    expect(field.emit(0, 0, 0, 5)).toBe(5);
  });

  it('moves emitted particles by their own velocity, gravity and wind, not with the emitter', () => {
    const kind: ParticleKind = {
      ...still,
      speedU: [10, 10],
      directionDeg: [-90, -90],
      gravityU: 4,
      windU: -3,
    };
    const field = new ParticleField([kind], 4, lcg(2));
    field.emit(0, 100, 50, 1, { vxU: 6 });
    field.step(1);
    const [p] = field.particles();
    // Up 10 u/s, gravity 4 u/s² down, wind 3 u/s left, inherited 6 u/s right.
    expect(p?.x).toBeCloseTo(100 + 6 - 3, 9);
    expect(p?.y).toBeCloseTo(50 - 10 + 2, 9);
  });

  it('stands still while the simulation is paused (step 0)', () => {
    const kind: ParticleKind = {
      ...still,
      speedU: [20, 20],
      spinDegPerSec: [90, 90],
    };
    const field = new ParticleField([kind], 4, lcg(3));
    field.emit(0, 0, 0, 2);
    field.step(0.5);
    const before = JSON.stringify(field.particles());
    field.step(0);
    expect(JSON.stringify(field.particles())).toBe(before);
  });

  it('is repeatable for the same random sequence', () => {
    const kind: ParticleKind = {
      ...still,
      speedU: [5, 30],
      directionDeg: [-150, -30],
      lifeSec: [1, 3],
    };
    const run = () => {
      const field = new ParticleField([kind], 50, lcg(7));
      for (let i = 0; i < 20; i++) {
        field.emit(0, i, 0, 2);
        field.step(0.1);
      }
      return field.particles();
    };
    expect(run()).toEqual(run());
  });

  it('fades in, holds and fades out over its life', () => {
    const field = new ParticleField([{ ...still, alpha: 0.8 }], 1, lcg(4));
    field.emit(0, 0, 0, 1);
    const alpha = () => {
      const p = field.particles()[0];
      if (!p) throw new Error('no particle');
      return field.alphaOf(p);
    };
    expect(alpha()).toBe(0);
    field.step(1);
    expect(alpha()).toBeCloseTo(0.8, 9);
    field.step(0.98);
    expect(alpha()).toBeLessThan(0.1);
  });

  it('lowers its capacity for the low quality profile without dropping live particles', () => {
    const field = new ParticleField([still], 10, lcg(5));
    field.emit(0, 0, 0, 8);
    field.setCapacity(4);
    expect(field.live).toBe(8);
    expect(field.emit(0, 0, 0, 1)).toBe(0);
    field.step(2.1);
    expect(field.emit(0, 0, 0, 6)).toBe(4);
  });
});
