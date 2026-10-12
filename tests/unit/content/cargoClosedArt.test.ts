import { describe, expect, it } from 'vitest';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { wagons } from '../../../src/content/vehicles.ts';

describe('CNT-02: closed cargo art follows the frozen vehicle contract', () => {
  it.each([
    ['cargo_tank', 176, 82, 55, [20, 46, 130, 156]],
    ['cargo_milk', 168, 76, 52, [32, 136]],
    ['cargo_grain', 172, 84, 53, [20, 46, 126, 152]],
    ['cargo_mail', 164, 78, 51, [31, 133]],
    ['cargo_refrigerated', 176, 80, 55, [33, 143]],
  ] as const)(
    '%s has its own full frames and prescribed running gear',
    (id, lengthU, heightU, bogieOffsetU, axles) => {
      const vehicle = wagons.find((wagon) => wagon.id === id);
      expect(vehicle).toMatchObject({
        lengthU,
        bogieOffsetU,
        wheelRadiusU: 12,
      });
      expect(vehicle).not.toHaveProperty('placeholder');
      const art = vehicleArt[id];
      expect(art).toEqual({
        heightU,
        body: `${id}.body`,
        overlay: `${id}.overlay`,
        wheels: axles.map((xU) => ({ part: 'wheel.wagon-disc', xU })),
      });
      if (!art?.overlay) throw new Error(`${id}: missing full-frame art`);
      for (const key of [art.body, art.overlay]) {
        expect(artParts[key]).toEqual({
          file: `${key}.svg`,
          widthU: lengthU,
          heightU,
          pivotU: { x: lengthU / 2, y: heightU },
        });
      }
    },
  );
});
