import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import type { Plugin } from 'vite';
import { appManifest, precacheBundle } from './bundle.ts';

export function pwaPlugin(base: string, buildId: string): Plugin {
  return {
    name: 'vlacek-offline-bundle',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url !== `${base}manifest.webmanifest`) return next();
        response.setHeader('Content-Type', 'application/manifest+json');
        response.end(JSON.stringify(appManifest(base)));
      });
    },
    generateBundle() {
      const credits = [
        '../../assets/SOURCES.md',
        '../../THIRD_PARTY_NOTICES.md',
      ]
        .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
        .join('\n\n');
      this.emitFile({
        type: 'asset',
        fileName: 'credits.txt',
        source: credits,
      });
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(appManifest(base), null, 2),
      });
    },
    writeBundle(options) {
      if (!options.dir)
        throw new Error('PWA requires a build output directory');
      const dir = options.dir;
      const files = readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => {
          const fullPath = join(entry.parentPath, entry.name);
          const path = fullPath.slice(dir.length + 1).replaceAll('\\', '/');
          return { path, bytes: readFileSync(fullPath) };
        });
      const source = readFileSync(
        new URL('../../src/service-worker/worker.ts', import.meta.url),
        'utf8',
      );
      const bundle = precacheBundle(
        [...files, { path: 'sw.js', bytes: Buffer.from(source) }],
        base,
        buildId,
      );
      const worker = transpileModule(source, {
        compilerOptions: {
          target: ScriptTarget.ES2022,
          module: ModuleKind.None,
        },
      }).outputText;
      writeFileSync(
        join(dir, 'precache.json'),
        JSON.stringify(bundle, null, 2),
      );
      writeFileSync(
        join(dir, 'sw.js'),
        `const __PRECACHE__ = ${JSON.stringify(bundle)};\n${worker}`,
      );
    },
  };
}
