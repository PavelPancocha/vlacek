import { expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import { validateChunkScenery } from '../../../src/domain/world/WorldValidation.ts';
import { regionAt } from '../../../src/domain/world/Regions.ts';
import { templateById } from '../../../src/domain/world/WorldPlan.ts';
import { ROAD_CONFLICT_U } from '../../../src/domain/interaction/LevelCrossing.ts';
import {
  projectedBounds,
  propFootU,
  propScale,
  railYUpU,
} from '../../../src/domain/world/SceneryGeometry.ts';
import {
  streamHalfWidthU,
  streamBendU,
} from '../../../src/domain/world/StreamGeometry.ts';
import { hash32 } from '../../../src/domain/world/Hash.ts';

it('CR03: moving a supporting road without changing its ID invalidates its wheel/contact trajectory', () => {
  const sc = chunkScenery(1, 61, catalog);
  expect(sc.props.some((p) => p.work === 'forwarder')).toBe(true);
  sc.roads = sc.roads.map((r) =>
    r.layer === 'near'
      ? { ...r, points: r.points.map((p) => ({ ...p, yU: p.yU + 100 })) }
      : r,
  );
  expect(
    validateChunkScenery(1, sc, catalog).some((e) =>
      e.includes('work-support'),
    ),
  ).toBe(true);
});
it('FO02: dense core has overlapping grouped layers at the corridor and a connected low edge', () => {
  for (const k of [64, 65]) {
    const sc = chunkScenery(1, k, catalog);
    expect(sc.locality).toBe('farm-forest-dense');
    const groups = sc.props.filter((p) =>
      p.kind.startsWith('backdrop.forest-dense-'),
    );
    expect(new Set(groups.map((p) => p.depth)).size).toBeGreaterThanOrEqual(2);
    expect(groups.some((p) => p.depth <= 0.2)).toBe(true);
    const edge = sc.props.filter((p) => p.kind.startsWith('near.forest-edge-'));
    expect(edge.length).toBeGreaterThanOrEqual(3);
    expect(
      sc.props.filter((p) => p.kind.startsWith('tree.')).length,
    ).toBeGreaterThanOrEqual(12);
  }
});
it('CR01: crop groups form coherent repeated rows on their field, not independently random depths', () => {
  const sc = chunkScenery(1, 5, catalog);
  const rows = sc.props.filter(
    (p) => p.layer === 'near' && p.kind.startsWith('near.crop-rows'),
  );
  expect(rows.length).toBeGreaterThanOrEqual(8);
  expect(new Set(rows.map((p) => p.depth)).size).toBe(2);
});
it.each(Array.from({ length: 12 }, (_, seed) => seed))(
  'FO07: both bank anchors lie on dry banks of the actual meandering stream, seed %i',
  (seed) => {
    for (let k = 0; k < 160; k++) {
      const sc = chunkScenery(seed, k, catalog),
        p = sc.props.find((p) => p.kind === 'back.footbridge');
      if (!p || !sc.bridge) continue;
      const r = -p.depth * 220,
        amplitude =
          14 * Math.min(1, Math.max(0, Math.abs(r) - ROAD_CONFLICT_U) / 90);
      const bend =
        amplitude * Math.sin(r / 52 + (hash32('stream', k) % 628) / 100);
      expect(p.xU - sc.bridge.localXU).toBeCloseTo(bend, 5);
      const part = catalog[p.kind];
      if (!part?.bankAnchorsU) throw new Error('missing authored bank anchors');
      const foot = propFootU(
        p,
        k * 1024 + p.xU,
        railYUpU(seed, k * 1024 + p.xU),
        0,
      );
      for (const anchor of part.bankAnchorsU) {
        const y = foot.yU + anchor.yU * propScale(p),
          at = y + railYUpU(seed, k * 1024 + sc.bridge.localXU);
        expect(
          Math.abs(
            foot.xU +
              anchor.xU * propScale(p) -
              (k * 1024 + sc.bridge.localXU + streamBendU(k, at)),
          ),
        ).toBeGreaterThan(streamHalfWidthU(at) + 3);
      }
    }
  },
);
it.each([0, 1, 2, 3, 10, 25, 63, 4242])(
  'CR01/02/04, FO01/02: actual composed regions keep work, variety, quiet and a 2048u dense core, seed %i',
  (seed) => {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU)) {
      if (!['forest', 'countryside'].includes(r.landscape)) continue;
      const chunks = Array.from(
        { length: (r.toXU - r.fromXU) / 1024 },
        (_, n) => chunkScenery(seed, r.fromXU / 1024 + n, catalog),
      );
      const ids = new Set(chunks.map((sc) => sc.locality));
      for (const sc of chunks.filter(
        (c) => c.locality === 'farm-forest-dense',
      )) {
        expect(
          sc.props.filter((p) => p.kind.startsWith('tree.')).length,
        ).toBeGreaterThanOrEqual(12);
        expect(
          new Set(
            sc.props
              .filter((p) => p.kind.startsWith('backdrop.forest-dense-'))
              .map((p) => p.depth),
          ).size,
        ).toBeGreaterThanOrEqual(2);
        expect(
          sc.props.filter((p) => p.kind.startsWith('near.forest-edge-')).length,
        ).toBeGreaterThanOrEqual(3);
      }
      expect(
        chunks.some((sc) => templateById(sc.locality).calm),
        `${seed}/${r.id} quiet`,
      ).toBe(true);
      if (r.landscape === 'countryside') {
        expect(
          chunks.some(
            (sc) =>
              sc.chunkIndex * 1024 - r.fromXU < 12288 &&
              sc.props.some(
                (p) => p.kind === 'back.tractor-work' && p.layer === 'near',
              ),
          ),
          `${seed}/${r.id} tractor`,
        ).toBe(true);
        expect(
          chunks.some((sc) =>
            sc.props.some(
              (p) =>
                p.layer === 'near' &&
                p.work ===
                  {
                    spring: 'sow',
                    summer: 'bale',
                    autumn: 'plough',
                    winter: 'snow-clear',
                  }[r.season],
            ),
          ),
        ).toBe(true);
        expect(
          ['orchard', 'farm', 'pasture', 'farm-forest-pasture'].filter((id) =>
            ids.has(id),
          ).length,
        ).toBeGreaterThanOrEqual(2);
      } else {
        expect(
          chunks.some(
            (sc, n) =>
              sc.locality === 'farm-forest-dense' &&
              chunks[n + 1]?.locality === 'farm-forest-dense',
          ),
          `${seed}/${r.id} uninterrupted core`,
        ).toBe(true);
        expect(
          [
            'forest',
            'clearing',
            'lodge',
            'farm-forest-lodge',
            'forest-work',
            'farm-forest-work',
          ].filter((id) => ids.has(id)).length,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  },
);

import { validateFarmForestRegions } from '../../../src/domain/world/WorldValidation.ts';
it('FO01/CR01: a station replacing a composed dense core or a missing tractor is a region failure', () => {
  for (const biome of ['forest', 'countryside']) {
    let r = regionAt(1, 0);
    while (r.landscape !== biome) r = regionAt(1, r.toXU);
    const cases = Array.from(
      { length: (r.toXU - r.fromXU) / 1024 },
      (_, n) => ({
        seed: 1,
        scenery: chunkScenery(1, r.fromXU / 1024 + n, catalog),
      }),
    );
    expect(validateFarmForestRegions(cases)).toEqual([]);
    const changed = cases.map((c) => ({
      seed: c.seed,
      scenery:
        biome === 'forest' && c.scenery.locality === 'farm-forest-dense'
          ? { ...c.scenery, locality: 'station' }
          : {
              ...c.scenery,
              props: c.scenery.props.filter(
                (p) => p.kind !== 'back.tractor-work',
              ),
            },
    }));
    expect(
      validateFarmForestRegions(changed).some((e) =>
        e.includes(biome === 'forest' ? 'dense-core' : 'tractor'),
      ),
    ).toBe(true);
  }
});

// Projected pixels, including both authored 5% side fades, must overlap.
it('FO02: seed 1 dense bands cover the core and repeat continuously across chunks 64/65', () => {
  for (const [layer, depth] of [
    ['back', 0.12],
    ['back', 0.86],
    ['near', 0.28],
  ] as const) {
    const chunks = [64, 65].map((k) =>
      chunkScenery(1, k, catalog).props.filter(
        (p) =>
          (p.kind.startsWith('backdrop.forest-dense-') ||
            p.kind.startsWith('near.forest-edge-')) &&
          p.layer === layer &&
          p.depth === depth,
      ),
    );
    for (const [i, props] of chunks.entries()) {
      const k = 64 + i;
      const spans = props
        .map((p) => {
          const part = catalog[p.kind];
          if (!part) throw new Error('missing band art');
          const unclipped = { ...p };
          delete unclipped.clip;
          const b = projectedBounds(1, k, unclipped, part);
          const fadeU = part.widthU * propScale(p) * 0.05;
          return [b.leftU + fadeU, b.rightU - fadeU] as const;
        })
        .sort((a, b) => a[0] - b[0]);
      for (let x = k * 1024 + 128; x < (k + 1) * 1024 - 128; x += 8)
        expect(
          spans.some(([a, b]) => a <= x && x <= b),
          `depth=${depth}, x=${x}`,
        ).toBe(true);
    }
    const seam = 65 * 1024;
    const crossers = chunks.map((props, i) =>
      props
        .filter((p) => {
          const part = catalog[p.kind];
          if (!part) throw new Error('missing band art');
          const raw = { ...p };
          delete raw.clip;
          const b = projectedBounds(1, 64 + i, raw, part);
          return b.leftU < seam && b.rightU > seam;
        })
        .map((p) => (64 + i) * 1024 + p.xU),
    );
    expect(crossers[0]?.length).toBeGreaterThan(0);
    expect(crossers[0]).toEqual(crossers[1]);
  }
});

it('FO02: real forest exit tapers, while the technical 64/65 seam stays opaque', () => {
  for (const k of [64, 65]) {
    const groups = chunkScenery(1, k, catalog).props.filter((p) =>
      p.kind.startsWith('backdrop.forest-dense-'),
    );
    expect(groups.length).toBeGreaterThan(0);
    for (const p of groups) {
      expect(p.fadeX).toBeDefined();
      if (!p.fadeX) throw new Error('missing forest end taper');
      expect(p.fadeX.toU).toBe(66 * 1024);
      expect(p.fadeX.widthU).toBeGreaterThanOrEqual(128);
      expect(65 * 1024 - p.fadeX.fromU).toBeGreaterThan(p.fadeX.widthU);
      expect(p.fadeX.toU - 65 * 1024).toBeGreaterThan(p.fadeX.widthU);
    }
  }
});

it('FO02: a station replacing the next planned forest chunk is a real tapered end', () => {
  expect(chunkScenery(2, 34, catalog).locality).toBe('station');
  const groups = chunkScenery(2, 33, catalog).props.filter((p) =>
    p.kind.startsWith('backdrop.forest-dense-'),
  );
  expect(groups.length).toBeGreaterThan(0);
  for (const p of groups) expect(p.fadeX?.toU).toBe(34 * 1024);
});
