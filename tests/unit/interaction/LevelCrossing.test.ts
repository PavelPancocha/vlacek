import { describe, expect, it } from 'vitest';
import {
  crossingCloseDistanceU,
  gameConfig,
} from '../../../src/config/gameConfig.ts';
import {
  CROSSING_ZONE_HALF_U,
  LevelCrossing,
  worstClearingSeconds,
  type CrossingRules,
  type TrainSpan,
} from '../../../src/domain/interaction/LevelCrossing.ts';

const VMAX = gameConfig.train.maxSpeedUPerSec;
const rules: CrossingRules = {
  crossing: gameConfig.crossing,
  closeDistanceU: crossingCloseDistanceU(gameConfig.crossing, VMAX),
};
const DT = 1 / gameConfig.simulation.fixedHz;
const X = 10_000;

/** A train `lengthU` long whose front is at `frontX`. */
const span = (frontX: number, lengthU = 600): TrainSpan => ({
  tailX: frontX - lengthU,
  frontX,
});

/** Runs the crossing while the train moves; returns what happened. */
function drive(
  crossing: LevelCrossing,
  start: TrainSpan,
  speedAt: (t: number, train: TrainSpan) => number,
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
    train = { tailX: train.tailX + v * DT, frontX: train.frontX + v * DT };
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
