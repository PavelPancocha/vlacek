import { roadVehicleArt } from '../content/roadVehicleArt.ts';
import { hash32 } from '../domain/world/Hash.ts';
import { pointInside, waterSectionU } from '../domain/world/SceneryGeometry.ts';
import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crossingParts } from '../content/worldArt.ts';
import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import type { ChunkScenery } from '../domain/world/Scenery.ts';
import { regionAt, transitionAt } from '../domain/world/Regions.ts';
import { contextAt } from '../domain/world/WorldPlan.ts';
import { sceneAt } from '../domain/world/WorldPlan.ts';
import { ChunkView } from './ChunkView.ts';
import { CrossingView } from './CrossingView.ts';
import { chunkScenery } from '../domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { generateTrackProfile } from '../domain/world/TrackProfile.ts';
import {
  buildArcLengthTable,
  heightAtX,
} from '../domain/world/ArcLengthTable.ts';
import { NEAR_POST_ROAD_U } from './crossingLayout.ts';
import { roadHalfWidthU } from './crossingLayout.ts';
import { roadPolygon } from '../domain/world/SceneryGeometry.ts';
import {
  NEAR_PALETTE,
  BACK_PALETTE,
  WATER_PALETTE,
  spatialNearPalette,
  spatialBackPalette,
} from './groundPalette.ts';

vi.mock('phaser', () => ({
  default: {
    Math: {
      Vector2: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
    },
  },
}));

type Point = { x: number; y: number };
afterEach(() => vi.unstubAllGlobals());

it('SCN-RD06: seed 1/x 16896 draws separated motorway carriageways around a green median', () => {
  const sc = chunkScenery(1, 16, worldPlacementCatalog),
    drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(1, 16), 16, 1024, 8);
  const view = new ChunkView(drawn.scene, table, 1, sc, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  const road = sc.roads.find((r) => r.id.includes(':highway')),
    p = road?.points.find((p) => p.xU === 16896);
  if (!p) throw new Error('highway sample missing');
  const motorway = drawn.polygons.filter((p) => p.color === 0x777a7b);
  expect(motorway).toHaveLength(2);
  for (const offset of [-16, 0, 16]) {
    const hit = motorway.some((v) =>
      pointInside(
        { xU: 512, yU: p.yU + offset },
        v.points.map((a) => ({ xU: a.x, yU: a.y })),
      ),
    );
    expect(hit, `carriageway/median at ${offset}`).toBe(offset !== 0);
  }
  view.destroy();
});

