import { describe, expect, it } from 'vitest';
import {
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
