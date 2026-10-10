import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ASSET_LIMIT_BYTES,
  DEFAULT_LIMIT_BYTES,
  oversizedFiles,
  sizeLimitFor,
} from '../../scripts/check-file-sizes.ts';
import { fakePrivateKey } from './fake-secrets.ts';

const repo = resolve(import.meta.dirname, '../..');
const MiB = 1024 * 1024;

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'vlacek-guards-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('file size limits', () => {
  it('derives a larger limit only for game assets', () => {
    expect(DEFAULT_LIMIT_BYTES).toBe(1 * MiB);
    expect(ASSET_LIMIT_BYTES).toBe(4 * MiB);
    expect(sizeLimitFor('src/main.ts')).toBe(DEFAULT_LIMIT_BYTES);
    expect(sizeLimitFor('public/assets/vehicles.png')).toBe(ASSET_LIMIT_BYTES);
    expect(sizeLimitFor('docs/public/assets/x.png')).toBe(DEFAULT_LIMIT_BYTES);
  });

  it('reports only files above their limit', () => {
    expect(
      oversizedFiles([
        { path: 'big.bin', bytes: MiB + 1 },
        { path: 'ok.bin', bytes: MiB },
        { path: 'public/assets/atlas.png', bytes: 3 * MiB },
        { path: 'public/assets/huge.png', bytes: 4 * MiB + 1 },
      ]),
    ).toEqual([
      { path: 'big.bin', bytes: MiB + 1, limitBytes: MiB },
      {
        path: 'public/assets/huge.png',
        bytes: 4 * MiB + 1,
        limitBytes: 4 * MiB,
      },
    ]);
  });

  it('fails the CLI for an oversized file and passes a small one', () => {
    writeFileSync(join(dir, 'big file.bin'), Buffer.alloc(MiB + 1));
    writeFileSync(join(dir, 'small.txt'), 'ok');
    const script = join(repo, 'scripts/check-file-sizes.ts');
    const bad = spawnSync(process.execPath, [script, 'big file.bin'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('big file.bin');
    const good = spawnSync(process.execPath, [script, 'small.txt'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(good.status, good.stderr).toBe(0);
  });
});

describe('secret scanning', () => {
  function secretlint(file: string) {
    return spawnSync(
      join(repo, 'node_modules/.bin/secretlint'),
      ['--no-glob', '--secretlintrc', join(repo, '.secretlintrc.json'), file],
      { cwd: dir, encoding: 'utf8' },
    );
  }

  it('rejects a private key and masks it in the report', () => {
    writeFileSync(join(dir, 'leak.txt'), `token:\n${fakePrivateKey()}`);
    const result = secretlint('leak.txt');
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('leak.txt');
    expect(result.stdout + result.stderr).not.toContain('MIIEowIBAAKCAQEA');
  });

  it('accepts ordinary source text', () => {
    writeFileSync(join(dir, 'clean.ts'), 'export const speedUPerSec = 180;\n');
    expect(secretlint('clean.ts').status).toBe(0);
  });
});
