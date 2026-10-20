import { pointInside } from '../domain/world/SceneryGeometry.ts';
import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import {
  WaterMountainView,
  waterMountainCompound,
} from './WaterMountainView.ts';
import { SeasonalSceneryView } from './SeasonalSceneryView.ts';
import { worldParts } from '../content/worldArt.ts';
import { regionAt, transitionAt } from '../domain/world/Regions.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Vector2: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
    },
  },
}));

const pages = vi.hoisted(() => ({ active: false }));
vi.mock('./frameTexture.ts', () => ({
  frameTexture: (frame: string, fallback: string) =>
    pages.active
      ? `page:${frame.startsWith('fx.') ? frame : frame.startsWith('life.') ? 'life' : frame.startsWith('snow.') ? 'snow' : 'world'}`
      : fallback,
}));
function image(key: string, x = 0) {
  return {
    key,
    x,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    alpha: 1,
    rotation: 0,
    depth: 4,
    frame: { width: 64, height: 12 },
    texture: { key: 'world' },
    add() {
      return this;
    },
    setName() {
      return this;
    },
    setVisible() {
      return this;
    },
    setOrigin() {
      return this;
    },
    setFlipX() {
      return this;
    },
    setScale(x: number, y = x) {
      this.scaleX = x;
      this.scaleY = y;
      return this;
    },
    setAlpha(a: number) {
      this.alpha = a;
      return this;
    },
    setDepth(d: number) {
      this.depth = d;
      return this;
    },
    setRotation(r: number) {
      this.rotation = r;
      return this;
    },
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    },
    // D-030 tags each pooled particle with its world part.
    setData() {
      return this;
    },
    setFrame(key: string) {
      this.key = key;
      return this;
    },
    setTexture(texture: string, key: string) {
      this.texture.key = texture;
      this.key = key;
      return this;
    },
  };
}
function renderer(
  seed: number,
  x: number,
  parts: Readonly<Record<string, ArtPart | undefined>> = worldParts,
) {
  const images: ReturnType<typeof image>[] = [];
  const snowPlanes: { x: number; y: number }[][] = [];
  const scene = {
    add: {
      container: () => image('container'),
      graphics: () => ({
        ...image('roof-surface'),
        fillStyle() {
          return this;
        },
        lineStyle() {
          return this;
        },
        fillPoints(points: { x: number; y: number }[]) {
          snowPlanes.push(points);
          return this;
        },
        strokePoints() {
          return this;
        },
      }),
      image: (x: number, _y: number, texture: string, key: string) => {
        const result = image(key, x);
        result.texture.key = texture;
        images.push(result);
        return result;
      },
    },
  };
  // Platform drawing double records actual renderer outputs, not private call ordering.
  const owner = new SeasonalSceneryView(
    scene as unknown as Phaser.Scene,
    seed,
    x,
    'world',
    1,
    parts,
  );
  const container = { add() {} } as unknown as Phaser.GameObjects.Container;
  const add = (kind: string, x = 0, flip = false, flowing = true) => {
    const base = image(owner.frame(kind, x), x);
    owner.add(
      {
        kind,
        id: kind + x,
        xU: x,
        flip,
        layer: 'back',
        depth: 0.5,
        scale: 1,
        phase: 0,
      } satisfies SceneryProp,
      base as unknown as Phaser.GameObjects.Image,
      container,
      4,
      flowing,
    );
    return base;
  };
  return { owner, images, add, snowPlanes, scene };
}
function witness(season: string, transition = false) {
  for (let seed = 1; seed < 12; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 40; i++) {
      if (r.season === season) {
        if (!transition) return { seed, x: r.fromXU + 3000 };
        for (let x = r.fromXU; x < r.toXU; x += 10) {
          const t = transitionAt(seed, x);
          if (
            t.progress >= 0.49 &&
            t.progress <= 0.51 &&
            t.to.season !== season
          )
            return { seed, x };
        }
      }
      r = regionAt(seed, r.toXU);
    }
  }
  throw new Error('season witness missing');
}
it('roof snow retains readable thickness under the same house transform', () => {
  const { seed, x } = witness('winter');
  const r = renderer(seed, x);
  for (const kind of ['back.house-a', 'back.house-b', 'back.farmhouse'])
    r.add(kind);
  const caps = r.images.filter((i) => i.key === 'snow.roof-64');
  expect(caps.length).toBeGreaterThan(4);
  expect(caps.every((i) => i.scaleY >= 1.5)).toBe(true);
});
it('midpoint trees stay opaque, with one image carrying all seasonal motion', () => {
  const { seed, x } = witness('winter', true);
  const r = renderer(seed, x);
  const base = r.add('tree.oak');
  expect(base.alpha).toBe(1);
  expect(r.images.filter((i) => i.key.startsWith('tree.oak'))).toHaveLength(0);
});
it('visible life wins over an earlier offscreen actor', () => {
  const r = renderer(1, 5000);
  r.add('back.watermill', -1000);
  r.add('back.watermill', 500);
  r.owner.update(0, 1, 5500, 1, { left: 0, right: 1000 });
  r.owner.update(1, 1, 5500, 1, { left: 0, right: 1000 });
  const wheels = r.images.filter((i) => i.key === 'life.watermill-wheel');
  expect(wheels[1]?.rotation).toBeGreaterThan(0.1);
  expect(wheels[0]?.rotation).toBe(0);
});
it('a starved life actor resumes its local animation without an absolute-time jump', () => {
  const r = renderer(1, 5000);
  r.add('back.watermill');
  r.owner.update(0, 1, 5000, 1);
  const wheel = r.images.find((i) => i.key === 'life.watermill-wheel');
  const before = wheel?.rotation ?? 0;
  r.owner.update(10, 1, 5000, 0);
  r.owner.update(10.1, 1, 5000, 1);
  expect((wheel?.rotation ?? 0) - before).toBeLessThanOrEqual(0.071);
});

