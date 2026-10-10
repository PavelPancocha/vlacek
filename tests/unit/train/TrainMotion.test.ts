import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import type { MotionIntent } from '../../../src/domain/input/InputReducer.ts';
import {
  motionParams,
  stepMotion,
  type MotionParams,
} from '../../../src/domain/train/TrainMotion.ts';

const dtSec = 1 / gameConfig.simulation.fixedHz;
const standard = motionParams(gameConfig, 1);

function run(
  params: MotionParams,
  startSpeed: number,
  intent: MotionIntent,
  ticks: number,
  grade = 0,
) {
  let speed = startSpeed;
  let distance = 0;
  const speeds: number[] = [];
  for (let i = 0; i < ticks; i++) {
    const step = stepMotion(speed, intent, grade, params, dtSec);
    speed = step.speedUPerSec;
    distance += step.distanceU;
    speeds.push(speed);
  }
  return { speed, distance, speeds };
}

function ticksUntilStop(startSpeed: number, intent: MotionIntent) {
  let speed = startSpeed;
  let distance = 0;
  let ticks = 0;
  while (speed > 0 && ticks < 10_000) {
    const step = stepMotion(speed, intent, 0, standard, dtSec);
    speed = step.speedUPerSec;
    distance += step.distanceU;
    ticks++;
  }
  return { ticks, distance };
}

describe('TrainMotion', () => {
  it('derives parameters from doc 13 and the parent speed factor', () => {
    expect(standard.maxSpeedUPerSec).toBe(180);
    expect(motionParams(gameConfig, 0.65).maxSpeedUPerSec).toBeCloseTo(117);
  });

  it('INP-01: throttle accelerates monotonically and never exceeds the limit', () => {
    const { speeds } = run(standard, 0, 'THROTTLE', 10 * 60);
    expect(speeds[59]).toBeCloseTo(65, 5);
    for (let i = 1; i < speeds.length; i++) {
      expect(speeds[i]).toBeGreaterThanOrEqual(speeds[i - 1] ?? 0);
      expect(speeds[i]).toBeLessThanOrEqual(180);
    }
    expect(speeds.at(-1)).toBe(180);
  });

  it('INP-02: coasting from full speed stops in ~6 s after ~540 u', () => {
    const { ticks, distance } = ticksUntilStop(180, 'COAST');
    expect(Math.abs(ticks - 360)).toBeLessThanOrEqual(2);
    expect(distance).toBeCloseTo(540, 0);
  });

  it('INP-03: braking from full speed stops in ~1 s after ~90 u', () => {
    const { ticks, distance } = ticksUntilStop(180, 'BRAKE');
    expect(Math.abs(ticks - 60)).toBeLessThanOrEqual(2);
    expect(distance).toBeCloseTo(90, 0);
  });

  it('snaps speeds below the stop epsilon to zero', () => {
    expect(stepMotion(0.6, 'COAST', 0, standard, dtSec).speedUPerSec).toBe(0);
  });

  describe('TRN-05: grades', () => {
    it('uphill throttle settles 10 % below the limit with weaker acceleration', () => {
      const first = stepMotion(0, 'THROTTLE', 0.12, standard, dtSec);
      expect(first.speedUPerSec).toBeCloseTo(65 * 0.75 * dtSec, 9);
      expect(run(standard, 0, 'THROTTLE', 20 * 60, 0.12).speed).toBeCloseTo(
        162,
        6,
      );
    });

    it('entering an uphill above its target slows by at most coast deceleration', () => {
      const step = stepMotion(180, 'THROTTLE', 0.12, standard, dtSec);
      expect(step.speedUPerSec).toBeCloseTo(180 - 30 * dtSec, 9);
    });

    it('downhill still decelerates without a finger and never exceeds the limit', () => {
      const coasting = run(standard, 100, 'COAST', 60, -0.12);
      expect(coasting.speed).toBeCloseTo(70, 6);
      expect(
        Math.max(...run(standard, 0, 'THROTTLE', 20 * 60, -0.12).speeds),
      ).toBe(180);
    });

    it('never produces negative speed or distance (seeded random sequences)', () => {
      const seed = 20261009;
      let state = seed;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
      };
      const intents: MotionIntent[] = ['THROTTLE', 'COAST', 'BRAKE'];
      let speed = 0;
      for (let i = 0; i < 20_000; i++) {
        const intent = intents[Math.floor(random() * 3)] ?? 'COAST';
        const grade = (random() * 2 - 1) * 0.12;
        const step = stepMotion(speed, intent, grade, standard, dtSec);
        expect(
          step.speedUPerSec,
          `seed ${seed} step ${i}`,
        ).toBeGreaterThanOrEqual(0);
        expect(step.speedUPerSec, `seed ${seed} step ${i}`).toBeLessThanOrEqual(
          180,
        );
        expect(step.distanceU, `seed ${seed} step ${i}`).toBeGreaterThanOrEqual(
          0,
        );
        speed = step.speedUPerSec;
      }
    });
  });
});
