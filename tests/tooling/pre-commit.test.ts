import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';

let root: string;

function run(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
    env: {
      ...process.env,
      HUSKY: '1',
      GIT_CONFIG_GLOBAL: join(root, '.git', 'empty-global'),
      GIT_CONFIG_NOSYSTEM: '1',
    },
  });
}

function git(...args: string[]) {
  const result = run('git', args);
  expect(result.status, result.stderr + result.stdout).toBe(0);
  return result.stdout;
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'vlacek-hook-'));
  for (const file of [
    'package.json',
    '.gitignore',
    '.prettierrc.json',
    'lint-staged.config.mjs',
    'scripts',
    '.husky/pre-commit',
  ]) {
    cpSync(resolve(file), join(root, file), { recursive: true });
  }
  symlinkSync(resolve('node_modules'), join(root, 'node_modules'), 'dir');
  git('init', '--quiet');
  git('config', 'user.name', 'Hook test');
  git('config', 'user.email', 'hook-test@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  writeFileSync(join(root, 'README.md'), '# Fixture\n');
  git('add', '.');
  git('-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Fixture');
  const install = run(process.execPath, [resolve('node_modules/husky/bin.js')]);
  expect(install.status, install.stderr).toBe(0);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

it('commits only the staged portion and preserves unstaged edits', () => {
  const staged = '# Fixture\n\nStaged text.\n';
  const working = `${staged}\n[Unstaged broken link](missing.md)\n`;
  writeFileSync(join(root, 'README.md'), staged);
  git('add', 'README.md');
  writeFileSync(join(root, 'README.md'), working);
  git('commit', '--quiet', '-m', 'Staged text');
  expect(git('show', 'HEAD:README.md')).toBe(staged);
  expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe(working);
}, 30_000);

it('rejects broken staged links without modifying the index or working tree', () => {
  const broken = '# Fixture\n\n[Broken](missing.md)\n';
  writeFileSync(join(root, 'README.md'), broken);
  git('add', 'README.md');
  const before = git('rev-parse', 'HEAD');
  const result = run('git', ['commit', '--quiet', '-m', 'Must fail']);
  expect(result.status).not.toBe(0);
  expect(result.stdout + result.stderr).toContain('missing.md');
  expect(git('rev-parse', 'HEAD')).toBe(before);
  expect(git('show', ':README.md')).toBe(broken);
  expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe(broken);
}, 30_000);

it('handles a renamed document with spaces in its path', () => {
  git('mv', 'README.md', 'Project guide.md');
  writeFileSync(
    join(root, 'README.md'),
    '# Entry\n\n[Guide](<Project guide.md>)\n',
  );
  git('add', 'README.md');
  git('commit', '--quiet', '-m', 'Rename guide');
  expect(git('show', 'HEAD:Project guide.md')).toBe('# Fixture\n');
}, 30_000);
