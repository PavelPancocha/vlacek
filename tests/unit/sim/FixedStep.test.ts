import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  advanceFixedStep,
  initialFixedStep,
  type FixedStepParams,
} from '../../../src/domain/sim/FixedStep.ts';
import {
  motionParams,
  stepMotion,
} from '../../../src/domain/train/TrainMotion.ts';

const params: FixedStepParams = {
  stepSec: 1 / gameConfig.simulation.fixedHz,
  maxStepsPerFrame: gameConfig.simulation.maxCatchUpSteps,
};

function ticksFor(frameSec: number, totalSec: number): number {
  let state = initialFixedStep();
  let ticks = 0;
  const frames = Math.round(totalSec / frameSec);
  for (let i = 0; i < frames; i++) {
    const result = advanceFixedStep(state, frameSec, params);
    state = result.state;
    ticks += result.steps;
  }
  return ticks;
}

describe('FixedStep', () => {
  it('runs 60 simulation steps per second at 30, 60 and 120 FPS', () => {
    expect(ticksFor(1 / 30, 10)).toBe(600);
    expect(ticksFor(1 / 60, 10)).toBe(600);
    expect(ticksFor(1 / 120, 10)).toBe(600);
  });

  it('exposes the interpolation fraction of the next step', () => {
    const result = advanceFixedStep(initialFixedStep(), 1.5 / 60, params);
    expect(result.steps).toBe(1);
    expect(result.alpha).toBeCloseTo(0.5, 9);
  });

  it('caps catch-up at five steps and drops the remaining backlog', () => {
    const result = advanceFixedStep(initialFixedStep(), 3, params);
    expect(result.steps).toBe(5);
    expect(result.droppedSec).toBeCloseTo(3 - 5 / 60, 9);
    expect(advanceFixedStep(result.state, 1 / 60, params).steps).toBe(1);
  });

  it('treats negative or non-finite frame times as no time', () => {
    for (const delta of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = advanceFixedStep(initialFixedStep(), delta, params);
      expect(result.steps).toBe(0);
    }
  });

  it('TRN-04: travelled distance does not depend on the render frame rate', () => {
    const motion = motionParams(gameConfig, 1);
    function distanceAt(fps: number) {
      let state = initialFixedStep();
      let speed = 0;
      let distance = 0;
      for (let frame = 0; frame < 8 * fps; frame++) {
        const result = advanceFixedStep(state, 1 / fps, params);
        state = result.state;
        for (let i = 0; i < result.steps; i++) {
          // Input changes at the same wall-clock instant (4 s) for every rate.
          const intent = frame < 4 * fps ? 'THROTTLE' : 'COAST';
          const step = stepMotion(speed, intent, 0, motion, params.stepSec);
          speed = step.speedUPerSec;
          distance += step.distanceU;
        }
      }
      return distance;
    }
    const reference = distanceAt(60);
    expect(distanceAt(30)).toBeCloseTo(reference, 6);
    expect(distanceAt(120)).toBeCloseTo(reference, 6);
  });
});