/** Record drawing output; Phaser's browser/texture boundary is the only fake. */
function drawingScene() {
  class Canvas {
    width = 0;
    height = 0;
  }
  vi.stubGlobal('HTMLCanvasElement', Canvas);
  vi.stubGlobal('document', { createElement: () => new Canvas() });
  const textures = new Map<string, HTMLCanvasElement>();
  const images: {
    key: string | undefined;
    x: number;
    y: number;
    flipX: boolean;
  }[] = [];
  const polygons: { color: number; points: Point[] }[] = [];
  const strokes: { color: number; alpha: number; points: Point[] }[] = [];
  const rectangles: {
    color: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  const tailFills: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: number;
  }[] = [];
  const bakes: { left: number; top: number; width: number; height: number }[] =
    [];
  const object = (x = 0, y = 0, key?: string) => {
    let strokeColor = 0,
      strokeAlpha = 1;
    let color = 0,
      translateX = 0,
      translateY = 0;
    const target = {
      x,
      y,
      key,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      flipX: false,
      depth: 0,
      alpha: 1,
      frame: { width: 128, height: 128 },
    };
    const proxy = new Proxy(target, {
      get(target, property) {
        if (property in target) {
          const value: unknown = Reflect.get(target, property);
          return value;
        }
        if (property === 'setScale')
          return (x: number, y = x) => {
            target.scaleX = x;
            target.scaleY = y;
            return proxy;
          };
        if (property === 'setRotation')
          return (value: number) => {
            target.rotation = value;
            return proxy;
          };
        if (property === 'setTexture')
          return (_texture: string, key: string) => {
            target.key = key;
            return proxy;
          };
        if (property === 'setPosition')
          return (x: number, y: number) => {
            target.x = x;
            target.y = y;
            return proxy;
          };
        if (property === 'setX')
          return (x: number) => {
            target.x = x;
            return proxy;
          };
        if (property === 'setScale')
          return (x: number, y = x) => {
            target.scaleX = x;
            target.scaleY = y;
            return proxy;
          };
        if (property === 'setRotation')
          return (r: number) => {
            target.rotation = r;
            return proxy;
          };
        if (property === 'setFlipX')
          return (flip: boolean) => {
            target.flipX = flip;
            return proxy;
          };
        if (property === 'setDepth')
          return (depth: number) => {
            target.depth = depth;
            return proxy;
          };
        if (property === 'setAlpha')
          return (alpha: number) => {
            target.alpha = alpha;
            return proxy;
          };
        if (property === 'translateCanvas')
          return (x: number, y: number) => {
            translateX = x;
            translateY = y;
            return proxy;
          };
        if (property === 'generateTexture')
          return (
            _canvas: HTMLCanvasElement,
            width: number,
            height: number,
          ) => {
            bakes.push({ left: -translateX, top: -translateY, width, height });
            return proxy;
          };
        if (property === 'fillStyle')
          return (value: number) => {
            color = value;
            return proxy;
          };
        if (property === 'lineStyle')
          return (_width: number, color: number, alpha = 1) => {
            strokeColor = color;
            strokeAlpha = alpha;
            return proxy;
          };
        if (property === 'strokePoints')
          return (points: Point[]) => {
            strokes.push({ color: strokeColor, alpha: strokeAlpha, points });
            return proxy;
          };
        if (property === 'lineBetween')
          return (x1: number, y1: number, x2: number, y2: number) => {
            strokes.push({
              color: strokeColor,
              alpha: strokeAlpha,
              points: [
                { x: x1, y: y1 },
                { x: x2, y: y2 },
              ],
            });
            return proxy;
          };
        if (property === 'fillPoints')
          return (points: Point[]) => {
            if (points.length < 3)
              throw new Error('Phaser fillPoints requires a nonempty polygon');
            polygons.push({ color, points });
            return proxy;
          };
        if (property === 'fillRect' || property === 'fillRoundedRect')
          return (x: number, y: number, w: number, h: number) => {
            rectangles.push({ color, x, y, w, h });
            return proxy;
          };
        return () => proxy;
      },
    });
    return proxy;
  };
  const scene = {
    game: { renderer: {} },
    add: {
      image: (x: number, y: number, _texture: string, key?: string) => {
        const image = object(x, y, key);
        images.push(image);
        return image;
      },
      container: () => object(),
      rectangle: (
        x: number,
        y: number,
        width: number,
        height: number,
        color: number,
      ) => {
        tailFills.push({ x, y, width, height, color });
        return object(x, y);
      },
      graphics: () => object(),
    },
    make: { graphics: () => object() },
    textures: {
      create: (key: string, canvas: HTMLCanvasElement) => {
        textures.set(key, canvas);
        return { add() {} };
      },
      get: (key: string) => ({ getSourceImage: () => textures.get(key) }),
      remove: (key: string) => textures.delete(key),
    },
  };
  // This test double implements only the scene drawing surface used by ChunkView.
  return {
    scene: scene as unknown as Phaser.Scene,
    images,
    polygons,
    strokes,
    rectangles,
    bakes,
    tailFills,
  };
}

it.each([-0.08, 0, 0.08])(
  'SCN-RD02/03: every crossing car front follows measured motion, wait/restart and origin shift, slope %f',
  (slope) => {
    const drawn = drawingScene(),
      view = new CrossingView(
        drawn.scene,
        { texture: 'world', pxPerU: 1 },
        256,
        { railY: -100, meadowY: -80, railSlope: slope },
        { back: 1, deck: 3, near: 6 },
      );
    const colours = [0, 1].map((colour) => {
      const id = Array.from({ length: 100 }, (_, i) => `car-${i}`).find(
        (id) => hash32('car-colour', id) % 2 === colour,
      );
      if (!id) throw new Error('car colour witness missing');
      return id;
    });
    for (const direction of [-1, 1] as const)
      for (const id of colours) {
        const stop = direction === 1 ? -40 : 56;
        const actor = (roadU: number, waiting = false) => ({
          id,
          kind: 'car' as const,
          direction,
          roadU,
          waiting,
        });
        view.update(
          { barrier: 0, warning: false, actors: [actor(stop - direction * 4)] },
          0,
          1,
          true,
        );
        const first = view.roadVehicles(3072)[0];
        view.update(
          { barrier: 1, warning: true, actors: [actor(stop)] },
          1,
          1,
          true,
        );
        const arrived = view.roadVehicles(3072)[0];
        if (!first || !arrived) throw new Error('car missing');
        expect(arrived.kind).toBe(
          `road.car-${hash32('car-colour', id) % 2 === 0 ? 'a' : 'b'}-${direction === 1 ? 'front' : 'back'}`,
        );
        expect(
          (arrived.worldXU - first.worldXU) * arrived.frontX +
            (arrived.worldYU - first.worldYU) * arrived.frontY,
        ).toBeGreaterThan(0);
        view.update(
          { barrier: 1, warning: true, actors: [actor(stop, true)] },
          2,
          1,
          true,
        );
        const waiting = view.roadVehicles(3072)[0];
        expect(waiting?.frontX).toBe(arrived.frontX);
        expect(waiting?.frontY).toBe(arrived.frontY);
        expect(waiting?.worldXU).toBe(arrived.worldXU);
        expect(waiting?.worldYU).toBe(arrived.worldYU);
        view.setX(-400);
        expect(view.roadVehicles(3072)[0]).toEqual(waiting);
        view.update(
          { barrier: 0, warning: false, actors: [actor(stop + direction * 4)] },
          3,
          1,
          true,
        );
        const restart = view.roadVehicles(3072)[0];
        if (!restart || !waiting) throw new Error('restart missing');
        expect(
          (restart.worldXU - waiting.worldXU) * restart.frontX +
            (restart.worldYU - waiting.worldYU) * restart.frontY,
        ).toBeGreaterThan(0);
      }
    view.destroy();
  },
);

