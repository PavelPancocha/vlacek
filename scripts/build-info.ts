/**
 * Build identity and deployment base path shared by the Vite build.
 * The build ID is SemVer build metadata: `<version>+<commit7>[.dirty]`.
 */
export function formatBuildId(
  version: string,
  commit: string | undefined,
  options: { dirty?: boolean } = {},
): string {
  const revision = commit ? commit.slice(0, 7) : 'nogit';
  return `${version}+${revision}${options.dirty ? '.dirty' : ''}`;
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Normalises the public base path (`/` or `/project/`) used for every asset
 * URL. Rejects absolute URLs, traversal and characters that need escaping.
 */
export function normalizeBasePath(raw: string | undefined): string {
  const segments = (raw ?? '').split('/').filter((part) => part !== '');
  for (const segment of segments) {
    if (!SAFE_SEGMENT.test(segment) || segment === '.' || segment === '..') {
      throw new Error(`Invalid base path: ${JSON.stringify(raw)}`);
    }
  }
  return segments.length === 0 ? '/' : `/${segments.join('/')}/`;
}
