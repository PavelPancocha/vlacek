import { expect, it } from 'vitest';
import {
  SeasonalEffects,
  type SeasonalEffectsInput,
} from '../../../../src/render/particles/SeasonalEffects.ts';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import {
  PARTICLE_KINDS,
  kindName,
  kindIndex,
} from '../../../../src/render/particles/particleKinds.ts';
import { regionAt } from '../../../../src/domain/world/Regions.ts';
function winter() {
  for (let seed = 1; seed < 30; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 30; i++) {
      if (r.weather === 'snow') return { seed, x: r.fromXU + 3000 };
      r = regionAt(seed, r.toXU);
    }
  }
  throw new Error('missing winter witness');
}
const { seed, x } = winter();
const input: SeasonalEffectsInput = {
  seed,
  dtSec: 1 / 60,
  timeSec: 0,
  view: { left: x, top: -350, width: 1400, height: 700 },
  sources: [],
  frontXU: x + 600,
  speedUPerSec: 0,
  rateScale: 1,
  canEmit: () => true,
};
it('SEA-04: ambient snow has three depths and continues while stopped', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new SeasonalEffects(field, () => 0.5);
  for (let i = 0; i < 120; i++) {
    effects.step({ ...input, timeSec: i / 60 });
    field.step(1 / 60);
  }
  const kinds = new Set(field.particles().map((p) => kindName(p.kind)));
  expect(kinds.has('snow-far')).toBe(true);
  expect(kinds.has('snow-mid')).toBe(true);
  expect(kinds.has('snow-near')).toBe(true);
  expect(new Set(field.particles().map((p) => p.depth)).size).toBe(3);
  expect(field.live).toBeLessThanOrEqual(240);
});
it('SEA-07: sources are bounded, retained only in view, pause cannot emit', () => {
  const field = new ParticleField(PARTICLE_KINDS, 96, () => 0.5);
  const effects = new SeasonalEffects(field, () => 0.5);
  const sources = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    kind: 'deciduous' as const,
    x: x + i,
    y: -100,
    depth: 4,
    radiusU: 20,
  }));
  effects.step({ ...input, sources, rateScale: 0.5 });
  expect(effects.sourceCount).toBeGreaterThan(0);
  expect(effects.sourceCount).toBeLessThanOrEqual(12);
  effects.step({ ...input, dtSec: 0, sources });
  expect(field.live).toBe(0);
  effects.step({ ...input, sources: [] });
  expect(effects.sourceCount).toBe(0);
});

it('SEA-03/06: leaves need local deciduous sources; winter never emits petals or dragonflies', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new SeasonalEffects(field, () => 0.5);
  const sources = [
    {
      id: 'tree',
      kind: 'deciduous' as const,
      x: x + 400,
      y: -100,
      depth: 4,
      radiusU: 20,
    },
    {
      id: 'pond',
      kind: 'freshwater' as const,
      x: x + 600,
      y: -50,
      depth: 4,
      radiusU: 8,
    },
  ];
  for (let i = 0; i < 1800; i++) {
    effects.step({ ...input, sources, timeSec: i / 60 });
    field.step(1 / 60);
  }
  expect(
    field
      .particles()
      .some((p) =>
        ['petal', 'leaf-fall', 'dragonfly'].includes(kindName(p.kind) ?? ''),
      ),
  ).toBe(false);
  expect(field.live).toBeLessThanOrEqual(240);
  const before = field.live;
  effects.step({
    ...input,
    dtSec: 30,
    timeSec: 60,
    sources: [],
    canEmit: () => false,
  });
  expect(field.live).toBe(before);
  expect(effects.sourceCount).toBe(0);
});

