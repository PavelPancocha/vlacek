import { expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';

it.each(['spring', 'summer', 'autumn', 'winter'])(
  'SCN-CR01/02/03/06: %s machinery and crops on both sides, supported full patrol',
  (season) => {
    const found = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      let r = regionAt(seed, 0);
      for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU)) {
        if (r.landscape !== 'countryside' || r.season !== season) continue;
        for (const k of [r.fromXU / 1024 + 4, r.fromXU / 1024 + 5]) {
          const sc = chunkScenery(seed, k, worldPlacementCatalog);
          for (const p of sc.props) found.add(`${p.kind}/${p.layer}`);
          expect(validateChunkScenery(seed, sc, worldPlacementCatalog)).toEqual(
            [],
          );
        }
      }
    }
    expect(found.has('back.tractor-work/near'), season).toBe(true);
    if (season === 'summer') expect(found.has('back.combine/back')).toBe(true);
    else expect(found.has('back.tractor-work/back')).toBe(true);
    if (season !== 'winter') {
      expect(found.has('back.farmer-work/near')).toBe(true);
      expect(
        found.has(
          `${season === 'autumn' ? 'near.stubble' : `near.crop-rows-${season}`}/near`,
        ),
      ).toBe(true);
    }
  },
);
it('SCN-FO01/02/03/04/05/06/07: dense edge, both forest machines and supported forest life have nonzero witnesses', () => {
  const found = new Set<string>();
  for (let seed = 0; seed < 12; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU)) {
      if (r.landscape !== 'forest') continue;
      for (const k of [
        r.fromXU / 1024 + 4,
        r.fromXU / 1024 + 5,
        r.fromXU / 1024 + 8,
        r.fromXU / 1024 + 10,
      ]) {
        const sc = chunkScenery(seed, k, worldPlacementCatalog);
        for (const p of sc.props) found.add(p.kind);
        expect(validateChunkScenery(seed, sc, worldPlacementCatalog)).toEqual(
          [],
        );
      }
    }
  }
  for (const kind of [
    'back.harvester',
    'back.forwarder',
    'back.log-truck',
    'back.feeding-rack',
    'back.footbridge',
    'animal.woodpecker',
    'animal.owl',
    ...['spring', 'summer', 'autumn', 'winter'].map(
      (s) => `near.forest-edge-${s}`,
    ),
  ])
    expect(found.has(kind), kind).toBe(true);
});
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';
it('SCN-CR04/FO01: every bounded region has a dense core/work and two other local motifs', () => {
  for (let seed = 0; seed < 500; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU)) {
      if (r.landscape !== 'countryside' && r.landscape !== 'forest') continue;
      const ids = new Set<string>();
      for (let x = r.fromXU; x < r.toXU; x += 2048)
        ids.add(sceneAt(seed, x).templateId);
      if (r.landscape === 'countryside')
        expect(
          ['pasture', 'farm', 'orchard'].filter((id) => ids.has(id)).length,
          `${seed}/${r.id}`,
        ).toBeGreaterThanOrEqual(2);
      else {
        expect(ids.has('farm-forest-dense')).toBe(true);
        expect(ids.has('forest-work')).toBe(true);
        expect(
          ['forest', 'clearing', 'lodge', 'farm-forest-lodge'].filter((id) =>
            ids.has(id),
          ).length,
          `${seed}/${r.id}`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  }
});
it('SCN-FO05/06/07: validator rejects a machine without its path, bird without its tree, bridge without its stream', () => {
  for (const kind of [
    'back.harvester',
    'animal.woodpecker',
    'back.footbridge',
  ]) {
    const k = kind === 'back.footbridge' ? 60 : 61;
    const sc = chunkScenery(1, k, worldPlacementCatalog);
    const index = sc.props.findIndex((p) => p.kind === kind);
    const p = sc.props[index];
    if (!p) throw new Error(`missing ${kind}`);
    sc.props[index] = { ...p, dependencies: [] };
    expect(
      validateChunkScenery(1, sc, worldPlacementCatalog).some((e) =>
        e.includes('dependency'),
      ),
      kind,
    ).toBe(true);
  }
});
it.each(Array.from({ length: 20 }, (_, seed) => seed))(
  'SCN-FO04: mandatory work pocket contains both machines and truck in every itinerary, seed %i',
  (seed) => {
    let r = regionAt(seed, 0);
    while (r.landscape !== 'forest') r = regionAt(seed, r.toXU);
    const props = chunkScenery(
      seed,
      r.fromXU / 1024 + 5,
      worldPlacementCatalog,
    ).props;
    for (const kind of ['back.harvester', 'back.forwarder', 'back.log-truck'])
      expect(
        props.some((p) => p.kind === kind),
        `${seed}/${r.id}/${kind}`,
      ).toBe(true);
  },
);
