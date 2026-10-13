import type { DevOptions } from './DevOptions.ts';
import type { Settings } from './SaveValidation.ts';

/** Renderer resolved from the page URL and developer store; `auto` = WebGL with Canvas fallback. */
export type RendererPreference = 'auto' | 'canvas';

export function rendererPreference(
  search: string,
  stored?: DevOptions,
): RendererPreference {
  const value = new URLSearchParams(search).get('renderer');
  return value === 'canvas' || value === 'auto'
    ? value
    : (stored?.renderer ?? 'auto');
}

/** Diagnostics are opt-in via the URL or parent gate, never in the child UI. */
export function debugEnabled(search: string, stored?: DevOptions): boolean {
  const value = new URLSearchParams(search).get('debug');
  return value === '1'
    ? true
    : value === '0'
      ? false
      : (stored?.debug ?? false);
}

/**
 * World seed pinned by the page URL (`?seed=123`) or developer store: new journeys start in
 * that world so a layout can be replayed (doc 04 §11). Anything that is not
 * a plain decimal in the non-negative 32-bit range (doc 04 §3) is ignored.
 */
export function seedOverride(
  search: string,
  stored?: DevOptions,
): number | undefined {
  const value = new URLSearchParams(search).get('seed');
  if (value === null || !/^\d{1,10}$/.test(value)) return stored?.seed;
  const seed = Number(value);
  return seed <= 0xffffffff ? seed : stored?.seed;
}

/** Page-load quality resolved from the URL and saved setting; never writes the saved setting. */
export function qualityOverride(
  search: string,
  stored?: Settings['quality'],
): Settings['quality'] | undefined {
  const value = new URLSearchParams(search).get('quality');
  return value === 'auto' || value === 'standard' || value === 'low'
    ? value
    : stored;
}

/** Keep the deployment path, fragment and every unrelated query parameter. */
export function devReloadUrl(href: string): string {
  const url = new URL(href);
  for (const key of ['debug', 'renderer', 'quality', 'seed'])
    url.searchParams.delete(key);
  return url.href;
}
