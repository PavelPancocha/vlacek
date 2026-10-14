import { swayAmplitudeRad } from '../render/ambientMotion.ts';
import { worldParts } from './worldArt.ts';
import type {
  PlacementCatalog,
  PlacementPart,
} from '../domain/world/SceneryGeometry.ts';

/** Numerical trust boundary: domain receives validated dimensions, never content imports. */
export function placementCatalog(
  parts: Readonly<
    Record<
      string,
      { widthU: number; heightU: number; pivotU: { x: number; y: number } }
    >
  >,
): PlacementCatalog {
  const result: Record<string, PlacementPart> = {};
  for (const [key, part] of Object.entries(parts)) {
    const { widthU, heightU, pivotU } = part;
    if (
      ![widthU, heightU, pivotU.x, pivotU.y].every(Number.isFinite) ||
      widthU <= 0 ||
      heightU <= 0 ||
      pivotU.x < 0 ||
      pivotU.x > widthU ||
      pivotU.y < 0 ||
      pivotU.y > heightU
    )
      throw new Error(`invalid placement art ${key}`);
    result[key] = Object.freeze({
      widthU,
      heightU,
      pivotU: Object.freeze({ xU: pivotU.x, yU: pivotU.y }),
      swayRad: swayAmplitudeRad(key),
      contactWidth: key.startsWith('tree.') ? 0.18 : 1,
    });
  }
  return Object.freeze(result);
}
export const worldPlacementCatalog = placementCatalog(worldParts);
