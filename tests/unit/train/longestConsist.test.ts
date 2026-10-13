import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import { npcFleetFor } from '../../../src/domain/interaction/npcFleet.ts';
import { RideSimulation } from '../../../src/domain/ride/RideSimulation.ts';

const catalog = [...locomotives, ...wagons];
const vehicles = [
  'steam_local',
  ...Array.from({ length: 11 }, () => 'passenger_open'),
  'cargo_box',
].map((id) => {
  const vehicle = catalog.find((v) => v.id === id);
  if (!vehicle) throw new Error(id);
  return vehicle;
});

describe('D-028 longest consist, world 123', () => {
  it('TRN-01/03/07/10, GEN-09, SCN-09: retains every vehicle, coupler and tail chunk through hills, stations and an NPC meeting', () => {
    const ride = new RideSimulation({
      seed: 123,
      vehicles,
      config: gameConfig,
      speedFactor: 1,
      npcFleet: npcFleetFor(123, { locomotives, wagons }),
    });
    expect(ride.layout.frontOffsetU + ride.layout.tailOffsetU).toBe(2000);
    expect(ride.vehicleCount).toBe(13);
    const chunks = new Set<number>();
    let metNpc = false;
    let maxChunks = 0;
    for (let tick = 0; tick < 60 * 50; tick++) {
      ride.step('THROTTLE');
      chunks.add(ride.headCursor().chunkIndex);
      metNpc ||= ride.oncomingTrains.some((train) => {
        const npc = train.xSpan();
        const frontX = ride.track.sample(ride.frontS).x;
        const tailX = ride.track.sample(ride.tailS).x;
        return (
          npc.minX <= frontX &&
          npc.maxX >= tailX &&
          npc.minX >= train.site.fromX &&
          npc.minX <= train.site.toX
        );
      });
      maxChunks = Math.max(maxChunks, ride.track.chunkCount);
      expect(ride.track.startS).toBeLessThanOrEqual(
        ride.tailS - gameConfig.world.geometryTailMarginU,
      );
      expect(ride.track.endS).toBeGreaterThanOrEqual(
        ride.frontS + gameConfig.world.geometryLookAheadU,
      );
      if (tick % 30 !== 0) continue;
      let previous;
      for (const [i, vehicle] of vehicles.entries()) {
        const pose = ride.vehiclePose(i);
        expect(Number.isFinite(pose.angleRad)).toBe(true);
        if (previous) {
          const front = {
            x: pose.centerX + (Math.cos(pose.angleRad) * vehicle.lengthU) / 2,
            y: pose.centerY + (Math.sin(pose.angleRad) * vehicle.lengthU) / 2,
          };
          expect(previous.x).toBeGreaterThan(front.x);
          expect(
            Math.abs(
              Math.hypot(previous.x - front.x, previous.y - front.y) -
                gameConfig.train.couplerGapU,
            ),
          ).toBeLessThanOrEqual(0.5);
        }
        previous = {
          x: pose.centerX - (Math.cos(pose.angleRad) * vehicle.lengthU) / 2,
          y: pose.centerY - (Math.sin(pose.angleRad) * vehicle.lengthU) / 2,
        };
      }
    }
    expect([...chunks]).toEqual(expect.arrayContaining([2, 3, 6, 11, 12]));
    expect(metNpc).toBe(true);
    expect(maxChunks).toBeLessThanOrEqual(8);
  });
});
