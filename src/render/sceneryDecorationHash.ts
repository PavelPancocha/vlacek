import { hash32 } from '../domain/world/Hash.ts';

/** Static baked details keyed by a clipped surface's finite world-unit coordinate. */
export function sceneryDecorationHash(
  kind: string,
  chunkIndex: number,
  fromXU: number,
  index: number,
): number {
  if (!Number.isFinite(fromXU))
    throw new RangeError('non-finite baked decoration coordinate');
  // Keep existing integer seeds exactly; clipped channels can have fractional banks.
  const coordinate = Number.isSafeInteger(fromXU) ? fromXU : `u:${fromXU}`;
  return hash32(kind, chunkIndex, coordinate, index);
}
