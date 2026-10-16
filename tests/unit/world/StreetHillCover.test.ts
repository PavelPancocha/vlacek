import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { chunkScenery } from '../../../src/domain/world/Scenery.ts';
import { worldPlacementCatalog as catalog } from '../../../src/content/worldPlacementCatalog.ts';
import {
  railYUpU,
  roadSide,
  type RoadPath,
} from '../../../src/domain/world/SceneryGeometry.ts';
import { tunnelSite } from '../../../src/domain/world/Structures.ts';

function street(seed: number, k: number): RoadPath {
  const road = chunkScenery(seed, k, catalog).roads.find((r) =>
    r.id.includes(':street:'),
  );
  if (!road) throw Error('missing street witness');
  return road;
}
function endCap(road: RoadPath) {
  const drawing = { ...road, points: road.drawingPoints ?? road.points };
  return [-1, 1].map((sign) => {
    const p = roadSide(drawing, sign, 1.6).at(-1);
    if (!p) throw Error('missing shoulder');
    return p;
  });
}

it.each([32, 64])(
  'polish-2: seed 1 / chunk 11 rejects the exposed %i-u cap at the secondary SVG',
  (reachU) => {
    const road = street(1, 11);
    expect(road.toXU).toBe(12288 - 384);
    expect(road.drawingPoints).toBeUndefined();
    const end = road.points.at(-1);
    if (!end) throw Error('missing clear endpoint');
    expect(end).toMatchObject({ xU: 11904, halfWidthU: 9 });
    // Reconstruct both rejected village-green tips; always check their geometry.
    const xU = end.xU + reachU;
    const tip = {
      ...end,
      xU,
      yU:
        -railYUpU(1, xU) -
        140 -
        45 * Math.min(1, (12288 - xU) / 350) +
        4 * Math.sin(xU / 300),
    };
    // Select the opaque hill fill, not the identical clip or translucent highlight.
    const svg = readFileSync('assets/world/secondary.portal-hill.svg', 'utf8');
    const opaquePath = svg.match(/<path d="([^"]+)" fill="url\(#hill\)"/);
    const cubic = opaquePath?.[1]?.match(/^M0 200 C\s*([^C]+)C/);
    if (!cubic?.[1]) throw Error('secondary silhouette changed');
    const n = [0, 200, ...cubic[1].matchAll(/\d+/g)].map(Number);
    expect(n).toHaveLength(8);
    const at = (t: number, axis: number) =>
      (n[axis] ?? 0) * (1 - t) ** 3 +
      3 * (n[axis + 2] ?? 0) * (1 - t) ** 2 * t +
      3 * (n[axis + 4] ?? 0) * (1 - t) * t * t +
      (n[axis + 6] ?? 0) * t ** 3;
    const clearances = endCap({ ...road, points: [end, tip] }).map((p) => {
      const x = p.xU - 12288 + 380;
      const y = p.yU + railYUpU(1, 12288) + 64 + 194;
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(150);
      let low = 0,
        high = 1;
      for (let i = 0; i < 40; i++) {
        const t = (low + high) / 2;
        if (at(t, 0) < x) low = t;
        else high = t;
      }
      return y - at((low + high) / 2, 1);
    });
    expect(
      Math.min(...clearances),
      'at least one shoulder above the opaque SVG outline',
    ).toBeLessThan(0);
  },
);

// Independent reconstruction of TunnelView's *drawn* 16-u polyline, including bumps.
function moundTop(seed: number, k: number, worldX: number): number {
  const site = tunnelSite(seed, k);
  if (!site) throw Error('missing tunnel');
  const x = worldX - k * 1024,
    from = site.fromX - 170,
    to = site.toX + 170;
  const left = Math.max(from, from + Math.floor((x - from) / 16) * 16),
    right = Math.min(to, left + 16);
  const top = (x: number) => {
    const ratio = Math.min(
      1,
      Math.abs(x - (site.fromX + site.toX) / 2) / ((to - from) / 2),
    );
    return (
      -railYUpU(seed, k * 1024 + x) -
      290 * Math.sqrt(1 - ratio ** 3) -
      (10 * Math.sin((x - site.fromX) / 47) + 6 * Math.sin(x / 23)) *
        (1 - ratio)
    );
  };
  return top(left) + ((top(right) - top(left)) * (x - left)) / (right - left);
}
for (const [seed, k] of [
  [7, 62],
  [1, 246],
] as const)
  it(`polish-2: seed ${seed} / chunk ${k} complete cap fits the rendered short mound`, () => {
    const road = street(seed, k),
      [a, b] = endCap(road);
    if (!a || !b) throw Error('missing cap');
    expect(road.drawingPoints).toBeDefined();
    for (let i = 0; i <= 100; i++) {
      const t = i / 100,
        x = a.xU + (b.xU - a.xU) * t,
        y = a.yU + (b.yU - a.yU) * t;
      expect(y, 'cap below the rendered mound outline').toBeGreaterThanOrEqual(
        moundTop(seed, k, x),
      );
      expect(y).toBeLessThan(-railYUpU(seed, x));
    }
    if (seed === 7) expect(road.drawingPoints?.at(-1)?.xU).toBe(road.toXU + 64);
  });
