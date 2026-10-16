import { generateTrackProfile, profileGrade } from './TrackProfile.ts';
import { chunkScenery } from './Scenery.ts';
import { projectedBounds, rectPolygon, railYUpU } from './SceneryGeometry.ts';
import { templateById } from './WorldPlan.ts';
import type { PlacementCatalog, PointU } from './SceneryGeometry.ts';
export interface WorldOverlayOptions {
  areas: boolean;
  boundaries: boolean;
  roads: boolean;
}
export interface WorldOverlayPrimitive {
  id: string;
  kind: 'reservation' | 'footprint' | 'scene' | 'subzone' | 'road-tangent';
  points: readonly PointU[];
}
export function worldOverlayGeometry(
  seed: number,
  k: number,
  catalog: PlacementCatalog,
  options: WorldOverlayOptions,
): WorldOverlayPrimitive[] {
  if (!options.areas && !options.boundaries && !options.roads) return [];
  const sc = chunkScenery(seed, k, catalog),
    result: WorldOverlayPrimitive[] = [];
  if (options.areas) {
    for (const r of sc.reservations)
      result.push({ id: r.id, kind: 'reservation', points: r.polygon });
    for (const p of sc.props) {
      const part = catalog[p.kind];
      if (part)
        result.push({
          id: p.id,
          kind: 'footprint',
          points: rectPolygon(projectedBounds(seed, k, p, part)),
        });
    }
  }
  if (options.areas)
    for (const fence of sc.fences)
      result.push({
        id: fence.id,
        kind: 'footprint',
        points: rectPolygon({
          leftU: fence.fromXU - 4,
          rightU: fence.toXU + 4,
          topU: Math.min(...fence.posts.map((p) => p.yU)) - 26,
          bottomU: Math.max(...fence.posts.map((p) => p.yU)) + 4,
        }),
      });
  if (options.roads && sc.crossing) {
    const x = k * 1024 + sc.crossing.localXU,
      y = -railYUpU(seed, x),
      grade = profileGrade(generateTrackProfile(seed, k), sc.crossing.localXU),
      norm = Math.hypot(grade, 1);
    for (const offset of [-160, 0, 160]) {
      const a = { xU: x + (grade / norm) * offset, yU: y + offset / norm };
      result.push({
        id: `${sc.crossing.id}:tangent:${offset}`,
        kind: 'road-tangent',
        points: [a, { xU: a.xU + (grade / norm) * 40, yU: a.yU + 40 / norm }],
      });
    }
  }
  if (options.boundaries) {
    for (const x of [sc.scene.fromXU, sc.scene.toXU])
      result.push({
        id: `${sc.scene.id}:boundary:${x}`,
        kind: 'scene',
        points: [
          { xU: x, yU: -railYUpU(seed, x) - 800 },
          { xU: x, yU: -railYUpU(seed, x) + 1100 },
        ],
      });
    const template = templateById(sc.scene.templateId);
    const cuts = new Set([
      k * 1024,
      ...(template.backSpans ?? []).flatMap((s) => [
        k * 1024 + s.fromX,
        k * 1024 + s.toX,
      ]),
    ]);
    for (const x of cuts)
      result.push({
        id: `${sc.scene.id}:subzone:${x}`,
        kind: 'subzone',
        points: [
          { xU: x, yU: -railYUpU(seed, x) - 220 },
          { xU: x, yU: -railYUpU(seed, x) + 440 },
        ],
      });
  }
  if (options.roads)
    for (const road of sc.roads)
      for (let i = 1; i < road.points.length; i += 3) {
        const a = road.points[i - 1],
          b = road.points[i];
        if (!a || !b) continue;
        const dx = b.xU - a.xU,
          dy = b.yU - a.yU,
          length = Math.hypot(dx, dy);
        if (length === 0) continue;
        result.push({
          id: `${road.id}:tangent:${i}`,
          kind: 'road-tangent',
          points: [
            a,
            { xU: a.xU + (dx / length) * 40, yU: a.yU + (dy / length) * 40 },
          ],
        });
      }
  return result;
}
