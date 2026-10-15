import { roadStretchesInChunk } from '../src/domain/world/RoadStretches.ts';
import { sceneAt, templateById } from '../src/domain/world/WorldPlan.ts';
import assert from 'node:assert/strict';
import { worldPlacementCatalog } from '../src/content/worldPlacementCatalog.ts';
import {
  chunkScenery,
  stationFlat,
  stationSlot,
} from '../src/domain/world/Scenery.ts';
import { crossingSite } from '../src/domain/world/Crossings.ts';
import { chunkObjects } from '../src/domain/world/ChunkObjects.ts';
import {
  regionAt,
  REGION_ROUTES,
  REGION_NEIGHBOURS,
} from '../src/domain/world/Regions.ts';
import {
  validateChunkScenery,
  validateFarmForestRegions,
  validateFootpathJoin,
  validateInfrastructureSurfaces,
  validateWorld,
  prominentMotifs,
  validateMotifSpacing,
  type ProminentMotif,
  validateOwnership,
  worldMotifCoverage,
  type WorldOwnership,
} from '../src/domain/world/WorldValidation.ts';

const seeds = [
  0, 1, 2, 3, 4, 7, 10, 14, 18, 25, 63, 83, 110, 123, 157, 226, 234, 238, 247,
  252, 338, 1226, 4242, 0xffffffff,
];
let cases = 0;
const errors: string[] = [];
const coverage: Record<string, number> = {};
for (const route of REGION_ROUTES)
  for (const [i, landscape] of route.entries()) {
    const next = route[(i + 1) % route.length];
    assert(
      next && REGION_NEIGHBOURS[landscape].includes(next),
      `illegal route adjacency ${landscape}/${next}`,
    );
  }
for (const seed of seeds) {
  const coverageCases: {
    seed: number;
    scenery: ReturnType<typeof chunkScenery>;
  }[] = [];
  const chunks = new Set([
    -65,
    -64,
    -9,
    -8,
    -1,
    ...Array.from({ length: 64 }, (_, i) => i),
    1000000,
  ]);
  let r = regionAt(seed, 0);
  for (let i = 0; i < 12; i++) {
    chunks.add(Math.floor(r.fromXU / 1024));
    chunks.add(Math.floor(r.toXU / 1024) - 1);
    chunks.add(Math.floor(r.toXU / 1024));
    for (let b = r.fromXU / 8192; b < r.toXU / 8192; b++) {
      const slot = stationSlot(seed, b);
      if (slot !== undefined) chunks.add(b * 8 + slot);
    }
    for (
      let x = r.fromXU;
      x < r.toXU;
      x += ['forest', 'countryside'].includes(r.landscape) ? 1024 : 2048
    )
      chunks.add(Math.floor(x / 1024));
    r = regionAt(seed, r.toXU);
  }
  const ascending = [...chunks].sort((a, b) => a - b);
  const fingerprints = new Map<number, string>();
  const motifs: ProminentMotif[] = [];
  const ownership: WorldOwnership[] = [];
  for (const k of ascending) {
    const scenery = chunkScenery(seed, k, worldPlacementCatalog);
    coverageCases.push({ seed, scenery });
    motifs.push(...prominentMotifs(scenery));
    ownership.push({
      chunkIndex: k,
      propIds: scenery.props.map((p) => p.id),
      features: scenery.features,
    });
    errors.push(...validateChunkScenery(seed, scenery, worldPlacementCatalog));
    cases++;
    fingerprints.set(k, JSON.stringify(scenery));
  }
  errors.push(...validateFarmForestRegions(coverageCases));
  for (const [motif, count] of Object.entries(
    worldMotifCoverage(coverageCases, worldPlacementCatalog),
  ))
    coverage[motif] = (coverage[motif] ?? 0) + count;
  errors.push(
    ...validateOwnership(ownership).map((e) => `seed=${seed} generator=2 ${e}`),
  );
  errors.push(
    ...validateMotifSpacing(motifs).map((e) => `seed=${seed} generator=2 ${e}`),
  );
  for (const query of [
    [...ascending].reverse(),
    [...ascending].sort((a, b) => ((a * 7919) % 97) - ((b * 7919) % 97)),
    ascending,
  ])
    for (const k of query) {
      assert.equal(
        JSON.stringify(chunkScenery(seed, k, worldPlacementCatalog)),
        fingerprints.get(k),
        `query-order seed=${seed} generator=2 chunk=${k}`,
      );
    }
}
for (const [motif, count] of Object.entries(coverage))
  assert(count > 0, `zero world motif coverage: ${motif}`);
console.log('Positive world motifs:', JSON.stringify(coverage));
// Every road/water scene in 100 complete itineraries; no expensive decorative comparisons.
let surfaceCases = 0,
  footpathJoins = 0;
