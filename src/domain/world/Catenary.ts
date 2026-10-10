import { gameConfig } from '../../config/gameConfig.ts';
import { crossingSite, crossingWorldX } from './Crossings.ts';
import { BRIDGE_HALF_U, bridgeSite, tunnelSite } from './Structures.ts';

const { chunkWidthU, catenaryPoleSpacingU, catenaryContactHeightU } =
  gameConfig.world;

/**
 * A pole keeps at least this far (u, along x) from a crossing's road: the
 * road with its shoulders, posts and booms stays free (D-015, D-016).
 */
export const POLE_ROAD_CLEARANCE_U = 48;

/** A pole off a stream under a bridge, beside the abutments. */
export const POLE_STREAM_CLEARANCE_U = BRIDGE_HALF_U + 8;

/** No mast stands in a tunnel or this close to its portals (u). */
export const TUNNEL_MAST_CLEARANCE_U = 72;

/**
 * What holds the wire at a pole (world x): a mast beside the track, or in
 * and right at a tunnel a hanger from its ceiling (doc 03 §9). Pure.
 */
export function catenarySupport(
  seed: number,
  poleX: number,
): 'mast' | 'hanger' {
  const k = Math.floor(poleX / chunkWidthU);
  for (const chunk of [k - 1, k, k + 1]) {
    const tunnel = tunnelSite(seed, chunk);
    if (!tunnel) continue;
    const local = poleX - chunk * chunkWidthU;
    if (
      local > tunnel.fromX - TUNNEL_MAST_CLEARANCE_U &&
      local < tunnel.toX + TUNNEL_MAST_CLEARANCE_U
    )
      return 'hanger';
  }
  return 'mast';
}

/** A pole moved off a crossing road or a stream, to the side it stood on. */
function poleX(seed: number, x: number): number {
  const k = Math.floor(x / chunkWidthU);
  const aside = (middle: number, clearance: number) =>
    x < middle ? middle - clearance : middle + clearance;
  for (const chunk of [k - 1, k, k + 1]) {
    const crossing = crossingSite(seed, chunk);
    if (crossing) {
      const road = crossingWorldX(crossing);
      if (Math.abs(x - road) < POLE_ROAD_CLEARANCE_U)
        return aside(road, POLE_ROAD_CLEARANCE_U);
    }
    const bridge = bridgeSite(seed, chunk);
    if (bridge) {
      const stream = chunk * chunkWidthU + bridge.localXU;
      if (Math.abs(x - stream) < POLE_STREAM_CLEARANCE_U)
        return aside(stream, POLE_STREAM_CLEARANCE_U);
    }
  }
  return x;
}

/**
 * World x of the catenary poles in [fromX, toX), ascending (doc 03 §9):
 * every `catenaryPoleSpacingU` in one global phase, so any chunk's poles
 * are the same whichever range asks; a pole that would stand on a
 * crossing road or in a stream under a bridge moves just beside it. Pure: seed and x only.
 */
export function catenaryPoleXs(
  seed: number,
  fromX: number,
  toX: number,
): number[] {
  const poles: number[] = [];
  const first = Math.ceil(
    (fromX - POLE_STREAM_CLEARANCE_U) / catenaryPoleSpacingU,
  );
  for (
    let n = first;
    n * catenaryPoleSpacingU < toX + POLE_STREAM_CLEARANCE_U;
    n++
  ) {
    const x = poleX(seed, n * catenaryPoleSpacingU);
    if (x >= fromX && x < toX) poles.push(x);
  }
  return poles;
}

/**
 * Height (world, up) of the contact wire at world x: straight between
 * neighbouring poles, each holding it `catenaryContactHeightU` above its
 * rail. `railHeightU` gives the rail height at a world x.
 */
export function contactWireHeightU(
  seed: number,
  x: number,
  railHeightU: (x: number) => number,
): number {
  // Neighbours are at most a spacing apart plus a shift on each side.
  const reach = catenaryPoleSpacingU + 2 * POLE_STREAM_CLEARANCE_U;
  const near = catenaryPoleXs(seed, x - reach, x + reach);
  let left: number | undefined;
  let right: number | undefined;
  for (const pole of near) {
    if (pole <= x) left = pole;
    else if (right === undefined) right = pole;
  }
  if (left === undefined || right === undefined)
    throw new RangeError(`No catenary poles around x ${x}`);
  const t = (x - left) / (right - left);
  const a = railHeightU(left) + catenaryContactHeightU;
  const b = railHeightU(right) + catenaryContactHeightU;
  return a + (b - a) * t;
}
