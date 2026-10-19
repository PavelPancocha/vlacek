import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { roadVehicleArt } from '../../../src/content/roadVehicleArt.ts';
import { worldParts } from '../../../src/content/worldArt.ts';
import { farmForestParts } from '../../../src/content/world-modules/farm-forest.art.ts';
import { waterMountainParts } from '../../../src/content/world-modules/water-mountains.art.ts';

const fronts = new Map<string, number>();
for (const [key, art] of Object.entries(roadVehicleArt))
  if (art?.front.xU && art.front.yU === 0) fronts.set(key, art.front.xU);
for (const [key, part] of Object.entries({
  ...farmForestParts,
  ...waterMountainParts,
}))
  if (key.startsWith('back.') && part.front)
    fronts.set(key, part.front === 'right' ? 1 : -1);

// Authored markers are visible, untransformed geometric primitives. This
// checks the identifying detail against metadata, not the perceived silhouette.
for (const [key, frontX] of fronts)
  it(`SCN-RD02/03: ${key} front marker agrees with its declared front`, () => {
    const part = Object.entries(worldParts).find(([id]) => id === key)?.[1];
    if (!part) throw new Error(`missing world art ${key}`);
    const svg = readFileSync(
      resolve(import.meta.dirname, '../../../assets/world', part.file),
      'utf8',
    );
    const viewBox = /viewBox="([^"]+)"/
      .exec(svg)?.[1]
      ?.split(/\s+/)
      .map(Number);
    expect(viewBox, `${key}: viewBox`).toHaveLength(4);
    const minX = viewBox?.[0],
      width = viewBox?.[2];
    if (minX === undefined || width === undefined) throw new Error('viewBox');
    const markers = [...svg.matchAll(/<(\w+)\b[^>]*\bid="front-lamp"[^>]*>/g)];
    expect(markers, `${key}: missing or duplicate front-lamp`).toHaveLength(1);
    const marker = markers[0];
    if (!marker) throw new Error(`${key}: missing front-lamp`);
    const attrs = new Map(
      [...marker[0].matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
    );
    expect(
      attrs.has('transform'),
      `${key}: marker must use SVG coordinates`,
    ).toBe(false);
    const number = (name: string) => {
      const value = attrs.get(name);
      expect(value, `${key}: ${name}`).toBeDefined();
      const result = Number(value);
      expect(Number.isFinite(result), `${key}: ${name}`).toBe(true);
      return result;
    };
    let centreX: number;
    switch (marker[1]) {
      case 'rect':
        centreX = number('x') + number('width') / 2;
        break;
      case 'circle':
      case 'ellipse':
        centreX = number('cx');
        break;
      case 'polyline':
      case 'polygon': {
        const points =
          attrs
            .get('points')
            ?.trim()
            .split(/[\s,]+/)
            .map(Number) ?? [];
        expect(points.length % 2).toBe(0);
        expect(points.length).toBeGreaterThanOrEqual(4);
        expect(points.every(Number.isFinite)).toBe(true);
        const xs = points.filter((_, i) => i % 2 === 0);
        centreX = (Math.min(...xs) + Math.max(...xs)) / 2;
        break;
      }
      default:
        throw new Error(`${key}: front-lamp must be a geometric primitive`);
    }
    expect(centreX).toBeGreaterThanOrEqual(minX);
    expect(centreX).toBeLessThanOrEqual(minX + width);
    expect((centreX - (minX + width / 2)) * frontX, key).toBeGreaterThan(0);
  });
