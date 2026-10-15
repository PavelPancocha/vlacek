import { generateTrackProfile, profileHeightU } from './TrackProfile.ts';
import { bankHeightU } from './Terrain.ts';

/** Projected world coordinates, x right / y down, in u. */
export interface PointU {
  xU: number;
  yU: number;
}
export interface BoundsU {
  leftU: number;
  rightU: number;
  topU: number;
  bottomU: number;
}
export const BACK_PLANE_U = 220;
export const NEAR_DEPTH_RANGE_U = 440;
export const NEAR_FOOT_OFFSET_U = 8;
export const TRACK_BED_DEPTH_U = 22;
export const WATER_END_U = 72;
export const WATER_SIDE_U = 10;
export interface PlacementPart {
  widthU: number;
  heightU: number;
  pivotU: PointU;
  /** Ground occupation width as fraction of the art; crowns may overlap. */
  contactWidth: number;
  workBoundsU?: BoundsU;
  workContactsU?: readonly PointU[];
  bankAnchorsU?: readonly PointU[];
  swayRad?: number;
  /** Animated silhouette around the art pivot; contacts still use the physical foot. */
  motionBoundsU?: BoundsU;
}
export type PlacementCatalog = Readonly<Record<string, PlacementPart>>;
export interface ProjectedProp {
  kind: string;
  layer: 'back' | 'near';
  xU: number;
  depth: number;
  scale: number;
  flip: boolean;
  motion?: { rangeU: number };
  rotationRad?: number;
  offsetYU?: number;
  clip?: readonly PointU[];
  roadPath?: RoadPath;
  laneDirection?: 1 | -1;
}
export function nearDepthScale(depth: number): number {
  return 1 + 0.5 * depth;
}
export function propScale(prop: ProjectedProp): number {
  return (
    prop.scale *
    (prop.layer === 'back' ? 1 - 0.35 * prop.depth : nearDepthScale(prop.depth))
  );
}
export function propFootU(
  prop: ProjectedProp,
  xU: number,
  railYUpU: number,
  bankU: number,
  target: PointU = { xU: 0, yU: 0 },
): PointU {
  if (prop.roadPath) {
    const at = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 };
    roadPositionAt(prop.roadPath, xU, prop.laneDirection ?? 1, at);
    return at;
  }
  target.xU = xU;
  target.yU =
    (prop.offsetYU ?? 0) +
    (prop.layer === 'back'
      ? -railYUpU - prop.depth * BACK_PLANE_U
      : -railYUpU +
        TRACK_BED_DEPTH_U +
        bankU +
        NEAR_FOOT_OFFSET_U +
        prop.depth * NEAR_DEPTH_RANGE_U);
  return target;
}
const heightCache = new Map<string, Float64Array>();
/** Matches the renderer's 8-u LUT chords instead of approximating track height twice. */
export function railYUpU(seed: number, worldXU: number): number {
  const k = Math.floor(worldXU / 1024),
    local = worldXU - k * 1024;
  const key = `${seed}/${k}`;
  let heights = heightCache.get(key);
  if (!heights) {
    const profile = generateTrackProfile(seed, k);
    heights = Float64Array.from({ length: 129 }, (_, i) =>
      profileHeightU(profile, i * 8),
    );
    if (heightCache.size === 32) {
      const first = heightCache.keys().next().value;
      if (first !== undefined) heightCache.delete(first);
    }
    heightCache.set(key, heights);
  }
  const i = Math.floor(local / 8),
    t = (local - i * 8) / 8;
  const a = heights[i] ?? 0;
  return a + ((heights[i + 1] ?? a) - a) * t;
}
export function projectedBounds(
  seed: number,
  k: number,
  prop: ProjectedProp,
  part: PlacementPart,
  contact = false,
): BoundsU {
  const reachU = prop.motion?.rangeU ?? 0;
  if (prop.roadPath && reachU > 0) {
    let leftU = Infinity,
      rightU = -Infinity,
      topU = Infinity,
      bottomU = -Infinity;
    for (
      let offset = -reachU / 2;
      ;
      offset = Math.min(reachU / 2, offset + 8)
    ) {
      const at = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 };
      roadPositionAt(
        prop.roadPath,
        k * 1024 + prop.xU + offset,
        prop.laneDirection ?? 1,
        at,
      );
      const b = projectedBounds(
        seed,
        k,
        {
          ...prop,
          xU: prop.xU + offset,
          motion: { rangeU: 0 },
          rotationRad: Math.atan2(at.tangentY, at.tangentX),
        },
        part,
        contact,
      );
      leftU = Math.min(leftU, b.leftU);
      rightU = Math.max(rightU, b.rightU);
      topU = Math.min(topU, b.topU);
      bottomU = Math.max(bottomU, b.bottomU);
      if (offset === reachU / 2) break;
    }
    return { leftU, rightU, topU, bottomU };
  }
  const scale = propScale(prop),
    wx = k * 1024 + prop.xU;
  const foot = propFootU(
    prop,
    wx,
    railYUpU(seed, wx),
    prop.layer === 'near' ? bankHeightU(seed, wx) : 0,
  );
  const pivotX = prop.flip ? part.widthU - part.pivotU.xU : part.pivotU.xU;
  const shrink = contact ? ((1 - part.contactWidth) * part.widthU) / 2 : 0;
  const envelope =
    part.workBoundsU ?? (contact ? undefined : part.motionBoundsU);
  const facingLeft = envelope
    ? prop.flip
      ? -envelope.rightU
      : envelope.leftU
    : -pivotX;
  const facingRight = envelope
    ? prop.flip
      ? -envelope.leftU
      : envelope.rightU
    : part.widthU - pivotX;
  // A patrol reverses the whole compound; include both mirrored end poses.
  const patrol = (prop.motion?.rangeU ?? 0) > 0;
  const left =
      ((patrol ? Math.min(facingLeft, -facingRight) : facingLeft) + shrink) *
      scale,
    right =
      ((patrol ? Math.max(facingRight, -facingLeft) : facingRight) - shrink) *
      scale;
  const bottom =
    (contact
      ? part.heightU - part.pivotU.yU
      : (envelope?.bottomU ?? part.heightU - part.pivotU.yU)) * scale;
  const top = contact
    ? bottom - 0.5
    : (envelope?.topU ?? -part.pivotU.yU) * scale;
  const rotation = prop.rotationRad ?? 0,
    cos = Math.cos(rotation),
    sin = Math.sin(rotation);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [x = 0, y = 0] of [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
  ]) {
    const atX = foot.xU + x * cos - y * sin,
      atY = foot.yU + x * sin + y * cos;
    minX = Math.min(minX, atX);
    maxX = Math.max(maxX, atX);
    minY = Math.min(minY, atY);
    maxY = Math.max(maxY, atY);
  }
  const reach = (prop.motion?.rangeU ?? 0) / 2;
  const sway = contact
    ? 0
    : (part.swayRad ?? 0) * Math.hypot(part.widthU, part.heightU) * scale;
  const motionY = motionYRange(seed, prop, wx, reach, foot.yU);
  return {
    leftU: Math.max(
      minX - reach - sway,
      prop.clip ? Math.min(...prop.clip.map((p) => p.xU)) : -Infinity,
    ),
    rightU: Math.min(
      maxX + reach + sway,
      prop.clip ? Math.max(...prop.clip.map((p) => p.xU)) : Infinity,
    ),
    topU: Math.max(
      minY - sway + motionY[0],
      prop.clip ? Math.min(...prop.clip.map((p) => p.yU)) : -Infinity,
    ),
    bottomU: Math.min(
      maxY + sway + motionY[1],
      prop.clip ? Math.max(...prop.clip.map((p) => p.yU)) : Infinity,
    ),
  };
}
/** Patrol feet follow the rail/terrain over the entire authored motion envelope. */
function motionYRange(
  seed: number,
  prop: ProjectedProp,
  x: number,
  reach: number,
  y: number,
): readonly [number, number] {
  let min = 0,
    max = 0;
  if (reach === 0) return [0, 0];
  for (let at = x - reach; at <= x + reach; at += 8) {
    const value =
      propFootU(
        prop,
        at,
        railYUpU(seed, at),
        prop.layer === 'near' ? bankHeightU(seed, at) : 0,
      ).yU - y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  const at = x + reach,
    value =
      propFootU(
        prop,
        at,
        railYUpU(seed, at),
        prop.layer === 'near' ? bankHeightU(seed, at) : 0,
      ).yU - y;
  return [Math.min(min, value), Math.max(max, value)];
}
export function rectPolygon(b: BoundsU): PointU[] {
  return [
    { xU: b.leftU, yU: b.topU },
    { xU: b.rightU, yU: b.topU },
    { xU: b.rightU, yU: b.bottomU },
    { xU: b.leftU, yU: b.bottomU },
  ];
}
export function pointInside(p: PointU, polygon: readonly PointU[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (!a || !b) continue;
    if (
      a.yU > p.yU !== b.yU > p.yU &&
      p.xU < ((b.xU - a.xU) * (p.yU - a.yU)) / (b.yU - a.yU) + a.xU
    )
      inside = !inside;
  }
  return inside;
}
const cross = (a: PointU, b: PointU, c: PointU) =>
  (b.xU - a.xU) * (c.yU - a.yU) - (b.yU - a.yU) * (c.xU - a.xU);
function segmentsHit(a: PointU, b: PointU, c: PointU, d: PointU): boolean {
  return (
    Math.max(a.xU, b.xU) >= Math.min(c.xU, d.xU) &&
    Math.max(c.xU, d.xU) >= Math.min(a.xU, b.xU) &&
    Math.max(a.yU, b.yU) >= Math.min(c.yU, d.yU) &&
    Math.max(c.yU, d.yU) >= Math.min(a.yU, b.yU) &&
    cross(a, b, c) * cross(a, b, d) <= 0 &&
    cross(c, d, a) * cross(c, d, b) <= 0
  );
}
export function boundsHitPolygon(
  bounds: BoundsU,
  polygon: readonly PointU[],
): boolean {
  // Separate planes cannot intersect; keep touching edges for the exact test below.
  if (
    polygon.every((p) => p.xU < bounds.leftU) ||
    polygon.every((p) => p.xU > bounds.rightU) ||
    polygon.every((p) => p.yU < bounds.topU) ||
    polygon.every((p) => p.yU > bounds.bottomU)
  )
    return false;
  const rect = rectPolygon(bounds);
  if (
    rect.some((p) => pointInside(p, polygon)) ||
    polygon.some(
      (p) =>
        p.xU >= bounds.leftU &&
        p.xU <= bounds.rightU &&
        p.yU >= bounds.topU &&
        p.yU <= bounds.bottomU,
    )
  )
    return true;
  for (let i = 0; i < rect.length; i++)
    for (let j = 0; j < polygon.length; j++) {
      const a = rect[i],
        b = rect[(i + 1) % rect.length],
        c = polygon[j],
        d = polygon[(j + 1) % polygon.length];
      if (a && b && c && d && segmentsHit(a, b, c, d)) return true;
    }
  return false;
}
/** Exact polygon edge/containment intersection, shared by roads and reservations. */
export function polygonsHit(
  a: readonly PointU[],
  b: readonly PointU[],
): boolean {
  if (a.some((p) => pointInside(p, b)) || b.some((p) => pointInside(p, a)))
    return true;
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++) {
      const p = a[i],
        q = a[(i + 1) % a.length],
        r = b[j],
        t = b[(j + 1) % b.length];
      if (p && q && r && t && segmentsHit(p, q, r, t)) return true;
    }
  return false;
}
/** Clip a polygon to an x corridor (planned crossings and render strips). */
export function clipPolygonX(
  polygon: readonly PointU[],
  fromXU: number,
  toXU: number,
): PointU[] {
  let result = [...polygon];
  for (const [x, sign] of [
    [fromXU, 1],
    [toXU, -1],
  ] as const) {
    const input = result;
    result = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i],
        b = input[(i + 1) % input.length];
      if (!a || !b) continue;
      const insideA = sign * (a.xU - x) >= 0,
        insideB = sign * (b.xU - x) >= 0;
      if (insideA) result.push(a);
      if (insideA !== insideB) {
        const t = (x - a.xU) / (b.xU - a.xU);
        result.push({ xU: x, yU: a.yU + t * (b.yU - a.yU) });
      }
    }
  }
  return result;
}
export interface RoadPointU extends PointU {
  halfWidthU: number;
}
export interface RoadPath {
  id: string;
  ownerId: string;
  layer?: 'near' | 'back';
  surface?: 'dirt';
  fromXU: number;
  toXU: number;
  points: readonly RoadPointU[];
  style?: 'path' | 'service';
  /** Separated carriageways; absent on local roads. */
  medianHalfWidthU?: number;
}
/** Caller-owned sample, projected world u; right-hand lane, independent of camera. */
export function roadPositionAt(
  road: RoadPath,
  worldXU: number,
  direction: 1 | -1,
  out: PointU & { tangentX: number; tangentY: number },
): void {
  for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1],
      b = road.points[i];
    if (!a || !b || (worldXU > b.xU && i < road.points.length - 1)) continue;
    const dx = b.xU - a.xU,
      dy = b.yU - a.yU;
    const length = Math.hypot(dx, dy) || 1,
      t = Math.max(0, Math.min(1, (worldXU - a.xU) / (dx || 1)));
    const lane =
      (direction * (a.halfWidthU + t * (b.halfWidthU - a.halfWidthU))) / 2;
    out.xU = a.xU + t * dx - (dy / length) * lane;
    out.yU = a.yU + t * dy + (dx / length) * lane;
    out.tangentX = dx / length;
    out.tangentY = dy / length;
    return;
  }
}
export function roadSide(path: RoadPath, sign: number, growU = 0): PointU[] {
  return path.points.map((p, i) => {
    const a = path.points[Math.max(0, i - 1)] ?? p,
      b = path.points[Math.min(path.points.length - 1, i + 1)] ?? p;
    const dx = b.xU - a.xU,
      dy = b.yU - a.yU,
      length = Math.hypot(dx, dy) || 1,
      offset = sign * (p.halfWidthU + growU);
    return {
      xU: p.xU - (dy / length) * offset,
      yU: p.yU + (dx / length) * offset,
    };
  });
}
export function roadPolygon(path: RoadPath, growU = 0): PointU[] {
  return [...roadSide(path, -1, growU), ...roadSide(path, 1, growU).reverse()];
}
export function villageRoad(
  seed: number,
  k: number,
  prop: ProjectedProp,
  ownerId: string,
): RoadPath {
  const range = prop.motion?.rangeU ?? 0,
    bend = 90,
    from = Math.max(bend, prop.xU - range / 2 - 12),
    to = Math.min(1024 - bend, prop.xU + range / 2 + 12);
  const path: { xU: number; depth: number }[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    path.push({
      xU: from - bend * (1 - t),
      depth: prop.depth + (1 - prop.depth) * (1 - t) ** 2,
    });
  }
  for (let x = from + 32; x < to; x += 32)
    path.push({ xU: x, depth: prop.depth });
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    path.push({
      xU: to + bend * t,
      depth: prop.depth + (1 - prop.depth) * t * t,
    });
  }
  return {
    id: `${ownerId}:road`,
    ownerId,
    fromXU: k * 1024 + from,
    toXU: k * 1024 + to,
    points: path.map((p) => ({
      xU: k * 1024 + p.xU,
      yU:
        -railYUpU(seed, k * 1024 + p.xU) -
        p.depth * 220 -
        22 * 0.3 * (1 - p.depth),
      halfWidthU: 11 * (1 - 0.7 * p.depth),
    })),
  };
}
export interface SeaShore {
  regionFromXU: number;
  regionToXU: number;
  transitionU: number;
}
export interface WaterGeometry {
  id: string;
  kind: 'pond' | 'channel' | 'sea';
  fromX: number;
  toX: number;
  nearDepth: number;
  farDepth: number;
  shore?: SeaShore;
}
export function waterLevelU(seed: number, k: number, w: WaterGeometry): number {
  let level = Infinity;
  for (let x = w.fromX + WATER_SIDE_U; x <= w.toX - WATER_SIDE_U; x += 16)
    level = Math.min(level, -railYUpU(seed, k * 1024 + x));
  return level;
}
export function waterSectionU(
  seed: number,
  k: number,
  w: WaterGeometry,
  xU: number,
  levelU = waterLevelU(seed, k, w),
) {
  const rail = -railYUpU(seed, k * 1024 + xU);
  const top =
    w.kind === 'sea'
      ? rail - w.farDepth * 220
      : Math.max(levelU - w.farDepth * 220, rail - 216);
  const worldXU = k * 1024 + xU;
  const presence = w.shore
    ? Math.max(
        0,
        Math.min(
          1,
          (worldXU - (w.shore.regionFromXU - w.shore.transitionU)) /
            w.shore.transitionU,
          (w.shore.regionToXU - worldXU) / w.shore.transitionU,
        ),
      )
    : 1;
  const nearDepth =
    w.kind === 'sea'
      ? w.farDepth - (w.farDepth - w.nearDepth) * presence
      : w.nearDepth;
  const bottom = rail - nearDepth * 220;
  const f = Math.max(
    0,
    Math.min(1, Math.min(xU - w.fromX - 10, w.toX - 10 - xU) / 62),
  );
  const open = w.kind === 'sea' ? 1 : Math.sqrt(1 - (1 - f) ** 2),
    middle = top + (bottom - top) * 0.55;
  return {
    topU: middle + (top - middle) * open,
    bottomU: middle + (bottom - middle) * open,
  };
}
export function waterPolygon(
  seed: number,
  k: number,
  w: WaterGeometry,
): PointU[] {
  const xs: number[] = [];
  for (let x = w.fromX; x < w.toX; x += 8) xs.push(x);
  xs.push(w.toX);
  const level = waterLevelU(seed, k, w);
  return [
    ...xs.map((x) => ({
      xU: k * 1024 + x,
      yU: waterSectionU(seed, k, w, x, level).topU,
    })),
    ...xs.reverse().map((x) => ({
      xU: k * 1024 + x,
      yU: waterSectionU(seed, k, w, x, level).bottomU,
    })),
  ];
}
