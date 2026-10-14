/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../../../src/platform/AudioManager.ts';

function deferred<T>() {
  let settle: (value: T) => void = () => {
    throw new Error('Promise not initialized');
  };
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: (value: T) => settle(value) };
}
const response = () => ({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
});

function setup() {
  const voices: ReturnType<typeof source>[] = [];
  function source() {
    const ended: (() => void)[] = [];
    return {
      buffer: undefined,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: { setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn((_name: string, callback: () => void) =>
        ended.push(callback),
      ),
      finish: () => {
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
      linearRampToValueAtTime: vi.fn(),
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
    context,
    voices,
    fetch,
    filter,
    delay,
    delays,
    gains,
  };
}

afterEach(() => vi.unstubAllGlobals());
describe('recorded sounds / H1', () => {
  it.each(['running', 'suspended'] as const)(
    'stopAll removes buffered tunnel echo while %s and retains context and decoded cache',
    async (state) => {
      const { audio, context, filter, delay, delays, gains, fetch, voices } =
        setup();
      audio.unlock();
      const layers = [
        { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
      ];
      audio.setLayers(layers);
      await vi.waitFor(() => expect(voices).toHaveLength(1));
      audio.setCovered(1);
      context.currentTime += 1;
      const echo = gains[0];
      if (!echo) throw new Error('echo node missing');
      // A stopped source can leave this pulse in the shared 90ms DSP buffer.
      delay.bufferedSample = 1;
      const output = () =>
        delays.reduce(
          (sum, node) =>
            sum +
            (node.connections.has(echo) &&
            echo.connections.has(context.destination)
              ? node.bufferedSample * echo.gain.value
              : 0),
          0,
        );
      expect(output()).toBeGreaterThan(0);
      if (state === 'suspended') audio.suspend();
      audio.stopAll();
      expect(output()).toBe(0);
      expect(echo.gain.value).toBe(0);
      expect(echo.gain.cancelScheduledValues).toHaveBeenLastCalledWith(
        context.currentTime,
      );
      expect(echo.gain.setValueAtTime).toHaveBeenLastCalledWith(
        0,
        context.currentTime,
      );
      expect(delay.connections.size).toBe(0);
      expect(filter.connections.has(delay)).toBe(false);
      const fresh = delays[1];
      if (!fresh) throw new Error('fresh delay missing');
      expect(fresh).not.toBe(delay);
      expect(fresh.delayTime.value).toBe(0.09);
      expect(filter.connections.has(context.destination)).toBe(true);
      expect(filter.connections.has(fresh)).toBe(true);
      expect(fresh.connections.has(echo)).toBe(true);
      expect(audio.state).toBe(state);
      expect(context.close).not.toHaveBeenCalled();
      audio.unlock();
      // Even renewed tunnel gain cannot expose the previous journey's buffered pulse.
      audio.setCovered(1);
      context.currentTime += 1;
      expect(echo.gain.value).toBeGreaterThan(0);
      expect(output()).toBe(0);
      audio.setLayers(layers);
      await vi.waitFor(() => expect(voices).toHaveLength(2));
      expect(fetch).toHaveBeenCalledOnce();
      expect(context.decodeAudioData).toHaveBeenCalledOnce();
      expect(context.createBiquadFilter).toHaveBeenCalledOnce();
      audio.dispose();
    },
  );

  it('stopAll stops loops, fading beds, scheduled chuffs and shots exactly once and remains reusable', async () => {
    const { audio, context, voices, gains } = setup();
    audio.unlock();
    const layers = (id: string) => [
      { key: 'ambient', id, gain: 1, rate: 1, priority: 10 },
      {
        key: 'engine',
        id: 'steam-chuff',
        gain: 1,
        rate: 1,
        priority: 70,
        pulsed: true,
      },
    ];
    audio.setLayers(layers('meadow'));
    audio.play('audio.horn.steam_local');
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(3));
    audio.chuff(0.1);
    audio.setLayers(layers('forest'));
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(4));
    const previous = [...voices];
    audio.stopAll();
    audio.stopAll();
    expect(audio.diagnostics.active).toEqual([]);
    expect(context.resume).not.toHaveBeenCalled();
    expect(context.suspend).not.toHaveBeenCalled();
    for (const voice of previous) {
      expect(voice.stop).toHaveBeenLastCalledWith();
      expect(voice.disconnect).toHaveBeenCalledOnce();
    }
    const disconnected = gains.map((gain) => gain.disconnect.mock.calls.length);
    // Five distinct recorded shots fill the budget again after cleanup.
    for (const id of ['sheep', 'cow', 'hen', 'dog', 'cat']) audio.play(id);
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(5));
    for (const voice of previous) voice.finish();
    expect(
      gains
        .slice(0, disconnected.length)
        .map((gain) => gain.disconnect.mock.calls.length),
    ).toEqual(disconnected);
    audio.play('songbird', 1, 10);
    await vi.waitFor(() => expect(audio.diagnostics.pending).toBe(0));
    expect(audio.diagnostics.active).toHaveLength(5);
    expect(audio.diagnostics.played).not.toContain('songbird');
    audio.suspend();
    audio.stopAll();
    expect(audio.state).toBe('suspended');
    expect(context.resume).not.toHaveBeenCalled();
    audio.unlock();
    audio.play('sheep');
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(1));
    audio.dispose();
  });

  it('stopAll aborts pending loads and delayed reactions without deleting a new journey request', async () => {
    const { audio, fetch, context, voices } = setup();
    const old = deferred<ReturnType<typeof response>>();
    const next = deferred<ReturnType<typeof response>>();
    fetch
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => old.promise);
    audio.unlock();
    const layer = [
      { key: 'ambient', id: 'meadow', gain: 1, rate: 1, priority: 10 },
    ];
    audio.setLayers(layer);
    audio.play('audio.horn.steam_local');
    const signals = fetch.mock.calls.map((call) => call[1]?.signal);
    audio.stopAll();
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    expect(audio.diagnostics.pending).toBe(0);
    expect(audio.diagnostics.pendingLayers).toBe(0);
    fetch.mockImplementation(() => next.promise);
    audio.setLayers(layer);
    old.resolve(response());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(audio.diagnostics.pending).toBe(1);
    expect(audio.diagnostics.pendingLayers).toBe(1);
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    next.resolve(response());
    await vi.waitFor(() => expect(voices).toHaveLength(1));
    expect(audio.diagnostics.played).toEqual(['meadow']);
    expect(audio.diagnostics.failures).toEqual([]);
    audio.dispose();
  });

  it('stopAll cancels an in-flight decode and keeps a fresh request for the same clip usable', async () => {
    const { audio, context, voices } = setup();
    const old = deferred<{ duration: number }>();
    const next = deferred<{ duration: number }>();
    context.decodeAudioData
      .mockImplementationOnce(() => old.promise)
      .mockImplementationOnce(() => next.promise);
    audio.unlock();
    audio.play('audio.horn.steam_local');
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledOnce(),
    );
    audio.stopAll();
    audio.play('audio.horn.steam_local');
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledTimes(2),
    );
    old.resolve({ duration: 3 });
    await vi.waitFor(() => expect(audio.diagnostics.loaded).toBe(0));
    expect(audio.diagnostics.pending).toBe(1);
    expect(voices).toHaveLength(0);
    next.resolve({ duration: 3 });
    await vi.waitFor(() => expect(voices).toHaveLength(1));
    expect(audio.diagnostics.played).toEqual(['audio.horn.steam_local']);
    audio.dispose();
  });

  it('bounds pending layer consumers across repeated frames and discards them after suspension', async () => {
    const { audio, fetch, context } = setup();
    const pending = deferred<ReturnType<typeof response>>();
    fetch.mockImplementation(() => pending.promise);
    audio.unlock();
    const layers = ['diesel-idle', 'wheels', 'meadow'].map((id) => ({
      key: id,
      id,
      gain: 1,
      rate: 1,
      priority: 10,
    }));
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Native then is deliberately invoked with .call(this) below.
    const nativeThen = Promise.prototype.then;
    let consumers = 0;
    // A Vitest spy uses Promise.then itself; count native subscriptions directly.
    void Object.defineProperty(Promise.prototype, 'then', {
      value: function (
        this: Promise<unknown>,
        ...args: Parameters<Promise<unknown>['then']>
      ) {
        consumers += 1;
        return nativeThen.call(this, ...args);
      },
    });
    try {
      for (let frame = 0; frame < 180; frame++) audio.setLayers(layers);
    } finally {
      void Object.defineProperty(Promise.prototype, 'then', {
        value: nativeThen,
      });
    }
    expect(audio.diagnostics.pendingLayers).toBe(3);
    audio.suspend();
    pending.resolve(response());
    await vi.waitFor(() => expect(audio.diagnostics.pendingLayers).toBe(0));
    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(3);
    audio.dispose();
    expect(consumers).toBeLessThanOrEqual(12);
  });
  it('aborts owned fetches on disposal and ignores even an eventual response', async () => {
    const { audio, fetch, context } = setup();
    const pending = deferred<ReturnType<typeof response>>();
    fetch.mockImplementation(() => pending.promise);
    audio.unlock();
    audio.setLayers([
      { key: 'engine', id: 'diesel-idle', gain: 1, rate: 1, priority: 70 },
    ]);
    const signal = fetch.mock.calls[0]?.[1]?.signal;
    audio.dispose();
    pending.resolve(response());
    await vi.waitFor(() => expect(audio.diagnostics.pendingLayers).toBe(0));
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    expect(context.createBufferSource).not.toHaveBeenCalled();
    expect(signal?.aborted).toBe(true);
    expect(audio.diagnostics.failures).toEqual([]);
  });
  it('reconciles the latest clip without another frame after a pending decode settles', async () => {
    const { audio, context, voices, gains } = setup();
    const pending = deferred<{ duration: number }>();
    context.decodeAudioData.mockImplementationOnce(() => pending.promise);
    audio.unlock();
    audio.setLayers([
      { key: 'engine', id: 'diesel-idle', gain: 1, rate: 1, priority: 10 },
    ]);
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledOnce(),
    );
    for (let frame = 0; frame < 180; frame++)
      audio.setLayers([
        {
          key: 'engine',
          id: 'diesel-running',
          gain: 0.4,
          rate: 1.5,
          priority: 70,
        },
      ]);
    pending.resolve({ duration: 3 });
    await vi.waitFor(() =>
      expect(audio.diagnostics.played).toEqual(['diesel-running']),
    );
    expect(voices).toHaveLength(1);
    expect(voices[0]?.playbackRate.setTargetAtTime).toHaveBeenCalledWith(
      1.5,
      10,
      0.08,
    );
    expect(gains[1]?.gain.setTargetAtTime).toHaveBeenCalledWith(0.1, 10, 0.08);
    audio.dispose();
  });
  it.each(['suspend', 'dispose'] as const)(
    'ignores an eventual decode after %s',
    async (action) => {
      const { audio, context, voices } = setup();
      const pending = deferred<{ duration: number }>();
      context.decodeAudioData.mockImplementationOnce(() => pending.promise);
      audio.unlock();
      audio.setLayers([
        { key: 'engine', id: 'diesel-idle', gain: 1, rate: 1, priority: 70 },
      ]);
      await vi.waitFor(() =>
        expect(context.decodeAudioData).toHaveBeenCalledOnce(),
      );
      for (let frame = 0; frame < 180; frame++)
        audio.setLayers([
          {
            key: 'engine',
            id: 'diesel-idle',
            gain: 0.5,
            rate: 1.5,
            priority: 70,
          },
        ]);
      audio[action]();
      pending.resolve({ duration: 3 });
      await vi.waitFor(() => expect(audio.diagnostics.pendingLayers).toBe(0));
      expect(voices).toHaveLength(0);
      expect(audio.diagnostics.active).toEqual([]);
      expect(audio.diagnostics.loaded).toBe(action === 'dispose' ? 0 : 1);
      audio.dispose();
    },
  );
  it('explicit developer audition remains playable after a slow decode', async () => {
    const { audio, context } = setup();
    const pending = deferred<{ duration: number }>();
    context.decodeAudioData.mockImplementationOnce(() => pending.promise);
    audio.unlock();
    audio.play('sheep', 1, 100, Infinity);
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledOnce(),
    );
    context.currentTime += 1;
    pending.resolve({ duration: 3 });
    await vi.waitFor(() => expect(audio.diagnostics.played).toEqual(['sheep']));
    audio.dispose();
  });
  it.each(['sheep', 'bubble-pop', 'train-full'])(
    'discards an expired %s during running decode and caches it for a fresh reaction',
    async (id) => {
      const { audio, fetch, context, voices } = setup();
      const pending = deferred<{ duration: number }>();
      context.decodeAudioData.mockImplementationOnce(() => pending.promise);
      audio.unlock();
      audio.play(id);
      await vi.waitFor(() =>
        expect(context.decodeAudioData).toHaveBeenCalledOnce(),
      );
      context.currentTime += 1;
      pending.resolve({ duration: 3 });
      await vi.waitFor(() => expect(audio.diagnostics.pending).toBe(0));
      expect(audio.state).toBe('running');
      expect(voices).toHaveLength(0);
      expect(audio.diagnostics.loaded).toBe(1);
      audio.play(id);
      await vi.waitFor(() => expect(voices).toHaveLength(1));
      expect(fetch).toHaveBeenCalledOnce();
      expect(context.decodeAudioData).toHaveBeenCalledOnce();
      audio.dispose();
    },
  );
  it('discards a reaction after delayed fetch without dropping a deliberately requested player horn', async () => {
    const { audio, fetch, context, voices } = setup();
    const pending = deferred<ReturnType<typeof response>>();
    fetch.mockImplementation(() => pending.promise);
    audio.unlock();
    audio.play('cow');
    audio.play('audio.horn.steam_local');
    context.currentTime += 1;
    pending.resolve(response());
    await vi.waitFor(() => expect(audio.diagnostics.pending).toBe(0));
    await vi.waitFor(() => expect(voices).toHaveLength(1));
    expect(audio.diagnostics.played).toEqual(['audio.horn.steam_local']);
    audio.dispose();
  });
  it('loads nothing before a gesture; plays a decoded horn instead of an oscillator', async () => {
    const { audio, context, fetch } = setup();
    audio.play('audio.horn.steam_local');
    expect(fetch).not.toHaveBeenCalled();
    audio.unlock();
    audio.play('audio.horn.steam_local');
    await vi.waitFor(() =>
      expect(context.createBufferSource).toHaveBeenCalledOnce(),
    );
    expect(context.decodeAudioData).toHaveBeenCalledOnce();
    audio.dispose();
  });
  it('plays an explicit audition after the gesture resume promise, never on an automatic resume', async () => {
    const { audio, context, voices } = setup();
    audio.unlock();
    audio.suspend();
    audio.play('sheep');
    expect(voices).toHaveLength(0);
    let resume: (() => void) | undefined;
    context.resume.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resume = () => {
            context.state = 'running';
            resolve();
          };
        }),
    );
    audio.unlock();
    audio.play('sheep');
    await vi.waitFor(() =>
      expect(context.decodeAudioData).toHaveBeenCalledOnce(),
    );
    expect(voices).toHaveLength(0);
    resume?.();
    await vi.waitFor(() => expect(audio.diagnostics.played).toContain('sheep'));
    audio.dispose();
  });

  it('the player replaces a distant NPC with the same horn identity', async () => {
    const { audio } = setup();
    audio.unlock();
    audio.play('audio.horn.steam_local', 0.2, 80);
    await vi.waitFor(() => expect(audio.diagnostics.played).toHaveLength(1));
    audio.play('audio.horn.steam_local', 1, 100);
    await vi.waitFor(() => expect(audio.diagnostics.played).toHaveLength(2));
    expect(audio.diagnostics.active).toHaveLength(1);
    audio.dispose();
  });

  it('never stacks the same animal and releases nodes when it ends', async () => {
    const { audio, voices } = setup();
    audio.unlock();
    audio.play('sheep');
    audio.play('sheep');
    await vi.waitFor(() => expect(voices).toHaveLength(1));
    voices[0]?.finish();
    expect(audio.diagnostics.active).toHaveLength(0);
    expect(voices[0]?.disconnect).toHaveBeenCalledOnce();
    audio.play('sheep');
    await vi.waitFor(() => expect(voices).toHaveLength(2));
    audio.dispose();
  });
  it('keeps fetch and decode failures silent, reported, and does not retry every frame', async () => {
    const { audio, fetch, context } = setup();
    fetch.mockRejectedValueOnce(new Error('offline'));
    audio.unlock();
    audio.play('cow');
    await vi.waitFor(() =>
      expect(audio.diagnostics.failures).toEqual([
        { file: 'cow.mp3', reason: 'offline' },
      ]),
    );
    audio.play('cow');
    expect(fetch).toHaveBeenCalledOnce();
    context.decodeAudioData.mockRejectedValueOnce(new Error('bad mp3'));
    audio.play('hen');
    await vi.waitFor(() => expect(audio.diagnostics.failures).toHaveLength(2));
    expect(context.createBufferSource).not.toHaveBeenCalled();
    audio.dispose();
  });
  it('reports source allocation failures silently and releases the reserved voice', async () => {
    const { audio, context } = setup();
    context.createBufferSource.mockImplementationOnce(() => {
      throw new Error('no node');
    });
    audio.unlock();
    audio.play('cat');
    await vi.waitFor(() =>
      expect(audio.diagnostics.failures).toEqual([
        { file: 'play:cat', reason: 'no node' },
      ]),
    );
    expect(audio.diagnostics.active).toHaveLength(0);
    audio.dispose();
  });

  it('sound off silences immediately and cancels work fetched before muting', async () => {
    const { audio, context, fetch } = setup();
    let finish: (() => void) | undefined;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () =>
            resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(2)),
            });
        }),
    );
    audio.unlock();
    audio.play('cat');
    audio.setEnabled(false);
    finish?.();
    await vi.waitFor(() => expect(audio.diagnostics.pending).toBe(0));
    expect(context.decodeAudioData).not.toHaveBeenCalled();
    audio.play('dog');
    audio.unlock();
    expect(fetch).toHaveBeenCalledOnce();
    audio.dispose();
  });
  it('enforces 3 loops / 5 shots; a player horn evicts a distant bird', async () => {
    const { audio } = setup();
    audio.unlock();
    audio.setLayers(
      ['meadow', 'wheels', 'electric-hum', 'crossing-bell'].map(
        (id, index) => ({ key: id, id, gain: 1, rate: 1, priority: index + 1 }),
      ),
    );
    for (const id of ['songbird', 'sheep', 'cow', 'hen', 'dog'])
      audio.play(id, 1, 10);
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(8));
    audio.play('audio.horn.steam_local');
    await vi.waitFor(() =>
      expect(audio.diagnostics.active.map((v) => v.id)).toContain(
        'audio.horn.steam_local',
      ),
    );
    expect(
      audio.diagnostics.active.filter((v) => v.kind === 'loop'),
    ).toHaveLength(3);
    expect(audio.diagnostics.active.map((v) => v.id)).not.toContain('songbird');
    audio.dispose();
  });
  it('crossfades an ambient bed when a spare loop voice exists, and cleans both on suspend', async () => {
    const { audio, voices, context } = setup();
    audio.unlock();
    const layer = (id: string) => [
      { key: 'ambient', id, gain: 0.6, rate: 1, priority: 10 },
    ];
    audio.setLayers(layer('meadow'));
    await vi.waitFor(() => expect(voices).toHaveLength(1));
    audio.setLayers(layer('forest'));
    await vi.waitFor(() => expect(voices).toHaveLength(2));
    expect(voices[0]?.stop).toHaveBeenCalledWith(12);
    expect(voices[1]?.loop).toBe(true);
    expect(voices[1]?.loopStart).toBe(0.12);
    expect(voices[1]?.loopEnd).toBe(3); // fake decoded buffer is only 3 seconds
    voices[0]?.finish();
    expect(audio.diagnostics.active).toHaveLength(1);
    audio.suspend();
    expect(context.suspend).toHaveBeenCalledOnce();
    expect(audio.diagnostics.active).toHaveLength(0);
    audio.dispose();
  });
  it('low-passes only train layers and sets a short echo by covered fraction', () => {
    const { audio, filter, delay, gains } = setup();
    audio.unlock();
    audio.setCovered(0.5);
    expect(filter.frequency.setTargetAtTime.mock.calls[0]?.[0]).toBeLessThan(
      6000,
    );
    audio.setCovered(1);
    expect(filter.frequency.setTargetAtTime).toHaveBeenLastCalledWith(
      1100,
      10,
      0.12,
    );
    expect(delay.delayTime.value).toBe(0.09);
    expect(gains[0]?.gain.setTargetAtTime).toHaveBeenCalledWith(0.06, 10, 0.12);
    audio.dispose();
  });
  it('counts a distance-scheduled engine as one loop and cleans its bounded chuff nodes', async () => {
    const { audio, voices, gains } = setup();
    audio.unlock();
    audio.setLayers([
      {
        key: 'engine',
        id: 'steam-chuff',
        gain: 1,
        rate: 1,
        priority: 70,
        pulsed: true,
      },
    ]);
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(1));
    audio.chuff(0.1);
    audio.chuff(0.1);
    audio.chuff(0.1);
    expect(voices).toHaveLength(2);
    expect(gains).toHaveLength(4);
    expect(gains[2]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      10.1,
    );
    expect(audio.diagnostics.active[0]?.kind).toBe('loop');
    audio.setLayers([]);
    expect(audio.diagnostics.active).toHaveLength(0);
    for (const voice of voices) expect(voice.disconnect).toHaveBeenCalledOnce();
    audio.dispose();
  });
});
