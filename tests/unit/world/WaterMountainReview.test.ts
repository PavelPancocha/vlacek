import { gameConfig } from '../../../src/config/gameConfig.ts';
import { trainZoom } from '../../../src/render/cameraFraming.ts';
import { waterMountainParts as parts } from '../../../src/content/world-modules/water-mountains.art.ts';
import { expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import {
  propFootU,
  projectedBounds,
  propScale,
  railYUpU,
  waterSectionU,
} from '../../../src/domain/world/SceneryGeometry.ts';
import { validateWorld } from '../../../src/domain/world/WorldValidation.ts';
import { cablewaySupportHeights } from '../../../src/render/waterMountainMotion.ts';

it('WM2-1 seed=1 chunks=290/291: a blocked continuation closes at the accepted river endpoint', () => {
  const a = chunkScenery(1, 290, catalog),
    b = chunkScenery(1, 291, catalog);
  const river = a.water.find((w) => w.flowSpan);
  expect(river).toBeDefined();
  if (!river) throw new Error('missing river witness');
  const next = b.water.find((w) => w.id === river.id);
  const section = waterSectionU(1, 290, river, 1024);
  if (next) {
    expect(section).toEqual(waterSectionU(1, 291, next, 0));
    expect(section.bottomU - section.topU).toBeGreaterThan(0);
  } else {
    expect(river.flowSpan?.toXU).toBeLessThanOrEqual(297984);
    expect(section.bottomU - section.topU).toBeCloseTo(0);
  }
});
it.each(['missing', 'closed', 'mismatch'] as const)(
  'WM2-1 validator rejects %s river continuation',
  (mutation) => {
    const a = chunkScenery(1, 292, catalog),
      b = chunkScenery(1, 293, catalog);
    const left = a.water.find((w) => w.flowSpan),
      right = b.water.find((w) => w.id === left?.id);
    if (!left || !right) throw new Error('missing continuous river witness');
    if (mutation === 'missing') b.water = b.water.filter((w) => w !== right);
    if (mutation === 'closed') {
      left.farDepth = left.nearDepth;
      right.farDepth = right.nearDepth;
    }
    if (mutation === 'mismatch') right.nearDepth += 0.1;
    expect(
      validateWorld(
        [
          { seed: 1, scenery: a },
          { seed: 1, scenery: b },
        ],
        catalog,
      ).some((e) => e.includes('river-seam')),
    ).toBe(true);
  },
);
it('WM2-5 seed=1 chunks=100/101: a scene owns one cableway installation', () => {
  const chunks = [100, 101].map((k) => chunkScenery(1, k, catalog));
  const cableways = chunks.flatMap((sc) =>
    sc.props.filter((p) => p.kind === 'back.cableway-tower'),
  );
  expect(cableways).toHaveLength(1);
  const installations = chunks
    .flatMap((sc) => sc.features)
    .filter((f) => f.kind === 'cableway');
  expect(installations).toHaveLength(1);
  expect(installations[0]?.ownerId).toBe(chunks[0]?.scene.id);
  expect(installations[0]?.dependencies).toEqual([cableways[0]?.id]);
});
it('WM2-5 cableway samples both stations at their own x on a curved grade', () => {
  const railAt = (x: number) => (x * x) / 1000;
  const x = 300,
    scale = 0.8;
  const heights = cablewaySupportHeights(x, scale, railAt);
  expect(heights.leftStationYU).toBeCloseTo(
    (railAt(x) - railAt(x - 35 * scale)) / scale,
  );
  expect(heights.rightTowerYU).toBeCloseTo(
    (railAt(x) - railAt(x + 320 * scale)) / scale,
  );
  expect(heights.rightStationYU).toBeCloseTo(
    (railAt(x) - railAt(x + 365 * scale)) / scale,
  );
});

it('WM2-4 all dune scenes use their own varied Scots pine silhouettes', () => {
  const kinds = new Set<string>();
  for (let k = 356; k < 396; k++) {
    const sc = chunkScenery(1, k, catalog);
    if (sc.region.landscape !== 'dunes') continue;
    expect(
      sc.props.some((p) => p.kind === 'tree.pine'),
      `seed=1 generator=2 scene=${sc.scene.id} chunk=${k}`,
    ).toBe(false);
    for (const p of sc.props)
      if (p.kind.startsWith('tree.sahara-pine-')) kinds.add(p.kind);
  }
  expect([...kinds].sort()).toEqual([
    'tree.sahara-pine-a',
    'tree.sahara-pine-b',
  ]);
});

it('WM3 SCN-FH05 cabin is at least 14 by 12 CSS pixels at 1140x512', () => {
  const cable = chunkScenery(1, 112, catalog).props.find(
    (p) => p.kind === 'back.cableway-tower',
  );
  const cabin = catalog['back.cableway-cabin'];
  if (!cable || !cabin) throw new Error('missing cableway witness');
  const pxPerU =
    trainZoom(
      {
        widthPx: 1140,
        heightPx: 512,
        reservedTopPx: 80,
        reservedBottomPx: 110,
      },
      2000,
      { ...gameConfig.camera, vehicleHeightU: 150 },
    ) * propScale(cable);
  expect(cabin.widthU * pxPerU).toBeGreaterThanOrEqual(14);
  expect(cabin.heightU * pxPerU).toBeGreaterThanOrEqual(12);
});

it.each([100, 112])(
  'WM3 SCN-FH05 cabin sweep remains inside the reserved bounds, seed=1 chunk=%i',
  (k) => {
    const p = chunkScenery(1, k, catalog).props.find(
      (p) => p.kind === 'back.cableway-tower',
    );
    const tower = parts['back.cableway-tower'],
      cabin = parts['back.cableway-cabin'];
    const bounds = tower?.workBoundsU,
      anchor = tower?.anchorsU?.['cable'];
    if (!p || !bounds || !cabin || !tower || !anchor)
      throw new Error('missing cableway bounds');
    const heights = cablewaySupportHeights(k * 1024 + p.xU, propScale(p), (x) =>
      railYUpU(1, x),
    );
    for (const r of [0, 0.5, 1]) {
      const x = 320 * r,
        y = anchor.y - tower.pivotU.y + heights.rightTowerYU * r;
      expect(x - cabin.pivotU.x).toBeGreaterThanOrEqual(bounds.leftU);
      expect(x + cabin.widthU - cabin.pivotU.x).toBeLessThanOrEqual(
        bounds.rightU,
      );
      expect(y - cabin.pivotU.y).toBeGreaterThanOrEqual(bounds.topU);
      expect(y + cabin.heightU - cabin.pivotU.y).toBeLessThanOrEqual(
        bounds.bottomU,
      );
    }
  },
);

it.each([100, 112])(
  'WM3 SCN-FH05 tree silhouettes clear the cabin sweep, seed=1 chunk=%i',
  (k) => {
    const sc = chunkScenery(1, k, catalog);
    const cable = sc.props.find((p) => p.kind === 'back.cableway-tower');
    if (!cable) throw new Error('missing cableway witness');
    const scale = propScale(cable),
      x = k * 1024 + cable.xU;
    const foot = propFootU(cable, x, railYUpU(1, x), 0);
    const heights = cablewaySupportHeights(x, scale, (x) => railYUpU(1, x));
    const left = x - 28 * scale,
      right = x + (320 + 28) * scale;
    for (const p of sc.props.filter((p) => p.kind.startsWith('tree.'))) {
      const part = catalog[p.kind];
      if (!part) throw new Error('missing tree bounds');
      const b = projectedBounds(1, k, p, part);
      // Only the span that can horizontally overlap this tree contributes to its sweep.
      const from = Math.max(
        0,
        Math.min(1, (b.leftU - x - 28 * scale) / (320 * scale)),
      );
      const to = Math.max(
        0,
        Math.min(1, (b.rightU - x + 28 * scale) / (320 * scale)),
      );
      const top =
        foot.yU +
        (-77 +
          Math.min(from * heights.rightTowerYU, to * heights.rightTowerYU)) *
          scale;
      const bottom =
        foot.yU +
        (-29 +
          Math.max(from * heights.rightTowerYU, to * heights.rightTowerYU)) *
          scale;
      expect(
        b.rightU <= left ||
          b.leftU >= right ||
          b.bottomU <= top ||
          b.topU >= bottom,
        p.id,
      ).toBe(true);
    }
  },
);
