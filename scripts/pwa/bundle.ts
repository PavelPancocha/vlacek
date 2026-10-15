import { createHash } from 'node:crypto';
import { normalizeBasePath } from '../build-info.ts';

export interface OutputFile {
  path: string;
  bytes: Uint8Array;
}
export interface PrecacheBundle {
  buildId: string;
  version: string;
  base: string;
  files: { url: string; sha256: string }[];
}

/** Build-output inventory, never a source catalog or a hand-maintained list. */
export function precacheBundle(
  files: readonly OutputFile[],
  base: string,
  buildId: string,
): PrecacheBundle {
  const normalizedBase = normalizeBasePath(base);
  const entries = files
    .filter(
      ({ path }) =>
        path !== 'sw.js' &&
        path !== 'precache.json' &&
        !path.endsWith('.map') &&
        !path.split('/').some((part) => part.startsWith('.')),
    )
    .map(({ path, bytes }) => ({
      url: normalizedBase + path.split('/').map(encodeURIComponent).join('/'),
      sha256: sha256(bytes),
    }))
    .sort((a, b) => a.url.localeCompare(b.url));
  const worker = files.find((file) => file.path === 'sw.js');
  const version = sha256(
    Buffer.from(
      JSON.stringify({
        buildId,
        base: normalizedBase,
        files: entries,
        worker: worker === undefined ? undefined : sha256(worker.bytes),
      }),
    ),
  ).slice(0, 16);
  return { buildId, version, base: normalizedBase, files: entries };
}

export function appManifest(base: string) {
  const scope = normalizeBasePath(base);
  return {
    name: 'Vláček',
    short_name: 'Vláček',
    id: scope,
    scope,
    start_url: scope,
    lang: 'cs',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
    theme_color: '#F5F1E8',
    background_color: '#F5F1E8',
    icons: [192, 512].flatMap((size) =>
      ['any', 'maskable'].map((purpose) => ({
        src: `${scope}icons/icon-${purpose === 'maskable' ? 'maskable-' : ''}${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose,
      })),
    ),
  };
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