it('SCN-RD04: seed 123/chunk 3 junction has asphalt mouths without crossing shoulders or edge lines', () => {
  const sc = chunkScenery(123, 3, worldPlacementCatalog),
    drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(123, 3), 3, 1024, 8);
  const view = new ChunkView(drawn.scene, table, 123, sc, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  const road = sc.roads.find((r) => r.id.includes(':parallel-road')),
    p = road?.points.find((p) => p.xU === 3328);
  if (!road || !p || !sc.crossing) throw new Error('junction witness missing');
  const r = p.yU + heightAtX(table, p.xU);
  for (const side of [-1, 1]) {
    const sample = { xU: 256, yU: p.yU + side * (p.halfWidthU + 0.8) };
    const last = drawn.polygons.findLast(
      (v) =>
        [0x8e8d88, 0x7d7b77, 0xb8a682, 0x6f8f52].includes(v.color) &&
        pointInside(
          sample,
          v.points.map((a) => ({ xU: a.x, yU: a.y })),
        ),
    );
    expect(
      last?.color,
      'local shoulder must not stripe the crossing asphalt',
    ).toBe(0x7d7b77);
  }
  for (const side of [-1, 1]) {
    const sample = { xU: 256 + side * (roadHalfWidthU(r) + 2), yU: p.yU };
    const lastRoadFill = drawn.polygons.findLast(
      (v) =>
        [0x8e8d88, 0x7d7b77, 0xb8a682].includes(v.color) &&
        pointInside(
          sample,
          v.points.map((a) => ({ xU: a.x, yU: a.y })),
        ),
    );
    expect(lastRoadFill?.color, `mouth side ${side}`).not.toBe(0xb8a682);
    expect(lastRoadFill).toBeDefined();
  }
  const mouth = roadPolygon(road, -1).map((p) => ({
    xU: p.xU - 3072,
    yU: p.yU,
  }));
  for (const stroke of drawn.strokes.filter((s) => s.color === 0xe9e6dc))
    for (let i = 1; i < stroke.points.length; i++) {
      const a = stroke.points[i - 1],
        b = stroke.points[i];
      if (!a || !b) throw new Error('edge segment missing');
      for (let j = 0; j <= 8; j++)
        expect(
          pointInside(
            {
              xU: a.x + ((b.x - a.x) * j) / 8,
              yU: a.y + ((b.y - a.y) * j) / 8,
            },
            mouth,
          ),
          'edge line across junction mouth',
        ).toBe(false);
    }
  expect(drawn.strokes.filter((s) => s.color === 0xffffff)).toHaveLength(2);
  view.destroy();
});

