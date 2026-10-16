import Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig.ts';
import { catenaryPoleXs, catenarySupport } from '../domain/world/Catenary.ts';
import { tunnelSite, type TunnelSite } from '../domain/world/Structures.ts';
import { TunnelView } from './TunnelView.ts';
import { worldParts, type WorldPartKey } from '../content/worldArt.ts';
import { regionAt } from '../domain/world/Regions.ts';
import { streetHillCoversCap } from '../domain/world/StreetHillCover.ts';
import { pointInside, railYUpU } from '../domain/world/SceneryGeometry.ts';
import { secondaryPortalFeet } from './SecondaryView.ts';
import { BACK_PALETTE } from './groundPalette.ts';
import { effectiveClimateAt } from '../domain/world/Seasons.ts';

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
      Image: class {
        scaleX = 1;
        scaleY = 1;
        alpha = 1;
        data = new Map<string, unknown>();
        frame = { width: 182, height: 242 };
        setData(key: string, value: unknown) {
          this.data.set(key, value);
          return this;
        }
        setOrigin() {
          return this;
        }
        setScale(scale: number, scaleY = scale) {
          this.scaleX = scale;
          this.scaleY = scaleY;
          return this;
        }
        setAlpha(alpha: number) {
          this.alpha = alpha;
          return this;
        }
        setFlipX() {
          return this;
        }
      },
      Container: class {
        add() {
          return this;
        }
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
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
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
    seed,
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
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
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
    [],
    123,
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
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
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

it('SCN-TB04/06: an interior long-tunnel fragment bakes at most one chunk and still covers the entire train', () => {
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
  const widths: number[] = [];
  const view = new TunnelView(
    scene,
    undefined,
    { id: 'long', chunkIndex: 10, fromX: -1500, toX: 1828, rock: true },
    { railY: (x) => 0.05 * x, meadowY: (x) => 0.05 * x + 80 },
    (paint, bounds) => {
      widths.push(bounds.right - bounds.left);
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    [],
    123,
  );
  expect(Math.max(...widths)).toBeLessThanOrEqual(1028);
  view.update({ minX: 9000, maxX: 11000 });
  expect(view.train).toBe('inside');
  for (const localX of [0, 512, 1024]) {
    expect(
      view.coversPoint({ x: 10240 + localX, y: 0.05 * localX - 110 }),
    ).toBe(true);
    expect(
      view.coversPoint({ x: 10240 + localX, y: 0.05 * localX - 600 }),
    ).toBe(false);
  }
});

it('SCN-TB04: the dark interior starts inside the mouth, never as a wedge on the approach', () => {
  const scene = new Phaser.Scene(),
    graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
  const fills = vi.spyOn(graphics, 'fillPoints');
  new TunnelView(
    scene,
    undefined,
    { id: 'long-entrance', chunkIndex: 5, fromX: 128, toX: 3200, rock: true },
    { railY: (x) => x * 0.05, meadowY: (x) => x * 0.05 + 40 },
    (paint) => {
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    [],
    123,
  );
  const interior = fills.mock.calls[0]?.[0];
  expect(interior).toBeDefined();
  expect(Math.min(...(interior ?? []).map((p) => p.x))).toBeGreaterThanOrEqual(
    68,
  );
});

it('SCN-TB04: a flank-only fragment never passes an empty polygon to Phaser', () => {
  const scene = new Phaser.Scene(),
    graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
  vi.spyOn(graphics, 'fillPoints').mockImplementation((points) => {
    expect(points.length).toBeGreaterThan(0);
    return graphics;
  });
  new TunnelView(
    scene,
    undefined,
    { id: 'long-flank', chunkIndex: 9, fromX: -3200, toX: -100, rock: true },
    { railY: () => 0, meadowY: () => 30 },
    (paint) => {
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    [],
    123,
  );
});

it('SCN-TB09: every interior chunk of a long tunnel draws all classified hangers', () => {
  let checked = 0;
  for (let seed = 0; seed < 4; seed++)
    for (let owner = 6; owner < 480; owner += 8) {
      const site = tunnelSite(seed, owner);
      if (!site?.rock) continue;
      const from = owner * 1024 + site.fromX,
        to = owner * 1024 + site.toX;
      for (let k = Math.floor(from / 1024); k <= Math.floor(to / 1024); k++) {
        const fragment = tunnelSite(seed, k);
        if (!fragment) throw new Error('fragment missing');
        const drawn = drawnHangerXs(seed, fragment);
        for (const x of catenaryPoleXs(seed, k * 1024, (k + 1) * 1024)) {
          expect(
            catenarySupport(seed, x) === 'mast' || drawn.includes(x),
            `${seed}/${k}/${x}`,
          ).toBe(true);
          checked++;
        }
      }
    }
  expect(checked).toBeGreaterThan(100);
});

function shortMound(
  seed: number,
  k: number,
  art = false,
  appearance?: ConstructorParameters<typeof TunnelView>[8],
) {
  const site = tunnelSite(seed, k);
  if (!site || site.rock) throw new Error(`missing short tunnel ${seed}/${k}`);
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
  const fills = vi.spyOn(graphics, 'fillStyle');
  const strokes = vi.spyOn(graphics, 'strokePoints');
  const lines = vi.spyOn(graphics, 'lineBetween');
  let coverStrokes: typeof strokes.mock.calls = [];
  let coverLines: typeof lines.mock.calls = [];
  let layers = 0;
  const image = vi.fn(
    (x: number, y: number, texture: string, frame: WorldPartKey) =>
      new Phaser.GameObjects.Image(scene, x, y, texture, frame),
  );
  Object.assign(scene, { add: { image } });
  const view = new TunnelView(
    scene,
    art ? { texture: 'world', pxPerU: 1 } : undefined,
    site,
    { railY: () => 0, meadowY: () => 20 },
    (paint) => {
      strokes.mockClear();
      lines.mockClear();
      paint(graphics);
      if (++layers === 4) {
        coverStrokes = [...strokes.mock.calls];
        coverLines = [...lines.mock.calls];
      }
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    [],
    seed,
    appearance,
  );
  return { site, fills, image, view, coverStrokes, coverLines };
}

it.each([230, 190])(
  'SEA-05: art-enabled short portals at seed 0 chunk %i retain both effective-winter snow caps',
  (k) => {
    const climateAt = (x: number) => effectiveClimateAt(0, k * chunkWidthU + x);
    const { site, image } = shortMound(0, k, true, {
      climateAt,
      sandAt: () => false,
    });
    const caps = image.mock.calls.flatMap((call, i) => {
      if (call[3] !== 'snow.roof-64') return [];
      const result = image.mock.results[i];
      if (result?.type !== 'return') throw new Error('missing portal snow cap');
      return [{ call, cap: result.value }];
    });
    expect(caps).toHaveLength(2);
    for (const [i, x] of [site.fromX, site.toX].entries()) {
      const attachment = caps[i];
      if (!attachment) throw new Error('missing portal snow cap');
      expect(attachment.call).toEqual([x - 78, -228, 'world', 'snow.roof-64']);
      expect(attachment.cap.data.get('world-part')).toBe('snow.roof-64');
      expect(attachment.cap.scaleX).toBe(156 / 64);
      expect(attachment.cap.scaleY).toBe(0.45);
      expect(attachment.cap.alpha).toBe(climateAt(x).winter);
      expect(attachment.cap.alpha).toBeGreaterThan(0);
      if (k === 190) expect(attachment.cap.alpha).toBeLessThan(1);
    }
  },
);

it('SCN-TB04: the transition mound at seed 0 chunk 190 follows the effective winter', () => {
  const { site, fills, image } = shortMound(0, 190, true);
  const x = 190 * 1024 + site.fromX;
  expect(regionAt(0, x).season).toBe('autumn');
  expect(effectiveClimateAt(0, x).season).toBe('winter');
  expect(fills.mock.calls[0]).toEqual([BACK_PALETTE.snow.base, 1]);
  expect(image.mock.calls.map((call) => call[3])).toContain('tree.spruce-snow');
});

it.each([
  [0, 382],
  [0, 398],
  [2, 142],
  [0, 230],
])(
  'SCN-TB04: cover %i/%i paints no outline on its empty outer shoulders',
  (seed, k) => {
    const { site, view, coverStrokes, coverLines } = shortMound(seed, k);
    const left = site.fromX - 150;
    const right = site.toX + 150;
    // Here the front cap equals its roof: there is no filled cover to outline.
    const strokeXs = coverStrokes.flatMap(([points]) => points.map((p) => p.x));
    const lineXs = coverLines.flatMap(([x1, , x2]) => [x1, x2]);
    expect([...strokeXs, ...lineXs].some((x) => x < left || x > right)).toBe(
      false,
    );
    expect(coverStrokes.length + coverLines.length).toBeGreaterThan(0);
    for (const [x1, y1, x2, y2] of coverLines)
      for (const [x, y] of [
        [x1, y1],
        [x2, y2],
      ] as const)
        expect(view.coversPoint({ x: k * 1024 + x, y })).toBe(true);
  },
);

it.each([
  ['dunes', 0, 382, 'summer', 0xe4c58b],
  ['coast', 0, 398, 'summer', 0x96958b],
  ['mountains', 2, 142, 'summer', 0x96958b],
  ['foothills', 0, 174, 'autumn', 0x96958b],
  ['countryside', 0, 6, 'summer', 0x6eae43],
  ['town', 0, 38, 'summer', 0x6eae43],
  ['mountains', 0, 230, 'winter', 0xf3f7fa],
] as const)(
  'SCN-TB04: %s / seed %i chunk %i %s paints the host surface, never a foreign meadow',
  (landscape, seed, k, season, tone) => {
    const { site, fills } = shortMound(seed, k);
    const host = regionAt(seed, k * 1024 + site.fromX);
    expect([host.landscape, host.season]).toEqual([landscape, season]);
    if (landscape === 'dunes') {
      // The first fill paints the real flank shared by Canvas and WebGL baking.
      const flank = fills.mock.calls[0]?.[0];
      if (flank === undefined) throw new Error('flank fill missing');
      const ground = BACK_PALETTE.sand.base;
      const contrast = Math.hypot(
        ...[16, 8, 0].map(
          (shift) => ((flank >> shift) & 255) - ((ground >> shift) & 255),
        ),
      );
      expect(
        contrast,
        'filled sand flank must differ from the flat ground',
      ).toBeGreaterThan(18);
    }
    expect(fills.mock.calls[0]).toEqual([tone, 1]);
    if (tone !== 0x6eae43) {
      expect(fills.mock.calls.some(([color]) => color === 0x6eae43)).toBe(
        false,
      );
      expect(fills.mock.calls.some(([color]) => color === 0xe74c3c)).toBe(
        false,
      );
    }
  },
);

it.each([
  [0, 382, ['tree.pine', 'near.bush', 'near.flowers-b']],
  [0, 398, ['near.dune-grass']],
  [2, 142, ['tree.spruce']],
  [0, 174, ['tree.spruce']],
  [0, 230, ['tree.spruce-snow']],
] as const)(
  'SCN-TB04: art-enabled host vegetation at %i/%i stays inside the original cover',
  (seed, k, expected) => {
    const { image, view } = shortMound(seed, k, true);
    const keys = image.mock.calls.map((call) => call[3]);
    for (const key of expected) expect(keys).toContain(key);
    expect(keys).not.toContain('near.wildflowers');
    for (const [i, [x, y, , key]] of image.mock.calls.entries()) {
      if (key === 'tunnel.portal') continue;
      const result = image.mock.results[i];
      if (result?.type !== 'return') throw new Error('missing plant');
      const scale = result.value.scaleX;
      const part = worldParts[key];
      for (const dx of [-part.widthU / 2, 0, part.widthU / 2])
        for (const dy of [-part.heightU, 0])
          expect(
            view.coversPoint({
              x: k * 1024 + x + dx * scale,
              y: y + dy * scale,
            }),
          ).toBe(true);
    }
  },
);

it('SEA-05: winter hill is snowy without summer flowers, tunnel cover remains opaque', () => {
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
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
    123,
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
  Object.assign(scene, {
    add: {
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
  });
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

for (const [seed, k] of [
  [7, 62],
  [1, 246],
] as const)
  it(`street caps match TunnelView's actual baked flank, seed ${seed} / ${k}`, () => {
    const site = tunnelSite(seed, k);
    if (!site) throw Error('missing tunnel');
    const scene = new Phaser.Scene();
    const graphics = new Phaser.GameObjects.Graphics(scene);
    const polygons = vi.spyOn(graphics, 'fillPoints');
    new TunnelView(
      scene,
      undefined,
      site,
      {
        railY: (x) => -railYUpU(seed, k * 1024 + x),
        meadowY: () => 30,
      },
      (paint) => {
        paint(graphics);
        return new Phaser.GameObjects.Container(scene);
      },
      { flanks: 1, interior: 2, shade: 3, cover: 4 },
      [],
      seed,
    );
    const points = polygons.mock.calls[0]?.[0];
    if (!points) throw Error('no opaque flank baked');
    const actual = points.map((p) => ({ xU: k * 1024 + p.x, yU: p.y }));
    let covered = 0,
      rejected = 0;
    for (let x = site.fromX - 160; x < site.toX + 160; x += 17)
      for (let y = -310; y < 0; y += 13) {
        const cap = [
          { xU: k * 1024 + x - 3, yU: y - 10.6 },
          { xU: k * 1024 + x + 3, yU: y + 10.6 },
        ];
        const expected = Array.from({ length: 101 }, (_, i) => {
          const t = i / 100;
          return pointInside(
            { xU: k * 1024 + x - 3 + 6 * t, yU: y - 10.6 + 21.2 * t },
            actual,
          );
        }).every(Boolean);
        const result = streetHillCoversCap(
          seed,
          k,
          { purpose: 'tunnel-hill', ownerId: site.id },
          cap,
        );
        expect(result, `actual baked cap ${x}/${y}`).toBe(expected);
        if (result) covered++;
        else rejected++;
      }
    expect(covered).toBeGreaterThan(100);
    expect(rejected).toBeGreaterThan(100);
  });
