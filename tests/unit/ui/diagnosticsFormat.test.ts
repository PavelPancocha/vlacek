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
    '60 FPS · p95 17.3 ms · dlouhé 0 · webgl · low',
    'Svět 4294967295 · úsek -2 · 103.8 u/s · 5 vozů',
  ]);
});

it('keeps missing or non-finite measurements readable without JSON', () => {
  expect(hudLines({ medianFps: NaN, speedUPerSec: Infinity })).toEqual([
    '— FPS · p95 — ms · dlouhé 0 · — · —',
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

it('includes world-v2 context, crossing geometry, recorded audio, opaque tunnels and catenary reach', () => {
  const groups = diagnosticGroups({
    backdrop: {
      currentBiome: 'forest',
      incomingBiome: undefined,
      fade: 0,
      world: {
        generatorVersion: 2,
        seed: 123,
        worldXU: 512,
        regionId: 'region-1',
        sceneId: 'scene-2',
        landscape: 'forest',
        subzone: 'forest-work',
        season: 'autumn',
        weather: 'clear',
        transitionProgress: 0.25,
        logicalFeatures: 3,
        renderedFragments: 4,
        props: 5,
        animatedObjects: 6,
      },
    },
    crossings: [
      {
        id: 'crossing-1',
        worldX: 500,
        screenX: 250,
        tailX: 100,
        phase: 'CLOSED',
        phases: ['WARNING', 'CLOSED'],
        barrier: 1,
        occupied: true,
        actors: 2,
        waiting: 2,
        crossed: 0,
      },
    ],
    audio: 'running',
    audioDetails: {
      active: [{ id: 'crossing-bell', kind: 'loop', key: 'bell' }],
      played: ['sheep'],
      loaded: 2,
      pending: 1,
      pendingLayers: 1,
      failures: [{ file: 'cow.mp3', reason: 'offline' }],
      covered: 0.5,
    },
    tunnels: [
      {
        id: 'tunnel-1',
        alpha: 1,
        train: 'partly',
        vehicles: ['partly', 'outside'],
      },
    ],
    catenary: {
      electrified: true,
      poles: 4,
      pantographGapU: 0.2,
      outOfRange: 1,
    },
  });
  const rows = (title: string) =>
    groups.find((group) => group.title === title)?.rows;
  expect(rows('Svět')).toContainEqual(['Region / scéna', 'region-1 / scene-2']);
  expect(rows('Svět')).toContainEqual([
    'Krajina / podzóna',
    'forest / forest-work',
  ]);
  expect(rows('Svět')).toContainEqual(['Sezóna / počasí', 'autumn / clear']);
  expect(
    rows('Přejezdy')
      ?.map((row) => row[1])
      .join(' '),
  ).toContain('500 u');
  expect(rows('Zvuk')).toContainEqual(['Načtené / čekající nahrávky', '2 / 1']);
  expect(
    rows('Zvuk')
      ?.map((row) => row[1])
      .join(' '),
  ).toContain('crossing-bell');
  expect(
    rows('Zvuk')
      ?.map((row) => row[1])
      .join(' '),
  ).toContain('cow.mp3: offline');
  expect(
    rows('Tunely')
      ?.map((row) => row[1])
      .join(' '),
  ).toContain('Neprůhledný');
  expect(rows('Trolejové vedení')).toContainEqual([
    'Mimo dosah (outOfRange)',
    '1',
  ]);
});
