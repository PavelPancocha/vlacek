import { describe, expect, it } from 'vitest';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import {
  PARTICLE_KINDS,
  kindIndex,
} from '../../../../src/render/particles/particleKinds.ts';
import {
  TrainEffects,
  type TrainEffectsInput,
} from '../../../../src/render/particles/TrainEffects.ts';

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

const MAX = 480;
const base: TrainEffectsInput = {
  dtSec: 1 / 60,
  speedUPerSec: 0,
  maxSpeedUPerSec: MAX,
  intent: 'COAST',
  emitters: [],
  driverRadiusU: 13,
  wheels: [{ x: 0, y: 0 }],
  front: { x: 0, y: 0, ground: undefined },
  rateScale: 1,
};

/** Emissions per particle kind over `seconds` of the given state. */
function run(
  input: Partial<TrainEffectsInput>,
  seconds = 10,
  capacity = 10_000,
) {
  const field = new ParticleField(PARTICLE_KINDS, capacity, lcg(11));
  const effects = new TrainEffects(field, lcg(12));
  const counts = new Map<string, number>();
  const frames = Math.round(seconds * 60);
  let maxLive = 0;
  for (let i = 0; i < frames; i++) {
    const before = field.live;
    const emitted = effects.step({ ...base, ...input });
    for (const [kind, n] of emitted)
      counts.set(kind, (counts.get(kind) ?? 0) + n);
    field.step(input.dtSec ?? base.dtSec);
    maxLive = Math.max(maxLive, field.live, before);
  }
  return { counts, maxLive, field };
}

const steam = [{ kind: 'steam' as const, x: 0, y: -94, tiltDeg: 0 }];

