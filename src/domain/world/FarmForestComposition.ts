import { stationFlat, stationSlot, type SceneryProp } from './Scenery.ts';
import { biomeAt } from './Biomes.ts';
import type { LocalityTemplate } from './sceneryTypes.ts';
import { contextAt, sceneAt, templateById } from './WorldPlan.ts';
import { placementConflict, footprintAdmissible } from './Placement.ts';
import {
  clipPolygonX,
  projectedBounds,
  propScale,
  railYUpU,
  type PlacementCatalog,
  type PointU,
} from './SceneryGeometry.ts';
import type { Reservation } from './Reservations.ts';
/** Static grouped artwork and field rows share the accepted ground polygons. */
export function farmForestComposition(
  seed: number,
  k: number,
  own: LocalityTemplate,
  catalog: PlacementCatalog,
  reservations: readonly Reservation[],
): SceneryProp[] {
  const result: SceneryProp[] = [],
    x0 = k * 1024,
    season = contextAt(seed, x0 + 512).season;
  const clipCache = new Map<string, readonly PointU[]>();
  const work = own.rules.some((r) => r.work === 'forwarder');
  for (const [n, rule] of own.rules.entries()) {
    if (!rule.layout || (rule.seasons && !rule.seasons.includes(season)))
      continue;
    const support = reservations.find(
      (r) => r.purpose === (rule.surface ?? 'forest-floor'),
    );
    const clips: readonly PointU[][] =
      rule.layer === 'near' && support
        ? [clipPolygonX(support.polygon, x0, x0 + 1024)]
        : [
            [
              { xU: x0, yU: -2000 },
              { xU: x0 + 1024, yU: -2000 },
              ...(rule.layout === 'forest-band'
                ? Array.from({ length: 33 }, (_, i) => ({
                    xU: x0 + 1024 - i * 32,
                    yU: -railYUpU(seed, x0 + 1024 - i * 32) - 18,
                  }))
                : [
                    { xU: x0 + 1024, yU: 2000 },
                    { xU: x0, yU: 2000 },
                  ]),
            ],
          ];
    let ranges = [{ from: x0, to: x0 + 1024 }];
    if (rule.layout === 'forest-band' && work && rule.depth[0] < 0.4)
      ranges = [
        { from: x0, to: x0 + 220 },
        { from: x0 + 850, to: x0 + 1024 },
      ];
    for (const r of reservations.filter(
      (r) =>
        ['river', 'crossing-road', 'tunnel-hill', 'secondary-hill'].includes(
          r.purpose,
        ) &&
        (r.layer === 'both' || r.layer === rule.layer),
    )) {
      const from =
          Math.min(...r.polygon.map((p) => p.xU)) -
          (rule.layer === 'near' ? 40 : 4),
        to =
          Math.max(...r.polygon.map((p) => p.xU)) +
          (rule.layer === 'near' ? 40 : 4);
      ranges = ranges
        .flatMap((v) => [
          { from: v.from, to: Math.min(v.to, from) },
          { from: Math.max(v.from, to), to: v.to },
        ])
        .filter((v) => v.to > v.from);
    }
    const resolved = ranges
      .flatMap((range) =>
        clips.map((base) => {
          const key = `${rule.layer}/${rule.layout === 'forest-band' ? 'forest' : 'ground'}/${range.from}/${range.to}`;
          let clip = clipCache.get(key);
          if (!clip) {
            clip = clipPolygonX(base, range.from, range.to);
            clipCache.set(key, clip);
          }
          return clip;
        }),
      )
      .filter((clip) => clip.length >= 3);
    const groupedForest =
      rule.layout === 'forest-band' || rule.layout === 'forest-edge';
    const firstKind = rule.kinds[0];
    const firstPart = firstKind && catalog[firstKind];
    if (!firstKind || !firstPart) throw new Error('missing composition art');
    const widthU =
      firstPart.widthU *
      propScale({
        kind: firstKind,
        layer: rule.layer,
        xU: 0,
        depth: rule.depth[0],
        scale: rule.scale?.[0] ?? 1,
        flip: false,
      });
    // Each SVG fades over 5% on both sides. Keep 12% overlap, also after projection.
    const step =
      rule.layout === 'rows'
        ? 144
        : rule.layout === 'forest-trees'
          ? 64
          : Math.floor(widthU * 0.88);
    // A world lattice includes the previous tile's fragment. Never restart at a chunk cut.
    const start = groupedForest
      ? Math.floor((x0 - widthU) / step) * step - x0
      : rule.layout === 'rows'
        ? 208
        : 32;
    const scene = sceneAt(seed, x0 + 512);
    const continues = (x: number) => {
      const adjacent = sceneAt(seed, x);
      if (
        !templateById(adjacent.templateId).rules.some(
          (r) => r.layout === rule.layout && r.depth[0] === rule.depth[0],
        )
      )
        return false;
      // Match the composed station override, not merely the planned template.
      const chunk = Math.floor(x / 1024),
        place = biomeAt(seed, chunk);
      return (
        adjacent.templateId === 'farm-forest-dense' ||
        place.slot !== stationSlot(seed, place.block) ||
        !stationFlat(seed, chunk)
      );
    };
    const fromU = !continues(x0 - 1)
      ? x0
      : scene.fromXU - (continues(scene.fromXU - 1) ? 2048 : 0);
    const toU = !continues(x0 + 1024)
      ? x0 + 1024
      : scene.toXU + (continues(scene.toXU) ? 2048 : 0);
    for (let x = start, i = 0; x < 1024; x = start + ++i * step) {
      const kind = rule.kinds[i % rule.kinds.length];
      if (!kind) continue;
      // The existing rule/candidate identity convention also covers compositions;
      // 1000+ avoids ordinary transition-rule candidates that share a rule index.
      const p: SceneryProp = {
        id: `g2:chunk:${k}:prop:rule:${n}:candidate:${1000 + i}`,
        kind,
        layer: rule.layer,
        xU: x,
        depth: rule.depth[0],
        scale: rule.scale?.[0] ?? 1,
        flip: false,
        phase: 0,
      };
      if (rule.layout === 'forest-trees') {
        if (work && x > 220 && x < 850) continue;
        if (!placementConflict(seed, k, p, catalog, reservations))
          result.push(p);
        continue;
      }
      for (const [j, clip] of resolved.entries()) {
        const clipFromU = Math.min(...clip.map((p) => p.xU));
        const clipToU = Math.max(...clip.map((p) => p.xU));
        const candidate: SceneryProp = {
          ...p,
          id: `g2:chunk:${k}:prop:rule:${n}:candidate:${1000 + i * resolved.length + j}`,
          clip,
          ...(groupedForest
            ? {
                fadeX: {
                  fromU: Math.max(fromU, clipFromU > x0 ? clipFromU : fromU),
                  toU: Math.min(toU, clipToU < x0 + 1024 ? clipToU : toU),
                  widthU: rule.layout === 'forest-band' ? 192 : 128,
                },
              }
            : {}),
        };
        const part = catalog[kind];
        if (!part) throw new Error(`missing grouped art ${kind}`);
        const b = projectedBounds(seed, k, candidate, part);
        if (b.rightU <= b.leftU || b.bottomU <= b.topU) continue;
        if (support && rule.layer === 'near') {
          candidate.dependencies = [support.ownerId];
          candidate.relations = [
            {
              reservationId: support.id,
              relation:
                rule.surface === 'field'
                  ? 'object-on-field'
                  : 'object-on-forest-floor',
            },
          ];
        }
        if (
          footprintAdmissible(seed, k, candidate, catalog) &&
          !placementConflict(
            seed,
            k,
            candidate,
            catalog,
            reservations,
            candidate.relations,
          )
        )
          result.push(candidate);
      }
    }
  }
  return result;
}
