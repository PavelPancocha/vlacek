import { chunkOfEntityId } from './ChunkObjects.ts';
import { chunkScenery } from './Scenery.ts';
import type { PlacementCatalog } from './SceneryGeometry.ts';
export interface PlacementTraceEntry {
  candidate: {
    id: string;
    kind: string | undefined;
    worldXU: number;
    layer: 'back' | 'near';
    depth: number | undefined;
    attempt: number;
  };
  admissible: readonly string[];
  rejectionCode:
    | 'spacing'
    | 'animal-clearance'
    | 'no-admissible-kind'
    | 'accepted'
    | 'outside-chunk'
    | 'context'
    | 'collision'
    | 'missing-dependency'
    | 'surface';
  conflictingReservation: string | undefined;
  missingDependency: string | undefined;
}
/** Rebuild only the requested chunk; observation never advances layout randomness. */
export function traceChunkPlacement(
  seed: number,
  k: number,
  catalog: PlacementCatalog,
  query?: string | number,
): PlacementTraceEntry[] {
  const entries: PlacementTraceEntry[] = [];
  chunkScenery(seed, k, catalog, entries);
  return entries.filter(
    (e) =>
      query === undefined ||
      (typeof query === 'string'
        ? e.candidate.id === query
        : Math.abs(e.candidate.worldXU - query) <= 128),
  );
}
export function placementQuery(
  input: string,
  headWorldXU: number,
): { chunkIndex: number; query: string | number } | undefined {
  const value = input.trim();
  const numeric = value === '' ? headWorldXU : Number(value);
  if (Number.isFinite(numeric) && Number.isSafeInteger(Math.trunc(numeric)))
    return { chunkIndex: Math.floor(numeric / 1024), query: numeric };
  const chunkIndex = chunkOfEntityId(value);
  return chunkIndex !== undefined &&
    Number.isSafeInteger(chunkIndex * 1024) &&
    value.length <= 160
    ? { chunkIndex, query: value }
    : undefined;
}