it('attachments and animation changes resolve their own texture pages', () => {
  pages.active = true;
  try {
    const w = witness('winter');
    const r = renderer(w.seed, w.x);
    r.add('back.house-a');
    r.add('back.dispatcher');
    r.owner.update(2, 1, w.x, 100);
    for (const i of r.images) {
      if (i.key.startsWith('snow.')) expect(i.texture.key).toBe('page:snow');
      if (i.key.startsWith('life.')) expect(i.texture.key).toBe('page:life');
    }
  } finally {
    pages.active = false;
  }
});

it('snow and falling leaves render at readable widths, not just positive pool counts', () => {
  const captured: ReturnType<typeof image>[] = [];
  const scene = {
    add: {
      image: (_x: number, _y: number, texture: string, key: string) => {
        const i = image(key);
        i.texture.key = texture;
        captured.push(i);
        return i;
      },
    },
  };
  const view = new EffectsView(scene as unknown as Phaser.Scene, 7.5);
  view.setAtlas('world', 1);
  const field = new ParticleField(PARTICLE_KINDS, 20, () => 0.5);
  for (const kind of ['snow-near', 'leaf-fall', 'snow'])
    field.emit(kindIndex(kind), 0, 0, 1);
  field.step(0.3);
  view.draw(field, 0);
  expect(
    captured.find((i) => i.key === 'fx.snow-near')?.scaleX,
  ).toBeGreaterThanOrEqual(12 / worldParts['fx.snow-near'].widthU);
  expect(
    captured.find((i) => i.key.startsWith('fx.leaf-'))?.scaleX,
  ).toBeGreaterThanOrEqual(13 / worldParts['fx.leaf-oak-amber'].widthU);
  expect(
    captured.find((i) => i.key === 'fx.snow-kick')?.scaleX,
  ).toBeGreaterThanOrEqual(18 / worldParts['fx.snow-kick'].widthU);
});
import { EffectsView } from './particles/EffectsView.ts';
import { ParticleField } from './particles/ParticleField.ts';
import { PARTICLE_KINDS, kindIndex } from './particles/particleKinds.ts';

it('particle wing frame changes resolve a different page without losing the live particle', () => {
  pages.active = true;
  try {
    const captured: ReturnType<typeof image>[] = [];
    const scene = {
      add: {
        image: (_x: number, _y: number, texture: string, key: string) => {
          const i = image(key);
          i.texture.key = texture;
          captured.push(i);
          return i;
        },
      },
    };
    const view = new EffectsView(scene as unknown as Phaser.Scene, 10);
    view.setAtlas('world', 1);
    const field = new ParticleField(PARTICLE_KINDS, 10, () => 0.5);
    field.emit(kindIndex('dragonfly'), 0, 0, 1);
    view.draw(field, 0);
    const first = captured[0]?.texture.key;
    field.step(0.1);
    view.draw(field, 0);
    expect(captured).toHaveLength(1);
    expect(captured[0]?.texture.key).not.toBe(first);
    expect(field.live).toBe(1);
  } finally {
    pages.active = false;
  }
});

it('leaf litter renders as a readable local ground patch', () => {
  const w = witness('autumn'),
    r = renderer(w.seed, w.x);
  r.add('tree.oak');
  expect(
    r.images.find((i) => i.key === 'near.leaf-litter')?.scaleX,
  ).toBeGreaterThanOrEqual(1);
});
it('mirrored roof snow stays above the roof rather than turning its white cushion underneath', () => {
  const w = witness('winter'),
    r = renderer(w.seed, w.x);
  r.add('back.house-a', 0, true);
  const caps = r.images.filter((i) => i.key === 'snow.roof-64');
  expect(caps.length).toBeGreaterThan(2);
  expect(caps.every((i) => Math.cos(i.rotation) > 0)).toBe(true);
});

