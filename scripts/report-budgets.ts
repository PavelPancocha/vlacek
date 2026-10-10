import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const MiB = 1024 * 1024;

/**
 * Doc 13 `assetBudgets.initialTransferMiB`: the first usable menu and ride.
 * Until assets are loaded lazily, every built file counts as initial.
 */
export const INITIAL_TRANSFER_LIMIT_BYTES = 10 * MiB;

export interface BuiltFile {
  path: string;
  bytes: number;
  gzipBytes: number;
}

export function summarizeBudget(
  files: readonly BuiltFile[],
  limitBytes: number,
) {
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const totalGzipBytes = files.reduce((sum, file) => sum + file.gzipBytes, 0);
  return {
    totalBytes,
    totalGzipBytes,
    limitBytes,
    // Raw size is the conservative bound: not every host compresses.
    withinBudget: totalBytes <= limitBytes,
  };
}

function listFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

if (import.meta.main) {
  const dist = join(process.cwd(), 'dist');
  const files: BuiltFile[] = listFiles(dist).map((path) => {
    const content = readFileSync(path);
    return {
      path: relative(dist, path),
      bytes: content.byteLength,
      gzipBytes: gzipSync(content).byteLength,
    };
  });
  const kib = (bytes: number) => `${(bytes / 1024).toFixed(1)} KiB`;
  for (const file of files.sort((a, b) => b.bytes - a.bytes)) {
    console.log(
      `${kib(file.bytes).padStart(12)} ${kib(file.gzipBytes).padStart(12)} gzip  ${file.path}`,
    );
  }
  const summary = summarizeBudget(files, INITIAL_TRANSFER_LIMIT_BYTES);
  const line = `Initial transfer: ${kib(summary.totalBytes)} (gzip ${kib(summary.totalGzipBytes)}) of ${kib(summary.limitBytes)} budget`;
  if (summary.withinBudget) console.log(line);
  else {
    console.error(`${line} — OVER BUDGET`);
    process.exitCode = 1;
  }
}
