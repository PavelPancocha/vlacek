import {
  ANIMAL_HOP_U,
  ANIMAL_SCALE,
  NEAR_DEPTH_RANGE_U,
  NEAR_PROP_MAX_HEIGHT_U,
  nearDepthScale,
} from '../domain/world/Scenery.ts';

/** Where and how large an interactive animal is drawn. */
export interface AnimalPlacement {
  /** Near depth of its foot. */
  depth: number;
  /** 0 … 1: share of the full drawing size (ANIMAL_SCALE) and hop. */
  fit: number;
}

/**
 * Draws an animal at its generated depth, raised so its foot stays above
 * the controls in the bottom corners (`freeDepth`, doc 02: a tap on the
 * brake never reaches an object under it). Where that band is too thin
 * for the full size (a phone held sideways), the animal is drawn smaller,
 * hop included, so it still stays below the train under the same cap as
 * the near props. Where even the bank foot is among the controls (a small
 * phone), it is left out: undefined.
 */
export function placeAnimal(
  depth: number,
  heightU: number,
  freeDepth: number,
): AnimalPlacement | undefined {
  // The controls reach above the bank foot: no place is free of them.
  if (freeDepth < 0) return undefined;
  const at = Math.min(depth, freeDepth);
  const reach = heightU * ANIMAL_SCALE * nearDepthScale(at) + ANIMAL_HOP_U;
  const cap = NEAR_PROP_MAX_HEIGHT_U + at * NEAR_DEPTH_RANGE_U;
  return { depth: at, fit: Math.min(1, cap / reach) };
}
