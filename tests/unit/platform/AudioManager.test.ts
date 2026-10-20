/// <reference lib="dom" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  response,
  setupAudioContext as setup,
} from '../../helpers/audioContextDouble.ts';

function deferred<T>() {
  let settle: (value: T) => void = () => {
    throw new Error('Promise not initialized');
  };
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, resolve: (value: T) => settle(value) };
}

async function saturatedTails(extraClips: readonly string[] = []) {
  const state = setup();
  const { audio, advanceTo } = state;
  for (const id of [
    'diesel-running',
    'audio.horn.steam_local',
    ...extraClips,
  ]) {
    audio.audition(id);
    await advanceTo(10);
  }
  audio.stopAll();
  await advanceTo(10);
  for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog']) audio.play(id, 1, 40);
  const wheels = {
    key: 'wheels',
    id: 'wheels',
    gain: 1,
    rate: 1,
    priority: 60,
  };
  audio.setLayers([
    wheels,
    { key: 'engine', id: 'diesel-idle', gain: 1, rate: 1, priority: 70 },
    { key: 'bell', id: 'crossing-bell', gain: 1, rate: 1, priority: 90 },
  ]);
  await advanceTo(10);
  expect(audio.diagnostics.active).toHaveLength(8);
  audio.setLayers([
    wheels,
    { key: 'engine', id: 'diesel-running', gain: 1, rate: 1, priority: 70 },
    { key: 'ambient', id: 'forest', gain: 1, rate: 1, priority: 10 },
  ]);
  await advanceTo(10);
  expect(audio.diagnostics.retiringSources).toBe(2);
  expect(state.voices.filter((source) => source.playing)).toHaveLength(10);
  return state;
}

