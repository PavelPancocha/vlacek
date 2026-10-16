import Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import { infrastructureReservations } from '../domain/world/Reservations.ts';
import { railYUpU, pointInside } from '../domain/world/SceneryGeometry.ts';
import { tunnelSite, type TunnelSite } from '../domain/world/Structures.ts';
import { RockTunnelView } from './RockTunnelView.ts';
import * as framePixels from './atlasFramePixels.ts';
import * as framePages from './frameTexture.ts';
import { TextureMemory } from './TextureMemory.ts';

// Replace drawing APIs only: the real art composition and cover predicates run.
vi.mock('phaser', () => {
  class Image {
    frame = { width: 182, height: 242 };
    setOrigin() {
      return this;
    }
    setScale() {
      return this;
    }
    setRotation() {
      return this;
    }
    setData() {
      return this;
    }
  }
  class Container {
    list = [new Image()];
    add() {
      return this;
    }
    setDepth() {
      return this;
    }
    setName() {
      return this;
    }
  }
  class Graphics {
    fillStyle() {
      return this;
    }
    fillPoints() {
      return this;
    }
    fillRect() {
      return this;
    }
    lineStyle() {
      return this;
    }
    lineBetween() {
      return this;
    }
  }
  return {
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
      GameObjects: { Container, Image, Graphics },
    },
  };
});

