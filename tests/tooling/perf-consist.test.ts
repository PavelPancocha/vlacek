import { consistLengthU } from '../../src/domain/consist/ConsistEditor.ts';
import { describe, expect, it } from 'vitest';
import { longestMixedConsist } from '../e2e/perfConsist.ts';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';

describe('performance measurement consist', () => {
  it('fills the length limit with PERF_WAGON and the chosen locomotive', () => {
    const consist = longestMixedConsist('steam_express', 'cargo_cars');
    expect(consist.locomotiveId).toBe('steam_express');
    expect(consist.wagons.length).toBeGreaterThan(0);
    expect(
      consist.wagons.every((wagon) => wagon.definitionId === 'cargo_cars'),
    ).toBe(true);
    const locomotive = locomotives.find(
      (entry) => entry.id === consist.locomotiveId,
    );
    const wagon = wagons.find((entry) => entry.id === 'cargo_cars');
    if (!locomotive || !wagon) throw new Error('catalog entry missing');
    const nextLengthU =
      locomotive.lengthU +
      (consist.wagons.length + 1) *
        (wagon.lengthU + gameConfig.train.couplerGapU);
    expect(nextLengthU).toBeGreaterThan(gameConfig.train.maxConsistLengthU);
    expect(
      nextLengthU - wagon.lengthU - gameConfig.train.couplerGapU,
    ).toBeLessThanOrEqual(gameConfig.train.maxConsistLengthU);
  });

  it.each(['unknown', 'steam_express', ''])(
    'rejects the unknown PERF_WAGON "%s" clearly',
    (id) => {
      expect(() => longestMixedConsist('steam_local', id)).toThrow(
        `Unknown PERF_WAGON: "${id}"`,
      );
    },
  );

  it('fills the new limit with the default mixed train', () => {
    const consist = longestMixedConsist('steam_local');
    expect(consist.locomotiveId).toBe('steam_local');
    expect(
      consistLengthU(consist, {
        maxLengthU: gameConfig.train.maxConsistLengthU,
        couplerGapU: gameConfig.train.couplerGapU,
        geometryOf: (id) =>
          [...locomotives, ...wagons].find((v) => v.id === id),
      }),
    ).toBe(2000);
    expect(consist.wagons.map((wagon) => wagon.definitionId)).toEqual([
      'passenger_classic',
      'passenger_open',
      'cargo_box',
      'cargo_apples',
      'cargo_container',
      'service_crane',
      'fun_balloons',
      'passenger_open',
      'passenger_open',
      'passenger_open',
      'passenger_open',
    ]);
  });
});
