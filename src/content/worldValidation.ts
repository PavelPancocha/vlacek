import type { ArtPart } from './artManifest.ts';
import { partFileErrors } from './artValidation.ts';

export interface WorldValidationInput {
  parts: Readonly<Record<string, ArtPart>>;
  /** SVG text by file name: every file in `assets/world/`. */
  files: ReadonlyMap<string, string>;
  /** Part keys the renderer or the world generator refers to. */
  usedKeys: readonly string[];
}

/**
 * World art contract (CNT-02, D-011): the part files exist at their size in
 * u, the folder holds nothing else, and every part is used.
 */
export function validateWorldArt(input: WorldValidationInput): string[] {
  const used = new Set(input.usedKeys);
  return [
    ...partFileErrors(input.parts, input.files),
    ...Object.keys(input.parts)
      .filter((key) => !used.has(key))
      .map((key) => `${key}: not used`),
  ];
}
