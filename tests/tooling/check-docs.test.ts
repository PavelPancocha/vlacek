import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { brokenLocalLinks } from '../../scripts/check-docs.ts';

describe('local Markdown link validation', () => {
  let root: string;
  let source: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vlacek-docs-'));
    mkdirSync(join(root, 'docs'));
    source = join(root, 'docs', 'README.md');
    writeFileSync(join(root, 'existing file.md'), '# Existing');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('reports missing inline links and images, including nested and reference links', () => {
    const markdown =
      '[one](missing.md)\n- [two](other.md)\n> ![image](image.png)\n[ref][target]\n\n[target]: reference.md';
    expect(brokenLocalLinks(markdown, source, root)).toEqual([
      'missing.md',
      'other.md',
      'image.png',
      'reference.md',
    ]);
  });

  it('resolves relative, root-relative, encoded and angle-bracket paths and strips queries/fragments', () => {
    const markdown =
      '[one](../existing%20file.md?raw=1#existing)\n[two](</existing file.md>)\n[dir](../docs/)';
    expect(brokenLocalLinks(markdown, source, root)).toEqual([]);
  });

  it('ignores external URLs, same-page anchors and code examples', () => {
    const markdown =
      '[web](https://example.com) [mail](mailto:a@example.com) [cdn](//example.com/a) [heading](#title)\n`[code](missing.md)`\n\n```md\n[fenced](missing.md)\n```';
    expect(brokenLocalLinks(markdown, source, root)).toEqual([]);
  });

  it('reports malformed URL encoding without crashing the checker', () => {
    expect(brokenLocalLinks('[bad](bad%ZZ.md)', source, root)).toEqual([
      'bad%ZZ.md',
    ]);
  });

  it('the CLI fails with source and target diagnostics for a missing local file', () => {
    execFileSync('git', ['init', '--quiet', root]);
    writeFileSync(source, '[missing](missing.md)');
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('../../scripts/check-docs.ts', import.meta.url))],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('docs/README.md: missing.md');
  });

  it('the CLI checks untracked documents and fails after a referenced target is removed', () => {
    execFileSync('git', ['init', '--quiet', root]);
    writeFileSync(source, '[existing](../existing%20file.md)');
    const command = [
      fileURLToPath(new URL('../../scripts/check-docs.ts', import.meta.url)),
    ];
    expect(spawnSync(process.execPath, command, { cwd: root }).status).toBe(0);
    rmSync(join(root, 'existing file.md'));
    expect(spawnSync(process.execPath, command, { cwd: root }).status).toBe(1);
  });

  it('allows deleting an unreferenced tracked document before staging the deletion', () => {
    execFileSync('git', ['init', '--quiet', root]);
    writeFileSync(source, '# Removed guide');
    execFileSync('git', ['add', '.'], { cwd: root });
    rmSync(source);
    const result = spawnSync(
      process.execPath,
      [fileURLToPath(new URL('../../scripts/check-docs.ts', import.meta.url))],
      {
        cwd: root,
        encoding: 'utf8',
      },
    );
    expect(result.status, result.stderr).toBe(0);
  });
});
