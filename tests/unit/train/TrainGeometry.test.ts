import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  layoutConsist,
  poseVehicle,
  type VehicleGeometry,
} from '../../../src/domain/train/TrainGeometry.ts';
import { TrackWindow } from '../../../src/domain/world/TrackWindow.ts';
import type { TrackProfile } from '../../../src/domain/world/TrackProfile.ts';

const gap = gameConfig.train.couplerGapU;
const loco: VehicleGeometry = { lengthU: 156, bogieOffsetU: 46 };
const short: VehicleGeometry = { lengthU: 144, bogieOffsetU: 44 };
const long: VehicleGeometry = { lengthU: 188, bogieOffsetU: 58 };

/** Every chunk is the steepest valid hill: crest at local x = 512. */
const hills: TrackProfile = {
  kind: 'hill',
  startHeightU: 0,
  endHeightU: 0,
  middleHeightU: (0.12 * 512) / 1.875,
};

describe('layoutConsist', () => {
  it('TRN-01: lays out 0, 1, 10 and 100 wagons without shortening', () => {
    for (const count of [0, 1, 10, 100]) {
      const vehicles = [
        loco,
        ...Array.from({ length: count }, (_, i) => (i % 2 ? short : long)),
      ];
      const layout = layoutConsist(vehicles, gap);
      const total =
        vehicles.reduce((sum, v) => sum + v.lengthU, 0) + count * gap;
      expect(layout.centerOffsetsU).toHaveLength(count + 1);
      expect(layout.frontOffsetU + layout.tailOffsetU).toBeCloseTo(total, 9);
    }
  });

  it('TRN-02: one type repeated 100 times has the exact total length', () => {
    const layout = layoutConsist(
      [loco, ...Array.from({ length: 100 }, () => short)],
      gap,
    );
    expect(layout.frontOffsetU).toBe(78);
    expect(layout.tailOffsetU).toBe(100 * (144 + gap) + 78);
    expect(layout.centerOffsetsU[1]).toBe(78 + gap + 72);
  });

  it('rejects a consist without a locomotive', () => {
    expect(() => layoutConsist([], gap)).toThrow(RangeError);
  });
});

describe('poseVehicle', () => {
  const window = new TrackWindow(() => hills, 0, gameConfig.world);
  window.ensureRange(-8000, 14000);
  const crestS = window.sFromLocalX(0, 512);
  const sample = (s: number) => window.sample(s);

  it('TRN-03: bogies sit on the track and vehicles tilt individually over a crest', () => {
    // Locomotive on the steepest descent, last wagon on the steep climb.
    const vehicles = [loco, long, long, short];
    const layout = layoutConsist(vehicles, gap);
    const headS = crestS + 256;
    const poses = layout.centerOffsetsU.map((offset, i) =>
      poseVehicle(sample, headS - offset, vehicles[i] as VehicleGeometry),
    );
    for (const [i, pose] of poses.entries()) {
      const vehicle = vehicles[i] as VehicleGeometry;
      const centerS = headS - (layout.centerOffsetsU[i] ?? 0);
      const front = sample(centerS + vehicle.bogieOffsetU);
      const rear = sample(centerS - vehicle.bogieOffsetU);
      expect(pose.frontBogie).toEqual({ x: front.x, y: front.y });
      expect(pose.rearBogie).toEqual({ x: rear.x, y: rear.y });
    }
    expect(poses[0]?.angleRad).toBeLessThan(-0.1);
    expect(poses.at(-1)?.angleRad).toBeGreaterThan(0.1);
  });

  it('TRN-10: adjacent bodies neither overlap nor visibly separate on the extreme profile', () => {
    const vehicles = [
      loco,
      ...Array.from({ length: 30 }, (_, i) => (i % 3 ? short : long)),
    ];
    const layout = layoutConsist(vehicles, gap);
    for (
      let headS = crestS - 1500;
      headS < crestS + 1500 + layout.tailOffsetU;
      headS += 37
    ) {
      if (headS - layout.tailOffsetU - 100 < window.startS) continue;
      for (let i = 1; i < vehicles.length; i++) {
        const a = vehicles[i - 1] as VehicleGeometry;
        const b = vehicles[i] as VehicleGeometry;
        const pa = poseVehicle(
          sample,
          headS - (layout.centerOffsetsU[i - 1] ?? 0),
          a,
        );
        const pb = poseVehicle(
          sample,
          headS - (layout.centerOffsetsU[i] ?? 0),
          b,
        );
        const rearOfA = {
          x: pa.centerX - Math.cos(pa.angleRad) * (a.lengthU / 2),
          y: pa.centerY - Math.sin(pa.angleRad) * (a.lengthU / 2),
        };
        const frontOfB = {
          x: pb.centerX + Math.cos(pb.angleRad) * (b.lengthU / 2),
          y: pb.centerY + Math.sin(pb.angleRad) * (b.lengthU / 2),
        };
        const spacing = Math.hypot(
          rearOfA.x - frontOfB.x,
          rearOfA.y - frontOfB.y,
        );
        expect(
          Math.abs(spacing - gap),
          `head ${headS}, vehicle ${i}`,
        ).toBeLessThanOrEqual(0.5);
        expect(rearOfA.x, `head ${headS}, vehicle ${i}`).toBeGreaterThan(
          frontOfB.x,
        );
      }
    }
  });
});
