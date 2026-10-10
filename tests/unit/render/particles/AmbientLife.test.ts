import { describe, expect, it } from 'vitest';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import { PARTICLE_KINDS } from '../../../../src/render/particles/particleKinds.ts';
import {
  AmbientLife,
  type AmbientInput,
} from '../../../../src/render/particles/AmbientLife.ts';

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const input: AmbientInput = {
  dtSec: 1 / 60,
  view: { left: 0, top: -1000, width: 2000, height: 1200 },
  meadowY: 100,
  meadow: true,
  rateScale: 1,
};

function run(over: Partial<AmbientInput>, seconds: number) {
  const field = new ParticleField(PARTICLE_KINDS, 1000, lcg(3));
  const life = new AmbientLife(field, lcg(4));
  const events: string[] = [];
  let overlapping = 0;
  for (let i = 0; i < seconds * 60; i++) {
    const started = life.step({ ...input, ...over });
    if (started) {
      if (life.activeEvents > 1) overlapping += 1;
      events.push(started);
    }
    field.step(over.dtSec ?? input.dtSec);
  }
  return { events, overlapping };
}

describe('AmbientLife: now and then a bird or a butterfly (doc 14 §4)', () => {
  it('starts occasional events, never two at once', () => {
    const { events, overlapping } = run({}, 300);
    expect(events.length).toBeGreaterThan(5);
    expect(events.length).toBeLessThan(40);
    expect(overlapping).toBe(0);
  });

  it('sends butterflies only over a meadow', () => {
    const { events } = run({ meadow: false }, 300);
    expect(events.length).toBeGreaterThan(3);
    expect(events.every((event) => event === 'birds')).toBe(true);
    const meadow = run({}, 600).events;
    expect(meadow).toContain('butterflies');
  });

  it('waits while the ride is paused', () => {
    expect(run({ dtSec: 0 }, 120).events).toEqual([]);
  });
});
