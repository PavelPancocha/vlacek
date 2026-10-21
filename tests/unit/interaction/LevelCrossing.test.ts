import { describe, expect, it } from 'vitest';
import {
  crossingCloseDistanceU,
  gameConfig,
} from '../../../src/config/gameConfig.ts';
import {
  CROSSING_ZONE_HALF_U,
  earliestArrivalSeconds,
  LevelCrossing,
  worstClearingSeconds,
  type CrossingRules,
  type CrossingTrain,
} from '../../../src/domain/interaction/LevelCrossing.ts';

import {
  motionParams,
  stepMotion,
} from '../../../src/domain/train/TrainMotion.ts';

const VMAX = gameConfig.train.maxSpeedUPerSec;
const rules: CrossingRules = {
  crossing: gameConfig.crossing,
  closeDistanceU: crossingCloseDistanceU(gameConfig.crossing, VMAX),
};
const DT = 1 / gameConfig.simulation.fixedHz;
const X = 10_000;

/** A train `lengthU` long whose front is at `frontX`. */
const span = (frontX: number, lengthU = 600): CrossingTrain => ({
  tailX: frontX - lengthU,
  frontX,
  direction: 1,
  speedUPerSec: 0,
  maxSpeedUPerSec: VMAX,
  accelerationUPerSec2:
    gameConfig.train.accelerationUPerSec2 *
    (1 + gameConfig.train.gradeAccelerationFactor),
});

/** Runs the crossing while the train moves; returns what happened. */
function drive(
  crossing: LevelCrossing,
  start: CrossingTrain,
  speedAt: (t: number, train: CrossingTrain) => number,
  seconds: number,
) {
  let train = start;
  const phases: string[] = [];
  let violations = 0;
  let maxCars = 0;
  let maxBikes = 0;
  let openWhileOccupied = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const v = speedAt(i * DT, train);
    train = {
      ...train,
      speedUPerSec: v,
      tailX: train.tailX + v * DT,
      frontX: train.frontX + v * DT,
    };
    crossing.step(DT, train);
    if (phases.at(-1) !== crossing.phase) phases.push(crossing.phase);
    if (crossing.trainInConflict(train) && crossing.roadInConflict())
      violations += 1;
    if (crossing.trainInConflict(train) && crossing.barrier < 1)
      openWhileOccupied += 1;
    maxCars = Math.max(maxCars, crossing.count('car'));
    maxBikes = Math.max(maxBikes, crossing.count('bike'));
  }
  return { train, phases, violations, maxCars, maxBikes, openWhileOccupied };
}

