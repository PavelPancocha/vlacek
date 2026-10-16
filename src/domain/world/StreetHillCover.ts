import { gameConfig } from '../../config/gameConfig.ts';
import { secondarySite } from './SecondaryTrack.ts';
import { tunnelSite } from './Structures.ts';
import {
  generateTrackProfile,
  profileGrade,
  profileHeightU,
} from './TrackProfile.ts';
import {
  pointInside,
  polygonsHit,
  railYUpU,
  type PointU,
} from './SceneryGeometry.ts';
import type { Reservation } from './Reservations.ts';

// Inscribed chords of the two convex flank curves in secondary.portal-hill.svg.
// Stop before the portal cutout; only continuous opaque grass can hide a cap.
const secondaryFlank: readonly PointU[] = [
  ...[
    [0, 200, 14, 134, 60, 44, 150, 26],
    [150, 26, 230, 10, 300, 24, 326, 54],
  ].flatMap((c) =>
    Array.from({ length: 33 }, (_, i) => {
      const t = i / 32,
        s = 1 - t;
      const axis = (a: number) =>
        (c[a] ?? 0) * s ** 3 +
        3 * (c[a + 2] ?? 0) * s * s * t +
        3 * (c[a + 4] ?? 0) * s * t * t +
        (c[a + 6] ?? 0) * t ** 3;
      return { xU: axis(0), yU: axis(1) };
    }),
  ),
  { xU: 326, yU: 200 },
  { xU: 0, yU: 200 },
];

/** Opaque drawn flanks only: reservations include invisible placement clearance. */
export function streetHillCoversCap(
  seed: number,
  k: number,
  hill: Pick<Reservation, 'purpose' | 'ownerId'>,
  cap: readonly PointU[],
): boolean {
  let outline: readonly PointU[];
  if (hill.purpose === 'secondary-hill') {
    const site = secondarySite(seed, Math.floor(k / 8));
    if (!site) return false;
    const portal = [site.fromX, site.toX].find(
      (x) => hill.ownerId === `${site.id}:portal:${x}`,
    );
    if (portal === undefined) return false;
    const profile = generateTrackProfile(seed, Math.floor(portal / 1024));
    const angle = -Math.atan(profileGrade(profile, 0)),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const mirrored = portal === site.toX,
      y = -railYUpU(seed, portal) - gameConfig.world.secondaryTrackOffsetU;
    outline = secondaryFlank.map((p) => {
      const dx = (p.xU - 380) * (mirrored ? -1 : 1),
        dy = p.yU - 194;
      return { xU: portal + c * dx - s * dy, yU: y + s * dx + c * dy };
    });
  } else if (hill.purpose === 'tunnel-hill') {
    const site = [k - 1, k, k + 1]
      .map((chunk) => tunnelSite(seed, chunk))
      .find((s) => s?.id === hill.ownerId);
    if (!site) return false;
    const profile = generateTrackProfile(seed, site.chunkIndex),
      x0 = site.chunkIndex * 1024;
    // TunnelView extrapolates its own 8-u rail chords beyond the owning chunk.
    const rail = (x: number) => {
      const left = Math.max(0, Math.min(127, Math.floor(x / 8))) * 8;
      const a = profileHeightU(profile, left),
        b = profileHeightU(profile, left + 8);
      return -a - ((b - a) * (x - left)) / 8;
    };
    const from = site.fromX - 170,
      to = site.toX + 170,
      middle = (site.fromX + site.toX) / 2,
      half = (to - from) / 2;
    const xs: number[] = [];
    for (let x = from; x < to; x += 16) xs.push(x);
    xs.push(to);
    // Same sampled outline as TunnelView's opaque flanks, including local bump phase.
    outline = [
      ...xs.map((x) => {
        const ratio = Math.min(1, Math.abs(x - middle) / half);
        const bump =
          (10 * Math.sin((x - site.fromX) / 47) + 6 * Math.sin(x / 23)) *
          (1 - ratio);
        return {
          xU: x0 + x,
          yU: rail(x) - 290 * Math.sqrt(1 - ratio ** 3) - bump,
        };
      }),
      ...xs.toReversed().map((x) => ({ xU: x0 + x, yU: rail(x) })),
    ];
  } else return false;
  // Two inside shoulders are insufficient for a non-convex sampled silhouette:
  // the complete cap must also avoid every boundary edge.
  return (
    cap.length === 2 &&
    cap.every((p) => pointInside(p, outline)) &&
    !outline.some((p, i) => {
      const next = outline[(i + 1) % outline.length];
      return next !== undefined && polygonsHit(cap, [p, next]);
    })
  );
}
