import { gameConfig } from '../../../../src/config/gameConfig.ts';
import { effectiveClimateAt } from '../../../../src/domain/world/Seasons.ts';
import { frostyWireAt } from '../../../../src/render/particles/SeasonalEffects.ts';
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

const MAX = gameConfig.train.maxSpeedUPerSec;
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
  it('drops partial emission clocks when starting a new journey', () => {
    const field = new ParticleField(PARTICLE_KINDS, 100, () => 0.5);
    const effects = new TrainEffects(field, () => 0.5);
    const input = {
      ...base,
      dtSec: 0.2,
      emitters: [{ kind: 'diesel' as const, x: 0, y: 0, tiltDeg: 0 }],
    };
    expect(effects.step(input).size).toBe(0); // 0.6 of an idle puff.
    field.clear();
    effects.reset();
    expect(effects.step(input).size).toBe(0);
    expect(field.live).toBe(0);
    expect(effects.step(input).get('diesel')).toBe(1);
  });

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
    expect(moving.get('contact-spark') ?? 0).toBeGreaterThan(100);
    expect(moving.get('contact-spark') ?? 0).toBeLessThanOrEqual(300);
    expect(moving.get('spark') ?? 0).toBe(0);
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
    const { parts: seasonParts } =
      await import('../../../../src/content/world-modules/seasons-life.art.ts');
    const { PARTICLE_FRAMES } =
      await import('../../../../src/render/particles/particleKinds.ts');
    // The glint shimmers on water in the chunk view, not as a particle.
    expect([...PARTICLE_FRAMES, 'fx.glint'].sort()).toEqual(
      [
        ...effectParts.filter(
          (key) =>
            !['fx.leaf-a', 'fx.leaf-b', 'fx.leaf-c', 'fx.snow'].includes(key),
        ),
        ...Object.keys(seasonParts).filter(
          (key) => key.startsWith('fx.') && !key.startsWith('fx.duck-ripple'),
        ),
      ].sort(),
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

it('SEA-04: each bogie stirs its own snow surface; a dry front cannot hide snowy rear wheels', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new TrainEffects(field, () => 0.5);
  for (let i = 0; i < 60; i++)
    effects.step({
      ...base,
      speedUPerSec: gameConfig.train.maxSpeedUPerSec,
      wheels: [
        { x: 10, y: 0 },
        { x: 100, y: 0 },
      ],
      groundAt: (x) => (x < 50 ? { kind: 'snow', strength: 1 } : undefined),
    });
  expect(field.live).toBeGreaterThan(0);
  expect(field.particles().every((p) => p.x >= 6 && p.x <= 14)).toBe(true);
  const count = field.live;
  effects.step({ ...base, groundAt: () => ({ kind: 'snow', strength: 1 }) });
  expect(field.live).toBe(count);
  field.step(1.2);
  expect(field.live).toBe(0);
});

it('SEA-04: low longest train leaves a continuous short granular trail without raising its emission budget', () => {
  const field = new ParticleField(PARTICLE_KINDS, 96, lcg(31));
  const effects = new TrainEffects(field, lcg(32));
  let born = 0;
  for (let tick = 0; tick < 240; tick++) {
    const front = tick * 8;
    const wheels = Array.from({ length: 22 }, (_, i) => ({
      x: front - i * 86,
      y: 0,
    }));
    born +=
      effects
        .step({
          ...base,
          speedUPerSec: gameConfig.train.maxSpeedUPerSec,
          rateScale: 0.5,
          wheels,
          groundAt: () => ({ kind: 'snow', strength: 1 }),
        })
        .get('snow') ?? 0;
    field.step(1 / 60);
    if (tick >= 180 && tick % 2 === 0) {
      const tail = front - 21 * 86;
      const trail = field
        .particles()
        .filter(
          (p) => p.x < tail - 20 && p.x > tail - 400 && field.alphaOf(p) > 0.3,
        );
      expect(trail.length, `tick ${tick}`).toBeGreaterThanOrEqual(3);
    }
  }
  expect(born).toBeLessThanOrEqual(4 * 70 * 0.5 + 22); // existing fractional phases
  expect(field.live).toBeLessThanOrEqual(96);
});

