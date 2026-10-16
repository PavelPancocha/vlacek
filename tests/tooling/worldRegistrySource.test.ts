import { expect, it } from 'vitest';
import { worldRegistrySource } from '../../scripts/worldRegistrySource.ts';
it('content lanes get deterministic static pure-domain imports and art/used-key registries without shared edits', () => {
  const a = worldRegistrySource(
    ['z.scenes.ts', 'a.scenes.ts'],
    ['wood.art.ts'],
  );
  expect(a).toEqual(
    worldRegistrySource(['a.scenes.ts', 'z.scenes.ts'], ['wood.art.ts']),
  );
  expect(a.scenes).toContain("from './a.scenes.ts'");
  expect(a.scenes).toContain('...scene0');
  expect(a.art).toContain('...art0.parts');
  expect(a.art).toContain('...art0.usedKeys');
  expect(a.scenes).not.toContain('import.meta');
});
it('registry rejects duplicate or unsafe module names', () => {
  for (const files of [
    ['x.scenes.ts', 'x.scenes.ts'],
    ['../x.scenes.ts'],
    ['x.scenes.ts\n'],
  ])
    expect(() => worldRegistrySource(files, [])).toThrow();
});