it('evergreen renderers use their authored winter snow frames while keeping autumn foliage', () => {
  const w = witness('winter'),
    r = renderer(w.seed, w.x);
  expect(r.owner.frame('tree.pine', 0)).toBe('tree.pine-snow');
  expect(r.owner.frame('tree.spruce', 0)).toBe('tree.spruce-snow');
  const a = witness('autumn');
  expect(renderer(a.seed, a.x).owner.frame('tree.pine', 0)).toBe('tree.pine');
});

import type { ArtPart } from '../content/artManifest.ts';

it('tagged seasonal machine art selects one opaque body, without affecting unsupported suffixes', () => {
  const w = witness('winter');
  const parts = {
    ...worldParts,
    'back.tractor-winter': {
      ...worldParts['back.tractor'],
      atlasGroup: { seasons: ['winter'] as const },
    },
    'back.house-a-winter': worldParts['back.house-a'],
  };
  const r = renderer(w.seed, w.x, parts);
  expect(r.owner.frame('back.tractor', 0)).toBe('back.tractor-winter');
  expect(r.add('back.tractor').alpha).toBe(1);
  expect(r.images.filter((i) => i.key.startsWith('back.tractor'))).toHaveLength(
    0,
  );
  expect(r.owner.frame('back.house-a', 0)).toBe('back.house-a');
});

it('SEA-01: broad roof snow fills the slope while leaving the dormer and chimney open', () => {
  const { seed, x } = witness('winter');
  const r = renderer(seed, x);
  r.add('back.house-c');
  function covered(x: number, y: number) {
    return r.snowPlanes.some((points) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
          b = points[j];
        if (
          a &&
          b &&
          a.y > y !== b.y > y &&
          x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
        )
          inside = !inside;
      }
      return inside;
    });
  }
  // Coordinates relative to the original (60,104) pivot.
  for (const y of [12, 24, 39]) expect(covered(80 - 60, y - 104)).toBe(true);
  expect(covered(60 - 60, 18 - 104)).toBe(false); // dormer window
  expect(covered(31 - 60, 8 - 104)).toBe(false); // chimney
});

it.each([
  ['back.house-gable', 120, 104, [70, 25], [90, 22]],
  ['back.house-hip', 108, 90, [45, 25], [67, 15]],
] as const)(
  'SEA-01 integration: %s uses its own roof snow anchors and leaves the chimney open',
  (kind, width, height, snow, chimney) => {
    const { seed, x } = witness('winter');
    const r = renderer(seed, x);
    r.add(kind);
    const contains = (point: readonly [number, number]) =>
      r.snowPlanes.some((points) =>
        pointInside(
          { xU: point[0] - width / 2, yU: point[1] - height },
          points.map((p) => ({ xU: p.x, yU: p.y })),
        ),
      );
    expect(contains(snow)).toBe(true);
    expect(contains(chimney)).toBe(false);
    if (kind === 'back.house-hip') {
      expect(contains([45, 9.75])).toBe(true);
      expect(contains([45, 8.5])).toBe(true);
      expect(contains([45, 37.5])).toBe(true);
    }
  },
);

import { chunkScenery } from '../domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
it.each([
  { name: 'station', seed: 2, chunk: 489, candidates: [26, 27, 29] },
  { name: 'street', seed: 4, chunk: 994, candidates: [9, 10] },
])(
  'i3: real combined $name composition draws winter shrubs without blossoms',
  ({ seed, chunk, candidates }) => {
    const scenery = chunkScenery(seed, chunk, worldPlacementCatalog);
    const shrubs = scenery.props.filter((p) => p.kind === 'near.bush');
    expect(shrubs.map((p) => Number(p.id.split(':').at(-1)))).toEqual(
      expect.arrayContaining(candidates),
    );
    const r = renderer(seed, chunk * 1024);
    for (const shrub of shrubs) {
      const base = r.add(shrub.kind, shrub.xU, shrub.flip);
      expect(base.key).toBe('near.bush-winter');
    }
  },
);

