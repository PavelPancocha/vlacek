import { expect, it } from 'vitest';
import { forestWorkPose, farmPatrolOffsetU } from './farmForestMotion.ts';
it('SCN-FO05: trunk stays gripped during transfer and rests at either end, stack changes only at handoff', () => {
  const start = forestWorkPose(0, 0, false),
    middle = forestWorkPose(12, 0, false),
    end = forestWorkPose(24, 0, false);
  expect(start.gripYU).toBe(-38);
  expect(middle.holding).toBe(true);
  expect(middle.open).toBe(false);
  expect(end.trunkAngleRad).toBeCloseTo(Math.PI / 2);
  expect(end.gripYU).toBe(-12);
  expect(end.holding).toBe(false);
  expect(end.stacked).toBe(true);
  expect(forestWorkPose(12, 0, true).holding).toBe(true);
});
it('SCN-FO05/06: forwarder waits for pickup/drop, carries horizontally and returns without moving the beds', () => {
  const pickup = forestWorkPose(2, 0, true),
    transfer = forestWorkPose(12, 0, true),
    drop = forestWorkPose(24, 0, true),
    returning = forestWorkPose(30, 0, true);
  expect(pickup.gripYU).toBe(-12);
  expect(transfer.trunkAngleRad).toBeCloseTo(Math.PI / 2);
  expect(drop.stacked).toBe(true);
  expect(drop.open).toBe(true);
  expect(returning.holding).toBe(false);
});

it('FO05: a full 32s forwarder trajectory waits at both fixed beds, reverses and repeats continuously', () => {
  const prop = {
    phase: 0,
    work: 'forwarder',
    motion: { rangeU: 120, speedUPerSec: 10 },
  };
  for (const t of [0, 2, 4]) expect(farmPatrolOffsetU(prop, t)).toBe(-60);
  for (const t of [20, 22, 24, 26]) expect(farmPatrolOffsetU(prop, t)).toBe(60);
  expect(farmPatrolOffsetU(prop, 32)).toBe(-60);
  for (let t = 0; t <= 64; t += 0.125) {
    const p = forestWorkPose(t, 0, true),
      x = farmPatrolOffsetU(prop, t);
    expect(x).toBeCloseTo((p.patrolRatio - 0.5) * 120, 8);
    const prev = forestWorkPose(t - 0.001, 0, true);
    if (t % 32 > 0 && p.patrolRatio === prev.patrolRatio)
      expect(p.direction).toBe(prev.direction);
    if (p.patrolRatio > prev.patrolRatio) expect(p.direction).toBe(1);
    if (p.patrolRatio < prev.patrolRatio) expect(p.direction).toBe(-1);
  }
  // World-space gripped trunk shares the bed contact at pickup and release.
  for (const t of [4, 22]) {
    const p = forestWorkPose(t, 0, true);
    expect(farmPatrolOffsetU(prop, t) + p.gripXU).toBe(t === 4 ? -100 : 20);
    expect(p.gripYU).toBeCloseTo(-12, 8);
  }
});
