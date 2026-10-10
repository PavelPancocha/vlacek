import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  INITIAL_TRANSFER_LIMIT_BYTES,
  summarizeBudget,
} from '../../scripts/report-budgets.ts';

const MiB = 1024 * 1024;

describe('summarizeBudget', () => {
  it('uses the 10 MiB initial transfer budget from doc 13', () => {
    expect(INITIAL_TRANSFER_LIMIT_BYTES).toBe(10 * MiB);
  });

  it('sums raw and gzip sizes and compares the raw total to the limit', () => {
    const files = [
      { path: 'index.html', bytes: 500, gzipBytes: 300 },
      { path: 'assets/index.js', bytes: 2 * MiB, gzipBytes: MiB / 2 },
    ];
    expect(summarizeBudget(files, 3 * MiB)).toEqual({
      totalBytes: 2 * MiB + 500,
      totalGzipBytes: MiB / 2 + 300,
      limitBytes: 3 * MiB,
      withinBudget: true,
    });
    expect(summarizeBudget(files, 2 * MiB).withinBudget).toBe(false);
  });
});

describe('report:budgets CLI', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vlacek-budget-'));
    mkdirSync(join(dir, 'dist'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const script = resolve(
    import.meta.dirname,
    '../../scripts/report-budgets.ts',
  );

  it('fails when dist exceeds the budget and passes otherwise', () => {
    writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html>');
    const ok = spawnSync(process.execPath, [script], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('index.html');
    writeFileSync(join(dir, 'dist', 'huge.bin'), Buffer.alloc(10 * MiB + 1));
    const bad = spawnSync(process.execPath, [script], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(bad.status).toBe(1);
  });

  it('fails without a build', () => {
    rmSync(join(dir, 'dist'), { recursive: true });
    const result = spawnSync(process.execPath, [script], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
  });
});