function fragment(
  site: TunnelSite,
  winter = false,
  railY: (x: number) => number = () => 0,
  memory = new TextureMemory(),
  failPaint = false,
) {
  class Canvas {
    width = 1;
    height = 1;
    getContext() {
      return {
        save() {},
        restore() {},
        scale() {},
        translate() {},
        drawImage() {
          if (failPaint) throw new Error('material draw failure');
        },
      };
    }
  }
  vi.stubGlobal('HTMLCanvasElement', Canvas);
  vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('document', { createElement: () => new Canvas() });
  const scene = new Phaser.Scene();
  Object.assign(scene, {
    add: {
      image: () => new Phaser.GameObjects.Image(scene, 0, 0, ''),
      graphics: () => graphics,
      container: () => new Phaser.GameObjects.Container(scene),
    },
    textures: {
      getFrame: (_texture: string, key: string) => ({
        name: key,
        cutX: 0,
        cutY: 0,
        cutWidth: 258,
        cutHeight: 292,
        source: { image: new Canvas() },
      }),
      get: () => ({
        get: () => ({ cutX: 0, cutY: 0, source: { image: new Canvas() } }),
      }),
    },
  });
  const graphics = new Phaser.GameObjects.Graphics(scene);
  const polygons = vi.spyOn(graphics, 'fillPoints');
  const colors = vi.spyOn(graphics, 'fillStyle');
  const bounds: { left: number; right: number; top: number; bottom: number }[] =
    [];
  const view = new RockTunnelView(
    scene,
    { texture: 'world', pxPerU: 1 },
    site,
    { railY, meadowY: (x) => railY(x) + 30 },
    (paint, box, compose) => {
      bounds.push(box);
      paint(graphics);
      compose?.(document.createElement('canvas'), memory, 'unit-rock');
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    [],
    winter,
  );
  return {
    view,
    polygons: polygons.mock.calls.map(([p]) => p),
    colors: colors.mock.calls.map(([c]) => c),
    bounds,
    memory,
  };
}

it.each([false, true])(
  'D-030: releases every material readback and scratch on draw failure=%s',
  (failPaint) => {
    const memory = new TextureMemory();
    const page = vi
      .spyOn(framePages, 'frameTexture')
      .mockImplementation((key) => `resident:${key}`);
    const release = vi.fn((owner: string) => memory.remove(owner));
    const readback = vi
      .spyOn(framePixels, 'atlasFramePixels')
      .mockImplementation((_scene, _texture, _key, ledger, owner) => {
        ledger.set(owner, { canvas: 16, imageData: 16 });
        ledger.set(owner, { canvas: 16 });
        return {
          image: document.createElement('canvas'),
          x: 0,
          y: 0,
          width: 2,
          height: 2,
          release: () => release(owner),
        };
      });
    try {
      const build = () =>
        fragment(
          { id: 'readback', chunkIndex: 0, fromX: 128, toX: 3200, rock: true },
          false,
          () => 0,
          memory,
          failPaint,
        );
      if (failPaint) expect(build).toThrow('material draw failure');
      else build();
      expect(readback.mock.calls.length).toBeGreaterThan(0);
      for (const [, texture, key] of readback.mock.calls)
        expect(texture).toBe(`resident:${key}`);
      expect(release).toHaveBeenCalledTimes(readback.mock.calls.length);
      expect(memory.snapshot.highWaterBytes).toBe(32);
      expect(memory.snapshot.allocations).toEqual([]);
    } finally {
      readback.mockRestore();
      page.mockRestore();
    }
  },
);

it.each([
  { mouth: 'entrance', chunkIndex: 0, fromX: 200, toX: 3272, x: 40 },
  { mouth: 'exit', chunkIndex: 3, fromX: -2872, toX: 200, x: 360 },
])(
  'TB-2: art leaves outdoor particles visible beyond the $mouth mouth',
  ({ chunkIndex, fromX, toX, x }) => {
    const { view } = fragment({
      id: 'mountain',
      chunkIndex,
      fromX,
      toX,
      rock: true,
    });
    expect(view.coversPoint({ x: chunkIndex * 1024 + x, y: -80 })).toBe(false);
  },
);

it('TB-2: mountain rises to a crest, falls on the rear slope, shares chunk samples and hosts seasonal ground', () => {
  const topAt = (k: number, x: number, winter = false) => {
    const f = fragment(
      {
        id: 'mountain',
        chunkIndex: k,
        fromX: 128 - k * 1024,
        toX: 3200 - k * 1024,
        rock: true,
      },
      winter,
    );
    const heights = f.polygons.flatMap((p) =>
      p.filter((v) => v.x === x - k * 1024).map((v) => v.y),
    );
    return { ...f, top: Math.min(...heights) };
  };
  const approach = topAt(0, 128),
    crest = topAt(1, 1664),
    rear = topAt(3, 3200);
  expect(crest.top).toBeLessThan(approach.top - 130);
  expect(crest.top).toBeLessThan(rear.top - 130);
  expect(topAt(0, 1024).top).toBe(topAt(1, 1024).top);
  expect(crest.colors).toContain(0x6eae43);
  expect(topAt(1, 1664, true).colors).toContain(0xf1f6fa);
  expect(crest.bounds[0]?.top).toBe(-292);
  expect(crest.bounds[0]?.bottom).toBe(2);
  expect(crest.bounds).toHaveLength(1);
  expect(crest.view.coversPoint({ x: 1664, y: crest.top + 2 })).toBe(true);
  const site = {
    id: 'mountain',
    chunkIndex: 1,
    fromX: 128 - 1024,
    toX: 3200 - 1024,
    rock: true,
  };
  const reservation = infrastructureReservations(
    1,
    1,
    undefined,
    undefined,
    site,
  ).find((r) => r.ownerId === site.id);
  if (!reservation) throw new Error('hill reservation');
  // Render uses a flat rail here; compare reservation height relative to its rail.
  expect(
    Math.min(...reservation.polygon.map((p) => p.yU + railYUpU(1, p.xU))),
  ).toBeLessThan(-400);
  expect(
    pointInside(
      { xU: 1664, yU: -railYUpU(1, 1664) - 350 },
      reservation.polygon,
    ),
  ).toBe(true);
});

it('TB-2: the real descending mountain grade still rises above both portal crowns', () => {
  const entrance = tunnelSite(1, 149);
  if (!entrance) throw new Error('seed 1 long tunnel');
  const from = 149 * 1024 + entrance.fromX,
    to = 149 * 1024 + entrance.toX;
  const crestX = (from + to) / 2,
    k = Math.floor(crestX / 1024),
    site = tunnelSite(1, k);
  if (!site) throw new Error('interior fragment');
  const f = fragment(site, true, (x) => -railYUpU(1, k * 1024 + x));
  const crest = Math.min(
    ...f.polygons.flatMap((p) =>
      p.filter((v) => v.x === crestX - k * 1024).map((v) => v.y),
    ),
  );
  const highestPortal = Math.min(-railYUpU(1, from), -railYUpU(1, to)) - 264;
  expect(crest).toBeLessThan(highestPortal - 80);
});
