import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { format } from 'prettier';
import { worldRegistrySource } from './worldRegistrySource.ts';
const root = resolve(import.meta.dirname, '..');
const scenesDir = resolve(root, 'src/domain/world/scenes'),
  artDir = resolve(root, 'src/content/world-modules');
const source = worldRegistrySource(
  readdirSync(scenesDir).filter((f) => f.endsWith('.scenes.ts')),
  readdirSync(artDir).filter((f) => f.endsWith('.art.ts')),
);
for (const [file, text] of [
  [resolve(scenesDir, 'registry.generated.ts'), source.scenes],
  [resolve(root, 'src/content/worldRegistry.generated.ts'), source.art],
]) {
  if (file === undefined || text === undefined)
    throw new Error('missing registry');
  const expected = await format(text, {
    parser: 'typescript',
    singleQuote: true,
  });
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== expected)
      throw new Error(
        `stale registry ${file}; run volta run npm run generate:world-registries`,
      );
  } else writeFileSync(file, expected);
}
console.log(
  process.argv.includes('--check')
    ? 'World registries current'
    : 'World registries generated',
);
