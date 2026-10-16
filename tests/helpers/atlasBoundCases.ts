import { expect, it } from 'vitest';
import { worldParts } from '../../src/content/worldArt.ts';
import { worldAtlasWindowKeys } from '../../src/content/worldAtlasGroups.ts';
import {
  ATLAS_BOUND,
  BUDGET_BYTES,
  integratedCatalogue,
  lifetimeModel,
  profileScales,
  windowPairs,
  windowResidency,
} from './atlasResidency.ts';

/**
 * D-030 memory bound over the integrated catalogue: one case per profile,
 * current landscape/season and raster pair. Files split the world raster
 * scales so the exhaustive packing runs on several Vitest workers; both
 * profiles share the world packing of a scale.
 */
export function atlasBoundCases(worldScales: readonly number[]): void {
  const parts = integratedCatalogue(worldParts);
  const pairs = windowPairs();
  // One case per current landscape/season and incoming landscape keeps each under a second.
  const groups = [
    ...new Map(
      pairs.map((pair) => {
        const [first, next] = pair.regions;
        if (!first || !next) throw new Error(`incomplete pair ${pair.label}`);
        return [
          `${first.landscape}/${first.season}->${next.landscape}`,
          { first, next: next.landscape },
        ];
      }),
    ).entries(),
  ];
  const cases = (['low', 'standard'] as const).flatMap((quality) =>
    profileScales(quality)
      .filter((scale) => worldScales.includes(scale.world))
      .flatMap((scale) =>
        groups.map(([label, group]) => ({ quality, label, group, ...scale })),
      ),
  );
  if (!cases.length)
    throw new Error(`no raster pair at ${worldScales.join(', ')} px/u`);
  it.each(cases)(
    '$quality: $label windows at world $world / backdrop $backdrop px/u stay within D-030',
    ({ quality, group, world: worldScale, backdrop: backdropScale }) => {
      for (const pair of pairs.filter(
        (p) =>
          p.regions[0]?.landscape === group.first.landscape &&
          p.regions[0].season === group.first.season &&
          p.regions[1]?.landscape === group.next,
      )) {
        const keys = worldAtlasWindowKeys(parts, pair.regions);
        const groups = [
          windowResidency(parts, keys, false, worldScale),
          windowResidency(parts, keys, true, backdropScale),
        ] as const;
        for (const group of groups) {
          expect(group.pages.length, pair.label).toBeLessThanOrEqual(2);
          for (const { items, plan } of group.pages) {
            expect(plan.width, pair.label).toBeLessThanOrEqual(2048);
            expect(plan.height, pair.label).toBeLessThanOrEqual(2048);
            const placed = items.map((item) => {
              const at = plan.frames.get(item.key);
              if (!at) throw new Error(`${pair.label}: unplaced ${item.key}`);
              return { ...item, ...at };
            });
            expect(
              placed.filter(
                (p) =>
                  p.x < 2 ||
                  p.y < 2 ||
                  p.x + p.width + 2 > plan.width ||
                  p.y + p.height + 2 > plan.height,
              ),
              pair.label,
            ).toEqual([]);
            expect(
              placed.some((a, i) =>
                placed
                  .slice(i + 1)
                  .some(
                    (b) =>
                      a.x + a.width + 4 > b.x &&
                      b.x + b.width + 4 > a.x &&
                      a.y + a.height + 4 > b.y &&
                      b.y + b.height + 4 > a.y,
                  ),
              ),
              pair.label,
            ).toBe(false);
          }
        }
        const [world, backdrop] = groups;
        expect(
          groups
            .flatMap((g) => g.pages.flatMap((p) => [...p.plan.frames.keys()]))
            .sort(),
          pair.label,
        ).toEqual([...keys].sort());
        expect(world.bytes, pair.label).toBeLessThanOrEqual(
          ATLAS_BOUND[quality].oldWorldBytes,
        );
        expect(backdrop.bytes, pair.label).toBeLessThanOrEqual(
          ATLAS_BOUND[quality].oldBackdropBytes,
        );
        for (const gpu of [false, true]) {
          const model = lifetimeModel(quality, world, backdrop, gpu);
          const label = `${pair.label}; ${gpu ? 'WebGL' : 'Canvas'}; MiB=${model.peakBytes / 1048576}`;
          expect(model.peakBytes, label).toBeLessThanOrEqual(
            ATLAS_BOUND[quality].peakBytes,
          );
          expect(model.peakBytes, label).toBeLessThan(BUDGET_BYTES[quality]);
        }
      }
    },
  );
}
