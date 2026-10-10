import { describe, expect, it } from 'vitest';
import {
  crossingCloseDistanceU,
  gameConfig,
  validateGameConfig,
  type GameConfig,
} from '../../../src/config/gameConfig.ts';

describe('gameConfig', () => {
  it('carries the doc 13 input defaults', () => {
    expect(gameConfig.input).toEqual({
      maxPointers: 5,
      leftSwipeDistanceCssPx: 64,
      leftSwipeMaxDurationMs: 500,
      leftSwipeHorizontalRatio: 1.5,
      minTargetCssPx: 64,
      primaryControlTargetCssPx: 80,
    });
  });

  it('doc 14 §6: the ride feels snappy on screen yet easy to follow', () => {
    const { train, camera } = gameConfig;
    // Screen widths per second at full speed: the scale fits the longest
    // train into trainWidthFraction of the width on every screen.
    const widthsPerSecond =
      (train.maxSpeedUPerSec * camera.trainWidthFraction) /
      train.maxConsistLengthU;
    expect(widthsPerSecond).toBeGreaterThanOrEqual(0.18);
    expect(widthsPerSecond).toBeLessThanOrEqual(0.3);
    // Smooth start and coast: seconds from standstill to full speed and back.
    const toFull = train.maxSpeedUPerSec / train.accelerationUPerSec2;
    const coast = train.maxSpeedUPerSec / train.coastDecelerationUPerSec2;
    const brake = train.maxSpeedUPerSec / train.brakeDecelerationUPerSec2;
    expect(toFull).toBeGreaterThanOrEqual(2);
    expect(toFull).toBeLessThanOrEqual(4);
    expect(coast).toBeGreaterThanOrEqual(4);
    expect(coast).toBeLessThanOrEqual(7);
    expect(brake).toBeLessThan(coast / 3);
  });

  it('carries the doc 13 catenary spacing and contact height (doc 03 §9)', () => {
    expect(gameConfig.world.catenaryPoleSpacingU).toBe(256);
    expect(gameConfig.world.catenaryContactHeightU).toBe(160);
  });

  it('rejects poles that would not keep one phase across chunks', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: {
        ...gameConfig.world,
        catenaryPoleSpacingU: 300,
        catenaryContactHeightU: 0,
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'world.catenaryPoleSpacingU',
      'world.catenaryContactHeightU',
    ]);
  });

  it('carries the doc 13 quality profiles with their particle budgets', () => {
    expect(gameConfig.quality).toEqual({
      low: { maxDpr: 1, targetFps: 30, maxDecorativeParticles: 96 },
      standard: { maxDpr: 1.5, targetFps: 60, maxDecorativeParticles: 240 },
    });
  });

  it('rejects a quality profile without a particle budget', () => {
    const broken: GameConfig = {
      ...gameConfig,
      quality: {
        ...gameConfig.quality,
        low: { ...gameConfig.quality.low, maxDecorativeParticles: 0 },
        standard: { ...gameConfig.quality.standard, maxDpr: 0.5 },
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'quality.low.maxDecorativeParticles',
      'quality.standard.maxDpr',
    ]);
  });

  it('carries the doc 13 crossing timings and derives Dclose from the top speed (doc 05 §4)', () => {
    expect(gameConfig.crossing).toEqual({
      roadClearanceSeconds: 2,
      warningSeconds: 1.2,
      closingSeconds: 0.8,
      openingSeconds: 0.8,
      safetySeconds: 0.5,
      distanceMarginU: 80,
      maxQueuedCars: 6,
      maxQueuedBikes: 2,
    });
    // Doc 05 example: 180 u/s gives 890 u; the ride now tops out at 480 u/s.
    expect(crossingCloseDistanceU(gameConfig.crossing, 180)).toBeCloseTo(
      890,
      9,
    );
    expect(
      crossingCloseDistanceU(
        gameConfig.crossing,
        gameConfig.train.maxSpeedUPerSec,
      ),
    ).toBeCloseTo(480 * 4.5 + 80, 9);
  });

  it('is valid as shipped', () => {
    expect(validateGameConfig(gameConfig)).toEqual([]);
  });

  it('reports out-of-range values with their path', () => {
    const broken: GameConfig = {
      ...gameConfig,
      input: {
        ...gameConfig.input,
        maxPointers: 0,
        leftSwipeDistanceCssPx: Number.NaN,
        primaryControlTargetCssPx: 40,
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'input.maxPointers',
      'input.leftSwipeDistanceCssPx',
      'input.primaryControlTargetCssPx',
    ]);
  });

  it('rejects a train-width fraction of zero (the camera would not zoom)', () => {
    const broken: GameConfig = {
      ...gameConfig,
      camera: { ...gameConfig.camera, trainWidthFraction: 0 },
    };
    expect(validateGameConfig(broken)).toEqual(['camera.trainWidthFraction']);
  });

  it('rejects a terrain without lattice or with a negative embankment', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: {
        ...gameConfig.world,
        terrain: { latticeU: 0, maxEmbankmentU: -1 },
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'world.terrain.latticeU',
      'world.terrain.maxEmbankmentU',
    ]);
  });
});
