import { expect, it } from 'vitest';
import {
  diagnosticGroups,
  hudLines,
} from '../../../src/ui/diagnosticsFormat.ts';

it('formats two short HUD lines with rounded metrics and the full seed', () => {
  expect(
    hudLines({
      medianFps: 59.76,
      p95FrameMs: 17.26,
      renderer: 'webgl',
      renderProfile: {
        quality: 'low',
        maxDpr: 1,
        fpsLimit: 30,
        effects: 'low',
      },
      seed: 4294967295,
      headChunk: -2,
      speedUPerSec: 103.76,
      vehicles: 5,
    }),
  ).toEqual([
    '60 FPS · p95 17.3 ms · webgl · low',
    'Svět 4294967295 · úsek -2 · 103.8 u/s · 5 vozů',
  ]);
});

it('keeps missing or non-finite measurements readable without JSON', () => {
  expect(hudLines({ medianFps: NaN, speedUPerSec: Infinity })).toEqual([
    '— FPS · p95 — ms · — · —',
    'Svět — · úsek — · — u/s · — vozů',
  ]);
});

it('groups Czech key–value rows and includes optional atlases and audio', () => {
  const groups = diagnosticGroups({ seed: 0, vehicles: 2, audio: 'suspended' });
  expect(groups.map((group) => group.title)).toEqual([
    'Výkon',
    'Svět',
    'Vlak',
    'Přejezdy',
    'Atlasy',
    'Zvuk',
  ]);
  expect(groups.find((group) => group.title === 'Svět')?.rows).toContainEqual([
    'Číslo světa',
    '0',
  ]);
  expect(groups.find((group) => group.title === 'Zvuk')?.rows).toContainEqual([
    'Stav',
    'Pozastavený',
  ]);
  expect(diagnosticGroups({}).map((group) => group.title)).not.toContain(
    'Zvuk',
  );
  expect(groups.find((group) => group.title === 'Atlasy')?.rows).toContainEqual(
    ['Svět', 'Není načten'],
  );
});
