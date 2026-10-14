import { expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import {
  projectedBounds,
  polygonsHit,
  rectPolygon,
} from '../../../src/domain/world/SceneryGeometry.ts';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';
it.each(Array.from({ length: 50 }, (_, seed) => seed))(
  'SCN-CR01/03: warm countryside near tractor on its field before 12288 u, seed %i',
  (seed) => {
    const r = regionAt(seed, 0),
      near = [];
    for (let k = 0; k < 12; k++)
      near.push(
        ...chunkScenery(seed, k, worldPlacementCatalog).props.filter(
          (p) => p.kind === 'back.tractor-work' && p.layer === 'near',
        ),
      );
    expect(near.length, `${seed}/${r.id}`).toBeGreaterThan(0);
    expect(
      near.every(
        (p) => p.motion !== undefined && (p.dependencies?.length ?? 0) > 0,
      ),
    ).toBe(true);
  },
);
it('SCN-FO03/G07: forest work has near logs and a low edge, on their surface and below the train', () => {
  const seed = 1;
  let r = regionAt(seed, 0);
  while (r.landscape !== 'forest') r = regionAt(seed, r.toXU);
  let logs = 0,
    young = 0;
  for (let k = r.fromXU / 1024; k < r.toXU / 1024; k++) {
    const sc = chunkScenery(seed, k, worldPlacementCatalog);
    for (const p of sc.props.filter((p) => p.layer === 'near')) {
      const part = worldPlacementCatalog[p.kind];
      if (!part) throw new Error('missing art');
      const b = projectedBounds(seed, k, p, part);
      expect(
        sc.reservations
          .filter((r) => r.purpose === 'track')
          .some((r) => polygonsHit(rectPolygon(b), r.polygon)),
        `${k}/${p.id}`,
      ).toBe(false);
      if (p.kind === 'back.logs') {
        logs++;
        expect(p.dependencies?.length).toBeGreaterThan(0);
      }
      if (p.kind === 'near.young-spruce') young++;
    }
    expect(validateChunkScenery(seed, sc, worldPlacementCatalog)).toEqual([]);
  }
  expect(logs).toBeGreaterThan(0);
  expect(young).toBeGreaterThan(0);
});
it('SCN-G06/CR03: validator rejects a tractor whose full patrol leaves its supporting field', () => {
  let sc = chunkScenery(1, 4, worldPlacementCatalog);
  if (
    !sc.props.some((p) => p.kind === 'back.tractor-work' && p.layer === 'near')
  )
    sc = chunkScenery(1, 5, worldPlacementCatalog);
  const index = sc.props.findIndex(
      (p) => p.kind === 'back.tractor-work' && p.layer === 'near',
    ),
    p = sc.props[index];
  if (!p) throw new Error('missing tractor mutation');
  sc.props[index] = { ...p, depth: 0.95 };
  expect(
    validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
      e.includes('surface-envelope'),
    ),
  ).toBe(true);
});
it('SCN-CR06/G06: winter foreground keeps snow and only winter artwork', () => {
  let found: { seed: number; k: number } | undefined;
  for (let seed = 0; seed < 100 && !found; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU))
      if (r.landscape === 'forest' && r.season === 'winter') {
        found = { seed, k: r.fromXU / 1024 + 4 };
        break;
      }
  }
  expect(found).toBeDefined();
  if (!found) return;
  const sc = chunkScenery(found.seed, found.k, worldPlacementCatalog);
  expect(sc.near[0]?.style).toBe('snow');
  expect(
    sc.props.some(
      (p) => p.kind === 'back.combine' || p.kind.includes('crop-rows'),
    ),
  ).toBe(false);
  expect(
    sc.props
      .filter((p) => p.kind.startsWith('near.forest-edge-'))
      .every((p) => p.kind.endsWith('-winter')),
  ).toBe(true);
});
import { sceneAt, templateById } from '../../../src/domain/world/WorldPlan.ts';
it('SCN-G06: warm artwork is not emitted in the winter half of an incoming transition', () => {
  let cases = 0;
  for (let seed = 0; seed < 500; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU)) {
      if (r.season === 'winter' || regionAt(seed, r.toXU).season !== 'winter')
        continue;
      const k = r.toXU / 1024 - 4;
      if (!templateById(sceneAt(seed, k * 1024).templateId).nearSurface)
        continue;
      cases++;
      expect(
        chunkScenery(seed, k, worldPlacementCatalog).props.some(
          (p) =>
            p.kind === 'back.combine' ||
            p.kind.includes('crop-rows') ||
            p.kind === 'near.stubble',
        ),
        `${seed}/${k}`,
      ).toBe(false);
    }
  }
  expect(cases).toBeGreaterThan(0);
});

it.each([4, 5, 60, 61])(
  'SCN-G06: natural surface margins and identical cross-chunk edge at %i',
  (k) => {
    const sc = chunkScenery(1, k, worldPlacementCatalog);
    const surface = sc.reservations.find(
      (r) => r.purpose === 'field' || r.purpose === 'forest-floor',
    );
    expect(surface).toBeDefined();
    if (!surface) throw new Error('surface missing');
    const upper = surface.polygon.slice(0, surface.polygon.length / 2);
    const lower = surface.polygon.slice(surface.polygon.length / 2).reverse();
    const from = sc.scene.fromXU + 64,
      to = sc.scene.toXU - 64;
    for (let i = 0; i < upper.length; i++) {
      const a = upper[i],
        b = lower[i];
      if (!a || !b) throw new Error('surface boundary missing');
      if (a.xU === from || a.xU === to)
        expect(Math.abs(b.yU - a.yU)).toBeLessThan(1e-8);
    }
    if (k % 2 === 0) {
      const next = chunkScenery(
        1,
        k + 1,
        worldPlacementCatalog,
      ).reservations.find((r) => r.ownerId === surface.ownerId);
      expect(next).toBeDefined();
      expect(upper.at(-1)).toEqual(next?.polygon[0]);
    }
  },
);

it('SCN-G06 review2 adjacent supported fields retain a grass headland gap', () => {
  const fields = new Map<string, { fromXU: number; toXU: number }>();
  let tractors = 0;
  for (let k = 0; k < 72; k++) {
    const scene = sceneAt(1, k * 1024);
    if (!templateById(scene.templateId).nearSurface) continue;
    const sc = chunkScenery(1, k, worldPlacementCatalog);
    for (const f of sc.features) if (f.kind === 'field') fields.set(f.id, f);
    tractors += sc.props.filter(
      (p) => p.kind === 'back.tractor-work' && p.layer === 'near',
    ).length;
    expect(validateChunkScenery(1, sc, worldPlacementCatalog)).toEqual([]);
  }
  expect(tractors).toBeGreaterThan(0);
  const ordered = [...fields.values()].sort((a, b) => a.fromXU - b.fromXU);
  let neighbours = 0;
  for (let i = 1; i < ordered.length; i++) {
    const a = ordered[i - 1],
      b = ordered[i];
    if (!a || !b) throw new Error('field missing');
    if (b.fromXU - a.toXU > 128) continue;
    neighbours++;
    // A 12-u grass stroke on either cap still leaves a grass separator.
    expect(b.fromXU - a.toXU).toBeGreaterThanOrEqual(128);
  }
  expect(neighbours).toBeGreaterThan(0);
});
