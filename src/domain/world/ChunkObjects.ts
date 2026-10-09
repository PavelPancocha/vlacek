import { unitRandom } from './Hash.ts';
import { TEST_TRACK_GENERATOR_VERSION } from './TrackProfile.ts';

/** Interactive placeholder object of generator v0 (one per chunk, M0). */
export interface ChunkObject {
  /** Stable entity id `g0:chunk:<k>:object:<n>` (doc 04 §3). */
  id: string;
  chunkIndex: number;
  localXU: number;
}

export function chunkObjects(seed: number, chunkIndex: number): ChunkObject[] {
  const roll = unitRandom(
    seed,
    TEST_TRACK_GENERATOR_VERSION,
    'object-position',
    chunkIndex,
  );
  return [
    {
      id: `g${TEST_TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:object:0`,
      chunkIndex,
      localXU: 128 + 768 * roll,
    },
  ];
}

const ENTITY_ID = /^g\d+:chunk:(-?\d+):/;

export function chunkOfEntityId(id: string): number | undefined {
  const match = ENTITY_ID.exec(id);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}
