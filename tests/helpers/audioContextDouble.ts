/// <reference lib="dom" />
import { vi } from 'vitest';
import { AudioManager } from '../../src/platform/AudioManager.ts';

export const response = () => ({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
});

export function setupAudioContext() {
  const voices: ReturnType<typeof source>[] = [];
  function source() {
    const ended: (() => void)[] = [];
    let started = false;
    let finished = false;
    let endSec = Infinity;
    let stopSec = Infinity;
    return {
      buffer: undefined,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: { setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn((_when?: number, _offset?: number, duration?: number) => {
        started = true;
        endSec = nowSec + (duration ?? 3);
      }),
      stop: vi.fn((at?: number) => {
        stopSec = at ?? nowSec;
      }),
      get playing() {
        return started && !finished;
      },
      get dueSec() {
        return Math.min(stopSec, this.loop ? Infinity : endSec);
      },
      addEventListener: vi.fn((_name: string, callback: () => void) =>
        ended.push(callback),
      ),
      finish: () => {
        finished = true;
        for (const callback of ended.splice(0)) callback();
      },
    };
  }
  let nowSec = 10;
  const param = () => {
    let value = 0;
    let target:
      { value: number; from: number; at: number; constant: number } | undefined;
    const sample = (at: number) =>
      target
        ? target.value +
          (target.from - target.value) *
            Math.exp(-Math.max(0, at - target.at) / target.constant)
        : value;
    return {
      get value() {
        return sample(nowSec);
      },
      set value(next: number) {
        value = next;
        target = undefined;
      },
      setValueAtTime: vi.fn((next: number) => {
        value = next;
        target = undefined;
      }),
      cancelScheduledValues: vi.fn((at: number) => {
        value = sample(at);
        target = undefined;
      }),
      setTargetAtTime: vi.fn((next: number, at: number, constant: number) => {
        target = { value: next, from: sample(at), at, constant };
      }),
      linearRampToValueAtTime: vi.fn<(value: number, at: number) => void>(),
    };
  };
  const node = () => {
    const connections = new Set<object>();
    return {
      connections,
      bufferedSample: 0,
      gain: param(),
      frequency: param(),
      delayTime: param(),
      type: 'lowpass',
      connect: vi.fn((target: object) => connections.add(target)),
      disconnect: vi.fn((target?: object) => {
        if (target) connections.delete(target);
        else connections.clear();
      }),
    };
  };
  const filter = node();
  const delay = node();
  const delays: ReturnType<typeof node>[] = [];
  const gains: ReturnType<typeof node>[] = [];
  const context = {
    state: 'running',
    get currentTime() {
      return nowSec;
    },
    set currentTime(next: number) {
      nowSec = next;
    },
    destination: {},
    createGain: vi.fn(() => {
      const gain = node();
      gains.push(gain);
      return gain;
    }),
    createBiquadFilter: vi.fn(() => filter),
    createDelay: vi.fn(() => {
      const next = delays.length === 0 ? delay : node();
      delays.push(next);
      return next;
    }),
    createBufferSource: vi.fn(() => {
      const voice = source();
      voices.push(voice);
      return voice;
    }),
    decodeAudioData: vi.fn(() => Promise.resolve({ duration: 3 })),
    resume: vi.fn(() => {
      context.state = 'running';
      return Promise.resolve();
    }),
    suspend: vi.fn(() => {
      context.state = 'suspended';
      return Promise.resolve();
    }),
    close: vi.fn(() => Promise.resolve()),
  };
  vi.stubGlobal(
    'AudioContext',
    vi.fn(function () {
      return context;
    }),
  );
  const fetch = vi.fn<
    (url: string, options?: RequestInit) => Promise<ReturnType<typeof response>>
  >(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetch);
  return {
    audio: new AudioManager(),
    advanceTo: async (sec: number) => {
      nowSec = sec;
      for (const voice of [...voices])
        if (voice.playing && voice.dueSec <= sec) voice.finish();
      // Drain async decode/reconciliation without advancing the controlled audio clock.
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
    context,
    voices,
    fetch,
    filter,
    delay,
    delays,
    gains,
  };
}
