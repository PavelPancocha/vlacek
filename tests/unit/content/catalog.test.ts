import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { validateCatalog } from '../../../src/content/catalogValidation.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import type {
  LocomotiveDefinition,
  WagonDefinition,
} from '../../../src/domain/types.ts';

const limits = { maxVehicleLengthU: gameConfig.train.maxVehicleLengthU };

describe('temporary vehicle catalog (0.1)', () => {
  it('validates as shipped', () => {
    expect(validateCatalog(locomotives, wagons, limits)).toEqual([]);
  });

  it('uses stable doc 06 IDs and lengths', () => {
    expect(locomotives.map((l) => [l.id, l.lengthU])).toEqual([
      ['steam_local', 156],
      ['diesel_mainline', 196],
      ['magic_stars', 164],
    ]);
    expect(wagons.map((w) => [w.id, w.group, w.lengthU])).toEqual([
      ['passenger_classic', 'passenger', 176],
      ['passenger_open', 'passenger', 144],
      ['cargo_box', 'cargo', 164],
      ['cargo_coal', 'cargo', 152],
      ['cargo_container', 'cargo', 188],
      ['service_crane', 'service', 188],
      ['fun_balloons', 'fun', 164],
    ]);
  });

  it('offers no electric locomotive before catenary exists (M2)', () => {
    expect(locomotives.filter((l) => l.power === 'electric')).toEqual([]);
  });
});

describe('validateCatalog', () => {
  const loco = locomotives[0] as LocomotiveDefinition;
  const wagon = wagons[0] as WagonDefinition;

  it('rejects duplicate IDs across locomotives and wagons', () => {
    expect(
      validateCatalog([loco], [{ ...wagon, id: loco.id }], limits),
    ).toEqual([`duplicate id ${loco.id}`]);
  });

  it('rejects invalid geometry', () => {
    expect(
      validateCatalog(
        [{ ...loco, lengthU: 221 }],
        [
          { ...wagon, id: 'a', bogieOffsetU: wagon.lengthU / 2 },
          { ...wagon, id: 'b', wheelRadiusU: 0 },
          { ...wagon, id: 'c', lengthU: Number.NaN },
        ],
        limits,
      ),
    ).toEqual([
      `${loco.id}: lengthU`,
      'a: bogieOffsetU',
      'b: wheelRadiusU',
      'c: lengthU',
      'c: bogieOffsetU',
    ]);
  });

  it('requires catenary exactly for electric locomotives', () => {
    expect(
      validateCatalog([{ ...loco, requiresCatenary: true }], [], limits),
    ).toEqual([`${loco.id}: requiresCatenary`]);
    expect(
      validateCatalog(
        [{ ...loco, power: 'electric', requiresCatenary: false }],
        [],
        limits,
      ),
    ).toEqual([`${loco.id}: requiresCatenary`]);
  });

  it('requires labels and asset keys', () => {
    expect(
      validateCatalog([{ ...loco, labelCs: ' ', bodyAsset: '' }], [], limits),
    ).toEqual([`${loco.id}: labelCs`, `${loco.id}: bodyAsset`]);
  });
});
