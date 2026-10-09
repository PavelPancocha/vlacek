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