afterEach(() => vi.unstubAllGlobals());
describe('recorded sounds / H1', () => {
  it('defers a third steam stroke until the oldest ends after a 10ms ramp, replacing only the pending duration', async () => {
    const { audio, context, voices, gains, advanceTo } = setup();
    audio.unlock();
    audio.setLayers([
      {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      },
    ]);
    await advanceTo(10);
    audio.chuff(0.58);
    context.currentTime = 10.35;
    audio.chuff(0.25);
    const oldest = voices[0];
    const envelope = gains[2];
    if (!oldest || !envelope) throw new Error('Missing steam stroke');
    context.currentTime = 10.567;
    audio.chuff(0.25);
    expect(oldest.stop).toHaveBeenCalledExactlyOnceWith(10.577);
    expect(envelope.gain.cancelScheduledValues).toHaveBeenCalledWith(10.567);
    expect(envelope.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(
      0,
      10.577,
    );
    context.currentTime = 10.57;
    audio.chuff(0.31);
    expect(oldest.stop).toHaveBeenCalledOnce();
    expect(voices).toHaveLength(2);
    context.currentTime = 10.58; // Stop time passed; ended delivery is deliberately late.
    expect(voices.filter((source) => source.playing)).toHaveLength(2);
    oldest.finish();
    expect(voices).toHaveLength(3);
    expect(voices[2]?.start).toHaveBeenCalledExactlyOnceWith(10.58, 0, 0.31);
    expect(voices.filter((source) => source.playing)).toHaveLength(2);
    expect(audio.diagnostics.sourceCount).toBe(2);
    expect(voices[1]?.stop).not.toHaveBeenCalled();
    audio.dispose();
    for (const source of voices) source.finish();
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
    for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    [10, 10.01, 10.011],
    [10.145, 10.15, 10.151],
  ])(
    'counts retiring steam strokes at %s s without extending their existing end',
    async (requestSec, endSec, deliverySec) => {
      const { audio, voices, advanceTo, context } = setup();
      const steam = {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      };
      audio.unlock();
      audio.setLayers([steam]);
      await advanceTo(10);
      audio.chuff(0.58);
      audio.chuff(0.25);
      audio.setLayers([]);
      audio.setLayers([steam]);
      await advanceTo(10);
      context.currentTime = requestSec;
      audio.chuff(0.3);
      expect(voices.filter((source) => source.playing)).toHaveLength(2);
      expect(voices[0]?.stop).toHaveBeenLastCalledWith(endSec);
      context.currentTime = deliverySec;
      voices[0]?.finish();
      expect(voices.filter((source) => source.playing)).toHaveLength(2);
      expect(voices.at(-1)?.start).toHaveBeenCalledExactlyOnceWith(
        deliverySec,
        0,
        0.3,
      );
      audio.dispose();
      for (const source of voices) source.finish();
      for (const source of voices)
        expect(source.disconnect).toHaveBeenCalledOnce();
    },
  );

  it('waits for the retired oldest stroke even if the newer stroke ends first', async () => {
    const { audio, voices, advanceTo, context } = setup();
    audio.unlock();
    audio.setLayers([
      {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      },
    ]);
    await advanceTo(10);
    audio.chuff(0.58);
    audio.chuff(0.25);
    expect(voices[0]?.stop).not.toHaveBeenCalled();
    audio.chuff(0.3);
    expect(voices[0]?.stop).toHaveBeenCalledExactlyOnceWith(10.01);
    voices[1]?.finish();
    audio.chuff(0.4);
    expect(voices).toHaveLength(2);
    expect(voices[0]?.stop).toHaveBeenCalledOnce();
    context.currentTime = 10.011;
    voices[0]?.finish();
    expect(voices).toHaveLength(3);
    expect(voices[2]?.start).toHaveBeenCalledExactlyOnceWith(10.011, 0, 0.4);
    audio.dispose();
    for (const source of voices) source.finish();
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
  });

  it('keeps the 11-source ceiling with a pending stroke and cancels it even when tails block an engine change', async () => {
    const { audio, voices, advanceTo, gains } = setup();
    audio.unlock();
    const train = [
      {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      },
      { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
      { key: 'ambient', id: 'forest', gain: 1, rate: 1, priority: 10 },
    ];
    audio.setLayers(train);
    for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog'])
      audio.play(id, 1, 40);
    await advanceTo(10);
    audio.chuff(0.58);
    audio.chuff(0.25);
    const oldest = voices.find(
      (source) => source.start.mock.calls[0]?.[2] === 0.58,
    );
    audio.setLayers([
      ...train,
      { key: 'bell', id: 'crossing-bell', gain: 1, rate: 1, priority: 90 },
    ]);
    await advanceTo(10);
    audio.setLayers(train);
    await advanceTo(10);
    expect(voices.filter((source) => source.playing)).toHaveLength(11);
    expect(audio.diagnostics.retiringSources).toBe(2);
    const before = voices.length;
    audio.chuff(0.31);
    expect(voices).toHaveLength(before);
    expect(oldest?.stop).toHaveBeenCalledExactlyOnceWith(10.01);
    await advanceTo(10.010001);
    expect(voices).toHaveLength(before + 1);
    expect(voices.at(-1)?.start.mock.calls[0]?.[2]).toBe(0.31);
    expect(voices.filter((source) => source.playing)).toHaveLength(11);
    expect(audio.diagnostics.sourceCount).toBe(11);
    expect(audio.diagnostics.retiringSources).toBe(2);
    audio.chuff(0.32);
    audio.setLayers(
      train.map((layer) =>
        layer.key === 'engine'
          ? { ...layer, id: 'diesel-running', pulsed: false }
          : layer,
      ),
    );
    await advanceTo(10.030001);
    expect(
      voices.filter((source) => source.start.mock.calls[0]?.[2] !== undefined),
    ).toHaveLength(3);
    expect(
      voices.filter((source) => source.playing).length,
    ).toBeLessThanOrEqual(11);
    expect(audio.diagnostics.retiringSources).toBeLessThanOrEqual(2);
    audio.dispose();
    await advanceTo(11);
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
    for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledOnce();
  });

  it.each([
    'stopAll',
    'suspend',
    'mute',
    'dispose',
    'layer',
    'engine-key',
    'non-pulsed',
  ] as const)(
    'cancels a pending steam stroke on %s, including late ended delivery',
    async (cleanup) => {
      const { audio, context, voices, gains, advanceTo } = setup();
      const steam = {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      };
      audio.unlock();
      audio.setLayers([steam]);
      await advanceTo(10);
      audio.chuff(0.58);
      audio.chuff(0.25);
      audio.chuff(0.3);
      expect(voices[0]?.stop).toHaveBeenCalledExactlyOnceWith(10.01);
      if (cleanup === 'stopAll') audio.stopAll();
      else if (cleanup === 'suspend') audio.suspend();
      else if (cleanup === 'mute') audio.setEnabled(false);
      else if (cleanup === 'dispose') audio.dispose();
      else if (cleanup === 'layer') audio.setLayers([]);
      else if (cleanup === 'engine-key')
        audio.setLayers([{ ...steam, key: 'other' }]);
      else audio.setLayers([{ ...steam, pulsed: false }]);
      context.currentTime = 10.02;
      for (const source of [...voices]) source.finish();
      await advanceTo(10.02);
      expect(voices.filter((source) => !source.loop)).toHaveLength(2);
      if (cleanup !== 'dispose') audio.dispose();
      for (const source of voices) source.finish();
      for (const source of voices)
        expect(source.disconnect).toHaveBeenCalledOnce();
      for (const gain of gains) expect(gain.disconnect).toHaveBeenCalledOnce();
    },
  );

  it.each(['cow', 'sheep'])(
    'switches a playing audition to %s without a delayed context suspension freezing it',
    async (id) => {
      const { audio, context, voices } = setup();
      audio.audition('sheep');
      await vi.waitFor(() => expect(voices).toHaveLength(1));

      const suspended = deferred<void>();
      context.suspend.mockImplementation(() =>
        suspended.promise.then(() => {
          context.state = 'suspended';
        }),
      );
      context.suspend.mockClear();
      audio.audition(id);
      await vi.waitFor(() => expect(voices).toHaveLength(2));
      suspended.resolve();
      await suspended.promise;

      expect(context.state).toBe('running');
      expect(context.suspend).not.toHaveBeenCalled();
      expect(voices[0]?.stop).toHaveBeenCalledOnce();
      expect(voices[1]?.start).toHaveBeenCalledOnce();
      expect(audio.diagnostics.active.map((voice) => voice.id)).toEqual([id]);
      audio.dispose();
    },
  );
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
  it('does not add chuff sources to a non-pulsed engine loop', async () => {
    const { audio, voices } = setup();
    audio.unlock();
    audio.setLayers([
      { key: 'engine', id: 'steam-chuff', gain: 1, rate: 1, priority: 70 },
    ]);
    await vi.waitFor(() => expect(voices).toHaveLength(1));
    audio.chuff(0.1);
    audio.chuff(0.1);
    expect(voices).toHaveLength(1);
    audio.dispose();
  });
  it('finishes a coalesced empty layer set without another frame', async () => {
    const { audio, voices, gains, advanceTo } = setup();
    audio.audition('diesel-running');
    await advanceTo(10);
    audio.stopAll();
    await advanceTo(10);
    const layer = (id: string) => [
      { key: 'engine', id, gain: 1, rate: 1, priority: 70 },
    ];
    audio.setLayers(layer('diesel-idle'));
    await advanceTo(10);
    audio.setLayers(layer('diesel-running'));
    await advanceTo(10);
    expect(audio.diagnostics.active.map((voice) => voice.id)).toEqual([
      'diesel-running',
    ]);
    audio.setLayers([]);
    await advanceTo(10.01);
    await advanceTo(10.16);
    expect(voices.filter((source) => source.playing)).toEqual([]);
    expect(audio.diagnostics.active).toEqual([]);
    expect(audio.diagnostics.retiringSources).toBe(0);
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
    for (const gain of gains.slice(1))
      expect(gain.disconnect).toHaveBeenCalledOnce();
    audio.dispose();
  });
  it('admits a cached priority horn during saturated tails within the short ramp', async () => {
    const { audio, voices, advanceTo } = await saturatedTails();
    audio.play('audio.horn.steam_local', 1, 100);
    await advanceTo(10);
    expect(voices.filter((source) => source.playing)).toHaveLength(10);
    await advanceTo(10.01);
    expect(audio.diagnostics.active.map((voice) => voice.id)).toContain(
      'audio.horn.steam_local',
    );
    expect(voices.filter((source) => source.playing)).toHaveLength(10);
    expect(audio.diagnostics.retiringSources).toBe(2);
    await advanceTo(10.16);
    expect(voices.filter((source) => source.playing)).toHaveLength(8);
    audio.dispose();
    await advanceTo(11);
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
  });
  it('keeps only the highest-priority waiting shot and coalesces duplicate requests', async () => {
    const { audio, voices, advanceTo } = await saturatedTails([
      'audio.horn.diesel_shunter',
      'audio.horn.steam_express',
    ]);
    const playedBefore = audio.diagnostics.played.length;
    audio.play('audio.horn.steam_local', 0.2, 80);
    await advanceTo(10);
    for (let request = 0; request < 20; request++) {
      audio.play('audio.horn.diesel_shunter', 1, 100);
      audio.play('audio.horn.steam_express', 0.2, 80);
      audio.play('audio.horn.steam_local', 1, 100);
      audio.play('cow', 1, 40);
    }
    await advanceTo(10);
    await advanceTo(10.01);
    expect(voices.filter((source) => source.playing)).toHaveLength(10);
    await advanceTo(10.16);
    await advanceTo(13.02);
    expect(audio.diagnostics.played.slice(playedBefore)).toEqual([
      'audio.horn.diesel_shunter',
    ]);
    audio.dispose();
  });
  it.each([0.249, 0.251])(
    'checks the original animal deadline when tail ended is delivered after %s seconds',
    async (delaySec) => {
      const { audio, voices, advanceTo } = await saturatedTails(['frog']);
      const playedBefore = audio.diagnostics.played.length;
      audio.play('frog', 1, 60);
      await advanceTo(10);
      await advanceTo(10 + delaySec);
      expect(audio.diagnostics.played.slice(playedBefore)).toEqual(
        delaySec < 0.25 ? ['frog'] : [],
      );
      expect(
        voices.filter((source) => source.playing).length,
      ).toBeLessThanOrEqual(10);
      audio.dispose();
    },
  );
  it.each(['suspend', 'stopAll', 'disable', 'dispose'] as const)(
    'cancels a waiting priority shot and coalesced layers on %s, including late ended',
    async (action) => {
      const { audio, voices, gains, advanceTo } = await saturatedTails();
      audio.play('audio.horn.steam_local');
      await advanceTo(10);
      const playedBefore = audio.diagnostics.played.length;
      if (action === 'disable') audio.setEnabled(false);
      else audio[action]();
      // Reusing the manager before old ended events arrive must not revive requests.
      if (action !== 'dispose') {
        audio.setEnabled(true);
        audio.unlock();
        audio.play('frog', 1, 40);
      }
      await advanceTo(10.02);
      await advanceTo(10.2);
      expect(audio.diagnostics.played.slice(playedBefore)).toEqual(
        action === 'dispose' ? [] : ['frog'],
      );
      expect(audio.diagnostics.active.map((voice) => voice.id)).toEqual(
        action === 'dispose' ? [] : ['frog'],
      );
      audio.dispose();
      await advanceTo(11);
      expect(voices.filter((source) => source.playing)).toEqual([]);
      for (const source of voices)
        expect(source.disconnect).toHaveBeenCalledOnce();
      for (const gain of gains.slice(1))
        expect(gain.disconnect).toHaveBeenCalledOnce();
    },
  );
  it('does not queue a one-shot that cannot beat any admitted voice', async () => {
    const { audio, advanceTo } = setup();
    audio.unlock();
    for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog', 'frog'])
      audio.play(id, 1, 40);
    await advanceTo(10);
    expect(audio.diagnostics.active).toHaveLength(5);
    await advanceTo(13);
    expect(audio.diagnostics.active).toEqual([]);
    expect(audio.diagnostics.played).not.toContain('frog');
    audio.dispose();
  });
  it('preserves the 11-source ceiling when a priority horn waits beside two steam strokes', async () => {
    const { audio, voices, advanceTo } = setup();
    audio.audition('audio.horn.steam_local');
    await advanceTo(10);
    audio.stopAll();
    await advanceTo(10);
    const train = [
      {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      },
      { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
      { key: 'ambient', id: 'forest', gain: 1, rate: 1, priority: 10 },
    ];
    audio.setLayers(train);
    for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog'])
      audio.play(id, 1, 40);
    await advanceTo(10);
    audio.chuff(0.1);
    audio.chuff(0.1);
    audio.setLayers([
      ...train,
      { key: 'bell', id: 'crossing-bell', gain: 1, rate: 1, priority: 90 },
    ]);
    await advanceTo(10);
    audio.setLayers(train);
    await advanceTo(10);
    expect(audio.diagnostics.retiringSources).toBe(2);
    expect(voices.filter((source) => source.playing)).toHaveLength(11);
    audio.play('audio.horn.steam_local');
    await advanceTo(10);
    await advanceTo(10.01);
    expect(audio.diagnostics.active.map((voice) => voice.id)).toContain(
      'audio.horn.steam_local',
    );
    expect(voices.filter((source) => source.playing)).toHaveLength(11);
    expect(audio.diagnostics.sourceCount).toBe(11);
    audio.dispose();
    await advanceTo(11);
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
  });
  it.each([60, 80])(
    'does not extend a waiting animal deadline with a duplicate at priority %i',
    async (priority) => {
      const { audio, context, advanceTo } = await saturatedTails(['frog']);
      const playedBefore = audio.diagnostics.played.length;
      audio.play('frog', 1, 60);
      await advanceTo(10);
      // Delay delivery of ended while a duplicate arrives near the original deadline.
      context.currentTime = 10.24;
      audio.play('frog', 1, priority);
      await new Promise<void>((resolve) => setImmediate(resolve));
      await advanceTo(10.251);
      expect(audio.diagnostics.played.slice(playedBefore)).toEqual([]);
      audio.dispose();
    },
  );
  it('keeps the raised priority of a stronger same-ID duplicate within the original deadline', async () => {
    const { audio, context, advanceTo } = await saturatedTails([
      'frog',
      'duck',
    ]);
    const playedBefore = audio.diagnostics.played.length;
    audio.play('frog', 1, 60);
    await advanceTo(10);
    context.currentTime = 10.1;
    audio.play('frog', 1, 80);
    // Only a strictly stronger different ID may replace the waiting record.
    audio.play('duck', 1, 70);
    await new Promise<void>((resolve) => setImmediate(resolve));
    await advanceTo(10.2);
    expect(audio.diagnostics.played.slice(playedBefore)).toEqual(['frog']);
    audio.dispose();
  });
  it('reports allocation failure during an ended retry and releases the shot slot', async () => {
    const { audio, context, advanceTo } = await saturatedTails();
    audio.play('audio.horn.steam_local');
    await advanceTo(10);
    context.createBufferSource.mockImplementationOnce(() => {
      throw new Error('no node on retry');
    });
    await advanceTo(10.01);
    expect(audio.diagnostics.failures).toEqual([
      { file: 'play:audio.horn.steam_local', reason: 'no node on retry' },
    ]);
    audio.play('frog', 1, 40);
    await advanceTo(10.01);
    expect(audio.diagnostics.active.map((voice) => voice.id)).toContain('frog');
    audio.dispose();
  });
  it('retries the priority shot when an admitted one-shot naturally ends before the short tail', async () => {
    const { audio, voices, context, advanceTo } = await saturatedTails();
    audio.play('audio.horn.steam_local');
    await advanceTo(10);
    const animal = voices.find((source) => source.playing && !source.loop);
    if (!animal) throw new Error('playing animal missing');
    context.currentTime = 10.005;
    animal.finish();
    await advanceTo(10.005);
    expect(audio.diagnostics.active.map((voice) => voice.id)).toContain(
      'audio.horn.steam_local',
    );
    expect(voices.filter((source) => source.playing)).toHaveLength(10);
    audio.dispose();
  });
  it('retries the priority shot when the first retiring steam stroke frees capacity', async () => {
    const { audio, voices, advanceTo } = setup();
    for (const id of ['audio.horn.steam_local', 'diesel-running']) {
      audio.audition(id);
      await advanceTo(10);
    }
    audio.stopAll();
    await advanceTo(10);
    const surroundings = [
      { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
      { key: 'ambient', id: 'forest', gain: 1, rate: 1, priority: 10 },
    ];
    audio.setLayers([
      ...surroundings,
      {
        key: 'engine',
        id: 'steam-chuff',
        pulsed: true,
        gain: 1,
        rate: 1,
        priority: 70,
      },
    ]);
    for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog'])
      audio.play(id, 1, 40);
    await advanceTo(10);
    audio.chuff(0.005);
    audio.chuff(0.1);
    audio.setLayers([
      ...surroundings,
      { key: 'engine', id: 'diesel-running', gain: 1, rate: 1, priority: 70 },
    ]);
    await advanceTo(10);
    expect(audio.diagnostics.retiringSources).toBe(2);
    audio.play('audio.horn.steam_local');
    await advanceTo(10);
    await advanceTo(10.005);
    expect(audio.diagnostics.active.map((voice) => voice.id)).toContain(
      'audio.horn.steam_local',
    );
    expect(voices.filter((source) => source.playing)).toHaveLength(10);
    expect(audio.diagnostics.retiringSources).toBe(2);
    audio.dispose();
    await advanceTo(11);
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
  });
  it.each(['diesel', 'bell', 'ambient', 'chuffs'] as const)(
    'bounds every started-but-not-ended source during rapid %s transitions',
    async (scenario) => {
      const { audio, voices, advanceTo, gains } = setup();
      audio.unlock();
      // Warm all toggled clips before the controlled 30ms transition sequence.
      for (const id of [
        'diesel-idle',
        'diesel-running',
        'crossing-bell',
        'forest',
        'meadow',
        'steam-chuff',
      ]) {
        audio.audition(id);
        await vi.waitFor(() =>
          expect(audio.diagnostics.played.at(-1)).toBe(id),
        );
      }
      audio.stopAll();
      await advanceTo(10);
      const startIndex = voices.length;
      for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog']) audio.play(id);
      await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(5));
      const ceiling = scenario === 'chuffs' ? 11 : 10;
      let maximum = 0;
      for (let step = 0; step < 30; step++) {
        await advanceTo(10 + step * 0.03);
        const odd = step % 2 === 1;
        const previousStops = new Map(
          voices.map((source) => [source, source.stop.mock.calls.length]),
        );
        audio.setLayers([
          { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
          {
            key: 'engine',
            id:
              scenario === 'chuffs'
                ? odd
                  ? 'diesel-running'
                  : 'steam-chuff'
                : odd
                  ? 'diesel-running'
                  : 'diesel-idle',
            gain: 1,
            rate: 1,
            priority: 70,
            pulsed: scenario === 'chuffs' && !odd,
          },
          {
            key: 'ambient',
            id: scenario === 'ambient' && odd ? 'meadow' : 'forest',
            gain: 1,
            rate: 1,
            priority: 10,
          },
          ...(scenario !== 'diesel' && odd
            ? [
                {
                  key: 'bell',
                  id: 'crossing-bell',
                  gain: 1,
                  rate: 1,
                  priority: 90,
                },
              ]
            : []),
        ]);
        await advanceTo(10 + step * 0.03);
        if (scenario === 'chuffs') {
          audio.chuff(0.1);
          audio.chuff(0.1);
        }
        for (const source of voices.slice(startIndex))
          for (const [end] of source.stop.mock.calls.slice(
            previousStops.get(source) ?? 0,
          ))
            if (end !== undefined)
              expect(end - (10 + step * 0.03)).toBeGreaterThanOrEqual(
                0.01 - 1e-9,
              );
        const started = voices
          .slice(startIndex)
          .filter((source) => source.playing);
        maximum = Math.max(maximum, started.length);
        expect(started.length, `step ${step}`).toBeLessThanOrEqual(ceiling);
        expect(audio.diagnostics.sourceCount).toBe(started.length);
        expect(audio.diagnostics.retiringSources).toBeLessThanOrEqual(2);
        const keys = audio.diagnostics.retiring.map((tail) => tail.key);
        expect(new Set(keys).size).toBe(keys.length);
        // A saturated tail allowance permits the priority bell after a 10ms release.
        await advanceTo(10 + step * 0.03 + 0.010001);
        expect(
          voices.slice(startIndex).filter((source) => source.playing).length,
        ).toBeLessThanOrEqual(ceiling);
        expect(audio.diagnostics.active.length).toBeLessThanOrEqual(8);
        expect(
          audio.diagnostics.active.filter((v) => v.kind === 'loop').length,
        ).toBeLessThanOrEqual(3);
        if (odd && scenario !== 'diesel')
          expect(
            audio.diagnostics.active.some((v) => v.id === 'crossing-bell'),
          ).toBe(true);
      }
      expect(maximum).toBeGreaterThan(8); // Actually exercised retired sources/chuffs.
      expect(
        gains.some((gain) =>
          gain.gain.linearRampToValueAtTime.mock.calls.some(
            ([value, end]) =>
              value === 0 && typeof end === 'number' && end < 10.15,
          ),
        ),
      ).toBe(true);
      await advanceTo(12.95);
      audio.dispose();
      await advanceTo(13);
      expect(voices.filter((source) => source.playing)).toEqual([]);
      for (const source of voices)
        expect(source.disconnect).toHaveBeenCalledOnce();
      for (const gain of gains) expect(gain.connections.size).toBe(0);
    },
  );
  it('fades a stolen ambient voice for 150 ms and hands over its budget immediately', async () => {
    const { audio, context, voices, gains } = setup();
    audio.unlock();
    const train = [
      { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
      { key: 'engine', id: 'diesel-idle', gain: 1, rate: 1, priority: 70 },
    ];
    audio.setLayers([
      ...train,
      { key: 'ambient', id: 'forest', gain: 1, rate: 1, priority: 10 },
    ]);
    await vi.waitFor(() => expect(voices).toHaveLength(3));
    const ambient = voices[2];
    const envelope = gains[3];
    context.currentTime = 11;
    audio.setLayers([
      ...train,
      { key: 'ambient', id: 'meadow', gain: 1, rate: 1, priority: 10 },
      { key: 'bell', id: 'crossing-bell', gain: 1, rate: 1, priority: 90 },
    ]);
    for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog']) audio.play(id);
    await vi.waitFor(() => expect(audio.diagnostics.active).toHaveLength(8));
    expect(ambient?.stop).toHaveBeenLastCalledWith(11.15);
    expect(ambient?.stop.mock.calls.every((call) => call.length === 1)).toBe(
      true,
    );
    expect(envelope?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      11.15,
    );
    expect(ambient?.disconnect).not.toHaveBeenCalled();
    expect(
      audio.diagnostics.active.filter((v) => v.kind === 'loop'),
    ).toHaveLength(3);
    ambient?.finish();
    expect(ambient?.disconnect).toHaveBeenCalledOnce();
    expect(envelope?.disconnect).toHaveBeenCalledOnce();
    // Finishing a retired tail must not release its already handed-over slot twice.
    audio.setLayers([
      ...train,
      { key: 'ambient', id: 'meadow', gain: 1, rate: 1, priority: 10 },
      { key: 'bell', id: 'crossing-bell', gain: 1, rate: 1, priority: 90 },
    ]);
    audio.play('frog', 1, 1);
    await vi.waitFor(() => expect(audio.diagnostics.loaded).toBe(11));
    expect(audio.diagnostics.active).toHaveLength(8);
    expect(voices).toHaveLength(9);
    audio.dispose();
    for (const source of voices)
      expect(source.disconnect).toHaveBeenCalledOnce();
  });
  it('does not retrigger an animal id while its stolen voice is still fading', async () => {
    const { audio, voices } = setup();
    audio.unlock();
    for (const id of ['cow', 'sheep', 'hen', 'cat', 'dog'])
      audio.play(id, 1, 10);
    await vi.waitFor(() => expect(voices).toHaveLength(5));
    audio.play('audio.horn.steam_local', 1, 100);
    await vi.waitFor(() => expect(voices).toHaveLength(6));
    audio.play('cow', 1, 100);
    // A later uncached request proves the cached cow consumer has reconciled.
    audio.play('frog', 1, 1);
    await vi.waitFor(() => expect(audio.diagnostics.loaded).toBe(7));
    expect(voices).toHaveLength(6);
    voices[0]?.finish();
    audio.play('cow', 1, 100);
    await vi.waitFor(() => expect(voices).toHaveLength(7));
    audio.dispose();
  });
  it('resumes the ambient loop at its elapsed position after the bell releases its slot', async () => {
    const { audio, context, voices } = setup();
    audio.unlock();
    const layers = [
      { key: 'wheels', id: 'wheels', gain: 1, rate: 1, priority: 60 },
      { key: 'engine', id: 'diesel-idle', gain: 1, rate: 1, priority: 70 },
      { key: 'ambient', id: 'forest', gain: 1, rate: 1, priority: 10 },
    ];
    audio.setLayers(layers);
    await vi.waitFor(() => expect(voices).toHaveLength(3));
    context.currentTime = 11;
    audio.setLayers([
      ...layers,
      { key: 'bell', id: 'crossing-bell', gain: 1, rate: 1, priority: 90 },
    ]);
    await vi.waitFor(() => expect(voices).toHaveLength(4));
    expect(voices[2]?.stop).toHaveBeenCalledExactlyOnceWith(11.15);
    context.currentTime = 12;
    audio.setLayers(layers);
    await vi.waitFor(() => expect(voices).toHaveLength(5));
    expect(voices[4]?.start).toHaveBeenCalledWith(0, 2.12);
    expect(audio.diagnostics.active).toHaveLength(3);
    audio.dispose();
  });
  it.each([
    ['diesel clip change', 'engine', 'diesel-idle', 'diesel-running'],
    ['crossing opens', 'bell', 'crossing-bell', undefined],
    ['wheels stop', 'wheels', 'wheels', undefined],
  ] as const)(
    'fades the old layer for 150 ms: %s',
    async (_name, key, id, next) => {
      const { audio, context, voices, gains } = setup();
      audio.unlock();
      const layer = (clip: string) => [
        { key, id: clip, gain: 1, rate: 1, priority: 70 },
      ];
      audio.setLayers(layer(id));
      await vi.waitFor(() => expect(voices).toHaveLength(1));
      context.currentTime = 11;
      const heldGain = gains[1]?.gain.value;
      audio.setLayers(next ? layer(next) : []);
      expect(gains[1]?.gain.cancelScheduledValues).toHaveBeenCalledWith(11);
      expect(gains[1]?.gain.setValueAtTime).toHaveBeenCalledWith(heldGain, 11);
      expect(gains[1]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        11.15,
      );
      expect(voices[0]?.stop).toHaveBeenCalledExactlyOnceWith(11.15);
      expect(voices[0]?.disconnect).not.toHaveBeenCalled();
      if (next) await vi.waitFor(() => expect(voices).toHaveLength(2));
      expect(audio.diagnostics.active.length).toBe(next ? 1 : 0);
      audio.dispose();
      voices[0]?.finish();
      for (const source of voices)
        expect(source.disconnect).toHaveBeenCalledOnce();
      expect(audio.diagnostics.active).toEqual([]);
    },
  );
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
    for (const [index, voice] of voices.entries()) {
      expect(voice.stop).toHaveBeenCalledExactlyOnceWith(
        index === 0 ? 10.01 : 10.15,
      );
      expect(voice.disconnect).not.toHaveBeenCalled();
      voice.finish();
      expect(voice.disconnect).toHaveBeenCalledOnce();
    }
    audio.dispose();
  });
});
