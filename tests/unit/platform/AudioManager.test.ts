/// <reference lib="dom" />

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../../../src/platform/AudioManager.ts';

function oscillator() {
  const ended: (() => void)[] = [];
  return {
    type: 'sine',
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: () => void) =>
      ended.push(listener),
    ),
    finish: () => {
      for (const listener of ended) listener();
    },
  };
}

function audioContext() {
  const oscillators: ReturnType<typeof oscillator>[] = [];
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    state: 'running',
    currentTime: 10,
    destination: {},
    oscillators,
    gain,
    createGain: vi.fn(() => gain),
    createOscillator: vi.fn(() => {
      const voice = oscillator();
      oscillators.push(voice);
      return voice;
    }),
    close: vi.fn(() => Promise.resolve()),
  };
}

describe('H1 / O5: AudioManager synthesis', () => {
  let context: ReturnType<typeof audioContext>;
  let audio: AudioManager;

  beforeEach(() => {
    context = audioContext();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return context;
      }),
    );
    audio = new AudioManager();
    audio.unlock();
  });

  afterEach(() => {
    audio.dispose();
    vi.unstubAllGlobals();
  });

  it('starts all steam_express voices simultaneously with the B.4 envelope', () => {
    expect(() => audio.play('audio.horn.steam_express')).not.toThrow();
    expect(
      context.oscillators.map(
        (voice) => voice.frequency.setValueAtTime.mock.calls,
      ),
    ).toEqual([[[440, 10]], [[554, 10]]]);
    for (const voice of context.oscillators) {
      expect(voice.type).toBe('sine');
      expect(voice.start).toHaveBeenCalledWith(10);
      expect(voice.stop).toHaveBeenCalledWith(10.82);
      expect(
        voice.frequency.exponentialRampToValueAtTime,
      ).not.toHaveBeenCalled();
    }
    expect(context.gain.gain.exponentialRampToValueAtTime.mock.calls).toEqual([
      [0.18, 10.03],
      [0.0001, 10.8],
    ]);
  });

  it('glides the single magic_bubbles voice from 784 to 1175 Hz in 0.45 s', () => {
    expect(() => audio.play('audio.horn.magic_bubbles')).not.toThrow();
    expect(context.oscillators).toHaveLength(1);
    const voice = context.oscillators[0];
    expect(voice?.frequency.setValueAtTime).toHaveBeenCalledWith(784, 10);
    expect(voice?.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      1175,
      10.45,
    );
    expect(context.gain.gain.exponentialRampToValueAtTime.mock.calls).toEqual([
      [0.1, 10.03],
      [0.0001, 10.45],
    ]);
  });

  it('releases a chord budget only after its last oscillator ends', () => {
    expect(() => {
      for (let i = 0; i < 6; i++) audio.play('audio.horn.diesel_mainline');
    }).not.toThrow();
    expect(context.oscillators).toHaveLength(15);
    context.oscillators[0]?.finish();
    context.oscillators[1]?.finish();
    audio.play('audio.horn.diesel_mainline');
    expect(context.oscillators).toHaveLength(15);
    expect(context.gain.disconnect).not.toHaveBeenCalled();
    context.oscillators[2]?.finish();
    expect(context.gain.disconnect).toHaveBeenCalledOnce();
    audio.play('audio.horn.diesel_mainline');
    expect(context.oscillators).toHaveLength(18);
    for (const voice of context.oscillators.slice(0, 3))
      expect(voice.disconnect).toHaveBeenCalledOnce();
  });

  it('ignores unknown identities without spending the voice budget', () => {
    expect(() => {
      for (const id of ['missing', 'toString', 'constructor', '__proto__'])
        audio.play(id);
    }).not.toThrow();
    expect(context.createGain).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) audio.play('reaction');
    expect(context.oscillators).toHaveLength(5);
  });

  it('keeps reaction and train-full placeholder tones unchanged', () => {
    audio.play('reaction');
    audio.play('train-full');
    expect(
      context.oscillators.map(
        (voice) => voice.frequency.setValueAtTime.mock.calls,
      ),
    ).toEqual([[[620, 10]], [[196, 10]]]);
    expect(
      context.oscillators[0]?.frequency.exponentialRampToValueAtTime,
    ).toHaveBeenCalledWith(420, 10.25);
    expect(context.gain.gain.exponentialRampToValueAtTime.mock.calls).toEqual([
      [0.15, 10.03],
      [0.0001, 10.25],
      [0.12, 10.03],
      [0.0001, 10.3],
    ]);
  });
});