it('SEA-01: allowed summer rain has a quiet local shower, never winter flakes', () => {
  let witness: { seed: number; x: number } | undefined;
  for (let seed = 1; seed < 20 && !witness; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 36; i++) {
      if (r.weather === 'rain') {
        witness = { seed, x: r.fromXU + 3000 };
        break;
      }
      r = regionAt(seed, r.toXU);
    }
  }
  if (!witness) throw new Error('missing rain');
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new SeasonalEffects(field, () => 0.5);
  for (let i = 0; i < 180; i++) {
    effects.step({
      ...input,
      seed: witness.seed,
      view: { ...input.view, left: witness.x },
      timeSec: i / 60,
    });
    field.step(1 / 60);
  }
  expect(field.particles().some((p) => kindName(p.kind) === 'rain')).toBe(true);
  expect(
    field.particles().some((p) => kindName(p.kind)?.startsWith('snow-')),
  ).toBe(false);
});

it('SEA-06: summer freshwater life emits a dragonfly and its entire path stays above the same water patch', () => {
  const field = new ParticleField(PARTICLE_KINDS, 240, () => 0.5);
  const effects = new SeasonalEffects(field, () => 0.5);
  const source = {
    id: 'pond',
    kind: 'freshwater' as const,
    x: 5000,
    y: -50,
    depth: 4,
    radiusU: 8,
  };
  let seen = 0;
  for (let i = 0; i < 2400; i++) {
    effects.step({
      ...input,
      seed: 1,
      view: { ...input.view, left: 4800 },
      sources: [source],
      timeSec: i / 60,
    });
    field.step(1 / 60);
    for (const particle of field.particles())
      if (kindName(particle.kind) === 'dragonfly') {
        const p = field.positionOf(particle);
        seen++;
        expect(p.x).toBeGreaterThanOrEqual(4992);
        expect(p.x).toBeLessThanOrEqual(5008);
        expect(p.y).toBeGreaterThanOrEqual(-82);
        expect(p.y).toBeLessThanOrEqual(-54);
      }
  }
  expect(seen).toBeGreaterThan(0);
});

it('weather births and retained sprites remain inside their depth landing area', () => {
  const field = new ParticleField(PARTICLE_KINDS, 96, () => 0.9);
  const effects = new SeasonalEffects(field, () => 0.9);
  for (let i = 0; i < 900; i++) {
    effects.step({
      ...input,
      rateScale: 0.5,
      timeSec: i / 60,
      weatherBottomAt: (_x, depth) => (depth > 7 ? 120 : -100),
    });
    field.step(1 / 60);
    for (const p of field.particles())
      expect(p.y).toBeLessThanOrEqual((p.depth ?? 0) > 7 ? 125 : -95);
  }
  expect(field.live).toBeGreaterThan(0);
});

it('a flake drifting into a climate with zero snow releases its invisible pool slot', () => {
  const field = new ParticleField(PARTICLE_KINDS, 96, () => 0.5),
    effects = new SeasonalEffects(field, () => 0.5);
  field.emit(kindIndex('snow-far'), 5000, -100, 1);
  effects.step({
    ...input,
    seed: 1,
    view: { ...input.view, left: 4800 },
    timeSec: 1,
  });
  expect(field.live).toBe(0);
});

it('SEA-04: train particles cannot consume the low-profile near snowfall allowance', () => {
  const field = new ParticleField(PARTICLE_KINDS, 96, () => 0.5);
  const effects = new SeasonalEffects(field, () => 0.5);
  // Model 45 live locomotive/spray particles, renewed by the moving train.
  field.emit(kindIndex('smoke'), x + 700, -100, 45);
  for (let tick = 0; tick < 600; tick++) {
    for (const p of field.particles())
      if (p.kind === kindIndex('smoke')) p.age = 0.3;
    effects.step({ ...input, rateScale: 0.5, timeSec: tick / 60 });
    field.step(1 / 60);
  }
  expect(
    field.particles().filter((p) => p.kind === kindIndex('snow-near')).length,
  ).toBeGreaterThanOrEqual(18);
  expect(field.live).toBeLessThanOrEqual(96);
});
