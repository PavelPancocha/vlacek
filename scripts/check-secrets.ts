import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { listWorkingTreeFiles } from './repo-files.ts';

// Scans every tracked and untracked, non-ignored file, including dotfiles,
// which a `**/*` glob would skip. Runs offline; secrets are masked.
const root = process.cwd();
const files = listWorkingTreeFiles(root);
if (files.length === 0) throw new Error('No files to scan');
const result = spawnSync(
  resolve(root, 'node_modules/.bin/secretlint'),
  ['--no-glob', ...files],
  { cwd: root, stdio: 'inherit' },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
else console.log(`Scanned ${files.length} files for secrets`);
