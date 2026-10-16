import { crossingSite } from './Crossings.ts';
import { unitRandom } from './Hash.ts';
import { TRACK_GENERATOR_VERSION } from './TrackProfile.ts';
import { sceneAt, templateById } from './WorldPlan.ts';

/** Interactive placeholder object of generator v0 (one per chunk, M0). */
export interface ChunkObject {
  /** Stable entity id `g0:chunk:<k>:object:<n>` (doc 04 §3). */
  id: string;
  chunkIndex: number;
  localXU: number;
}

export function chunkObjects(seed: number, chunkIndex: number): ChunkObject[] {
  const roll = unitRandom(seed, 1, 'object-position', chunkIndex);
  const crossing = crossingSite(seed, chunkIndex);
  const range = templateById(sceneAt(seed, chunkIndex * 1024).templateId)
    .animalX ?? [128, 896];
  const candidateXU = range[0] + (range[1] - range[0]) * roll;
  const localXU =
    crossing && Math.abs(candidateXU - crossing.localXU) < 120
      ? crossing.localXU + (candidateXU >= crossing.localXU ? 120 : -120)
      : candidateXU;
  return [
    {
      id: `g${TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:object:0`,
      chunkIndex,
      localXU,
    },
  ];
}

const ENTITY_ID = /^g\d+:chunk:(-?\d+):/;

export function chunkOfEntityId(id: string): number | undefined {
  const match = ENTITY_ID.exec(id);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}
