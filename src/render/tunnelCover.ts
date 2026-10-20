/** Where the train is relative to a tunnel's portals. */
export type TrainInTunnel = 'outside' | 'partly' | 'inside';

/** Whether the train's x interval is outside, partly or wholly inside. */
export function trainInTunnel(
  train: { minX: number; maxX: number },
  tunnel: { fromX: number; toX: number },
): TrainInTunnel {
  if (train.maxX <= tunnel.fromX || train.minX >= tunnel.toX) return 'outside';
  return train.minX >= tunnel.fromX && train.maxX <= tunnel.toX
    ? 'inside'
    : 'partly';
}

/** Covered part of a vehicle's own track, not a locomotive-wide toggle. */
export function vehicleInCover(
  vehicle: { minX: number; maxX: number },
  covers: readonly { fromX: number; toX: number }[],
): TrainInTunnel {
  let result: TrainInTunnel = 'outside';
  for (const cover of covers) {
    const state = trainInTunnel(vehicle, cover);
    if (state === 'inside') return state;
    if (state === 'partly') result = state;
  }
  return result;
}

/** Bottom of a portal hill, fitted to its own track (render y, D-018). */
export function portalFootPoints(
  portalX: number,
  mirrored: boolean,
  railY: (worldX: number) => number,
): { x: number; y: number }[] {
  const xs: number[] = [];
  // Leave the 72 u mouth open. The far end meets the existing hill.
  for (let offset = 36; offset <= 320; offset += 16)
    xs.push(portalX + (mirrored ? offset : -offset));
  xs.push(portalX + (mirrored ? 320 : -320));
  const portalY = railY(portalX);
  return [
    ...xs.map((x) => ({ x, y: Math.min(railY(x) - 12, portalY - 4) })),
    ...xs
      .reverse()
      .map((x) => ({ x, y: Math.max(railY(x) + 12, portalY + 12) })),
  ];
}

/** Point relative to a portal rail pivot; the upper opening is a semicircle. */
export function portalMasonryPoint(
  x: number,
  y: number,
  halfWidth: number,
  height: number,
  radius: number,
  archCenterHeight: number,
): boolean {
  if (Math.abs(x) > halfWidth || y < -height || y > 4) return false;
  const inOpening =
    Math.abs(x) < radius &&
    (y >= -archCenterHeight ||
      x * x + (y + archCenterHeight) ** 2 < radius * radius);
  return !inOpening;
}

/** NPC vehicle source relative to its own portal, in world render coordinates. */
export function secondaryPortalCoversPoint(
  point: { x: number; y: number },
  portal: { x: number; y: number; grade: number; mirrored: boolean },
): boolean {
  const angle = -Math.atan(portal.grade);
  const cos = Math.cos(angle),
    sin = Math.sin(angle);
  const dx = point.x - portal.x,
    dy = point.y - portal.y;
  const x = dx * cos + dy * sin,
    y = -dx * sin + dy * cos;
  if (portal.mirrored ? x >= 0 : x <= 0) return true;
  return portalMasonryPoint(x, y, 64, 136, 36, 68);
}

/** Bounded secondary scenery silhouette; weather is not an NPC tail half-plane. */
export function secondaryWeatherCoversPoint(
  point: { x: number; y: number },
  portal: { x: number; y: number; grade: number; mirrored: boolean },
  radiusU = 0,
): boolean {
  const angle = -Math.atan(portal.grade),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const dx = point.x - portal.x,
    dy = point.y - portal.y;
  const x = (dx * cos + dy * sin) * (portal.mirrored ? -1 : 1),
    y = -dx * sin + dy * cos;
  if (
    x < -380 - radiusU ||
    x > 62 + radiusU ||
    y < -175 - radiusU ||
    y > 6 + radiusU
  )
    return false;
  const archX = Math.abs(x) + radiusU;
  const whollyInArch =
    archX < 36 &&
    y + radiusU <= 2 &&
    y - radiusU >= -68 - Math.sqrt(36 ** 2 - archX ** 2);
  if (whollyInArch) return false;
  return pointInsideSecondary(x, y, radiusU);
}

const SECONDARY_HILL = [
  [-380, 6],
  [-367, -44],
  [-337, -104],
  [-291, -146],
  [-230, -168],
  [-177, -175],
  [-129, -173],
  [-88, -165],
  [-54, -140],
  [60, -136],
  [62, -99],
  [59, -49],
  [60, 6],
] as const;
function pointInsideSecondary(x: number, y: number, radiusU: number): boolean {
  let inside = false;
  for (
    let i = 0, j = SECONDARY_HILL.length - 1;
    i < SECONDARY_HILL.length;
    j = i++
  ) {
    const a = SECONDARY_HILL[i],
      b = SECONDARY_HILL[j];
    if (!a || !b) continue;
    if (radiusU > 0) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy)),
      );
      if ((x - a[0] - t * dx) ** 2 + (y - a[1] - t * dy) ** 2 <= radiusU ** 2)
        return true;
    }
    if (
      a[1] > y !== b[1] > y &&
      x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/** D-033: only the player's interval drives the main-track cover. */
export const TUNNEL_SEE_THROUGH_ALPHA = 0.5;
const APPROACH_U = 80;
const FADE_PER_SEC = 6;
export function tunnelCoverTarget(
  train: { minX: number; maxX: number },
  tunnel: { fromX: number; toX: number },
): number {
  return train.maxX >= tunnel.fromX - APPROACH_U &&
    train.minX <= tunnel.toX + APPROACH_U
    ? TUNNEL_SEE_THROUGH_ALPHA
    : 1;
}
export function nextCoverAlpha(
  current: number | undefined,
  target: number,
  dtSec: number,
): number {
  if (current === undefined) return target;
  if (dtSec <= 0) return current;
  const next = target + (current - target) * Math.exp(-FADE_PER_SEC * dtSec);
  // Drawing and bubble visibility share an exact endpoint after departure.
  return Math.abs(next - target) <= 0.002 ? target : next;
}

/** View-owned easing clock. The caller supplies simulation seconds, including pauses. */
export class TunnelCoverFade {
  #alpha: number | undefined;
  #timeSec: number | undefined;
  #target = 1;
  constructor(
    readonly cover: { setAlpha(alpha: number): unknown },
    readonly range: { fromX: number; toX: number },
  ) {}
  get alpha(): number {
    return this.#alpha ?? 1;
  }
  setTarget(train: { minX: number; maxX: number } | undefined): void {
    this.#target = train ? tunnelCoverTarget(train, this.range) : 1;
    if (this.#alpha === undefined) {
      this.#alpha = this.#target;
      this.cover.setAlpha(this.#alpha);
    }
  }
  advance(timeSec: number): void {
    this.#alpha = nextCoverAlpha(
      this.#alpha,
      this.#target,
      this.#timeSec === undefined ? 0 : timeSec - this.#timeSec,
    );
    this.#timeSec = timeSec;
    this.cover.setAlpha(this.#alpha);
  }
  update(
    train: { minX: number; maxX: number } | undefined,
    timeSec: number,
  ): void {
    this.setTarget(train);
    this.advance(timeSec);
  }
}
