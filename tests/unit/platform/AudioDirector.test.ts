import { gameConfig } from '../../../src/config/gameConfig.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setupAudioContext } from '../../helpers/audioContextDouble.ts';
import { AudioManager } from '../../../src/platform/AudioManager.ts';
import {
  ambientSound,
  AudioDirector,
  chuffRate,
  ChuffDistance,
  coveredFraction,
  crossingBellGain,
  wheelSound,
} from '../../../src/platform/audio/AudioDirector.ts';

function recordSteam(wheelRadiusU: number) {
  const audio = new AudioManager();
  const director = new AudioDirector(audio);
  const strokes: { startSec: number; durationSec: number }[] = [];
  let nowSec = 0;
  vi.spyOn(audio, 'setLayers').mockImplementation(() => {});
  vi.spyOn(audio, 'setCovered').mockImplementation(() => {});
  vi.spyOn(audio, 'chuff').mockImplementation((durationSec) => {
    strokes.push({ startSec: nowSec, durationSec });
  });
  return {
    strokes,
    update(speedUPerSec: number, distanceU: number, startSec = 0) {
      nowSec = startSec;
      director.update({
        power: 'steam',
        speedUPerSec,
        distanceU,
        wheelRadiusU,
        throttle: true,
        biome: 'countryside',
        covered: 0,
        bellGain: 0,
      });
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

async function playRamp(
  radiusU: number,
  fps: number,
  initialSpeedUPerSec: number,
  decelerationUPerSec2 = gameConfig.train.accelerationUPerSec2,
) {
  const train = gameConfig.train;
  const state = setupAudioContext();
  const { audio, context, voices, advanceTo } = state;
  const director = new AudioDirector(audio);
  const requests: { startSec: number; durationSec: number }[] = [];
  const chuff = audio.chuff.bind(audio);
  let requesting = false;
  vi.spyOn(audio, 'chuff').mockImplementation((durationSec) => {
    if (requesting)
      requests.push({ startSec: context.currentTime, durationSec });
    chuff(durationSec);
  });
  const update = (speedUPerSec: number, distanceU: number) => {
    requesting = true;
    director.update({
      power: 'steam',
      speedUPerSec,
      distanceU,
      wheelRadiusU: radiusU,
      throttle: true,
      biome: 'countryside',
      covered: 0,
      bellGain: 0,
    });
    requesting = false;
  };
  audio.unlock();
  update(initialSpeedUPerSec, 0);
  await advanceTo(10);
  if (initialSpeedUPerSec > 0)
    update(initialSpeedUPerSec, (2 * Math.PI * radiusU) / 4);
  const accelerationSec =
    (train.maxSpeedUPerSec - initialSpeedUPerSec) / train.accelerationUPerSec2;
  const endSec = accelerationSec + train.maxSpeedUPerSec / decelerationUPerSec2;
  let previousSpeedUPerSec = initialSpeedUPerSec;
  let maximumLive = 0;
  const advanceAudioTo = async (sec: number) => {
    let dueSec = Math.min(
      ...voices
        .filter((source) => source.playing)
        .map((source) => source.dueSec),
    );
    while (dueSec + 1e-6 < sec) {
      await advanceTo(dueSec + 1e-6); // ended delivery 1 µs after the scheduled end.
      dueSec = Math.min(
        ...voices
          .filter((source) => source.playing)
          .map((source) => source.dueSec),
      );
    }
    await advanceTo(sec);
  };
  for (let frame = 1; frame <= Math.ceil(endSec * fps); frame++) {
    const timeSec = frame / fps;
    await advanceAudioTo(10 + timeSec);
    const speedUPerSec =
      timeSec <= accelerationSec
        ? initialSpeedUPerSec + timeSec * train.accelerationUPerSec2
        : Math.max(
            0,
            train.maxSpeedUPerSec -
              (timeSec - accelerationSec) * decelerationUPerSec2,
          );
    update(speedUPerSec, (previousSpeedUPerSec + speedUPerSec) / (2 * fps));
    previousSpeedUPerSec = speedUPerSec;
    const live = voices.filter(
      (source) => !source.loop && source.playing,
    ).length;
    maximumLive = Math.max(maximumLive, live);
    expect(live).toBeLessThanOrEqual(2);
    expect(audio.diagnostics.sourceCount).toBeLessThanOrEqual(11);
  }
  await advanceAudioTo(10 + endSec + 1);
  const played = voices
    .filter((source) => !source.loop)
    .map((source) => source.start.mock.calls[0]);
  expect(played).toHaveLength(requests.length);
  let deferred = 0;
  for (const [index, request] of requests.entries()) {
    const start = played[index];
    if (!start || start[0] === undefined)
      throw new Error('Missing played steam stroke');
    const delaySec = start[0] - request.startSec;
    expect(delaySec).toBeGreaterThanOrEqual(0);
    expect(delaySec).toBeLessThanOrEqual(0.0100011);
    if (delaySec > 1e-9) deferred++;
    expect(start[2]).toBe(request.durationSec);
  }
  audio.dispose();
  return { maximumLive, deferred, requests };
}

describe('steam chuff rhythm (D-035)', () => {
  it('preserves every distance beat and the old duration at 30 u/s for 10 s at 60 fps', () => {
    const steam = recordSteam(15);
    const oldBeats = new ChuffDistance();
    const oldDurationSec = Math.min(0.58, (2 * Math.PI * 15) / 4 / 30);
    for (let frame = 1; frame <= 600; frame++) {
      const before = steam.strokes.length;
      steam.update(30, 0.5, frame / 60);
      expect(steam.strokes.length - before).toBe(
        oldBeats.advance(0.5, 15) ? 1 : 0,
      );
    }
    expect(
      Math.abs(steam.strokes.length - 300 / ((2 * Math.PI * 15) / 4)),
    ).toBeLessThanOrEqual(1);
    expect(steam.strokes[0]?.startSec).toBe(48 / 60);
    for (const stroke of steam.strokes)
      expect(stroke.durationSec).toBe(oldDurationSec);
  });

  it.each([15, 19])(
    'D-036: caps full-speed chuffs with radius %s u over 10 s at 60 fps',
    (radiusU) => {
      const steam = recordSteam(radiusU);
      for (let frame = 1; frame <= 600; frame++)
        steam.update(
          gameConfig.train.maxSpeedUPerSec,
          gameConfig.train.maxSpeedUPerSec / 60,
          frame / 60,
        );
      expect(steam.strokes.length / 10).toBeGreaterThanOrEqual(2.9);
      expect(steam.strokes.length / 10).toBeLessThanOrEqual(3);
    },
  );

  it.each([15, 19])(
    'lengthens every full-speed chuff with radius %s u to 500 ms',
    (radiusU) => {
      const steam = recordSteam(radiusU);
      for (let frame = 1; frame <= 600; frame++)
        steam.update(
          gameConfig.train.maxSpeedUPerSec,
          gameConfig.train.maxSpeedUPerSec / 60,
          frame / 60,
        );
      expect(steam.strokes.length).toBeGreaterThan(0);
      for (const stroke of steam.strokes) {
        expect(stroke.durationSec).toBeGreaterThanOrEqual(0.2);
        expect(stroke.durationSec).toBeLessThanOrEqual(0.58);
        expect(stroke.durationSec).toBeCloseTo(0.5, 12);
      }
    },
  );

  it.each([
    [15, 47.12388980384689],
    [19, 59.690260418206066],
  ])(
    'D-036: radius %s u reaches the knee at %s u/s',
    (radiusU, kneeSpeedUPerSec) => {
      const intervalU = (2 * Math.PI * radiusU) / 4;
      expect(chuffRate(kneeSpeedUPerSec / intervalU)).toBeCloseTo(2, 12);
      expect(chuffRate(2)).toBe(2);
      expect((chuffRate(2 + 1e-6) - 2) / 1e-6).toBeCloseTo(1, 5);
      expect(chuffRate(3)).toBeCloseTo(2.6321205588285577, 12);
    },
  );

  it.each([15, 19])(
    'has a smooth monotone rate with slope at most 1 for radius %s u',
    (radiusU) => {
      const intervalU = (2 * Math.PI * radiusU) / 4;
      let previousRate = 0;
      // 0.1 u/s steps: dr/db <= 1 bounds each increase by db = 0.1 / intervalU.
      for (let sample = 0; sample <= 6000; sample++) {
        const beatsPerSec = sample / 10 / intervalU;
        const rate = chuffRate(beatsPerSec);
        expect(rate).toBeGreaterThanOrEqual(previousRate);
        expect(rate - previousRate).toBeLessThanOrEqual(
          0.1 / intervalU + 1e-12,
        );
        expect(rate).toBeLessThanOrEqual(3);
        if (beatsPerSec <= 2) expect(rate).toBe(beatsPerSec);
        previousRate = rate;
      }
      expect(chuffRate(2)).toBe(2);
      expect((chuffRate(2 + 1e-6) - 2) / 1e-6).toBeCloseTo(1, 5);
      expect(chuffRate(3)).toBeCloseTo(2.6321205588285577, 12);
      expect(chuffRate(0)).toBe(0);
    },
  );

  it.each([30, 60])(
    'plays every stroke with at most two live on trapezoidal ramps at %s fps, including a primed slow start',
    async (fps) => {
      for (const radiusU of [15, 19])
        for (const initialSpeedUPerSec of [0, 40])
          for (const decelerationUPerSec2 of [
            gameConfig.train.coastDecelerationUPerSec2,
            gameConfig.train.accelerationUPerSec2,
            gameConfig.train.brakeDecelerationUPerSec2,
          ]) {
            const result = await playRamp(
              radiusU,
              fps,
              initialSpeedUPerSec,
              decelerationUPerSec2,
            );
            expect(result.maximumLive).toBe(2);
          }
    },
  );

  it('plays the primed 40 u/s start at the new acceleration without dropping or deferring a stroke', async () => {
    const result = await playRamp(15, 60, 40);
    expect(result.requests[0]).toEqual({ startSec: 10, durationSec: 0.58 });
    expect(result.requests[1]?.startSec).toBeCloseTo(10 + 27 / 60, 12);
    expect(result.requests[2]?.startSec).toBeCloseTo(10 + 48 / 60, 12);
    expect(result.deferred).toBe(0);
  });

  it('carries phase through both knee crossings without extra or missing chuffs and with bounded interval changes', () => {
    const steam = recordSteam(15);
    let previousSpeedUPerSec = 40;
    for (let frame = 1; frame <= 480; frame++) {
      const speedUPerSec =
        frame <= 180
          ? 40 + (5 * frame) / 60
          : frame <= 360
            ? 55 - (5 * (frame - 180)) / 60
            : 30;
      steam.update(
        speedUPerSec,
        (previousSpeedUPerSec + speedUPerSec) / 120,
        frame / 60,
      );
      previousSpeedUPerSec = speedUPerSec;
    }
    // +5 then -5 u/s² through the new knee, then constant 30 u/s.
    // Independently calculated phase crossings retain the accumulated phase.
    expect(
      steam.strokes.map((stroke) => Math.round(stroke.startSec * 60)),
    ).toEqual([
      35, 67, 97, 126, 153, 180, 207, 234, 263, 293, 325, 359, 405, 453,
    ]);
    const intervalU = (2 * Math.PI * 15) / 4;
    // |Δperiod| <= a / (intervalU * minRate³) + two frames of quantization.
    const boundSec = 5 / (intervalU * (40 / intervalU) ** 3) + 2 / 60;
    const times = steam.strokes
      .filter((stroke) => stroke.startSec <= 6)
      .map((stroke) => stroke.startSec);
    for (let index = 2; index < times.length; index++) {
      const current = times[index],
        previous = times[index - 1],
        before = times[index - 2];
      if (
        current === undefined ||
        previous === undefined ||
        before === undefined
      )
        throw new Error('Missing interval');
      expect(
        Math.abs(current - previous - (previous - before)),
      ).toBeLessThanOrEqual(boundSec);
    }
    for (const stroke of steam.strokes.filter(
      (stroke) => stroke.startSec > 6.2,
    ))
      expect(stroke.durationSec).toBe(Math.min(0.58, intervalU / 30));
  });

  it('makes no strokes or phase progress without positive speed and distance', () => {
    const steam = recordSteam(15);
    steam.update(0, 1000);
    steam.update(-10, 1000);
    steam.update(gameConfig.train.maxSpeedUPerSec, 0);
    steam.update(gameConfig.train.maxSpeedUPerSec, -10);
    expect(steam.strokes).toHaveLength(0);
    steam.update(30, 23);
    expect(steam.strokes).toHaveLength(0);
    steam.update(30, 1);
    expect(steam.strokes).toHaveLength(1);
  });

  it('keeps the first capped chuff after one phase beat and discards whole catch-up beats', () => {
    const steam = recordSteam(15);
    for (let frame = 1; frame <= 20; frame++)
      steam.update(
        gameConfig.train.maxSpeedUPerSec,
        gameConfig.train.maxSpeedUPerSec / 60,
      );
    expect(steam.strokes).toHaveLength(0);
    steam.update(
      gameConfig.train.maxSpeedUPerSec,
      gameConfig.train.maxSpeedUPerSec / 60,
    );
    expect(steam.strokes).toHaveLength(1);
    steam.update(gameConfig.train.maxSpeedUPerSec, 8000);
    expect(steam.strokes).toHaveLength(2);
    steam.update(gameConfig.train.maxSpeedUPerSec, 0);
    expect(steam.strokes).toHaveLength(2);
  });
});

describe('recorded audio layer mapping', () => {
  it('D-036: wheels keep their absolute u/s mapping', () => {
    expect(wheelSound(240)).toEqual({ rate: 1.175, gain: 0.42500000000000004 });
  });
  it('wheels are silent at rest and increase rate and gain with speed', () => {
    expect(wheelSound(0).gain).toBe(0);
    expect(wheelSound(200).rate).toBeGreaterThan(wheelSound(50).rate);
    expect(wheelSound(200).gain).toBeGreaterThan(wheelSound(50).gain);
    expect(wheelSound(480).rate).toBeGreaterThan(wheelSound(200).rate);
    expect(wheelSound(480).gain).toBeGreaterThan(wheelSound(200).gain);
  });
  it('selects biome beds, with summer crickets as a single bed', () => {
    expect(ambientSound('forest')).toBe('forest');
    expect(ambientSound('lakes')).toBe('brook');
    expect(ambientSound('coast')).toBe('sea');
    expect(ambientSound('countryside', 'summer')).toBe('crickets');
    expect(ambientSound('forest', 'winter')).toBe('wind');
  });
  it('schedules four chuffs per driving-wheel revolution by travelled distance', () => {
    const chuffs = new ChuffDistance();
    const strokeU = (2 * Math.PI * 15) / 4;
    expect(chuffs.advance(strokeU - 0.01, 15)).toBe(false);
    expect(chuffs.advance(0.02, 15)).toBe(true);
    expect(chuffs.advance(0, 15)).toBe(false);
    expect(chuffs.advance(strokeU * 10, 15)).toBe(true);
    expect(chuffs.advance(0, 15)).toBe(false);
  });
  it('one nearest warning bell fades with distance and stops when opening', () => {
    expect(crossingBellGain([{ phase: 'WARNING', worldX: 0 }], 0, 500)).toBe(1);
    expect(
      crossingBellGain(
        [
          { phase: 'CLOSING', worldX: 250 },
          { phase: 'CLOSED', worldX: 400 },
        ],
        0,
        500,
      ),
    ).toBe(0.5);
    expect(crossingBellGain([{ phase: 'OPENING', worldX: 0 }], 0, 500)).toBe(0);
    expect(crossingBellGain([{ phase: 'CLOSED', worldX: 600 }], 0, 500)).toBe(
      0,
    );
  });
  it('muffles proportionally to actual train span intersecting tunnels', () => {
    expect(coveredFraction(0, 200, [{ fromX: 100, toX: 300 }])).toBe(0.5);
    expect(coveredFraction(120, 200, [{ fromX: 100, toX: 300 }])).toBe(1);
    expect(coveredFraction(0, 90, [{ fromX: 100, toX: 300 }])).toBe(0);
  });
});
