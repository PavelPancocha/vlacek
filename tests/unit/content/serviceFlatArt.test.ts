import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { wagons } from '../../../src/content/vehicles.ts';

describe('CNT-02: service wagons use the frozen V1 art contract', () => {
  it.each([
    {
      id: 'service_tools',
      lengthU: 164,
      heightU: 80,
      offsetU: 51,
      xs: [31, 133],
    },
    {
      id: 'service_snowplow',
      lengthU: 156,
      heightU: 80,
      offsetU: 48,
      xs: [30, 126],
    },
  ])('$id has layered vector art and the specified running gear', (row) => {
    expect(wagons.find((wagon) => wagon.id === row.id)).toMatchObject({
      lengthU: row.lengthU,
      bogieOffsetU: row.offsetU,
      wheelRadiusU: 12,
    });
    expect(
      wagons.find((wagon) => wagon.id === row.id)?.placeholder,
    ).toBeUndefined();
    const art = vehicleArt[row.id];
    expect(art).toEqual({
      heightU: row.heightU,
      body: `${row.id}.body`,
      overlay: `${row.id}.overlay`,
      wheels: row.xs.map((xU) => ({ part: 'wheel.wagon-disc', xU })),
    });
    if (!art?.overlay) throw new Error(`${row.id}: missing art`);
    for (const key of [art.body, art.overlay]) {
      const part = artParts[key];
      expect(part).toEqual({
        file: `${key}.svg`,
        widthU: row.lengthU,
        heightU: row.heightU,
        pivotU: { x: row.lengthU / 2, y: row.heightU },
      });
      const svg = readFileSync(
        resolve(import.meta.dirname, '../../../assets/vehicles', part.file),
        'utf8',
      );
      expect(svg).not.toMatch(
        /<(?:image|text|script|foreignObject)\b|data:|base64/i,
      );
    }
  });
});
