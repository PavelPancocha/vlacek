import { expect, it } from 'vitest';
import { placementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import { projectedBounds } from '../../../src/domain/world/SceneryGeometry.ts';
it('SCN-FO05/CR03: compound art envelope includes tools, arms and trunk in both facings over the whole patrol', () => {
  const part = {
    widthU: 110,
    heightU: 72,
    pivotU: { x: 55, y: 72 },
    workBoundsU: { leftU: -115, rightU: 115, topU: -155, bottomU: 4 },
  };
  const catalog = placementCatalog({ machine: part });
  const shape = catalog['machine'];
  if (!shape) throw new Error('shape missing');
  for (const flip of [false, true]) {
    const b = projectedBounds(
      1,
      4,
      {
        kind: 'machine',
        layer: 'near',
        xU: 500,
        depth: 0.55,
        scale: 1,
        flip,
        motion: { rangeU: 180 },
      },
      shape,
    );
    expect(b.rightU - b.leftU).toBeGreaterThanOrEqual(230 * 1.275 + 180);
    const still = projectedBounds(
      1,
      4,
      { kind: 'machine', layer: 'near', xU: 500, depth: 0.55, scale: 1, flip },
      shape,
    );
    expect(still.bottomU - still.topU).toBeGreaterThanOrEqual(159 * 1.275);
  }
});
it('SCN-FO05: numerical adapter rejects a finite work envelope that does not even contain its body', () => {
  expect(() =>
    placementCatalog({
      bad: {
        widthU: 110,
        heightU: 72,
        pivotU: { x: 55, y: 72 },
        workBoundsU: { leftU: -10, rightU: 10, topU: -10, bottomU: 0 },
      },
    }),
  ).toThrow('work envelope');
});
it('SCN-CR03: an asymmetric tool envelope covers the mirrored return leg as well as the outgoing patrol', () => {
  const catalog = placementCatalog({
    tractor: {
      widthU: 70,
      heightU: 46,
      pivotU: { x: 35, y: 46 },
      workBoundsU: { leftU: -92, rightU: 74, topU: -46, bottomU: 3 },
    },
  });
  const part = catalog['tractor'];
  if (!part) throw new Error('missing tractor');
  for (const flip of [false, true]) {
    const prop = {
      kind: 'tractor',
      layer: 'near' as const,
      xU: 500,
      depth: 0.37,
      scale: 1,
      flip,
      motion: { rangeU: 260 },
    };
    const b = projectedBounds(1, 5, prop, part);
    expect(b.rightU - b.leftU).toBeGreaterThanOrEqual(184 * 1.185 + 260);
    for (const direction of [false, true])
      for (const offset of [-130, 130]) {
        const end = projectedBounds(
          1,
          5,
          {
            ...prop,
            flip: direction,
            xU: prop.xU + offset,
            motion: { rangeU: 0 },
          },
          part,
        );
        expect(end.leftU).toBeGreaterThanOrEqual(b.leftU);
        expect(end.rightU).toBeLessThanOrEqual(b.rightU);
      }
  }
});
