import { describe, expect, it } from 'vitest';
import { soundTones } from '../../../src/content/soundTones.ts';
import { locomotives } from '../../../src/content/vehicles.ts';

describe('H1 / O5: locomotive horn tones (B.4)', () => {
  it('resolves every catalog hornAudio to a tone', () => {
    for (const locomotive of locomotives)
      expect(soundTones[locomotive.hornAudio], locomotive.id).toBeDefined();
    expect(
      Object.keys(soundTones).filter((id) => id.startsWith('audio.horn.')),
    ).toHaveLength(10);
  });

  it('has ten pairwise different horn pitches', () => {
    const pitches = locomotives.map((locomotive) => {
      const tone = soundTones[locomotive.hornAudio];
      return JSON.stringify([tone?.type, tone?.frequencies, tone?.glideTo]);
    });
    expect(new Set(pitches).size).toBe(10);
  });

  it('places steam_express exactly one octave below steam_local', () => {
    const local = soundTones['audio.horn.steam_local'];
    expect(local).toBeDefined();
    expect(soundTones['audio.horn.steam_express']?.frequencies).toEqual(
      local?.frequencies.map((frequency) => frequency / 2),
    );
  });

  it.each([
    ['steam_local', 'sine', [880, 1108], 0.7, 0.18, undefined],
    ['steam_express', 'sine', [440, 554], 0.8, 0.18, undefined],
    ['diesel_shunter', 'triangle', [164.81, 220], 0.65, 0.14, undefined],
    ['diesel_mainline', 'triangle', [220, 277, 330], 0.8, 0.16, undefined],
    ['electric_retro', 'triangle', [330, 415], 0.65, 0.14, undefined],
    ['electric_modern', 'sine', [659, 831], 0.55, 0.13, undefined],
    ['electric_mountain', 'triangle', [262, 349], 0.75, 0.14, undefined],
    ['magic_stars', 'sine', [1046, 1318, 1568], 0.6, 0.12, undefined],
    ['magic_bubbles', 'sine', [784], 0.45, 0.1, 1175],
    ['magic_rainbow', 'sine', [523, 659, 784], 0.65, 0.12, undefined],
  ] as const)(
    'matches the frozen B.4 tone for %s',
    (id, type, frequencies, durationSec, volume, glideTo) => {
      expect(soundTones[`audio.horn.${id}`]).toEqual({
        type,
        frequencies,
        durationSec,
        volume,
        ...(glideTo === undefined ? {} : { glideTo }),
      });
    },
  );
});
