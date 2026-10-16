import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { RideSimulation } from '../../src/domain/ride/RideSimulation.ts';
import { frameLeftX, trainZoom } from '../../src/render/cameraFraming.ts';

const sizes = [
  [1280, 800],
  [1140, 512],
  [844, 390],
  [568, 320],
] as const;

describe('camera-1 render corridor', () => {
  it('retains track across the whole wider viewport and its 64 u drawing gutter for the shortest locomotive, short and longest trains', () => {
    for (const ids of [
      ['diesel_shunter'],
      ['steam_local', 'cargo_box', 'passenger_open', 'cargo_coal'],
      [
        'steam_local',
        ...Array.from({ length: 11 }, () => 'passenger_open'),
        'cargo_box',
      ],
    ])
      for (const [widthPx, heightPx] of sizes) {
        const vehicles = ids.map((id) => {
          const v = [...locomotives, ...wagons].find((v) => v.id === id);
          if (!v) throw new Error(id);
          return v;
        });
        const ride = new RideSimulation({
          seed: 123,
          vehicles,
          config: gameConfig,
          speedFactor: 1,
          head: { chunkIndex: 3, arcOffsetU: 650 },
        });
        const lengthU = ride.layout.frontOffsetU + ride.layout.tailOffsetU;
        const view = {
          widthPx,
          heightPx,
          reservedTopPx: 80,
          reservedBottomPx: 160,
        };
        const framing = { ...gameConfig.camera, vehicleHeightU: 168 };
        const zoom = trainZoom(view, lengthU, framing);
        for (let tick = 0; tick < 240; tick++) {
          const frontX = ride.sample(ride.frontS).x;
          const leftX = frameLeftX(frontX, lengthU, view, zoom, framing);
          expect(
            ride.sample(ride.track.startS).x,
            `tail coverage at ${widthPx}px / tick ${tick}`,
          ).toBeLessThanOrEqual(leftX - 64);
          expect(ride.sample(ride.track.endS).x).toBeGreaterThanOrEqual(
            leftX + widthPx / zoom + 64,
          );
          ride.step('THROTTLE');
        }
      }
  });
});
