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
});
