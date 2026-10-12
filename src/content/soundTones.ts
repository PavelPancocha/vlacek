export interface Tone {
  type: 'sine' | 'triangle';
  frequencies: readonly number[];
  durationSec: number;
  volume: number;
  glideTo?: number;
}

/** PLACEHOLDER Web Audio tones; locomotive identities follow H1 / O5, B.4. */
export const soundTones: Readonly<Record<string, Tone>> = {
  'audio.horn.steam_local': {
    type: 'sine',
    frequencies: [880, 1108],
    durationSec: 0.7,
    volume: 0.18,
  },
  'audio.horn.steam_express': {
    type: 'sine',
    frequencies: [440, 554],
    durationSec: 0.8,
    volume: 0.18,
  },
  'audio.horn.diesel_shunter': {
    type: 'triangle',
    frequencies: [164.81, 220],
    durationSec: 0.65,
    volume: 0.14,
  },
  'audio.horn.diesel_mainline': {
    type: 'triangle',
    frequencies: [220, 277, 330],
    durationSec: 0.8,
    volume: 0.16,
  },
  'audio.horn.electric_retro': {
    type: 'triangle',
    frequencies: [330, 415],
    durationSec: 0.65,
    volume: 0.14,
  },
  'audio.horn.electric_modern': {
    type: 'sine',
    frequencies: [659, 831],
    durationSec: 0.55,
    volume: 0.13,
  },
  'audio.horn.electric_mountain': {
    type: 'triangle',
    frequencies: [262, 349],
    durationSec: 0.75,
    volume: 0.14,
  },
  'audio.horn.magic_stars': {
    type: 'sine',
    frequencies: [1046, 1318, 1568],
    durationSec: 0.6,
    volume: 0.12,
  },
  'audio.horn.magic_bubbles': {
    type: 'sine',
    frequencies: [784],
    durationSec: 0.45,
    volume: 0.1,
    glideTo: 1175,
  },
  'audio.horn.magic_rainbow': {
    type: 'sine',
    frequencies: [523, 659, 784],
    durationSec: 0.65,
    volume: 0.12,
  },
  reaction: {
    type: 'sine',
    frequencies: [620],
    durationSec: 0.25,
    volume: 0.15,
    glideTo: 420,
  },
  'bubble-pop': {
    type: 'sine',
    frequencies: [900],
    durationSec: 0.12,
    volume: 0.08,
    glideTo: 300,
  },
  'train-full': {
    type: 'sine',
    frequencies: [196],
    durationSec: 0.3,
    volume: 0.12,
  },
};
