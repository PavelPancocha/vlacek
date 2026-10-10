import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  artParts,
  vehicleArt,
  type VehicleArt,
} from '../../../src/content/artManifest.ts';
import {
  releaseErrors,
  validateVehicleArt,
  type ArtValidationInput,
} from '../../../src/content/artValidation.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';

const ASSETS = resolve(import.meta.dirname, '../../../assets/vehicles');
const files = new Map(
  readdirSync(ASSETS)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => [file, readFileSync(resolve(ASSETS, file), 'utf8')]),
);
const shipped: ArtValidationInput = {
  vehicles: [...locomotives, ...wagons],
  parts: artParts,
  art: vehicleArt,
  files,
};
const steam = vehicleArt['steam_local'];
if (!steam) throw new Error('steam_local has no art');
const steamGear = steam.steamGear;
if (!steamGear) throw new Error('steam_local has no steam gear');

/** The shipped input with steam_local's art replaced. */
function withSteam(art: VehicleArt): ArtValidationInput {
  return { ...shipped, art: { ...vehicleArt, steam_local: art } };
}

describe('vehicle art manifest (doc 06 §8, doc 07 §4, CNT-02)', () => {
  it('validates as shipped', () => {
    expect(validateVehicleArt(shipped)).toEqual([]);
  });

  it('gives the steam locomotive real art', () => {
    expect(locomotives.find((l) => l.id === 'steam_local')).not.toHaveProperty(
      'placeholder',
    );
  });

  it('requires exactly one look per vehicle: art or a marked placeholder', () => {
    const vehicles = shipped.vehicles.map((vehicle) =>
      vehicle.id === 'steam_local'
        ? { ...vehicle, placeholder: true as const }
        : vehicle,
    );
    const art = { ...vehicleArt };
    delete art['cargo_box'];
    expect(validateVehicleArt({ ...shipped, vehicles, art })).toEqual([
      'steam_local: art and a placeholder',
      'cargo_box: no art and no placeholder',
      'cargo_box.body: not used by any vehicle',
      'cargo_box.overlay: not used by any vehicle',
    ]);
    expect(
      validateVehicleArt({
        ...shipped,
        art: { ...vehicleArt, ghost: steam },
      }),
    ).toEqual(['ghost: art for a vehicle not in the catalog']);
  });

  it('gives every vehicle type its own drawing, not a shared or recoloured body', () => {
    const coal = vehicleArt['cargo_coal'];
    if (!coal) throw new Error('cargo_coal has no art');
    expect(
      validateVehicleArt({
        ...shipped,
        art: { ...vehicleArt, cargo_coal: { ...coal, body: 'cargo_box.body' } },
      }),
    ).toEqual([
      'cargo_coal: cargo_box.body frame is not 152 × 68 u, pivot on the rail',
      'cargo_coal: shares its body drawing with cargo_box',
      'cargo_coal.body: not used by any vehicle',
    ]);
  });

  it('lets a release ship no placeholder (doc 06 §8)', () => {
    expect(releaseErrors(shipped.vehicles)).toEqual([]);
    const vehicles = shipped.vehicles.map((vehicle) =>
      vehicle.id === 'cargo_box'
        ? { ...vehicle, placeholder: true as const }
        : vehicle,
    );
    expect(releaseErrors(vehicles)).toEqual(['cargo_box: placeholder']);
  });

  it('checks every part file and its size in world units', () => {
    const broken = new Map(files);
    broken.delete('wheel-steam-pony.svg');
    broken.set(
      'steam_local.crosshead.svg',
      (files.get('steam_local.crosshead.svg') ?? '').replace(
        'viewBox="0 0 30 7"',
        'viewBox="0 0 30 8"',
      ),
    );
    broken.set('stray.svg', '<svg/>');
    expect(validateVehicleArt({ ...shipped, files: broken })).toEqual([
      'steam_local.crosshead: steam_local.crosshead.svg is not 30 × 7 u',
      'wheel.steam-pony: wheel-steam-pony.svg missing',
      'stray.svg: not in the manifest',
    ]);
  });

  it('puts each locomotive effect on a point of its model (doc 14 §4)', () => {
    for (const locomotive of locomotives) {
      const emitters = vehicleArt[locomotive.id]?.emitters ?? [];
      if (locomotive.effect === 'none') expect(emitters).toEqual([]);
      else expect(emitters.length, locomotive.id).toBeGreaterThan(0);
    }
    expect(validateVehicleArt(withSteam({ ...steam, emitters: [] }))).toEqual([
      'steam_local: effect steam has no emitter on the model',
    ]);
    expect(
      validateVehicleArt(
        withSteam({ ...steam, emitters: [{ xU: 170, yU: 6 }] }),
      ),
    ).toEqual([
      'steam_local: emitter at 170, 6 is outside the 156 × 100 u frame',
    ]);
    const wagon = wagons[0];
    const wagonArt = wagon && vehicleArt[wagon.id];
    if (!wagon || !wagonArt) throw new Error('no wagon art');
    expect(
      validateVehicleArt({
        ...shipped,
        art: {
          ...vehicleArt,
          [wagon.id]: { ...wagonArt, emitters: [{ xU: 10, yU: 10 }] },
        },
      }),
    ).toEqual([`${wagon.id}: emitters on a vehicle without an effect`]);
  });

  it('keeps the drawing exactly as long as the vehicle (length invariant)', () => {
    const vehicles = shipped.vehicles.map((vehicle) =>
      vehicle.id === 'steam_local' ? { ...vehicle, lengthU: 160 } : vehicle,
    );
    expect(validateVehicleArt({ ...shipped, vehicles })).toEqual([
      'steam_local: steam_local.body frame is not 160 × 100 u, pivot on the rail',
      'steam_local: steam_local.overlay frame is not 160 × 100 u, pivot on the rail',
    ]);
  });

  it('stands wheels on the rail inside the vehicle, without overlaps', () => {
    const wheels = [
      { part: 'wheel.steam-driver', xU: 10 },
      { part: 'wheel.steam-driver', xU: 76 },
      { part: 'wheel.steam-driver', xU: 100 },
      { part: 'wheel.steam-pony', xU: 138 },
    ] as const;
    expect(validateVehicleArt(withSteam({ ...steam, wheels }))).toEqual([
      'steam_local: wheel at 10 outside the vehicle',
      'steam_local: wheels at 76 and 100 overlap',
    ]);
    const vehicles = shipped.vehicles.map((vehicle) =>
      vehicle.id === 'steam_local' ? { ...vehicle, wheelRadiusU: 14 } : vehicle,
    );
    expect(validateVehicleArt({ ...shipped, vehicles })).toEqual([
      'steam_local: largest wheel radius 15 is not wheelRadiusU 14',
    ]);
  });

  it('fits the rods to the wheels they work on', () => {
    expect(
      validateVehicleArt(
        withSteam({ ...steam, steamGear: { ...steamGear, crankU: 16 } }),
      ),
    ).toEqual(['steam_local: crank outside the main wheel']);
    expect(
      validateVehicleArt(
        withSteam({ ...steam, steamGear: { ...steamGear, guideYU: 30 } }),
      ),
    ).toEqual(['steam_local: cylinder out of the connecting rod reach']);
    expect(
      validateVehicleArt(
        withSteam({ ...steam, steamGear: { ...steamGear, mainWheel: 3 } }),
      ),
    ).toEqual([
      'steam_local: coupled wheel at 108 is not the size of the main wheel',
    ]);
  });
});