for (let seed = 0; seed < 100; seed++) {
  let previous: ReturnType<typeof chunkScenery> | undefined;
  for (let k = 0; k < 480; k++) {
    const t = templateById(sceneAt(seed, k * 1024).templateId);
    if (
      roadStretchesInChunk(seed, k).length === 0 &&
      !t.water &&
      !t.id.startsWith('settlements-') &&
      t.biome !== 'coast' &&
      !t.rules.some((r) => r.kinds.includes('back.car'))
    ) {
      previous = undefined;
      continue;
    }
    const scenery = chunkScenery(seed, k, worldPlacementCatalog);
    errors.push(...validateInfrastructureSurfaces(seed, scenery));
    // Neighbouring settlement chunks meet at the same footpath points.
    if (
      previous?.chunkIndex === k - 1 &&
      previous.scene.templateId.startsWith('settlements-') &&
      t.id.startsWith('settlements-')
    ) {
      errors.push(...validateFootpathJoin(seed, previous, scenery));
      footpathJoins++;
    }
    previous = scenery;
    surfaceCases++;
  }
}
assert(surfaceCases > 0, 'infrastructure surface sweep exercised zero cases');
assert(footpathJoins > 0, 'footpath join sweep exercised zero cases');
console.log(
  `Road/water sweep: 100 complete seed cycles, ${surfaceCases} cases, ${footpathJoins} footpath joins`,
);
assert(cases > 0, 'world validator exercised zero cases');
assert(
  validateWorld([], worldPlacementCatalog).length > 0,
  'empty matrix was accepted',
);
for (const mutation of ['collision', 'dependency', 'duplicate']) {
  const sc = chunkScenery(83, 19, worldPlacementCatalog),
    p = sc.props[0];
  assert(p && sc.crossing, 'empty self-check');
  if (mutation === 'collision')
    sc.props[0] = {
      id: p.id,
      phase: 0,
      flip: false,
      scale: 1,
      layer: 'back',
      depth: 0,
      kind: 'back.house-a',
      xU: sc.crossing.localXU,
    };
  if (mutation === 'dependency')
    sc.props[0] = { ...p, dependencies: ['missing-support'] };
  if (mutation === 'duplicate') sc.props.push({ ...p });
  assert(
    validateChunkScenery(83, sc, worldPlacementCatalog).some((e) =>
      e.includes(mutation),
    ),
    `validator missed ${mutation}`,
  );
}
let firstBlocks = 0;
for (let seed = 0; seed < 20000; seed++) {
  assert.equal(stationSlot(seed, 0), 1, `station-slot seed=${seed}`);
  const flat = stationFlat(seed, 1);
  assert(flat && flat[1] - flat[0] >= 448, `station-flat seed=${seed}`);
  const crossing = crossingSite(seed, 3);
  assert(crossing, `crossing seed=${seed}`);
  const animal = chunkObjects(seed, 3)[0];
  assert(
    animal && Math.abs(animal.localXU - crossing.localXU) >= 120,
    `animal seed=${seed}`,
  );
  firstBlocks++;
}
if (errors.length) {
  console.error(errors.slice(0, 30).join('\n'));
  throw new Error(`${errors.length} world violations across ${cases} cases`);
}
console.log(
  `World v2: ${cases} cases, ascending/descending/shuffled/repeated fingerprints, 3 mutation proofs; R3 ${firstBlocks} first blocks passed.`,
);

// SEA-01/03 and SCN-FH06: bounded witnesses, not a vacuous conditional check.
const seasonalCoverage = new Set<string>();
let deciduousAutumn = 0,
  sleds = 0;
for (let seed = 1; seed <= 20; seed++) {
  let region = regionAt(seed, 0);
  for (let index = 0; index < 36; index++) {
    seasonalCoverage.add(`${region.landscape}/${region.season}`);
    for (let x = region.fromXU + 2048; x < region.toXU - 8192; x += 4096) {
      const sc = chunkScenery(seed, x / 1024, worldPlacementCatalog);
      if (region.season === 'autumn')
        deciduousAutumn += sc.props.filter((p) =>
          [
            'tree.oak',
            'tree.birch',
            'tree.linden',
            'tree.apple',
            'tree.plum',
            'tree.willow',
          ].includes(p.kind),
        ).length;
      for (const prop of sc.props.filter((p) => p.kind === 'back.sled-child')) {
        assert.equal(region.season, 'winter');
        assert.equal(prop.layer, 'back');
        assert.equal(prop.motion?.rangeU, 48);
        sleds++;
      }
    }
    region = regionAt(seed, region.toXU);
  }
}
for (const landscape of ['forest', 'town', 'countryside'])
  for (const season of ['spring', 'summer', 'autumn', 'winter'])
    assert(
      seasonalCoverage.has(`${landscape}/${season}`),
      `SEA-01 missing ${landscape}/${season}`,
    );
assert(deciduousAutumn > 0, 'SEA-03 missing deciduous leaf sources');
assert(sleds > 0, 'SCN-FH06 missing winter sleds');
console.log(
  `Seasonal coverage: 12 combinations, ${deciduousAutumn} deciduous autumn sources, ${sleds} winter sleds`,
);
