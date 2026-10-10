import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve(import.meta.dirname, '../..');
const script = resolve(repo, 'scripts/validate-assets.ts');

describe('validate:assets', () => {
  it('accepts the shipped catalog and its art', () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(
      /11 vehicles valid \(11 with art, 37 art parts\), 144 world parts, 0 placeholders/,
    );
  });

  it('passes a release check: no placeholder vehicle is left', () => {
    const result = spawnSync(process.execPath, [script, '--release'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
  });
});
