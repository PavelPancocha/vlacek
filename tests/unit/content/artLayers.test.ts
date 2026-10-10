import { describe, expect, it } from 'vitest';
import { vehicleArtLayers } from '../../../src/content/artLayers.ts';
import { vehicleArt } from '../../../src/content/artManifest.ts';
import { steamGear } from '../../../src/content/steamGear.ts';

const art = vehicleArt['steam_local'];
if (!art) throw new Error('steam_local has no art');
const LENGTH_U = 156;

describe('vehicleArtLayers (one layout for the ride and the depot)', () => {
  it('stacks body, wheels, rods and overlay in drawing order', () => {
    expect(vehicleArtLayers(art, LENGTH_U, 0).map((p) => p.part)).toEqual([
      'steam_local.body',
      'wheel.steam-driver',
      'wheel.steam-driver',
      'wheel.steam-driver',
      'wheel.steam-pony',
      'steam_local.coupling-rod',
      'steam_local.crosshead',
      'steam_local.connecting-rod',
      'steam_local.overlay',
    ]);
  });

  it('pins body and overlay to the vehicle middle on the rail', () => {
    const layers = vehicleArtLayers(art, LENGTH_U, 123);
    for (const layer of [layers[0], layers.at(-1)])
      expect(layer).toMatchObject({ x: 0, y: 0, rotation: 0 });
  });

  it('stands wheels on the rail and turns each by distance / its radius', () => {
    const distance = 50;
    const wheels = vehicleArtLayers(art, LENGTH_U, distance).filter((p) =>
      p.part.startsWith('wheel.'),
    );
    expect(wheels.map((w) => [w.x, w.y])).toEqual([
      [44 - 78, -15],
      [76 - 78, -15],
      [108 - 78, -15],
      [138 - 78, -9],
    ]);
    expect(wheels[0]?.rotation).toBeCloseTo(distance / 15, 12);
    // The small leading wheel turns faster.
    expect(wheels[3]?.rotation).toBeCloseTo(distance / 9, 12);
  });

  it('drives the rods from the main wheel crank (doc 06 §2)', () => {
    for (const distance of [0, 7, 31.4, 100]) {
      const layers = vehicleArtLayers(art, LENGTH_U, distance);
      const gear = steamGear(
        {
          mainWheel: { x: -2, y: -15 },
          crankU: 7,
          connectingRodU: 44,
          guideY: 77 - 100,
        },
        distance / 15,
      );
      const byPart = (key: string) => layers.find((p) => p.part === key);
      expect(byPart('steam_local.coupling-rod')).toEqual({
        part: 'steam_local.coupling-rod',
        x: gear.crankPin.x,
        y: gear.crankPin.y,
        rotation: 0,
      });
      expect(byPart('steam_local.crosshead')).toEqual({
        part: 'steam_local.crosshead',
        x: gear.crosshead.x,
        y: gear.crosshead.y,
        rotation: 0,
      });
      expect(byPart('steam_local.connecting-rod')).toEqual({
        part: 'steam_local.connecting-rod',
        x: gear.crankPin.x,
        y: gear.crankPin.y,
        rotation: gear.connectingRodAngle,
      });
    }
  });

  it('draws no rods for vehicles without steam gear', () => {
    const plain = { ...art };
    delete plain.steamGear;
    expect(
      vehicleArtLayers(plain, LENGTH_U, 0).map((p) => p.part),
    ).not.toContain('steam_local.coupling-rod');
  });
});
