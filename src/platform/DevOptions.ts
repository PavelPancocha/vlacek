import type { RendererPreference } from './CapabilityProbe.ts';
import type { StorageLike } from './SaveRepository.ts';

export const DEV_KEY = 'vlacek.dev.v1';
export interface DevOptions {
  debug: boolean;
  perfGraph?: boolean;
  renderer: RendererPreference;
  seed: number | undefined;
}
export const defaultDevOptions: DevOptions = {
  debug: false,
  perfGraph: false,
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
      perfGraph: 'perfGraph' in raw && raw.perfGraph === true,
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
        perfGraph: options.perfGraph ?? false,
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

/** Valid URL wins; invalid or absent input falls back to the hidden menu setting. */
export function perfGraphEnabled(search: string, stored: DevOptions): boolean {
  const value = new URLSearchParams(search).get('perfgraph');
  return value === '1'
    ? true
    : value === '0'
      ? false
      : stored.perfGraph === true;
}

/** Used together with devReloadUrl: applying hidden options releases the graph URL override. */
export function perfReloadUrl(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('perfgraph');
  return url.href;
}