describe('ChunkView crossing geometry wiring', () => {
  for (const art of [true, false])
    for (const railSlope of [0, -0.08, 0.08]) {
      it(`puts the car and post feet on the painted road: art=${art}, slope=${railSlope}`, () => {
        const x = 192;
        const xs = Array.from({ length: 129 }, (_, i) => i * 8);
        const table: ArcLengthTable = {
          chunkIndex: 3,
          xs: xs.map((x) => 3072 + x),
          ys: xs.map((localX) => 100 - railSlope * (localX - x)),
          grades: xs.map(() => -railSlope),
          cumulativeArcU: xs.map((x) => x * Math.hypot(1, railSlope)),
          lengthU: 1024 * Math.hypot(1, railSlope),
        };
        const scenery: ChunkScenery = {
          region: regionAt(1, 3072),
          scene: sceneAt(1, 3072),
          roads: [],
          fences: [],
          reservations: [],
          features: [],
          chunkIndex: 3,
          biome: 'countryside',
          slot: 3,
          locality: 'meadow',
          near: [{ fromX: 0, toX: 1024, style: 'meadow' }],
          back: [{ fromX: 0, toX: 1024, style: 'meadow' }],
          water: [],
          props: [],
          crossing: { id: 'crossing', chunkIndex: 3, localXU: x },
          bridge: undefined,
          tunnel: undefined,
          animal: { kind: 'cow', depth: 0.5 },
        };
        const drawn = drawingScene();
        const view = new ChunkView(
          drawn.scene,
          table,
          1,
          scenery,
          art ? { texture: 'world', pxPerU: 1 } : undefined,
          {
            backGround: 0,
            backProps: 1,
            ground: 2,
            track: 3,
            train: 4,
            wires: 5,
            nearProps: 6,
          },
        );
        // Every point just inside the sloping back-band edges must remain painted after strip clipping.
        const base = drawn.polygons.filter((p) => p.color === 0x92cc66);
        for (const side of ['left', 'right'])
          for (const depth of [0.1, 0.25, 0.5, 0.75, 0.9]) {
            const edgeX = side === 'left' ? 0 : 1024;
            const lean =
              ((hash32('field-edge', 1, 3072 + edgeX) % 1000) / 1000 - 0.5) *
              80;
            const at =
              edgeX + lean * (2 * depth - 1) + (side === 'left' ? 2 : -2);
            const y = -100 + railSlope * (at - x) - depth * 220;
            expect(
              base.some((p) =>
                pointInside(
                  { xU: at, yU: y },
                  p.points.map((v) => ({ xU: v.x, yU: v.y })),
                ),
              ),
              `unpainted ${side} depth ${depth}`,
            ).toBe(true);
          }
        view.update(0, {
          barrier: 0,
          warning: false,
          actors: [
            { id: 'car', kind: 'car', direction: 1, roadU: 0, waiting: false },
          ],
        });
        const car = art
          ? drawn.images.find((image) => image.key?.startsWith('road.car'))
          : drawn.rectangles.findLast((rect) => rect.color === 0x5d7fa8);
        const post = art
          ? drawn.images.find((image) => image.key === crossingParts.postLow)
          : drawn.rectangles.findLast((rect) => rect.color === 0x4a4f57);
        if (!car || !post) throw new Error('car or post was not drawn');
        const carFoot = {
          x: car.x + ('w' in car ? car.w / 2 : 0),
          y: car.y + ('h' in car ? car.h : 0),
        };
        const postFoot = {
          x: post.x + ('w' in post ? post.w / 2 : 0),
          y: post.y + ('h' in post ? post.h : 0),
        };
        const asphalt = drawn.polygons.filter(
          (polygon) => polygon.color === 0x7d7b77,
        );
        const back = asphalt[0]?.points;
        const near = asphalt[1]?.points;
        if (!back || !near) throw new Error('road was not painted');
        // The back polygon ends at roadU 0: extrapolate its cross-road line to the car foot.
        const joinLeft = back[back.length / 2 - 1];
        const joinRight = back[back.length / 2];
        if (!joinLeft || !joinRight) throw new Error('road join missing');
        const atX = (a: Point, b: Point, x: number) =>
          a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
        expect(carFoot.y).toBeCloseTo(atX(joinLeft, joinRight, carFoot.x), 8);
        // Near rows 48 and 56 bracket the post at roadU 52; both sides are linear here.
        const left = near.slice(0, near.length / 2);
        const right = near.slice(near.length / 2).reverse();
        const a = left[6],
          b = left[7],
          c = right[6],
          d = right[7];
        if (!a || !b || !c || !d) throw new Error('road rows missing');
        const t = (NEAR_POST_ROAD_U - 48) / 8;
        const interpolate = (a: Point, b: Point) => ({
          x: a.x + t * (b.x - a.x),
          y: a.y + t * (b.y - a.y),
        });
        expect(postFoot.y).toBeCloseTo(
          atX(interpolate(a, b), interpolate(c, d), postFoot.x),
          8,
        );
        view.destroy();
      });
    }
});

it.each([4, 5, 60, 61])(
  'SCN-G06/GEN-23: the full foreground surface is baked, never cropped at chunk %i',
  (k) => {
    const sc = chunkScenery(1, k, worldPlacementCatalog);
    const surfaces = sc.reservations.filter(
      (r) => r.purpose === 'field' || r.purpose === 'forest-floor',
    );
    expect(surfaces.length).toBeGreaterThan(0);
    const drawn = drawingScene();
    const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
    const view = new ChunkView(drawn.scene, table, 1, sc, undefined, {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    });
    const ground = drawn.bakes[1];
    if (!ground) throw new Error('ground was not baked');
    const bottom = ground.top + ground.height;
    for (const surface of surfaces)
      for (const p of surface.polygon)
        expect(p.yU, `${k}/${surface.id}`).toBeLessThanOrEqual(bottom);
    const groundColors = new Set(
      sc.near.map((span) => NEAR_PALETTE[span.style].bands.at(-1)?.color),
    );
    expect(
      drawn.tailFills.filter((r) => groundColors.has(r.color)).length,
    ).toBeLessThanOrEqual(sc.near.length);
    view.destroy();
  },
);

