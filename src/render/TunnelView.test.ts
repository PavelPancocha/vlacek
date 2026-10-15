import Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig.ts';
import { catenaryPoleXs, catenarySupport } from '../domain/world/Catenary.ts';
import { tunnelSite, type TunnelSite } from '../domain/world/Structures.ts';
import { TunnelView } from './TunnelView.ts';
import { secondaryPortalFeet } from './SecondaryView.ts';

// Replace only the drawing platform; run the real tunnel painting in Node.
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: {
      Vector2: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
    },
    GameObjects: {
      Container: class {
        setDepth() {
          return this;
        }
      },
      Graphics: class {
        setDepth() {
          return this;
        }
        fillStyle() {}
        fillPoints() {}
        lineStyle() {}
        lineBetween() {}
        strokePoints() {}
        fillCircle() {}
        fillEllipse() {}
        fillRect() {}
      },
    },
  },
}));

const { chunkWidthU, catenaryContactHeightU } = gameConfig.world;

function drawnHangerXs(seed: number, site: TunnelSite): number[] {
  const x0 = site.chunkIndex * chunkWidthU;
  const poles = catenaryPoleXs(seed, x0, x0 + chunkWidthU);
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  const rectangles = vi.spyOn(graphics, 'fillRect');
  new TunnelView(
    scene,
    undefined,
    site,
    { railY: () => 0, meadowY: () => 20 },
    (paint) => {
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    poles
      .filter((x) => catenarySupport(seed, x) === 'hanger')
      .map((x) => x - x0),
  );
  // The clamp actually painted at the wire, not just a proposed hanger.
  return rectangles.mock.calls
    .filter(
      ([, y, width, height]) =>
        y === -catenaryContactHeightU - 3 && width === 6 && height === 3,
    )
    .map(([x]) => x + 3 + x0);
}

describe('tunnel catenary supports (TRN-08)', () => {
  it('R6: gives every support a mast or a drawn hanger in world 25, chunk 6', () => {
    const site = tunnelSite(25, 6);
    if (!site) throw new Error('no tunnel in world 25, chunk 6');
    const drawn = drawnHangerXs(25, site);
    for (const x of catenaryPoleXs(25, 6 * chunkWidthU, 7 * chunkWidthU))
      expect(
        catenarySupport(25, x) === 'mast' || drawn.includes(x),
        `world 25 chunk 6 support ${x}`,
      ).toBe(true);
  });

  it('R6: gives every support a mast or a drawn hanger across many tunnel worlds', () => {
    let tunnels = 0;
    let hangers = 0;
    for (let seed = 0; seed < 64; seed++) {
      for (let k = -10; k < 64; k += 8) {
        const site = tunnelSite(seed, k);
        if (!site) continue;
        tunnels += 1;
        const drawn = drawnHangerXs(seed, site);
        hangers += drawn.length;
        for (const x of catenaryPoleXs(
          seed,
          k * chunkWidthU,
          (k + 1) * chunkWidthU,
        ))
          expect(
            catenarySupport(seed, x) === 'mast' || drawn.includes(x),
            `world ${seed} chunk ${k} support ${x}`,
          ).toBe(true);
      }
    }
    expect(tunnels).toBeGreaterThan(100);
    expect(hangers).toBeGreaterThan(100);
  });
});

it('tunnel-1: opaque from the first paused frame; sources behind the fitted cover stay inside rock', () => {
  const site = tunnelSite(123, 6);
  if (!site) throw new Error('missing regression tunnel');
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  const view = new TunnelView(
    scene,
    undefined,
    site,
    { railY: (x) => x * 0.07885, meadowY: (x) => x * 0.07885 + 20 },
    (paint) => {
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
  );
  const fromX = site.chunkIndex * chunkWidthU + site.fromX;
  for (const minX of [fromX - 100, fromX + 40, fromX + 120]) {
    view.update({ minX, maxX: minX + 100 });
    expect(view.alpha).toBe(1);
  }
  const x = fromX + 150;
  const railY = (site.fromX + 150) * 0.07885;
  expect(view.coversPoint({ x, y: railY - 94 })).toBe(true);
  expect(view.coversPoint({ x, y: railY })).toBe(true);
  expect(view.coversPoint({ x, y: railY - 400 })).toBe(false);
  expect(view.coversPoint({ x, y: railY + 100 })).toBe(false);
  expect(view.coversPoint({ x: fromX - 100, y: railY - 94 })).toBe(false);
});

it('tunnel-1: NPC rear half-mouth covers its last pixels before domain removal', () => {
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, { add: { graphics: () => graphics } });
  const fills = vi.spyOn(graphics, 'fillStyle');
  const outlines = vi.spyOn(graphics, 'fillPoints');
  for (const chunkIndex of [0, 1])
    secondaryPortalFeet(
      scene,
      { fromX: 1000, toX: 2000 },
      (x) => x * 0.07885,
      4.35,
      chunkIndex,
    );
  expect(fills.mock.calls.filter(([tone]) => tone === 0x24211e)).toHaveLength(
    2,
  );
  // A sloped vehicle's roof extends past its rail endpoint along the normal.
  expect(outlines.mock.calls[0]?.[0][0]?.x).toBeGreaterThan(1000);
});

it('tunnel-3: fitted covers belong to the chunk that owns each portal', () => {
  const scene = new Phaser.Scene();
  Object.assign(scene, {
    add: { graphics: () => new Phaser.GameObjects.Graphics(scene) },
  });
  const site = { fromX: 1024, toX: 3072 };
  expect(
    secondaryPortalFeet(scene, site, (x) => x * 0.07885, 4.35, 1),
  ).toHaveLength(1);
  expect(
    secondaryPortalFeet(scene, site, (x) => x * 0.07885, 4.35, 2),
  ).toHaveLength(1);
  expect(
    secondaryPortalFeet(scene, site, (x) => x * 0.07885, 4.35, 3),
  ).toHaveLength(0);
});

it('SEA-05: winter hill is snowy without summer flowers, tunnel cover remains opaque', () => {
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  const fills = vi.spyOn(graphics, 'fillStyle');
  const view = new TunnelView(
    scene,
    undefined,
    { id: 'winter', chunkIndex: 6, fromX: 200, toX: 700 },
    { railY: () => 0, meadowY: () => 20 },
    (paint) => {
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    [],
    {
      climateAt: () => ({
        from: { season: 'winter', weather: 'snow' },
        to: { season: 'winter', weather: 'snow' },
        progress: 0,
        season: 'winter',
        weather: 'snow',
        spring: 0,
        summer: 0,
        autumn: 0,
        winter: 1,
        snowfall: 1,
        rainfall: 0,
      }),
      sandAt: () => false,
    },
  );
  expect(fills.mock.calls.some(([color]) => color === 0xf1f6fa)).toBe(true);
  expect(
    fills.mock.calls.some(
      ([color]) => color === 0xf4d03f || color === 0xe74c3c,
    ),
  ).toBe(false);
  expect(view.coversPoint({ x: 6 * 1024 + 400, y: -50 })).toBe(true);
});

it('SEA-05: secondary portal foot uses the same winter cover as its hill', () => {
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, { add: { graphics: () => graphics } });
  const fills = vi.spyOn(graphics, 'fillStyle');
  // The ordinary closed rear half remains dark; only its ground skirt is snow.
  secondaryPortalFeet(
    scene,
    { fromX: 1024, toX: 3072 },
    () => 0,
    4.35,
    1,
    () => 0xe7f0f5,
  );
  expect(fills.mock.calls.map(([tone]) => tone)).toEqual([0x24211e, 0xe7f0f5]);
});