// SPK-01: rates, traction, lifecycle and the shared cap are observable emissions.
describe('contact sparking (sparks-1, TRN-08)', () => {
  const pantograph = { x: 100, y: -128 };
  const moving = { pantograph, speedUPerSec: MAX, intent: 'THROTTLE' as const };
  const sparks = (input: Partial<TrainEffectsInput>) =>
    run(input).counts.get('contact-spark') ?? 0;

  it('is frequent at game scale and increases with speed and traction', () => {
    const slow = sparks({ ...moving, speedUPerSec: MAX * 0.4 });
    const fast = sparks(moving);
    const coast = sparks({ ...moving, intent: 'COAST' });
    expect(slow).toBeGreaterThan(25);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeGreaterThan(coast);
    expect(fast).toBeLessThanOrEqual(150);
  });

  it.each([
    { speedUPerSec: 0 },
    { intent: 'COAST' as const, speedUPerSec: MAX * 0.1 },
    { intent: 'BRAKE' as const },
    { pantograph: undefined },
    { pantograph: { ...pantograph, outOfRange: true } },
  ])('does not spark at an inactive contact: %j', (override) => {
    expect(sparks({ ...moving, ...override })).toBe(0);
  });

  it('bursts once at the actual support / span joint, not on both adjacent frames', () => {
    const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
    const effects = new TrainEffects(field, () => 0.5);
    const input = { ...base, ...moving, catenarySupportXs: [110] };
    effects.step(input);
    expect(
      effects
        .step({ ...input, pantograph: { x: 111, y: -128 } })
        .get('contact-spark'),
    ).toBe(6);
    expect(
      effects
        .step({ ...input, pantograph: { x: 112, y: -128 } })
        .get('contact-spark') ?? 0,
    ).toBe(0);
    expect(
      field
        .particles()
        .every((p) => p.vx < 0 || p.kind === kindIndex('contact-glow')),
    ).toBe(true);
  });

  it('bursts on the first moving step after standing under throttle', () => {
    const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
    const effects = new TrainEffects(field, () => 0.5);
    effects.step({ ...base, pantograph });
    expect(
      effects
        .step({ ...base, pantograph, intent: 'THROTTLE', speedUPerSec: 2 })
        .get('contact-spark'),
    ).toBe(6);
    expect(
      effects
        .step({ ...base, pantograph, intent: 'THROTTLE', speedUPerSec: 4 })
        .get('contact-spark') ?? 0,
    ).toBe(0);
  });

  it('uses game time, drops suspension backlog and resets the spatial passage', () => {
    const count = (dtSec: number) => {
      const field = new ParticleField(PARTICLE_KINDS, 1000, () => 0.5);
      const effects = new TrainEffects(field, () => 0.5);
      let n = 0;
      for (let i = 0; i < Math.round(10 / dtSec); i++)
        n +=
          effects.step({ ...base, ...moving, dtSec }).get('contact-spark') ?? 0;
      return n;
    };
    expect(count(1 / 30)).toBeGreaterThan(100);
    expect(Math.abs(count(1 / 30) - count(1 / 120))).toBeLessThanOrEqual(2);
    const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
    const effects = new TrainEffects(field, () => 0.5);
    effects.step({ ...base, ...moving, catenarySupportXs: [110] });
    expect(
      effects.step({ ...base, ...moving, dtSec: 0 }).get('contact-spark') ?? 0,
    ).toBe(0);
    expect(
      effects.step({ ...base, ...moving, dtSec: 10 }).get('contact-spark') ?? 0,
    ).toBe(0);
    expect(
      effects
        .step({
          ...base,
          ...moving,
          pantograph: { x: 120, y: -128 },
          catenarySupportXs: [110],
        })
        .get('contact-spark') ?? 0,
    ).toBe(0);
  });

  it('increases frequency on frosty wire, reduces low density, retains smaller low glow and stays capped', () => {
    expect(sparks({ ...moving, frostyWire: true })).toBeGreaterThan(
      sparks(moving),
    );
    const low = run({ ...moving, rateScale: 0.5 }, 60, 96);
    const full = run(moving, 60, 240);
    expect(low.counts.get('contact-spark') ?? 0).toBeGreaterThan(100);
    expect(low.counts.get('contact-spark') ?? 0).toBeLessThan(
      (full.counts.get('contact-spark') ?? 0) / 2,
    );
    expect(low.counts.get('contact-glow') ?? 0).toBeGreaterThan(0);
    expect(full.counts.get('contact-glow') ?? 0).toBeGreaterThan(0);
    expect(low.maxLive).toBeLessThanOrEqual(96);
    expect(full.maxLive).toBeLessThanOrEqual(240);
    const crowded = run(moving, 10, 2);
    expect(crowded.maxLive).toBeLessThanOrEqual(2);
  });
});