import { effectiveClimateAt } from '../domain/world/Seasons.ts';
it.each([
  { kind: 'back.house-a', seed: 4, chunk: 992 },
  { kind: 'back.house-b', seed: 2, chunk: 488 },
  { kind: 'back.house-c', seed: 2, chunk: 489 },
  { kind: 'back.lodge', seed: 2, chunk: 543 },
  { kind: 'back.logs', seed: 1, chunk: 1096 },
])(
  'i3 sweep: $kind replaces embedded summer grass in real winter compositions',
  ({ kind, seed, chunk }) => {
    const props = chunkScenery(seed, chunk, worldPlacementCatalog).props.filter(
      (p) =>
        p.kind === kind &&
        effectiveClimateAt(seed, chunk * 1024 + p.xU).winter === 1,
    );
    expect(props.length).toBeGreaterThan(0);
    const r = renderer(seed, chunk * 1024);
    for (const prop of props)
      expect(r.add(prop.kind, prop.xU, prop.flip).key).toBe(`${kind}-winter`);
  },
);

it('i3: all new seasonal frames preserve original dimensions/pivots and autumn shrubs share the resolver', () => {
  const parts: Readonly<Record<string, ArtPart>> = worldParts;
  for (const base of [
    'near.bush',
    'back.house-a',
    'back.house-b',
    'back.house-c',
    'back.lodge',
    'back.logs',
    'backdrop.town-sparse',
    'backdrop.town-dense',
  ]) {
    const original = parts[base],
      winter = parts[`${base}-winter`];
    if (!original || !winter)
      throw new Error(`missing seasonal family ${base}`);
    expect([winter.widthU, winter.heightU, winter.pivotU]).toEqual([
      original.widthU,
      original.heightU,
      original.pivotU,
    ]);
  }
  const autumn = witness('autumn');
  expect(renderer(autumn.seed, autumn.x).owner.frame('near.bush', 0)).toBe(
    'near.bush-autumn',
  );
});

it('i3: house-c snow reaches the lower roof band inside its original eave', () => {
  const w = witness('winter'),
    r = renderer(w.seed, w.x);
  r.add('back.house-c');
  for (const [x, y] of [
    [40, 43.5],
    [100, 43.5],
  ] as const) {
    expect(
      r.snowPlanes.some((poly) =>
        pointInside(
          { xU: x, yU: y },
          poly.map((p) => ({ xU: p.x + 60, yU: p.y + 104 })),
        ),
      ),
    ).toBe(true);
  }
});

it('WM4 the two former mill paths assemble exactly one body and wheel', () => {
  const r = renderer(1, 5000);
  const prop: SceneryProp = {
    kind: 'back.watermill',
    id: 'mill',
    xU: 0,
    layer: 'back',
    depth: 0.5,
    scale: 1,
    phase: 0,
    flip: false,
  };
  if (waterMountainCompound(prop.kind))
    new WaterMountainView(
      r.scene as unknown as Phaser.Scene,
      prop,
      'world',
      1,
      'summer',
      { leftStationYU: 0, rightTowerYU: 0, rightStationYU: 0 },
    );
  const base = r.add('back.watermill');
  expect(r.images.filter((i) => /watermill-wheel$/.test(i.key))).toHaveLength(
    1,
  );
  expect(
    [...r.images, base].filter((i) => /watermill-body$/.test(i.key)),
  ).toHaveLength(1);
});
it.each(['summer', 'winter'] as const)(
  'WM4 canonical mill wheel needs flowing unfrozen water in %s',
  (season) => {
    const { seed, x } = witness(season);
    for (const flowing of [true, false]) {
      const r = renderer(seed, x);
      r.add('back.watermill', 0, false, flowing);
      const wheel = r.images.find((i) => i.key === 'life.watermill-wheel');
      expect(wheel).toBeDefined();
      r.owner.update(0, 1, x, 100);
      const before = wheel?.rotation;
      r.owner.update(0.1, 1, x, 100);
      expect(wheel?.rotation !== before).toBe(flowing && season !== 'winter');
    }
  },
);

it('does not retarget unchanged animation frames, but retargets after an atlas page change', () => {
  pages.active = false;
  const r = renderer(20261009, 0);
  r.add('near.pond');
  r.add('back.dispatcher');
  r.owner.update(1, 0, 1, 100, { left: -100, right: 100 });
  const textures = r.images.map((i) => vi.spyOn(i, 'setTexture'));
  const data = r.images.map((i) => vi.spyOn(i, 'setData'));
  for (let i = 0; i < 60; i++)
    r.owner.update(1, 0, 1, 100, { left: -100, right: 100 });
  expect(textures.reduce((sum, spy) => sum + spy.mock.calls.length, 0)).toBe(0);
  expect(data.reduce((sum, spy) => sum + spy.mock.calls.length, 0)).toBe(0);
  pages.active = true;
  r.owner.update(1, 0, 1, 100, { left: -100, right: 100 });
  expect(
    textures.reduce((sum, spy) => sum + spy.mock.calls.length, 0),
  ).toBeGreaterThan(0);
  pages.active = false;
});
