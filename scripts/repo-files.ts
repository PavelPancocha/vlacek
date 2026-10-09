import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tracked and untracked, non-ignored files that currently exist in the
 * working tree (deleted tracked files are skipped), relative to `root`.
 */
export function listWorkingTreeFiles(root: string): string[] {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: root, encoding: 'utf8' },
  );
  return [...new Set(output.split('\0'))].filter((file) => {
    if (!file) return false;
    try {
      return statSync(resolve(root, file)).isFile();
    } catch {
      return false;
    }
  });
}