it.each([48, 51, 52, 55, 56])(
  'GEN-23: renderer paints full-height spatial ground at transition chunk %i',
  (k) => {
    const seed = 1,
      sc = {
        ...chunkScenery(seed, k, worldPlacementCatalog),
        reservations: [],
        props: [],
        water: [],
        roads: [],
        crossing: undefined,
        bridge: undefined,
      },
      drawn = drawingScene();
    const table = buildArcLengthTable(
      generateTrackProfile(seed, k),
      k,
      1024,
      8,
    );
    const view = new ChunkView(drawn.scene, table, seed, sc, undefined, {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    });
    const span = sc.near[0],
      back = sc.back[0];
    if (!span || !back) throw new Error('ground missing');
    for (const x of [136, 504, 888]) {
      const expected = spatialNearPalette(
        seed,
        k * 1024 + x,
        span.style,
      ).bands.at(-1)?.color;
      const deep = drawn.tailFills.findLast(
        (r) => r.x <= x && x < r.x + r.width && r.height > 1000,
      );
      expect(deep?.color, `deep fill ${k}/${x}`).toBe(expected);
      const middle = drawn.polygons.findLast((p) =>
        pointInside(
          {
            xU: x,
            yU: (drawn.bakes[1]?.top ?? 0) + (drawn.bakes[1]?.height ?? 0) - 4,
          },
          p.points.map((v) => ({ xU: v.x, yU: v.y })),
        ),
      );
      expect(middle?.color, `baked fill ${k}/${x}`).toBe(expected);
      const background = drawn.polygons.findLast((p) =>
        pointInside(
          { xU: x, yU: -(table.ys[Math.round(x / 8)] ?? 0) - 210 },
          p.points.map((v) => ({ xU: v.x, yU: v.y })),
        ),
      );
      expect(background, `back ${k}/${x}`).toBeDefined();
      const atBack = sc.back.find((s) => s.fromX <= x && x < s.toX);
      if (!atBack) throw new Error('background span missing');
      const color = spatialBackPalette(seed, k * 1024 + x, atBack.style).base;
      for (const shift of [0, 8, 16])
        expect(
          Math.abs(
            (((background?.color ?? 0) >> shift) & 255) -
              ((color >> shift) & 255),
          ),
        ).toBeLessThanOrEqual(1);
    }
    view.destroy();
  },
);
it.each([4, 5, 60, 61])(
  'SCN-G06: fallback field strips stay on their shared support; forest endpoints taper at chunk %i',
  (k) => {
    const sc = chunkScenery(1, k, worldPlacementCatalog),
      drawn = drawingScene();
    const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
    const view = new ChunkView(drawn.scene, table, 1, sc, undefined, {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    });
    const polygon = drawn.polygons.find(
      (p) => p.color === (k < 10 ? 0xb6a563 : 0x6c8043),
    );
    if (!polygon) throw new Error('foreground was not painted');
    const a =
      k % 2 === 0
        ? polygon.points[0]
        : polygon.points[polygon.points.length / 2 - 1];
    const b =
      k % 2 === 0
        ? polygon.points.at(-1)
        : polygon.points[polygon.points.length / 2];
    if (k < 10) {
      const support = sc.reservations.find((r) => r.purpose === 'field');
      if (!support) throw new Error('missing field support');
      expect(
        polygon.points.every((p) =>
          // Ray casting excludes a right seam; either inward epsilon includes its boundary.
          [-1e-6, 1e-6].some((dx) =>
            pointInside({ xU: k * 1024 + p.x + dx, yU: p.y }, support.polygon),
          ),
        ),
      ).toBe(true);
      expect(a).not.toEqual(b);
    } else expect(a).toEqual(b);
    if (k >= 60) {
      const edge = drawn.polygons.find((p) => p.color === 0x4b7436);
      if (!edge) throw new Error('forest silhouette missing');
      const first =
        k % 2 === 0 ? edge.points[0] : edge.points[edge.points.length / 2 - 1];
      const last =
        k % 2 === 0 ? edge.points.at(-1) : edge.points[edge.points.length / 2];
      expect(first).toEqual(last);
    }
    if (k >= 60)
      expect(drawn.polygons.some((p) => p.color === 0x4b7436)).toBe(true);
    view.destroy();
  },
);

