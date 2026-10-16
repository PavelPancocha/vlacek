import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { appManifest, precacheBundle } from '../../../scripts/pwa/bundle.ts';
const file = (path: string, text = path) => ({
  path,
  bytes: Buffer.from(text),
});

describe('PWA-09 build inventory', () => {
  it('covers every runtime output including lazy MP3, icons and credits under the base', () => {
    const paths = [
      'index.html',
      'assets/game-A.js',
      'assets/style.css',
      'assets/new.svg',
      'assets/lazy.mp3',
      'icons/icon-192.png',
      'credits.txt',
      'manifest.webmanifest',
    ];
    const bundle = precacheBundle(
      paths.map((path) => file(path)),
      '/vlacek/',
      '0.1.0+1234567',
    );
    expect(bundle.files.map((entry) => entry.url).sort()).toEqual(
      paths.map((path) => `/vlacek/${path}`).sort(),
    );
    expect(
      bundle.files.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256)),
    ).toBe(true);
  });
  it('excludes worker, generated inventory, source maps and deployment metadata', () => {
    const bundle = precacheBundle(
      [
        'index.html',
        'sw.js',
        'precache.json',
        'assets/game.js.map',
        '.nojekyll',
      ].map((path) => file(path)),
      '/',
      'test',
    );
    expect(bundle.files.map((entry) => entry.url)).toEqual(['/index.html']);
  });
  it('changes cache identity when only the worker implementation changes', () => {
    const before = precacheBundle(
      [file('index.html'), file('sw.js', 'old worker')],
      '/',
      'same-build',
    );
    const after = precacheBundle(
      [file('index.html'), file('sw.js', 'new worker')],
      '/',
      'same-build',
    );
    expect(after.version).not.toBe(before.version);
    expect(after.files).toEqual(before.files);
  });
  it('versioning is deterministic, includes base and build ID, and changes with any output bytes', () => {
    const files = [file('index.html'), file('assets/x.mp3')];
    const bundle = precacheBundle(files, '/', 'old');
    expect(bundle.version).toMatch(/^[a-f0-9]{16}$/);
    expect(precacheBundle([...files].reverse(), '/', 'old')).toEqual(bundle);
    expect(precacheBundle(files, '/vlacek', 'old').version).not.toBe(
      bundle.version,
    );
    expect(precacheBundle(files, '/', 'new').version).not.toBe(bundle.version);
    expect(
      precacheBundle(
        [file('index.html', 'changed'), file('assets/x.mp3')],
        '/',
        'old',
      ).version,
    ).not.toBe(bundle.version);
  });
});

describe('PWA manifest', () => {
  for (const base of ['/', '/vlacek/'])
    it(`has the required fields, real icons and paths under ${base}`, () => {
      const manifest = appManifest(base);
      expect(manifest).toMatchObject({
        name: 'Vláček',
        short_name: 'Vláček',
        id: base,
        start_url: base,
        scope: base,
        lang: 'cs',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        theme_color: '#F5F1E8',
        background_color: '#F5F1E8',
      });
      expect(manifest.icons).toHaveLength(4);
      for (const icon of manifest.icons) {
        expect(icon.src.startsWith(base)).toBe(true);
        expect(icon.type).toBe('image/png');
        expect(['any', 'maskable']).toContain(icon.purpose);
        const path = resolve('public', icon.src.slice(base.length));
        expect(existsSync(path)).toBe(true);
        const png = readFileSync(path);
        const size = Number(icon.sizes.split('x')[0]);
        expect(png.readUInt32BE(16)).toBe(size);
        expect(png.readUInt32BE(20)).toBe(size);
      }
    });
});
