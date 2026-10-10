import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve(import.meta.dirname, '../..');
const script = resolve(repo, 'scripts/validate-assets.ts');

describe('validate:assets', () => {
  it('accepts the shipped catalog and art during development and lists placeholders', () => {
    const result = spawnSync(process.execPath, [script], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(
      /10 vehicles valid \(1 with art, 7 art parts\), 9 placeholders/,
    );
  });

  it('refuses placeholders in a release check', () => {
    const result = spawnSync(process.execPath, [script, '--release'], {
      cwd: repo,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('diesel_mainline: placeholder');
    expect(result.stderr).not.toContain('steam_local');
  });
});
