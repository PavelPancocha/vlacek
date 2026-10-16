import { createServer } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { precacheBundle } from '../../scripts/pwa/bundle.ts';

/** Real production files under their built base; only release identity changes. */
export async function pwaServer() {
  const dir = resolve('dist');
  const original = new Map(
    readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const path = join(entry.parentPath, entry.name);
        return [path.slice(dir.length + 1), readFileSync(path)] as const;
      }),
  );
  const html = original.get('index.html')?.toString();
  const build = html?.match(/name="vlacek-build" content="([^"]+)"/)?.[1];
  if (!build) throw new Error('built identity missing');
  const base =
    original
      .get('manifest.webmanifest')
      ?.toString()
      .match(/"scope":\s*"([^"]+)"/)?.[1] ?? '/';
  const files = original;
  const svgPaths = [...files.keys()]
    .filter((path) => path.endsWith('.svg'))
    .sort();
  const interruptedPath = svgPaths[Math.floor(svgPaths.length / 2)];
  let release = 1;
  let failAsset = false;
  const source = original
    .get('sw.js')
    ?.toString()
    .split('\n')
    .slice(1)
    .join('\n');
  if (!source) throw new Error('built worker missing');
  const prepare = () => {
    const id = release === 1 ? build : `${build}-update-${release}`;
    const current = new Map(
      [...files].map(([key, bytes]) => [
        key,
        /\.(html|js)$/.test(key)
          ? Buffer.from(bytes.toString().replaceAll(build, id))
          : bytes,
      ]),
    );
    const bundle = precacheBundle(
      [...current].map(([path, bytes]) => ({ path, bytes })),
      base,
      id,
    );
    return {
      current,
      bundle,
      worker: `const __PRECACHE__ = ${JSON.stringify(bundle)};\n${source}`,
    };
  };
  let prepared = prepare();
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname.slice(
      base.length,
    );
    if (path === '__pwa_test_bootstrap__.html') {
      response.setHeader('Content-Type', 'text/html');
      response.end(
        '<!doctype html><meta charset="utf-8"><title>PWA lifecycle fixture</title>',
      );
      return;
    }
    const extension = (path || 'index.html').split('.').at(-1);
    const types: Record<string, string> = {
      html: 'text/html',
      js: 'text/javascript',
      css: 'text/css',
      svg: 'image/svg+xml',
      png: 'image/png',
      webmanifest: 'application/manifest+json',
      json: 'application/json',
    };
    const type = types[extension ?? ''];
    response.setHeader('Content-Type', type ?? 'text/plain');
    response.setHeader('Cache-Control', 'no-store');
    if (path === 'sw.js') response.end(prepared.worker);
    else if (path === 'precache.json')
      response.end(JSON.stringify(prepared.bundle));
    else if (failAsset && path === interruptedPath) {
      response.statusCode = 503;
      response.end('Interrupted download');
    } else {
      const bytes = prepared.current.get(path || 'index.html');
      response.statusCode = bytes ? 200 : 404;
      response.end(bytes ?? 'Not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, 'localhost', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('server port missing');
  return {
    url: `http://localhost:${address.port}${base}`,
    build,
    update: (fail = false) => {
      release++;
      failAsset = fail;
      prepared = prepare();
      return `${build}-update-${release}`;
    },
    rollback: (fail = false) => {
      release = 1;
      failAsset = fail;
      prepared = prepare();
    },
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}