describe('TrainEffects (doc 14 §4)', () => {
  it('emits nothing while the ride is paused', () => {
    const { counts } = run({
      dtSec: 0,
      speedUPerSec: 300,
      intent: 'THROTTLE',
      emitters: steam,
      front: { x: 0, y: 0, ground: 'snow' },
    });
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('puffs steam in beats of the driving wheels, stronger when moving than standing', () => {
    const standing = run({ emitters: steam }).counts;
    const moving = run({ emitters: steam, speedUPerSec: 120 }).counts;
    const puffs = (c: Map<string, number>) =>
      (c.get('smoke') ?? 0) + (c.get('steam') ?? 0);
    expect(puffs(standing)).toBeGreaterThan(5);
    // Four beats per revolution of a 13 u wheel over 1200 u.
    const beats = (4 * 1200) / (2 * Math.PI * 13);
    expect(moving.get('smoke')).toBeGreaterThan(beats * 0.9);
    expect(moving.get('smoke')).toBeLessThan(beats * 1.1 + 2);
    expect(puffs(moving)).toBeGreaterThan(puffs(standing) * 3);
  });

  it('adds white steam when starting off under throttle', () => {
    const coasting = run({ emitters: steam, speedUPerSec: 60 }).counts;
    const starting = run({
      emitters: steam,
      speedUPerSec: 60,
      intent: 'THROTTLE',
    }).counts;
    expect(starting.get('steam') ?? 0).toBeGreaterThan(
      (coasting.get('steam') ?? 0) + 10,
    );
  });

  it('gives the diesel light exhaust, more under throttle, and no smoke', () => {
    const diesel = [{ kind: 'diesel' as const, x: 0, y: -80, tiltDeg: 0 }];
    const idle = run({ emitters: diesel }).counts;
    const pulling = run({
      emitters: diesel,
      intent: 'THROTTLE',
      speedUPerSec: 100,
    }).counts;
    expect(idle.get('diesel') ?? 0).toBeGreaterThan(0);
    expect(pulling.get('diesel') ?? 0).toBeGreaterThan(
      (idle.get('diesel') ?? 0) * 2,
    );
    expect(pulling.get('smoke') ?? 0).toBe(0);
  });

  it('lets the fairy-tale locomotive puff stars, never smoke', () => {
    const stars = [{ kind: 'stars' as const, x: 0, y: -90, tiltDeg: 0 }];
    const { counts } = run({ emitters: stars, speedUPerSec: 200 });
    expect(counts.get('star') ?? 0).toBeGreaterThan(10);
    expect((counts.get('smoke') ?? 0) + (counts.get('steam') ?? 0)).toBe(0);
  });

  it('keeps a locomotive without emitters clean (electric)', () => {
    const { counts } = run({ speedUPerSec: 400, intent: 'THROTTLE' });
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('sparks now and then where the pantograph touches the wire, never standing (electric)', () => {
    const pantograph = { x: 5, y: -160 };
    const still = run({ pantograph }, 20).counts;
    const moving = run(
      { pantograph, speedUPerSec: MAX, intent: 'THROTTLE' },
      20,
    ).counts;
    expect(still.get('spark') ?? 0).toBe(0);
    expect(moving.get('spark') ?? 0).toBeGreaterThan(0);
    // Only now and then: a handful in twenty seconds.
    expect(moving.get('spark') ?? 0).toBeLessThan(30);
    expect(moving.get('smoke') ?? 0).toBe(0);
  });

  it('throws an occasional spark only when braking hard', () => {
    const coast = run({ speedUPerSec: MAX }).counts;
    const brakeSlow = run({ speedUPerSec: MAX * 0.2, intent: 'BRAKE' }).counts;
    const brakeFast = run({ speedUPerSec: MAX, intent: 'BRAKE' }).counts;
    expect(coast.get('spark') ?? 0).toBe(0);
    expect(brakeSlow.get('spark') ?? 0).toBe(0);
    // A few per second at most: no fireworks (doc 14 §4).
    expect(brakeFast.get('spark') ?? 0).toBeGreaterThan(5);
    expect(brakeFast.get('spark') ?? 0).toBeLessThan(150);
  });

  it('kicks up snow and leaves only where they lie and only while moving', () => {
    const snowStill = run({ front: { x: 0, y: 0, ground: 'snow' } }).counts;
    const snowMoving = run({
      speedUPerSec: 300,
      front: { x: 0, y: 0, ground: 'snow' },
    }).counts;
    const meadow = run({ speedUPerSec: 300 }).counts;
    const forest = run({
      speedUPerSec: 300,
      front: { x: 0, y: 0, ground: 'leaves' },
    }).counts;
    expect(snowStill.get('snow') ?? 0).toBe(0);
    expect(snowMoving.get('snow') ?? 0).toBeGreaterThan(50);
    expect((meadow.get('snow') ?? 0) + (meadow.get('leaf') ?? 0)).toBe(0);
    expect(forest.get('leaf') ?? 0).toBeGreaterThan(10);
    expect(forest.get('snow') ?? 0).toBe(0);
  });

  it('halves the density in the low quality profile', () => {
    const full = run({ emitters: steam, speedUPerSec: 300 }).counts;
    const low = run({
      emitters: steam,
      speedUPerSec: 300,
      rateScale: 0.5,
    }).counts;
    const ratio = (low.get('smoke') ?? 0) / (full.get('smoke') ?? 1);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('stays within the particle budget over a long, busy ride', () => {
    const { maxLive, field } = run(
      {
        emitters: steam,
        speedUPerSec: MAX,
        intent: 'BRAKE',
        front: { x: 0, y: 0, ground: 'snow' },
      },
      60,
      240,
    );
    expect(maxLive).toBeLessThanOrEqual(240);
    expect(field.capacity).toBe(240);
  });

  it('names a kind index for every kind it emits', () => {
    for (const name of [
      'smoke',
      'steam',
      'diesel',
      'star',
      'spark',
      'leaf',
      'snow',
    ])
      expect(kindIndex(name)).toBeGreaterThanOrEqual(0);
  });
});

describe('particle sprites', () => {
  it('draws every particle kind from the effect parts of the world art', async () => {
    const { effectParts } = await import('../../../../src/content/worldArt.ts');
    const { PARTICLE_FRAMES } =
      await import('../../../../src/render/particles/particleKinds.ts');
    // The glint shimmers on water in the chunk view, not as a particle.
    expect([...PARTICLE_FRAMES, 'fx.glint'].sort()).toEqual(
      [...effectParts].sort(),
    );
  });
});
