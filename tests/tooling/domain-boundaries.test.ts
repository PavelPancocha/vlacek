import { resolve } from 'node:path';
import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const BOUNDARY_RULES = new Set([
  'vlacek/pure-imports',
  'no-restricted-globals',
  'no-restricted-properties',
  'no-restricted-syntax',
  '@typescript-eslint/triple-slash-reference',
]);

// The real project config, with type-aware parsing switched off so that the
// probe files do not need to exist on disk. Boundary rules are syntactic.
const eslint = new ESLint({
  cwd: root,
  overrideConfig: [tseslint.configs.disableTypeChecked],
});

async function boundaryErrors(file: string, code: string) {
  const [result] = await eslint.lintText(code, {
    filePath: resolve(root, file),
  });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId && BOUNDARY_RULES.has(message.ruleId))
    .map((message) => message.ruleId);
}

const forbidden: [string, string][] = [
  ['Phaser', "import Phaser from 'phaser';\nexport const x = Phaser;"],
  [
    'type-only Phaser',
    "import type Phaser from 'phaser';\nexport type X = Phaser.Game;",
  ],
  ['render layer', "export { draw } from '../render/TrainRenderer.ts';"],
  [
    'alias path',
    "import { draw } from '@/render/TrainRenderer.ts';\nexport const x = draw;",
  ],
  ['re-export from platform', "export * from '../platform/SaveRepository.ts';"],
  ['dynamic import', "export const load = () => import('../ui/HomeView.ts');"],
  ['computed import', 'export const load = (p: string) => import(p);'],
  ['import type query', "export type G = import('phaser').Game;"],
  ['asset query', "import url from './track.ts?url';\nexport const x = url;"],
  ['require', "export const fs = require('node:fs');"],
  ['Math.random', 'export const r = Math.random();'],
  ['Date.now', 'export const t = Date.now();'],
  ['new Date', 'export const t = new Date();'],
  ['performance.now', 'export const t = performance.now();'],
  ['window', 'export const w = window.innerWidth;'],
  ['localStorage', "export const s = localStorage.getItem('x');"],
  ['setTimeout', 'export const id = setTimeout(() => undefined, 1);'],
  ['globalThis escape', 'export const r = globalThis.Math.random();'],
  ['import.meta', 'export const env = import.meta.url;'],
  ['DOM lib reference', '/// <reference lib="dom" />\nexport const x = 1;'],
  [
    'declare global',
    'declare global {\n  interface Window { x: number }\n}\nexport {};',
  ],
];

describe('pure zone (src/domain, src/config) boundary', () => {
  for (const zoneFile of ['src/domain/probe.ts', 'src/config/probe.ts']) {
    for (const [name, code] of forbidden) {
      it(`rejects ${name} in ${zoneFile}`, async () => {
        expect(await boundaryErrors(zoneFile, code)).not.toEqual([]);
      });
    }
  }

  it('allows relative imports that stay inside the pure zone', async () => {
    expect(
      await boundaryErrors(
        'src/domain/train/probe.ts',
        "import { a } from '../input/InputReducer.ts';\n" +
          "import type { B } from './TrainMotion.ts';\n" +
          "import { c } from '../../config/gameConfig.ts';\n" +
          'export const x: B = a + c;',
      ),
    ).toEqual([]);
  });

  it('does not restrict platform code outside the pure zone', async () => {
    expect(
      await boundaryErrors(
        'src/platform/probe.ts',
        "import { a } from '../render/x.ts';\nexport const t = Date.now() + a + localStorage.length;",
      ),
    ).toEqual([]);
  });
});