it('GEN-23: renderer retains authored field rows while their transition begins', () => {
  const sc = chunkScenery(15, 16, worldPlacementCatalog),
    drawn = drawingScene();
  // The scene planner may choose the integrated farm here; this regression owns
  // authored wheat rows at the transition, independently of motif scheduling.
  sc.back = [{ style: 'wheat', fromX: 0, toX: 1024 }];
  const table = buildArcLengthTable(generateTrackProfile(15, 16), 16, 1024, 8);
  const view = new ChunkView(drawn.scene, table, 15, sc, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  const rowColor = spatialBackPalette(15, 16384 + 512, 'wheat').rows;
  expect(rowColor).toBeDefined();
  expect(
    drawn.strokes.some(
      (s) =>
        s.alpha > 0 &&
        s.alpha < 1 &&
        [0, 8, 16].every(
          (shift) =>
            Math.abs(
              ((s.color >> shift) & 255) - (((rowColor ?? 0) >> shift) & 255),
            ) <= 1,
        ),
    ),
  ).toBe(true);
  view.destroy();
});

it.each(['wheat', 'crops', 'glade'] as const)(
  'GEN-23 review2 authored %s is rendered on both sides of x 49152',
  (style) => {
    for (const k of [47, 48]) {
      const sc = chunkScenery(1, k, worldPlacementCatalog);
      sc.back = [{ style, fromX: 0, toX: 1024 }];
      const drawn = drawingScene();
      const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
      const view = new ChunkView(drawn.scene, table, 1, sc, undefined, {
        backGround: 0,
        backProps: 1,
        ground: 2,
        track: 3,
        train: 4,
        wires: 5,
        nearProps: 6,
      });
      const x = k === 47 ? 1016 : 8;
      const worldX = k * 1024 + x;
      const expected = spatialBackPalette(1, worldX, style);
      const fill = drawn.polygons.findLast((p) =>
        pointInside(
          { xU: x, yU: -(table.ys[Math.round(x / 8)] ?? 0) - 110 },
          p.points.map((v) => ({ xU: v.x, yU: v.y })),
        ),
      );
      expect(fill).toBeDefined();
      // Independent authored-colour assertion on the rendered fill itself.
      for (const shift of [0, 8, 16])
        expect(
          Math.abs(
            (((fill?.color ?? 0) >> shift) & 255) -
              ((BACK_PALETTE[style].base >> shift) & 255),
          ),
        ).toBeLessThanOrEqual(1);
      expect(fill?.color).toBe(expected.base);
      const rows = BACK_PALETTE[style].rows;
      if (rows !== undefined)
        expect(
          drawn.strokes.some(
            (s) =>
              s.alpha > 0.98 &&
              s.points.some((p) => Math.abs(p.x - x) <= 8) &&
              [0, 8, 16].every(
                (shift) =>
                  Math.abs(
                    ((s.color >> shift) & 255) - ((rows >> shift) & 255),
                  ) <= 1,
              ),
          ),
        ).toBe(true);
      else expect(expected.rows).toBeUndefined();
      view.destroy();
    }
  },
);

it.each(['summer', 'autumn', 'spring'] as const)(
  'GEN-23 / SEA-02: authored %s surface survives an already incoming winter climate',
  (season) => {
    let found: { seed: number; x: number } | undefined;
    for (let seed = 0; seed < 20 && !found; seed++) {
      let r = regionAt(seed, 0);
      for (let i = 0; i < 40; i++, r = regionAt(seed, r.toXU))
        if (r.season === season && regionAt(seed, r.toXU).season === 'winter') {
          found = { seed, x: r.toXU - 3072 + 8 };
          break;
        }
    }
    if (!found) throw new Error('winter transition witness missing');
    const { seed, x } = found;
    expect(contextAt(seed, x, 'back').season).toBe('winter');
    const t = transitionAt(seed, x);
    // D-027 now colours the authored surface before the transition. The old
    // summer-only RGB expectation accidentally used an autumn witness (seed 0).
    // Keep its exact summer case and separately require both seasonal endpoints.
    const tint = season === 'autumn' ? 0xb39355 : 0xafd776;
    const strength = season === 'autumn' ? 0.6 : season === 'spring' ? 0.12 : 0;
    for (const style of ['wheat', 'crops', 'glade'] as const) {
      const palette = spatialBackPalette(seed, x, style);
      for (const shift of [0, 8, 16]) {
        const original = (BACK_PALETTE[style].base >> shift) & 255;
        const a = Math.round(
          original + (((tint >> shift) & 255) - original) * strength,
        );
        const b = (BACK_PALETTE.snow.base >> shift) & 255;
        expect((palette.base >> shift) & 255).toBe(
          Math.round(a + (b - a) * t.progress),
        );
      }
      expect(palette.rows !== undefined).toBe(
        BACK_PALETTE[style].rows !== undefined,
      );
    }
  },
);

it.each([4, 5, 60, 61])(
  'SCN-G06 review2 rounded headland and grass margin at chunk %i',
  (k) => {
    const sc = chunkScenery(1, k, worldPlacementCatalog),
      drawn = drawingScene();
    const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
    const view = new ChunkView(drawn.scene, table, 1, sc, undefined, {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    });
    const soil = k < 10 ? 0xb6a563 : 0x6c8043;
    const polygon = drawn.polygons.find((p) => p.color === soil);
    if (!polygon) throw new Error('surface not drawn');
    const upper = polygon.points.slice(0, polygon.points.length / 2);
    const lower = polygon.points.slice(polygon.points.length / 2).reverse();
    const i = k % 2 === 0 ? 1 : upper.length - 2;
    const a = upper[i],
      b = lower[i];
    if (!a || !b) throw new Error('cap sample missing');
    // First 8 u opens with a rounded, near-vertical tangent, not an acute wedge.
    expect(b.y - a.y).toBeGreaterThan(40);
    const margin = drawn.strokes.filter(
      (s) => s.color === 0x75954f && s.alpha === 0.45,
    );
    expect(margin).toHaveLength(2);
    const feature = sc.features.find(
      (f) => f.kind === (k < 10 ? 'field' : 'forest-floor'),
    );
    if (!feature) throw new Error('feature missing');
    const lines = drawn.strokes.filter(
      (s) => s.color === (k < 10 ? 0x928248 : 0x527239),
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines)
      for (const p of line.points) {
        expect(p.x + k * 1024).toBeGreaterThanOrEqual(feature.fromXU + 160);
        expect(p.x + k * 1024).toBeLessThanOrEqual(feature.toXU - 160);
      }
    view.destroy();
  },
);

it('SCN-CO02/GEN-23: the connected incoming sea keeps its own water palette before the coast border', () => {
  let coast = regionAt(1, 0);
  for (let i = 0; i < 12 && coast.landscape !== 'coast'; i++)
    coast = regionAt(1, coast.toXU);
  expect(coast.landscape).toBe('coast');
  const k = coast.fromXU / 1024 - 1,
    sc = chunkScenery(1, k, worldPlacementCatalog),
    drawn = drawingScene();
  expect(sc.water.some((w) => w.kind === 'sea')).toBe(true);
  expect(sc.near.some((s) => s.style === 'sand')).toBe(false);
  const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
  const view = new ChunkView(drawn.scene, table, 1, sc, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  expect(drawn.polygons.some((p) => p.color === WATER_PALETTE.sea.near)).toBe(
    true,
  );
  view.destroy();
});

it('SCN-CO02/GEN-23: later background fragments never erase the continuous sea at 0/331→332', () => {
  const polygons: { color: number; points: { xU: number; yU: number }[] }[] =
    [];
  for (const k of [331, 332]) {
    const sc = {
        ...chunkScenery(0, k, worldPlacementCatalog),
        props: [],
        roads: [],
        crossing: undefined,
        bridge: undefined,
      },
      drawn = drawingScene();
    const table = buildArcLengthTable(generateTrackProfile(0, k), k, 1024, 8);
    const view = new ChunkView(drawn.scene, table, 0, sc, undefined, {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    });
    polygons.push(
      ...drawn.polygons.map((p) => ({
        color: p.color,
        points: p.points.map((v) => ({ xU: k * 1024 + v.x, yU: v.y })),
      })),
    );
    view.destroy();
  }
  const sea = chunkScenery(0, 332, worldPlacementCatalog).water.find(
    (w) => w.kind === 'sea',
  );
  if (!sea) throw new Error('sea witness missing');
  const section = waterSectionU(0, 332, sea, -8),
    point = { xU: 332 * 1024 - 8, yU: (section.topU + section.bottomU) / 2 };
  expect(polygons.findLast((p) => pointInside(point, p.points))?.color).toBe(
    WATER_PALETTE.sea.middle,
  );
});

it('SEA-06 regression: seed 1 mill water with fractional edges renders without rejecting its cosmetic seed', () => {
  for (let k = 286; k <= 290; k++) {
    const sc = chunkScenery(1, k, worldPlacementCatalog);
    const table = buildArcLengthTable(generateTrackProfile(1, k), k, 1024, 8);
    const draw = drawingScene();
    expect(
      () =>
        new ChunkView(draw.scene, table, 1, sc, undefined, {
          backGround: 3,
          backProps: 4,
          ground: 5,
          track: 6,
          train: 7,
          wires: 7.5,
          nearProps: 8,
        }),
    ).not.toThrow();
  }
});

it('SEA-07 integration: farm animation consumes budget and holds its pose when denied', () => {
  const sc = chunkScenery(1, 0, worldPlacementCatalog);
  sc.props = [
    {
      id: 'farmer',
      kind: 'back.farmer-work',
      work: 'farmer',
      xU: 100,
      layer: 'back',
      depth: 0.5,
      scale: 1,
      flip: false,
      phase: 0,
    },
  ];
  const drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(1, 0), 0, 1024, 8);
  const view = new ChunkView(
    drawn.scene,
    table,
    1,
    sc,
    { texture: 'world', pxPerU: 1 },
    {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    },
  );
  expect(view.update(23, undefined, 1, 0, 1)).toBe(1);
  expect(drawn.images.some((image) => image.key === 'back.farmer-wave')).toBe(
    true,
  );
  expect(view.update(24, undefined, 1, 0, 0)).toBe(0);
  expect(drawn.images.some((image) => image.key === 'back.farmer-wave')).toBe(
    true,
  );
  expect(view.update(24.1, undefined, 1, 0, 1)).toBe(1);
  expect(drawn.images.some((image) => image.key === 'back.farmer-wave')).toBe(
    true,
  );
  view.destroy();
});

it('SEA-01 integration: the settlement green is snow-covered in the winter village', () => {
  const sc = chunkScenery(2, 490, worldPlacementCatalog);
  const area = sc.reservations.find((r) => r.purpose === 'village-green');
  expect(area).toBeDefined();
  const drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(2, 490), 490, 1024, 8);
  const view = new ChunkView(drawn.scene, table, 2, sc, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  const polygon = drawn.polygons.find(
    (p) =>
      p.points.length === area?.polygon.length &&
      p.points.every(
        (point, i) =>
          point.x === (area?.polygon[i]?.xU ?? 0) - 490 * 1024 &&
          point.y === area?.polygon[i]?.yU,
      ),
  );
  expect(polygon?.color).toBe(BACK_PALETTE.snow.base);
  view.destroy();
});

it('SEA-01 integration: the attached station canopy roof receives its authored snow plane', () => {
  const sc = chunkScenery(2, 490, worldPlacementCatalog);
  sc.props = [
    {
      id: 'canopy',
      kind: 'back.platform-canopy',
      xU: 100,
      layer: 'back',
      depth: 0.5,
      scale: 1,
      flip: false,
      phase: 0,
    },
  ];
  const drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(2, 490), 490, 1024, 8);
  const view = new ChunkView(
    drawn.scene,
    table,
    2,
    sc,
    { texture: 'world', pxPerU: 1 },
    {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    },
  );
  expect(
    drawn.images.some((image) => image.key === 'back.platform-canopy-roof'),
  ).toBe(true);
  expect(drawn.polygons.some((polygon) => polygon.color === 0xf4f9fc)).toBe(
    true,
  );
  view.destroy();
});