it('sparks-1: remembers standstill on the initial zero-time render for the first moving tick', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new TrainEffects(field, () => 0.5);
  const pantograph = { x: 100, y: -128 };
  effects.step({ ...base, pantograph, dtSec: 0 });
  expect(
    effects
      .step({ ...base, pantograph, intent: 'THROTTLE', speedUPerSec: 2 })
      .get('contact-spark'),
  ).toBe(6);
});

it('sparks-1: interpolation-only renders do not erase fractional game-time emission', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new TrainEffects(field, () => 0.5);
  const input = {
    ...base,
    pantograph: { x: 100, y: -128 },
    speedUPerSec: MAX,
    intent: 'THROTTLE' as const,
  };
  let count = 0;
  for (let i = 0; i < 60; i++) {
    count += effects.step(input).get('contact-spark') ?? 0;
    effects.step({ ...input, dtSec: 0 });
  }
  expect(count).toBeGreaterThanOrEqual(8);
  expect(count).toBeLessThanOrEqual(12);
});

it('sparks-1: both contact kinds retain their tunnel layer and hidden sources advance without a release burst', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new TrainEffects(field, () => 0.5);
  const input = {
    ...base,
    pantograph: { x: 100, y: -128 },
    speedUPerSec: MAX,
    intent: 'THROTTLE' as const,
    depth: 7.55,
  };
  for (let i = 0; i < 60; i++) effects.step({ ...input, canEmit: () => false });
  expect(field.live).toBe(0);
  effects.step({ ...input, dtSec: 1 / 120 });
  expect(field.live).toBe(0);
  for (let i = 0; i < 10; i++) effects.step(input);
  expect(
    field.particles().some((p) => p.kind === kindIndex('contact-spark')),
  ).toBe(true);
  expect(
    field.particles().some((p) => p.kind === kindIndex('contact-glow')),
  ).toBe(true);
  expect(field.particles().every((p) => p.depth === 7.55)).toBe(true);
  field.clear();
  effects.reset();
  expect(effects.step(input).get('contact-spark') ?? 0).toBe(0);
});

it('sparks-2: four bright streaks and a glow form a calm burst every 0.3–0.8 game seconds at speed', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new TrainEffects(field, () => 0.5);
  const input = {
    ...base,
    pantograph: { x: 100, y: -128 },
    speedUPerSec: MAX,
    intent: 'THROTTLE' as const,
  };
  let last = 0,
    bursts = 0;
  for (let frame = 1; frame <= 300; frame++) {
    const emitted = effects.step(input);
    field.step(input.dtSec);
    if ((emitted.get('contact-spark') ?? 0) === 0) continue;
    expect(emitted.get('contact-spark')).toBe(4);
    expect(emitted.get('contact-glow')).toBe(1);
    const gapSec = (frame - last) / 60;
    expect(gapSec).toBeGreaterThanOrEqual(0.3);
    expect(gapSec).toBeLessThanOrEqual(0.8);
    last = frame;
    bursts++;
  }
  expect(bursts).toBeGreaterThanOrEqual(8);
});

