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
