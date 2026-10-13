import { describe, expect, it } from 'vitest';
import { vehicleArt } from '../../../../src/content/artManifest.ts';
import { locomotives } from '../../../../src/content/vehicles.ts';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import {
  PARTICLE_KINDS,
  kindIndex,
} from '../../../../src/render/particles/particleKinds.ts';
import {
  TrainEffects,
  TrainEffectsByTrain,
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
  travelDirection: 1,
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
  it.each([
    {
      id: 'steam_express',
      kind: 'steam',
      xU: 186,
      yU: 8,
      heightU: 108,
      particle: 'smoke',
    },
    {
      id: 'diesel_shunter',
      kind: 'diesel',
      xU: 96,
      yU: 25,
      heightU: 82,
      particle: 'diesel',
    },
  ] as const)(
    'emits $particle at the $id contract outlet',
    ({ id, kind, xU, yU, heightU, particle }) => {
      const locomotive = locomotives.find((entry) => entry.id === id);
      const art = vehicleArt[id];
      expect(locomotive?.effect).toBe(kind);
      expect(art?.emitters).toEqual([{ xU, yU }]);
      if (!locomotive || !art) throw new Error(`${id}: missing art`);
      const field = new ParticleField(PARTICLE_KINDS, 100, () => 0.5);
      const effects = new TrainEffects(field, () => 0.5);
      effects.step({
        ...base,
        dtSec: 1,
        speedUPerSec: 120,
        intent: 'THROTTLE',
        driverRadiusU: locomotive.wheelRadiusU,
        emitters: (art.emitters ?? []).map((emitter) => ({
          kind,
          x: emitter.xU - locomotive.lengthU / 2,
          y: emitter.yU - art.heightU,
          tiltDeg: 0,
        })),
      });
      const particles = field
        .particles()
        .filter((entry) => entry.kind === kindIndex(particle));
      expect(particles.length).toBeGreaterThan(0);
      for (const puff of particles) {
        expect(puff.x).toBe(xU - locomotive.lengthU / 2);
        expect(puff.y).toBe(yU - heightU);
      }
      if (kind === 'diesel')
        expect(
          field
            .particles()
            .every((entry) => entry.kind === kindIndex('diesel')),
        ).toBe(true);
    },
  );

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

  it.each([
    ['bubbles', 'bubble'],
    ['rainbow', 'rainbow-puff'],
  ] as const)(
    'emits %s at its anchor without stars or smoke, respecting pause and reduced effects',
    (effect, kind) => {
      const emitters = [{ kind: effect, x: 127, y: -84, tiltDeg: 0 }];
      const input = { emitters, speedUPerSec: 200 };
      const full = run(input);
      const low = run({ ...input, rateScale: 0.5 }, 60, 96);
      const standard = run(input, 60, 240);
      expect(full.counts.get(kind) ?? 0).toBeGreaterThan(10);
      expect([...full.counts.keys()]).toEqual([kind]);
      const ratio =
        (low.counts.get(kind) ?? 0) / (standard.counts.get(kind) ?? 1);
      expect(ratio).toBeGreaterThan(0.45);
      expect(ratio).toBeLessThan(0.55);
      expect(standard.maxLive).toBeLessThanOrEqual(240);
      expect(low.maxLive).toBeLessThanOrEqual(96);
      expect(run({ ...input, dtSec: 0 }).counts.size).toBe(0);
      const field = new ParticleField(PARTICLE_KINDS, 96, lcg(11));
      new TrainEffects(field, lcg(12)).step({ ...base, emitters, dtSec: 1 });
      expect(field.live).toBeGreaterThan(0);
      for (const p of field.particles()) {
        expect(p.x).toBeGreaterThanOrEqual(125.5);
        expect(p.x).toBeLessThanOrEqual(128.5);
        expect(p.y).toBeGreaterThanOrEqual(-85.5);
        expect(p.y).toBeLessThanOrEqual(-82.5);
      }
    },
  );

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

describe('oncoming trains (doc 05 §6, D-017)', () => {
  const diesel = [{ kind: 'diesel' as const, x: 0, y: -80, tiltDeg: 0 }];
  const pulling: Partial<TrainEffectsInput> = {
    speedUPerSec: 300,
    intent: 'THROTTLE',
    travelDirection: -1,
  };

  it('keeps puffs moving with a train that drives left', () => {
    for (const [travelDirection, sign] of [
      [1, 1],
      [-1, -1],
    ] as const) {
      const { field } = run(
        {
          speedUPerSec: 400,
          emitters: steam,
          intent: 'THROTTLE',
          travelDirection,
        },
        0.5,
      );
      const smoke = field
        .particles()
        .filter((p) => p.kind === kindIndex('smoke'));
      expect(smoke.length).toBeGreaterThan(0);
      const meanVx = smoke.reduce((sum, p) => sum + p.vx, 0) / smoke.length;
      // 0.3 × 400 u/s inherited, against a few u/s of the puff's own drift.
      expect(meanVx * sign).toBeGreaterThan(60);
    }
  });

  it('gives each oncoming train its own emission clock', () => {
    // Per-frame diesel puffs of a train that runs alone.
    const frames = 600;
    const loneField = new ParticleField(PARTICLE_KINDS, 100_000, lcg(11));
    const loneEffects = new TrainEffects(loneField, lcg(12));
    const lone = Array.from(
      { length: frames },
      () =>
        loneEffects
          .step({ ...base, ...pulling, emitters: diesel })
          .get('diesel') ?? 0,
    );
    expect(lone.some((n) => n > 0)).toBe(true);
    // Two trains overlapping (seed 11 at full speed): each keeps the lone
    // train's rhythm, whatever order they are stepped in.
    const field = new ParticleField(PARTICLE_KINDS, 100_000, lcg(11));
    const trains = new TrainEffectsByTrain(field, lcg(12));
    const puffs = { a: [] as number[], b: [] as number[] };
    for (let i = 0; i < frames; i++)
      for (const id of ['a', 'b'] as const)
        puffs[id].push(
          trains
            .step(id, { ...base, ...pulling, emitters: diesel })
            .get('diesel') ?? 0,
        );
    expect(puffs.a).toEqual(lone);
    expect(puffs.b).toEqual(lone);
  });

  it('forgets a train once it has finished', () => {
    const field = new ParticleField(PARTICLE_KINDS, 1000, lcg(11));
    const trains = new TrainEffectsByTrain(field, lcg(12));
    for (const id of ['a', 'b'])
      trains.step(id, { ...base, ...pulling, emitters: diesel });
    expect(trains.size).toBe(2);
    trains.retain(new Set(['b']));
    expect(trains.size).toBe(1);
    trains.clear();
    expect(trains.size).toBe(0);
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

// The source is behind rock; clocks still advance without a release burst.
it('tunnel-1: suppresses every vehicle source behind rock and preserves its track depth', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new TrainEffects(field, () => 0.5);
  const input = {
    ...base,
    dtSec: 1,
    speedUPerSec: MAX,
    intent: 'BRAKE' as const,
    emitters: (['steam', 'diesel', 'stars', 'bubbles', 'rainbow'] as const).map(
      (kind) => ({ kind, x: 100, y: -94, tiltDeg: 0 }),
    ),
    wheels: [{ x: 100, y: 0 }],
    pantograph: { x: 100, y: -160 },
    front: { x: 100, y: 0, ground: 'snow' as const },
    canEmit: () => false,
    depth: 7.55,
  };
  effects.step(input);
  expect(field.live).toBe(0);
  effects.step({ ...input, dtSec: 1 / 60, canEmit: () => true });
  expect(field.live).toBeLessThan(5);
  effects.step({ ...input, canEmit: () => true });
  expect(field.live).toBeGreaterThan(0);
  expect(field.particles().every((p) => 'depth' in p && p.depth === 7.55)).toBe(
    true,
  );
});
