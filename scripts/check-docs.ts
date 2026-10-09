import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';
import { listWorkingTreeFiles } from './repo-files.ts';

export function brokenLocalLinks(
  markdown: string,
  sourcePath: string,
  root: string,
): string[] {
  const broken: string[] = [];
  void marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type !== 'link' && token.type !== 'image') return;
    if (typeof token.href !== 'string') return;
    const target = token.href;
    if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) return;

    let path: string;
    try {
      path = decodeURIComponent(target.split(/[?#]/)[0] ?? '');
    } catch {
      broken.push(target);
      return;
    }
    const absolute = path.startsWith('/')
      ? resolve(root, `.${path}`)
      : resolve(dirname(sourcePath), path);
    if (!existsSync(absolute)) broken.push(target);
  });
  return broken;
}

if (import.meta.main) {
  const root = process.cwd();
  const files = listWorkingTreeFiles(root).filter((file) =>
    file.toLowerCase().endsWith('.md'),
  );
  if (files.length === 0) throw new Error('No Markdown documents found');
  let failures = 0;
  for (const file of files) {
    const sourcePath = resolve(root, file);
    for (const target of brokenLocalLinks(
      readFileSync(sourcePath, 'utf8'),
      sourcePath,
      root,
    )) {
      console.error(`${file}: ${target}`);
      failures += 1;
    }
  }
  if (failures > 0) process.exitCode = 1;
  else console.log(`Checked local links in ${files.length} Markdown documents`);
}
