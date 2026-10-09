import type { StorageLike } from './SaveRepository.ts';

/** localStorage when the browser allows it; access itself may throw. */
export function browserStorage(): StorageLike | undefined {
  try {
    const storage = window.localStorage;
    storage.getItem('vlacek.probe');
    return storage;
  } catch {
    return undefined;
  }
}

/** Journey seed: crypto when available, otherwise a local fallback (doc 04 §3). */
export function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  } catch {
    return Math.floor(Math.random() * 0x100000000) >>> 0;
  }
}

/** Portrait orientation pauses the ride (doc 02 §9). */
export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}
