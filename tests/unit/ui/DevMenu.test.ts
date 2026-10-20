import { expect, it } from 'vitest';
import { parseDevMenu } from '../../../src/ui/DevMenu.ts';

const form = {
  debug: 'on',
  renderer: 'canvas',
  quality: 'low',
  reducedEffects: 'on',
  seed: '123',
};
it('menu model accepts the five selections, empty world and both 32-bit boundaries', () => {
  expect(parseDevMenu(form)).toEqual({
    debug: true,
    perfGraph: false,
    renderer: 'canvas',
    quality: 'low',
    reducedEffects: true,
    seed: 123,
  });
  for (const seed of ['', '0', '4294967295'])
    expect(
      parseDevMenu({
        ...form,
        debug: 'off',
        renderer: 'auto',
        quality: 'auto',
        reducedEffects: 'off',
        seed,
      }),
    ).toEqual({
      debug: false,
      perfGraph: false,
      renderer: 'auto',
      quality: 'auto',
      reducedEffects: false,
      seed: seed === '' ? undefined : Number(seed),
    });
  expect(parseDevMenu({ ...form, quality: 'standard' })?.quality).toBe(
    'standard',
  );
});
it('menu model rejects invalid selections and seeds instead of silently pinning a different world', () => {
  for (const seed of ['-1', '4294967296', '1.5', '1e3', ' 123', 'bad'])
    expect(parseDevMenu({ ...form, seed })).toBeUndefined();
  for (const key of ['debug', 'renderer', 'quality', 'reducedEffects', 'seed'])
    expect(parseDevMenu({ ...form, [key]: null })).toBeUndefined();
});
