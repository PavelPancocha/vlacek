import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { wagons } from '../../../src/content/vehicles.ts';

// Frozen contract B.1, H2 batch 4; CNT-02.
it.each([
  ['fun_stars', 164, 88, 51, 'wheel.wagon-spoked', [31, 133]],
  ['fun_garden', 172, 88, 53, 'wheel.wagon-spoked', [33, 139]],
  ['fun_aquarium', 176, 88, 55, 'wheel.wagon-disc', [20, 46, 130, 156]],
  ['fun_windmill', 160, 100, 50, 'wheel.wagon-spoked', [30, 130]],
  ['fun_lights', 168, 96, 52, 'wheel.wagon-spoked', [32, 136]],
  ['fun_toyblocks', 164, 84, 51, 'wheel.wagon-spoked', [31, 133]],
] as const)(
  '%s has vector art with the frozen frame and running gear',
  (id, lengthU, heightU, bogieOffsetU, wheel, positions) => {
    const wagon = wagons.find((entry) => entry.id === id);
    expect(wagon, id).toBeDefined();
    expect(wagon).not.toHaveProperty('placeholder');
    expect(wagon).toMatchObject({ lengthU, bogieOffsetU, wheelRadiusU: 12 });
    const art = vehicleArt[id];
    expect(art, id).toBeDefined();
    if (!art) throw new Error(`${id}: no art`);
    expect(art.heightU).toBe(heightU);
    expect(art.wheels).toEqual(positions.map((xU) => ({ part: wheel, xU })));
    expect(art.emitters ?? []).toEqual([]);
    expect(art.pantograph).toBeUndefined();
    expect(art.steamGear).toBeUndefined();
    for (const key of [art.body, art.overlay]) {
      expect(key).toBeDefined();
      if (!key) throw new Error(`${id}: missing layer`);
      const part = artParts[key];
      expect(part).toMatchObject({
        widthU: lengthU,
        heightU,
        pivotU: { x: lengthU / 2, y: heightU },
      });
      const svg = readFileSync(
        resolve(import.meta.dirname, '../../../assets/vehicles', part.file),
        'utf8',
      );
      expect(svg).not.toMatch(/<image\b|<text\b|data:|<animate\b/i);
    }
  },
);
