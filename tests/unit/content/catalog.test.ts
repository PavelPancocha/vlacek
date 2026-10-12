import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { validateCatalog } from '../../../src/content/catalogValidation.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import type {
  LocomotiveDefinition,
  WagonDefinition,
} from '../../../src/domain/types.ts';

const limits = { maxVehicleLengthU: gameConfig.train.maxVehicleLengthU };

describe('V1 vehicle catalog (doc 06 §2–3, CNT-01)', () => {
  it('validates as shipped', () => {
    expect(validateCatalog(locomotives, wagons, limits)).toEqual([]);
  });

  it('has exactly the ten locomotives of doc 06 §2', () => {
    expect(
      locomotives.map((l) => [
        l.id,
        l.labelCs,
        l.power,
        l.lengthU,
        l.requiresCatenary,
      ]),
    ).toEqual([
      ['steam_local', 'Malá parní mašinka', 'steam', 156, false],
      ['steam_express', 'Velká parní lokomotiva', 'steam', 216, false],
      ['diesel_shunter', 'Naftový posunovač', 'diesel', 148, false],
      ['diesel_mainline', 'Velká naftová lokomotiva', 'diesel', 196, false],
      ['electric_retro', 'Hranatá elektrická', 'electric', 188, true],
      ['electric_modern', 'Moderní elektrická', 'electric', 204, true],
      ['electric_mountain', 'Horská elektrická', 'electric', 160, true],
      ['magic_stars', 'Hvězdičková mašinka', 'fantasy', 164, false],
      ['magic_bubbles', 'Bublinková mašinka', 'fantasy', 164, false],
      ['magic_rainbow', 'Duhová mašinka', 'fantasy', 176, false],
    ]);
  });

  it('has exactly the 32 wagon types of doc 06 §3 in its four groups', () => {
    expect(wagons.map((w) => [w.id, w.labelCs, w.group, w.lengthU])).toEqual([
      ['passenger_classic', 'Osobní vagón', 'passenger', 176],
      ['passenger_double', 'Patrový vagón', 'passenger', 192],
      ['passenger_sleeper', 'Lůžkový vagón', 'passenger', 184],
      ['passenger_dining', 'Jídelní vagón', 'passenger', 184],
      ['passenger_panorama', 'Vyhlídkový vagón', 'passenger', 192],
      ['passenger_open', 'Otevřený výletní vagónek', 'passenger', 144],
      ['cargo_box', 'Krytý nákladní', 'cargo', 164],
      ['cargo_logs', 'Klády', 'cargo', 176],
      ['cargo_coal', 'Uhlák', 'cargo', 152],
      ['cargo_sand', 'Písek', 'cargo', 152],
      ['cargo_gravel', 'Kamení', 'cargo', 152],
      ['cargo_container', 'Kontejnerový', 'cargo', 188],
      ['cargo_tank', 'Cisterna', 'cargo', 176],
      ['cargo_milk', 'Mléčný vagón', 'cargo', 168],
      ['cargo_grain', 'Obilný vagón', 'cargo', 172],
      ['cargo_hay', 'Sláma', 'cargo', 164],
      ['cargo_apples', 'Jablka', 'cargo', 156],
      ['cargo_cars', 'Přepravník aut', 'cargo', 204],
      ['cargo_tractor', 'Vagón s traktorem', 'cargo', 184],
      ['cargo_excavator', 'Vagón s bagrem', 'cargo', 192],
      ['cargo_mail', 'Poštovní vagón', 'cargo', 164],
      ['cargo_refrigerated', 'Chladírenský vagón', 'cargo', 176],
      ['service_crane', 'Jeřábový vagón', 'service', 188],
      ['service_tools', 'Dílenský vagón', 'service', 164],
      ['service_snowplow', 'Vagón s pluhem', 'service', 156],
      ['fun_balloons', 'Balónkový vagónek', 'fun', 164],
      ['fun_stars', 'Hvězdičkový vagónek', 'fun', 164],
      ['fun_garden', 'Zahrádkový vagónek', 'fun', 172],
      ['fun_aquarium', 'Akvarijní vagónek', 'fun', 176],
      ['fun_windmill', 'Větrníkový vagónek', 'fun', 160],
      ['fun_lights', 'Světýlkový vagónek', 'fun', 168],
      ['fun_toyblocks', 'Vagónek s kostkami', 'fun', 164],
    ]);
  });

  it('has unique IDs and stable asset keys derived from them', () => {
    const all = [...locomotives, ...wagons];
    expect(new Set(all.map((v) => v.id)).size).toBe(42);
    for (const vehicle of all) {
      expect(vehicle.bodyAsset).toBe(`vehicle.${vehicle.id}.body`);
      expect(vehicle.previewAsset).toBe(`vehicle.${vehicle.id}.preview`);
    }
  });

  it('brings catenary exactly with the three electric locomotives (doc 06 §2, doc 03 §9)', () => {
    const electric = locomotives.filter((l) => l.power === 'electric');
    expect(electric.map((l) => l.id)).toEqual([
      'electric_retro',
      'electric_modern',
      'electric_mountain',
    ]);
    for (const locomotive of locomotives)
      expect(locomotive.requiresCatenary).toBe(locomotive.power === 'electric');
    // No smoke: at most a spark at the pantograph (doc 14 §4).
    for (const locomotive of electric) expect(locomotive.effect).toBe('none');
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
