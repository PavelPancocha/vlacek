import type { RendererPreference } from './CapabilityProbe.ts';
import type { StorageLike } from './SaveRepository.ts';

export const DEV_KEY = 'vlacek.dev.v1';
export interface DevOptions {
  debug: boolean;
  renderer: RendererPreference;
  seed: number | undefined;
}
export const defaultDevOptions: DevOptions = {
  debug: false,
  renderer: 'auto',
  seed: undefined,
};

/** Untrusted local JSON; unavailable storage leaves the ordinary defaults. */
export function readDevOptions(storage: StorageLike | undefined): DevOptions {
  try {
    const raw: unknown = JSON.parse(storage?.getItem(DEV_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      return { ...defaultDevOptions };
    const debug = 'debug' in raw ? raw.debug : undefined;
    const renderer = 'renderer' in raw ? raw.renderer : undefined;
    const seed = 'seed' in raw ? raw.seed : undefined;
    return {
      debug: debug === true,
      renderer: renderer === 'canvas' ? 'canvas' : 'auto',
      seed:
        typeof seed === 'number' &&
        Number.isInteger(seed) &&
        seed >= 0 &&
        seed <= 0xffffffff
          ? seed
          : undefined,
    };
  } catch {
    return { ...defaultDevOptions };
  }
}

export function writeDevOptions(
  storage: StorageLike | undefined,
  options: DevOptions,
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(
      DEV_KEY,
      JSON.stringify({
        debug: options.debug,
        renderer: options.renderer,
        seed: options.seed,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearDevOptions(storage: StorageLike | undefined): boolean {
  if (!storage) return false;
  try {
    storage.removeItem(DEV_KEY);
    return true;
  } catch {
    return false;
  }
}
