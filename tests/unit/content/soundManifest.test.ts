import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  soundManifest,
  animalSounds,
} from '../../../src/content/soundManifest.ts';
import { locomotives } from '../../../src/content/vehicles.ts';
import sources from '../../../scripts/audio/sources.json' with { type: 'json' };
import { audioCredits } from '../../../scripts/audio/credits.ts';

describe('recorded manifest / H1 / CNT', () => {
  it('ships attribution and changes for every CC BY recording', () => {
    const file = new URL('../../../assets/audio/credits.txt', import.meta.url);
    expect(existsSync(file)).toBe(true);
    const credits = readFileSync(file, 'utf8');
    expect(credits).toBe(audioCredits);
    for (const source of sources.filter(
      (source) => source.licence === 'CC-BY-4.0',
    )) {
      const credit = credits
        .split('\n\n')
        .find((block) => block.startsWith(`${source.file}\n`));
      expect(credit, source.file).toContain(source.title);
      expect(credit, source.file).toContain(source.author);
      expect(credit, source.file).toContain(source.url);
      expect(credit, source.file).toContain(
        'https://creativecommons.org/licenses/by/4.0/',
      );
      expect(credit, source.file).toContain(
        `Změny: výřez ${source.startSec}–${source.endSec} s`,
      );
    }
  });
  it('resolves every horn, animal and required layer to a shipped file and licence record', () => {
    const required = [
      ...locomotives.map((loco) => loco.hornAudio),
      ...Object.values(animalSounds),
      'steam-chuff',
      'diesel-idle',
      'diesel-running',
      'electric-hum',
      'wheels',
      'crossing-bell',
      'meadow',
      'forest',
      'brook',
      'sea',
      'wind',
      'crickets',
      'bubble-pop',
      'train-full',
      'horse',
      'songbird',
    ];
    for (const id of required) expect(soundManifest[id], id).toBeDefined();
    for (const [id, clip] of Object.entries(soundManifest)) {
      expect(
        existsSync(
          new URL(`../../../assets/audio/${clip.file}`, import.meta.url),
        ),
        id,
      ).toBe(true);
      const provenance = sources.find(
        (source) =>
          source.original === clip.licenceKey && source.file === clip.file,
      );
      expect(provenance, id).toBeDefined();
      expect(['CC0-1.0', 'CC-BY-4.0']).toContain(provenance?.licence);
      expect(provenance?.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(provenance?.download).toMatch(/^https:\/\//);
      if (clip.loopEndSec !== undefined) {
        expect(clip.loopStartSec).toBe(0.12);
        expect(clip.loopEndSec).toBeGreaterThan(clip.loopStartSec ?? 0);
      }
    }
  });
  it('gives every forest animal its own real recording, never the wind bed', () => {
    const wind = sources.find((source) => source.file === 'wind.mp3');
    const files = new Set<string>();
    for (const animal of ['deer', 'fox', 'squirrel', 'hedgehog'] as const) {
      const id = animalSounds[animal];
      expect(id, animal).not.toBe('rustle');
      const clip = soundManifest[id];
      expect(clip?.category).toBe('animal');
      const source = sources.find((source) => source.file === clip?.file);
      expect(source, animal).toBeDefined();
      expect(source?.sha256, animal).not.toBe(wind?.sha256);
      expect(source?.original, animal).not.toBe(wind?.original);
      expect(source?.download, animal).not.toBe(wind?.download);
      if (clip) files.add(clip.file);
    }
    expect(files.size).toBe(4);
    expect(soundManifest['rustle']).toBeUndefined();
  });
  it('uses documented outdoor leaf footsteps instead of cartoon-tagged fox eating', () => {
    const clip = soundManifest[animalSounds.fox];
    const source = sources.find((source) => source.file === clip?.file);
    expect(source?.original).toBe('ambience-leaves--bsb0137.wav');
    expect(clip?.licenceKey).toBe(source?.original);
    expect(source?.url).toBe(
      'https://bigsoundbank.com/feet-in-leaves-s0137.html',
    );
    expect(source?.licence).toBe('CC0-1.0');
  });
  it('keeps the isolated squirrel event at 7.20–7.70 seconds', () => {
    const clip = soundManifest[animalSounds.squirrel];
    const source = sources.find((source) => source.file === clip?.file);
    expect(source?.startSec).toBe(7.2);
    expect(source?.endSec).toBe(7.7);
  });
  it('keeps ten distinct horn characters and stable catalog IDs', () => {
    const horns = locomotives.map((loco) => soundManifest[loco.hornAudio]);
    expect(
      new Set(horns.map((clip) => JSON.stringify([clip?.file, clip?.rate])))
        .size,
    ).toBe(10);
    expect(Object.keys(animalSounds)).toHaveLength(12);
  });
});
