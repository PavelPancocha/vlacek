import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { formatBuildId, normalizeBasePath } from './scripts/build-info.ts';

function git(args: string[]): string | undefined {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

function packageVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
  );
  if (
    typeof manifest !== 'object' ||
    manifest === null ||
    !('version' in manifest) ||
    typeof manifest.version !== 'string'
  ) {
    throw new Error('package.json has no string version');
  }
  return manifest.version;
}

const ciCommit = process.env['GITHUB_SHA'];
const buildId = formatBuildId(
  packageVersion(),
  ciCommit ?? git(['rev-parse', 'HEAD']),
  { dirty: ciCommit === undefined && Boolean(git(['status', '--porcelain'])) },
);

export default defineConfig({
  base: normalizeBasePath(process.env['VLACEK_BASE']),
  // No SPA fallback: a missing asset must be a 404, never index.html (PWA-10).
  appType: 'mpa',
  define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    {
      name: 'vlacek-build-meta',
      transformIndexHtml: () => [
        {
          tag: 'meta',
          attrs: { name: 'vlacek-build', content: buildId },
          injectTo: 'head',
        },
      ],
    },
  ],
});
