import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { crossingParts } from '../content/worldArt.ts';
import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import type { ChunkScenery } from '../domain/world/Scenery.ts';
import { ChunkView } from './ChunkView.ts';
import { NEAR_POST_ROAD_U } from './crossingLayout.ts';

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

/** Record drawing output; Phaser's browser/texture boundary is the only fake. */
function drawingScene() {
  const images: { key: string | undefined; x: number; y: number }[] = [];
  const polygons: { color: number; points: Point[] }[] = [];
  const rectangles: {
    color: number;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  const object = (x = 0, y = 0, key?: string) => {
    let color = 0;
    const target = { x, y, key, frame: { width: 128, height: 128 } };
    const proxy = new Proxy(target, {
      get(target, property) {
        if (property in target) {
          const value: unknown = Reflect.get(target, property);
          return value;
        }
        if (property === 'setPosition')
          return (x: number, y: number) => {
            target.x = x;
            target.y = y;
            return proxy;
          };
        if (property === 'fillStyle')
          return (value: number) => {
            color = value;
            return proxy;
          };
        if (property === 'fillPoints')
          return (points: Point[]) => {
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
    add: {
      image: (x: number, y: number, _texture: string, key?: string) => {
        const image = object(x, y, key);
        images.push(image);
        return image;
      },
      container: () => object(),
      rectangle: () => object(),
      graphics: () => object(),
    },
    make: { graphics: () => object() },
    textures: { remove: () => undefined },
  };
  // This test double implements only the scene drawing surface used by ChunkView.
  return {
    scene: scene as unknown as Phaser.Scene,
    images,
    polygons,
    rectangles,
  };
}

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
          chunkIndex: 3,
          biome: 'countryside',
          slot: 3,
          locality: 'meadow',
          near: [{ fromX: 0, toX: 1024, style: 'meadow' }],
          back: [],
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
