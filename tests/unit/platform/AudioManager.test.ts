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
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  });
  const node = () => ({
    gain: param(),
    frequency: param(),
    delayTime: param(),
    type: 'lowpass',
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const filter = node();
  const delay = node();
  const gains: ReturnType<typeof node>[] = [];
  const context = {
    state: 'running',
    currentTime: 10,
    destination: {},
    createGain: vi.fn(() => {
      const gain = node();
      gains.push(gain);
      return gain;
    }),
    createBiquadFilter: vi.fn(() => filter),
    createDelay: vi.fn(() => delay),
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
    gains,
  };
}

afterEach(() => vi.unstubAllGlobals());
describe('recorded sounds / H1', () => {
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
