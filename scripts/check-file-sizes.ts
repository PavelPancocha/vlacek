import { statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { listWorkingTreeFiles } from './repo-files.ts';

const MiB = 1024 * 1024;

/** Source, documentation and configuration files. */
export const DEFAULT_LIMIT_BYTES = 1 * MiB;
/** One game asset file, e.g. a 2048 × 2048 atlas (doc 07 §10). */
export const ASSET_LIMIT_BYTES = 4 * MiB;

export interface FileSize {
  path: string;
  bytes: number;
}

export function sizeLimitFor(path: string): number {
  return path.split(sep).join('/').startsWith('public/assets/')
    ? ASSET_LIMIT_BYTES
    : DEFAULT_LIMIT_BYTES;
}

export function oversizedFiles(
  files: readonly FileSize[],
): (FileSize & { limitBytes: number })[] {
  return files
    .map((file) => ({ ...file, limitBytes: sizeLimitFor(file.path) }))
    .filter((file) => file.bytes > file.limitBytes);
}

if (import.meta.main) {
  const root = process.cwd();
  const paths =
    process.argv.length > 2
      ? process.argv.slice(2).map((file) => relative(root, resolve(root, file)))
      : listWorkingTreeFiles(root);
  const sizes: FileSize[] = [];
  for (const path of paths) {
    try {
      const stat = statSync(resolve(root, path));
      if (stat.isFile()) sizes.push({ path, bytes: stat.size });
    } catch {
      // A deleted or renamed file has nothing left to measure.
    }
  }
  const violations = oversizedFiles(sizes);
  for (const file of violations) {
    console.error(
      `${file.path}: ${file.bytes} B exceeds the ${file.limitBytes} B limit`,
    );
  }
  if (violations.length > 0) process.exitCode = 1;
  else console.log(`Checked sizes of ${sizes.length} files`);
}
