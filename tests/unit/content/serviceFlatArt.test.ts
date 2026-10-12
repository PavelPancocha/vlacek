import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { wagons } from '../../../src/content/vehicles.ts';

function bodySvg(id: string): string {
  return readFileSync(
    resolve(import.meta.dirname, `../../../assets/vehicles/${id}.body.svg`),
    'utf8',
  );
}

function distanceToEdge(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(x - a.x - t * dx, y - a.y - t * dy);
}

describe('CNT-02: carrier cargo is visibly secured (contract B.5)', () => {
  it('both chocks touch each tractor tyre and stand on the deck', () => {
    const svg = bodySvg('cargo_tractor');
    const tyres = [
      ...svg.matchAll(
        /<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)" fill="url\(#tyre\)"/g,
      ),
    ];
    const chocks = [...svg.matchAll(/<path d="([^"]+)" fill="url\(#chock\)"/g)];
    expect(tyres).toHaveLength(2);
    expect(chocks).toHaveLength(2);
    tyres.forEach((tyre, index) => {
      const path = chocks[index]?.[1];
      if (!path) throw new Error('missing tractor chocks');
      for (const triangle of path.split(' Z ')) {
        const points = [...triangle.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(
          (point) => ({
            x: Number(point[1]),
            y: Number(point[2]),
          }),
        );
        const [a, b, c] = points;
        if (!a || !b || !c) throw new Error('chock must have three vertices');
        expect(a.y).toBe(54);
        expect(c.y).toBe(54);
        const gapU =
          Math.min(
            distanceToEdge(Number(tyre[1]), Number(tyre[2]), a, b),
            distanceToEdge(Number(tyre[1]), Number(tyre[2]), b, c),
            distanceToEdge(Number(tyre[1]), Number(tyre[2]), c, a),
          ) - Number(tyre[3]);
        expect(
          Math.abs(gapU),
          'chock face must meet the tyre, within SVG rounding',
        ).toBeLessThan(0.03);
      }
    });
  });

  it('the excavator boom rests on the support along its lower edge', () => {
    const svg = bodySvg('cargo_excavator');
    const rest = /M32 59\.5 V([\d.]+) (?:H39|L39 ([\d.]+)) V59\.5 Z/.exec(svg);
    const boom =
      /<path d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+) L55 47 L33 30 Z"/.exec(
        svg,
      );
    if (!rest || !boom) throw new Error('missing boom or support');
    const lowerEdgeY = (x: number) =>
      Number(boom[2]) +
      ((x - Number(boom[1])) * (Number(boom[4]) - Number(boom[2]))) /
        (Number(boom[3]) - Number(boom[1]));
    expect(Number(rest[1])).toBeCloseTo(lowerEdgeY(32), 2);
    expect(Number(rest[2] ?? rest[1])).toBeCloseTo(lowerEdgeY(39), 2);
  });

  it('the excavator left chain starts at a visible chassis eye', () => {
    const svg = bodySvg('cargo_excavator');
    const chain = /<path d="M([\d.]+) ([\d.]+) L75 59 M156 44/.exec(svg);
    const frame = /M([\d.]+) ([\d.]+) H([\d.]+) V([\d.]+) H96 Z/.exec(svg);
    if (!chain || !frame) throw new Error('missing chain or chassis');
    const x = Number(chain[1]);
    const y = Number(chain[2]);
    expect(x).toBeGreaterThanOrEqual(Number(frame[1]));
    expect(x).toBeLessThanOrEqual(Number(frame[3]));
    expect(y).toBeGreaterThanOrEqual(Number(frame[2]));
    expect(y).toBeLessThanOrEqual(Number(frame[4]));
    expect(svg).toContain(`<circle cx="${x}" cy="${y}" r="1.2"`);
  });
});

describe('CNT-02: service and flat wagons use the frozen V1 art contract', () => {
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
    {
      id: 'cargo_cars',
      lengthU: 204,
      heightU: 96,
      offsetU: 63,
      xs: [26, 52, 152, 178],
    },
    {
      id: 'cargo_tractor',
      lengthU: 184,
      heightU: 90,
      offsetU: 57,
      xs: [22, 48, 136, 162],
    },
    {
      id: 'cargo_excavator',
      lengthU: 192,
      heightU: 96,
      offsetU: 60,
      xs: [23, 49, 143, 169],
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
