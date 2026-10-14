import type { SceneryProp } from './Scenery.ts';
import { bankHeightU } from './Terrain.ts';
import {
  pointInside,
  propFootU,
  propScale,
  railYUpU,
  roadPolygon,
  type PlacementPart,
  type PointU,
  type RoadPath,
} from './SceneryGeometry.ts';
/** Actual wheel/implement contacts, sampled over both mirrored patrol legs. */
export function workContactsU(
  seed: number,
  k: number,
  p: SceneryProp,
  part: PlacementPart,
): PointU[] {
  const reach = (p.motion?.rangeU ?? 0) / 2,
    points: PointU[] = [],
    scale = propScale(p);
  const contacts = part.workContactsU ?? [
    { xU: 0, yU: part.heightU - part.pivotU.yU },
  ];
  for (
    let x = p.xU - reach;
    x <= p.xU + reach;
    x = Math.min(p.xU + reach, x + 8)
  ) {
    const wx = k * 1024 + x,
      foot = propFootU(
        p,
        wx,
        railYUpU(seed, wx),
        p.layer === 'near' ? bankHeightU(seed, wx) : 0,
      );
    for (const sign of p.motion ? [1, -1] : [p.flip ? -1 : 1])
      for (const c of contacts)
        points.push({
          xU: wx + sign * c.xU * scale,
          yU: foot.yU + c.yU * scale,
        });
    if (x === p.xU + reach) break;
  }
  return points;
}
export function workRoadSupports(
  seed: number,
  k: number,
  p: SceneryProp,
  part: PlacementPart,
  road: RoadPath,
): boolean {
  const polygon = roadPolygon(road);
  return workContactsU(seed, k, p, part).every((c) => pointInside(c, polygon));
}
