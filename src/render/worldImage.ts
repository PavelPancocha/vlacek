import type Phaser from 'phaser';
import type { ArtPart } from '../content/artManifest.ts';
import { isBackdropPart, worldParts } from '../content/worldArt.ts';
import { frameOrigin } from './atlasPacking.ts';

interface PivotU {
  x: number;
  y: number;
}

/**
 * Origin of a world image from an authored pivot in u (an anchor, or a
 * mirrored pivot) against its current frame. The pivot is recorded, so a late
 * page publication recalibrates the image with it, not with the catalogue
 * pivot (D-030).
 */
export function setWorldPivot(
  image: Phaser.GameObjects.Image,
  pivotU: PivotU,
  pxPerU: number,
): Phaser.GameObjects.Image {
  const origin = frameOrigin(pivotU, pxPerU, image.frame);
  return image
    .setData('world-pivot', { x: pivotU.x, y: pivotU.y })
    .setOrigin(origin.x, origin.y);
}

function isPivot(value: unknown): value is PivotU {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<PivotU>).x === 'number' &&
    typeof (value as Partial<PivotU>).y === 'number'
  );
}

/**
 * Moves an existing world image to the published page. An image drawn while
 * its frame was missing gets its origin again from its recorded authored
 * pivot (`setWorldPivot`), otherwise from the catalogue pivot.
 */
export function rebindWorldImage(
  image: Phaser.GameObjects.Image,
  textureFor: (frame: string) => string | undefined,
  pxPerU: number,
): void {
  const expected: unknown = image.getData('world-part');
  if (typeof expected !== 'string' || isBackdropPart(expected)) return;
  const wasMissing = image.frame.name !== expected;
  const texture = textureFor(expected);
  if (texture) {
    image.setTexture(texture, expected);
    if (wasMissing) {
      const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;
      const authored: unknown = image.getData('world-pivot');
      const pivot = isPivot(authored) ? authored : parts[expected]?.pivotU;
      if (pivot) {
        const origin = frameOrigin(pivot, pxPerU, image.frame);
        image.setOrigin(origin.x, origin.y);
      }
    }
  } else image.setTexture('object-sheep');
}
