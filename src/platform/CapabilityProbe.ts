/** Renderer requested by the page URL; `auto` = WebGL with Canvas fallback. */
export type RendererPreference = 'auto' | 'canvas';

export function rendererPreference(search: string): RendererPreference {
  return new URLSearchParams(search).get('renderer') === 'canvas'
    ? 'canvas'
    : 'auto';
}

/** Developer diagnostics are opt-in via `?debug=1`, never in the child UI. */
export function debugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/**
 * World seed pinned by the page URL (`?seed=123`): new journeys start in
 * that world so a layout can be replayed (doc 04 §11). Anything that is not
 * a plain decimal in the non-negative 32-bit range (doc 04 §3) is ignored.
 */
export function seedOverride(search: string): number | undefined {
  const value = new URLSearchParams(search).get('seed');
  if (value === null || !/^\d{1,10}$/.test(value)) return undefined;
  const seed = Number(value);
  return seed <= 0xffffffff ? seed : undefined;
}