describe('LevelCrossing: barriers that really close (doc 05 §4)', () => {
  it('keeps barriers up after the minimum warning while arrival is still distant', () => {
    const crossing = new LevelCrossing('visible', X, 1, rules, span(X - 5000));
    const train = span(X - CROSSING_ZONE_HALF_U - VMAX * 3);
    for (let i = 0; i < 120; i++) crossing.step(DT, train);
    expect(crossing.phase).toBe('WARNING');
    expect(crossing.barrier).toBe(0);
  });

  it('predicts rest, cruise, full speed and constant-speed oncoming arrivals', () => {
    const acceleration = span(0).accelerationUPerSec2;
    const toFullSec = VMAX / acceleration;
    const acceleratingU = (VMAX * toFullSec) / 2;
    expect(
      earliestArrivalSeconds(acceleration / 2, 0, VMAX, acceleration),
    ).toBeCloseTo(1);
    expect(earliestArrivalSeconds(VMAX * 2, VMAX, VMAX, acceleration)).toBe(2);
    expect(
      earliestArrivalSeconds(acceleratingU + VMAX * 3, 0, VMAX, acceleration),
    ).toBeCloseTo(toFullSec + 3);
    expect(
      earliestArrivalSeconds(VMAX, VMAX / 2, VMAX, acceleration),
    ).toBeCloseTo(
      (Math.sqrt((VMAX / 2) ** 2 + 2 * acceleration * VMAX) - VMAX / 2) /
        acceleration,
    );
    expect(earliestArrivalSeconds(600, 120, 120, 0)).toBe(5);
    expect(earliestArrivalSeconds(600, 0, 120, 0)).toBe(Infinity);
    expect(earliestArrivalSeconds(0, 0, VMAX, acceleration)).toBe(0);
  });

  it('lowers after the maximum warning even for a standing train, never before the minimum', () => {
    const crossing = new LevelCrossing('standing', X, 1, rules, span(X - 5000));
    const train = span(X - CROSSING_ZONE_HALF_U - VMAX * 3);
    crossing.step(DT, train);
    crossing.step(DT, train);
    expect(crossing.phase).toBe('WARNING');
    for (let i = 0; i < 60; i++) crossing.step(DT, train);
    expect(crossing.phase).toBe('WARNING');
    for (let i = 0; i < 3 * 60 + 2; i++) crossing.step(DT, train);
    expect(crossing.phase).toBe('CLOSING');
    for (let i = 0; i < 60; i++) crossing.step(DT, train);
    expect(crossing.phase).toBe('CLOSED');
  });

  it('uses release hysteresis before opening and re-closes for a second train', () => {
    const approaching = {
      ...span(X - CROSSING_ZONE_HALF_U - rules.closeDistanceU + 1),
      speedUPerSec: VMAX,
    };
    const crossing = new LevelCrossing('hysteresis', X, 2, rules, approaching);
    const justOutside = {
      ...approaching,
      frontX: approaching.frontX - 2,
      tailX: approaching.tailX - 2,
    };
    for (let i = 0; i < 60; i++) crossing.step(DT, justOutside);
    expect(crossing.phase).toBe('CLOSED');
    const far = span(X - 5000);
    crossing.step(DT, far);
    expect(crossing.phase).toBe('OPENING');
    const second: CrossingTrain = {
      frontX: X + CROSSING_ZONE_HALF_U + 250,
      tailX: X + CROSSING_ZONE_HALF_U + 850,
      direction: -1,
      speedUPerSec: 120,
      maxSpeedUPerSec: 120,
      accelerationUPerSec2: 0,
    };
    crossing.step(DT, [far, second]);
    expect(crossing.phase).toBe('CLOSING');
    expect(crossing.roadPermitted()).toBe(false);
    for (let i = 0; i < 10 * 60; i++) {
      second.frontX -= 120 * DT;
      second.tailX -= 120 * DT;
      crossing.step(DT, [far, second]);
      if (crossing.trainInConflict(second)) {
        expect(crossing.barrier).toBe(1);
        expect(crossing.roadInConflict()).toBe(false);
      }
    }
    expect(crossing.phase).toBe('OPEN');
    const restored = new LevelCrossing('restore-second', X, 2, rules, [
      far,
      { ...second, frontX: X - 10, tailX: X + 100 },
    ]);
    expect(restored.phase).toBe('CLOSED');
  });

  it('keeps barriers fully down for Tsafety before the extended zone under seeded throttle/brake/coast (1600 u train)', () => {
    const params = motionParams(gameConfig, 1);
    for (let seed = 1; seed <= 40; seed++) {
      let state = seed;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
      };
      let train = span(X - 5000, 1600);
      const crossing = new LevelCrossing('safety', X, seed, rules, train);
      let closedSeconds = 0;
      let entered = false;
      let intent: 'THROTTLE' | 'COAST' | 'BRAKE' = 'THROTTLE';
      for (let tick = 0; tick < 60 * 180; tick++) {
        if (tick % 60 === 0) {
          const roll = random();
          intent = roll < 0.7 ? 'THROTTLE' : roll < 0.85 ? 'COAST' : 'BRAKE';
        }
        const motion = stepMotion(
          train.speedUPerSec,
          intent,
          (random() * 2 - 1) * params.maxTrackGrade,
          params,
          DT,
        );
        train = {
          ...train,
          frontX: train.frontX + motion.distanceU,
          tailX: train.tailX + motion.distanceU,
          speedUPerSec: motion.speedUPerSec,
        };
        crossing.step(DT, train);
        if (!entered && train.frontX > X - CROSSING_ZONE_HALF_U) {
          entered = true;
          expect(
            closedSeconds,
            `seed=${seed}, tick=${tick}, train=${JSON.stringify(train)}`,
          ).toBeGreaterThanOrEqual(gameConfig.crossing.safetySeconds);
        }
        if (crossing.trainInConflict(train)) {
          expect(crossing.barrier, `seed=${seed}, tick=${tick}`).toBe(1);
          expect(crossing.roadInConflict(), `seed=${seed}, tick=${tick}`).toBe(
            false,
          );
        }
        closedSeconds = crossing.barrier === 1 ? closedSeconds + DT : 0;
      }
      expect(entered, `seed=${seed}`).toBe(true);
    }
  });

  it('stays open with no train near, letting road traffic across', () => {
    const crossing = new LevelCrossing('c', X, 1, rules, span(X - 5000));
    const result = drive(crossing, span(X - 5000), () => 0, 60);
    expect(result.phases).toEqual(['OPEN']);
    expect(crossing.crossedCount).toBeGreaterThan(3);
  });

  it('SCN-04: from a standstill at full throttle the barriers are down before the front arrives', () => {
    // Standing just outside Dclose, then full throttle at once.
    const start = span(X - CROSSING_ZONE_HALF_U - rules.closeDistanceU - 1);
    const crossing = new LevelCrossing('c', X, 2, rules, start);
    const result = drive(crossing, start, () => VMAX, 12);
    expect(result.phases.slice(0, 5)).toEqual([
      'CLEARING',
      'WARNING',
      'CLOSING',
      'CLOSED',
      'OPENING',
    ]);
    expect(result.openWhileOccupied).toBe(0);
    expect(result.violations).toBe(0);
  });

  it('SCN-05: stays closed until the last wagon has passed, also when the train stops on it', () => {
    const start = span(X - 3000, 1600);
    const crossing = new LevelCrossing('c', X, 3, rules, start);
    // Drive in, stop with the crossing under the middle of the train for
    // half a minute, then drive on.
    const result = drive(
      crossing,
      start,
      (t, train) => (t < 20 && train.frontX < X + 800 ? 300 : t < 50 ? 0 : 300),
      70,
    );
    expect(result.openWhileOccupied).toBe(0);
    expect(result.violations).toBe(0);
    expect(crossing.phase).toBe('OPEN');
  });

  it('SCN-06: a car that has started across clears the road; the next ones wait', () => {
    const crossing = new LevelCrossing('c', X, 4, rules, span(X - 20_000));
    // Let traffic run until a car is just committed into the crossing.
    let train = span(X - 20_000);
    for (let i = 0; i < 60 * 120 && !crossing.roadCommitted(); i++)
      crossing.step(DT, train);
    expect(crossing.roadCommitted()).toBe(true);
    // The train now appears inside Dclose at top speed.
    train = span(X - CROSSING_ZONE_HALF_U - rules.closeDistanceU + 100);
    const result = drive(crossing, train, () => VMAX, 10);
    expect(result.violations).toBe(0);
    expect(result.openWhileOccupied).toBe(0);
  });

  it('SCN-07: a train approaching while the barriers rise closes them again; the road stays blocked', () => {
    const start = span(X - 3000, 300);
    const crossing = new LevelCrossing('c', X, 5, rules, start);
    // First train passes, then a second (the same span jumps back) arrives
    // while the barriers are opening.
    let train = start;
    let sawOpening = false;
    let reclosed = false;
    for (let i = 0; i < 60 * 30; i++) {
      train = {
        ...train,
        speedUPerSec: 400,
        tailX: train.tailX + 400 * DT,
        frontX: train.frontX + 400 * DT,
      };
      if (crossing.phase === 'OPENING' && !sawOpening) {
        sawOpening = true;
        train = span(X - 500, 300);
      }
      crossing.step(DT, train);
      // Until it is closed again for the second train, the road waits.
      if (sawOpening && !reclosed) {
        expect(crossing.roadPermitted()).toBe(false);
        expect(crossing.phase).not.toBe('OPEN');
        if (crossing.phase === 'CLOSED') reclosed = true;
      }
      if (crossing.trainInConflict(train)) expect(crossing.barrier).toBe(1);
    }
    expect(sawOpening).toBe(true);
    expect(reclosed).toBe(true);
  });

  it('SCN-08: restored with the train across, it is closed before the first frame and the road is empty', () => {
    const crossing = new LevelCrossing('c', X, 6, rules, span(X + 300, 1000));
    expect(crossing.phase).toBe('CLOSED');
    expect(crossing.barrier).toBe(1);
    expect(crossing.roadInConflict()).toBe(false);
  });

  it('SCN-12: a long stand keeps the queues bounded', () => {
    const start = span(X + 200, 1600);
    const crossing = new LevelCrossing('c', X, 7, rules, start);
    const result = drive(crossing, start, () => 0, 600);
    expect(result.maxCars).toBeLessThanOrEqual(
      gameConfig.crossing.maxQueuedCars,
    );
    expect(result.maxBikes).toBeLessThanOrEqual(
      gameConfig.crossing.maxQueuedBikes,
    );
    expect(result.violations).toBe(0);
    expect(crossing.waitingCount()).toBeGreaterThan(0);
  });

  it('near-side traffic waits at the foot of the bank, far-side traffic just behind the track', () => {
    // A train standing across the crossing: queues form on both sides.
    const crossing = new LevelCrossing('c', X, 11, rules, span(X + 300, 1000));
    drive(crossing, span(X + 300, 1000), () => 0, 60);
    const fronts = (direction: 1 | -1) =>
      crossing.actors
        .filter((actor) => actor.direction === direction && actor.waiting)
        .map(
          (actor) => actor.roadU + direction * (actor.kind === 'car' ? 13 : 7),
        );
    // Leading actor's front on its stop line (u from the track).
    expect(Math.max(...fronts(1))).toBeCloseTo(-40, 6);
    expect(Math.min(...fronts(-1))).toBeCloseTo(56, 6);
  });

  it('a road actor past its stop line clears the crossing within the road clearance time, even behind the slowest one', () => {
    expect(worstClearingSeconds()).toBeLessThanOrEqual(
      gameConfig.crossing.roadClearanceSeconds,
    );
    // Measured: no CLEARING phase lasts longer, in busy random traffic.
    for (let seed = 1; seed <= 30; seed++) {
      let state = seed * 7919;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
      };
      let train = span(X - 20_000);
      const crossing = new LevelCrossing('c', X, seed, rules, train);
      let clearing = 0;
      let longest = 0;
      for (let i = 0; i < 60 * 240; i++) {
        // Now and then a train appears just inside Dclose at top speed.
        if (crossing.phase === 'OPEN' && random() < 0.004)
          train = span(X - CROSSING_ZONE_HALF_U - rules.closeDistanceU + 1);
        train = {
          ...train,
          speedUPerSec: VMAX,
          tailX: train.tailX + VMAX * DT,
          frontX: train.frontX + VMAX * DT,
        };
        crossing.step(DT, train);
        clearing = crossing.phase === 'CLEARING' ? clearing + DT : 0;
        longest = Math.max(longest, clearing);
      }
      expect(longest, `seed ${seed}`).toBeLessThanOrEqual(
        worstClearingSeconds() + DT,
      );
    }
  });

  it('never lets a train and a road actor into the conflict at once (fuzz)', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let state = seed;
      const random = () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 2 ** 32;
      };
      const start = span(X - 4000 - random() * 4000, 200 + random() * 1400);
      const crossing = new LevelCrossing('c', X, seed, rules, start);
      let speed = 0;
      const result = drive(
        crossing,
        start,
        () => {
          // Throttle, coast or brake, changing every so often.
          if (random() < 0.02)
            speed = [0, VMAX * random(), VMAX][Math.floor(random() * 3)] ?? 0;
          return speed;
        },
        90,
      );
      expect(result.violations, `seed ${seed}`).toBe(0);
      expect(result.openWhileOccupied, `seed ${seed}`).toBe(0);
    }
  });
});