it.each(['lowered', 'out-of-range', 'reset'] as const)(
  'sparks-3: removes an attached glow when its contact is %s, including a zero-tick render',
  (mode) => {
    const field = new ParticleField(PARTICLE_KINDS, 96, () => 0.5);
    const effects = new TrainEffects(field, () => 0.5);
    const pantograph = { x: 100, y: -128 };
    effects.step({ ...base, pantograph });
    effects.step({
      ...base,
      pantograph,
      speedUPerSec: MAX,
      intent: 'THROTTLE',
    });
    field.step(1 / 60);
    expect(
      field.particles().some((p) => p.kind === kindIndex('contact-glow')),
    ).toBe(true);
    if (mode === 'reset') effects.reset();
    else
      effects.step({
        ...base,
        dtSec: 0,
        pantograph:
          mode === 'lowered' ? undefined : { ...pantograph, outOfRange: true },
      });
    field.step(0);
    expect(
      field.particles().some((p) => p.kind === kindIndex('contact-glow')),
    ).toBe(false);
    expect(
      field.particles().some((p) => p.kind === kindIndex('contact-spark')),
    ).toBe(true);
    // The released glow record is reused by a free spark; no anchor may leak.
    const freeX = 300;
    field.emit(kindIndex('contact-spark'), freeX, 0, 1);
    const recycled = field.particles().at(-1);
    if (!recycled) throw new Error('recycled particle missing');
    effects.step({ ...base, dtSec: 0, pantograph: { x: 500, y: -200 } });
    field.step(1 / 60);
    expect(recycled.x).toBeLessThan(freeX);
    expect(recycled.x).toBeGreaterThan(freeX - 10);
  },
);

// Integration: actual seeded climate drives the same contact emitter used by RideScene.
it('integrate-2: winter and snowy transitions increase contact frequency without changing warm wire or caps', () => {
  const seed = 2;
  const positions = Array.from({ length: 12_000 }, (_, i) => i * 512);
  const winter = positions.find((x) => {
    const c = effectiveClimateAt(seed, x);
    return c.season === 'winter' && c.snowfall === 0;
  });
  const snowyEdge = positions.find((x) => {
    const c = effectiveClimateAt(seed, x);
    return c.season !== 'winter' && c.snowfall > 0;
  });
  const warm = positions.find((x) => {
    const c = effectiveClimateAt(seed, x);
    return c.winter === 0 && c.snowfall === 0;
  });
  if (winter === undefined || snowyEdge === undefined || warm === undefined)
    throw new Error('seeded climate witnesses missing');
  const moving = {
    pantograph: { x: 100, y: -128 },
    speedUPerSec: MAX,
    intent: 'THROTTLE' as const,
  };
  const dry = run(moving).counts.get('contact-spark') ?? 0;
  expect(frostyWireAt(seed, warm)).toBe(false);
  expect(
    run({ ...moving, frostyWire: frostyWireAt(seed, warm) }).counts.get(
      'contact-spark',
    ),
  ).toBe(dry);
  for (const x of [winter, snowyEdge]) {
    expect(frostyWireAt(seed, x)).toBe(true);
    for (const rateScale of [1, 0.5]) {
      const capacity = rateScale === 1 ? 240 : 96;
      const baseline = run({ ...moving, rateScale }, 10, capacity);
      const cold = run(
        { ...moving, rateScale, frostyWire: frostyWireAt(seed, x) },
        10,
        capacity,
      );
      expect(cold.counts.get('contact-spark') ?? 0).toBeGreaterThan(
        baseline.counts.get('contact-spark') ?? 0,
      );
      expect(cold.maxLive).toBeLessThanOrEqual(capacity);
    }
  }
});
