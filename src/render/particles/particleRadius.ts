import type { ParticleField, Particle } from './ParticleField.ts';
import type { ArtPart } from '../../content/artManifest.ts';
import { worldParts } from '../../content/worldArt.ts';
const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;
/** Circumscribed radius of the drawn frame, including rotation and long rain strokes. */
export function particleRadiusU(
  field: ParticleField,
  particle: Particle,
): number {
  const frame = field.frameOf(particle),
    part = frame === undefined ? undefined : parts[frame];
  const width = field.sizeOf(particle);
  return (
    Math.hypot(width, part ? (width * part.heightU) / part.widthU : width) / 2
  );
}
