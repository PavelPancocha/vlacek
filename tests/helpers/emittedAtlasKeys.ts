import { expect } from 'vitest';

/** Adapter input: use the chunk's actual composition and renderer animation frame sets. */
export interface EmittedWorldArt {
  key: string;
  attachments?: readonly EmittedWorldArt[];
  animationFrames?: readonly string[];
}
export function assertEmittedAtlasKeys(
  reproduction: { seed: number; generatorVersion: number; chunkIndex: number },
  emitted: readonly EmittedWorldArt[],
  selectedKeys: readonly string[],
): void {
  const selected = new Set(selectedKeys);
  const missing = new Set<string>();
  const visit = (part: EmittedWorldArt) => {
    for (const key of [part.key, ...(part.animationFrames ?? [])])
      if (!selected.has(key)) missing.add(key);
    part.attachments?.forEach(visit);
  };
  emitted.forEach(visit);
  expect([...missing].sort(), JSON.stringify(reproduction)).toEqual([]);
}