it('SCN-RD05: road ends recede behind the actual terrain horizon, never a texture rectangle', () => {
  const seed = 123,
    k = 2,
    sc = chunkScenery(seed, k, worldPlacementCatalog),
    drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(seed, k), k, 1024, 8);
  const view = new ChunkView(drawn.scene, table, seed, sc, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  const roads = drawn.polygons.filter((p) => p.color === 0x8e8d88);
  expect(roads.length).toBeGreaterThan(0);
  for (const road of roads)
    for (const p of road.points)
      expect(
        p.y + heightAtX(table, k * 1024 + p.x) + 220,
      ).toBeGreaterThanOrEqual(-0.01);
  view.destroy();
});

it('SEA-01 / roads-6: a metadata-free sled faces its measured displacement on both patrol legs', () => {
  const seed = 1,
    k = 102;
  const scenery = chunkScenery(seed, k, worldPlacementCatalog);
  const sled = scenery.props.find(
    (p) => p.id === 'g2:chunk:102:prop:rule:0:candidate:0',
  );
  if (!sled) throw new Error('sled witness missing');
  expect(sled.kind).toBe('back.sled-child');
  expect(roadVehicleArt[sled.kind]).toBeUndefined();
  expect(sled.motion).toEqual({ rangeU: 48, speedUPerSec: 6 });
  scenery.props = [sled];
  const drawn = drawingScene();
  const table = buildArcLengthTable(generateTrackProfile(seed, k), k, 1024, 8);
  const view = new ChunkView(
    drawn.scene,
    table,
    seed,
    scenery,
    { texture: 'world', pxPerU: 1 },
    {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    },
  );
  const image = drawn.images.find((p) => p.key === sled.kind);
  if (!image) throw new Error('sled image missing');
  view.update(0);
  let previousX = image.x,
    previousDirection = 0,
    previousFlip = image.flipX,
    moving = 0;
  const directions = new Set<number>();
  for (let tick = 1; tick <= 200; tick++) {
    view.update(tick / 20);
    const dx = image.x - previousX;
    const direction = Math.sign(dx);
    // A chord straddling a reversal does not establish the new leg's direction.
    if (
      direction !== 0 &&
      direction === previousDirection &&
      image.flipX === previousFlip
    ) {
      expect(
        dx * (image.flipX ? -1 : 1),
        `sled front versus displacement at ${tick / 20}s`,
      ).toBeGreaterThan(0);
      directions.add(direction);
      moving++;
    }
    previousX = image.x;
    previousDirection = direction;
    previousFlip = image.flipX;
  }
  expect([...directions].sort()).toEqual([-1, 1]);
  expect(moving).toBeGreaterThan(190);
  view.destroy();
});
