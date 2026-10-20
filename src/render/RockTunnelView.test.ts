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
    frame: { name: string; width: number; height: number };
    texture: { key: string };
    rotation = 0;
    scaleX = 1;
    scaleY = 1;
    alpha = 1;
    constructor(
      _scene: unknown,
      public x = 0,
      public y = 0,
      _texture = '',
      key = '',
    ) {
      this.frame = { name: key, width: 182, height: 242 };
      this.texture = { key: _texture };
    }
    originX = 0;
    originY = 0;
    setOrigin(x: number, y = x) {
      this.originX = x;
      this.originY = y;
      return this;
    }
    setScale() {
      return this;
    }
    data = new Map<string, unknown>();
    flipX = false;
    setRotation() {
      return this;
    }
    setFlipX(value: boolean) {
      this.flipX = value;
      return this;
    }
    setData(key: string, value: unknown) {
      this.data.set(key, value);
      return this;
    }
  }
  class Container {
    list: Phaser.GameObjects.GameObject[] = [];
    depth = 0;
    alpha = 1;
    add(child: Phaser.GameObjects.GameObject) {
      this.list.push(child);
      return this;
    }
    setDepth(value: number) {
      this.depth = value;
      return this;
    }
    setAlpha(value: number) {
      this.alpha = value;
      return this;
    }
    removeAll() {
      this.list.length = 0;
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
  artEnabled = true,
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
        rotate() {},
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
      image: (x: number, y: number, texture: string, key: string) =>
        new Phaser.GameObjects.Image(scene, x, y, texture, key),
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
    artEnabled ? { texture: 'world', pxPerU: 1 } : undefined,
    site,
    { railY, meadowY: (x) => railY(x) + 30 },
    (paint, box, compose) => {
      bounds.push(box);
      paint(graphics);
      compose?.(document.createElement('canvas'), memory, 'unit-rock');
      const flat = new Phaser.GameObjects.Container(scene);
      flat.add(
        new Phaser.GameObjects.Image(
          scene,
          box.left,
          box.top,
          'ground:unit-rock',
          '__BASE',
        ),
      );
      return flat;
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
  expect(crest.bounds[0]?.bottom).toBe(6);
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

it.each([false, true])(
  'D-033: rock portals split and mirror, winter=%s',
  (winter) => {
    const adds = vi.spyOn(Phaser.GameObjects.Container.prototype, 'add');
    const { view } = fragment(
      { id: 'portals', chunkIndex: 0, fromX: 128, toX: 800, rock: true },
      winter,
    );
    const suffix = winter ? '-snow' : '';
    for (const [part, depth] of [
      ['mouth', 1.01],
      ['front', 3],
    ] as const) {
      const calls = adds.mock.calls.flatMap(([im], i) => {
        if (
          !(im instanceof Phaser.GameObjects.Image) ||
          im.data?.get('world-part') !== `tunnel.rock-portal-${part}${suffix}`
        )
          return [];
        const container = adds.mock.contexts[i];
        if (!(container instanceof Phaser.GameObjects.Container))
          throw new Error('portal owner missing');
        return [{ im, container }];
      });
      expect(calls).toHaveLength(2);
      expect(calls.map(({ im }) => im.flipX)).toEqual([false, true]);
      if (part === 'mouth')
        expect(calls[1]?.im.data.get('world-pivot')).toEqual({ x: 0, y: 186 });
      for (const { container } of calls) expect(container?.depth).toBe(depth);
    }
    view.update({ minX: -500, maxX: -200 }, 0);
    expect(view.alpha).toBe(1);
    view.update({ minX: 0, maxX: 48 }, 1);
    expect(view.alpha).toBeCloseTo(0.5, 2);
    view.update({ minX: 200, maxX: 400 }, 2);
    expect(view.alpha).toBe(0.5);
    for (let tick = 1; tick <= 60; tick++)
      view.update({ minX: 1000, maxX: 1200 }, 2 + tick / 60);
    expect(view.alpha).toBe(1);
    expect(view.containers.find((c) => c.depth === 3)?.alpha).toBe(1);
  },
);

it('D-033: pixel band trims empty shoulders while retaining the complete portal at 12 percent grade', () => {
  for (const grade of [-0.12, 0, 0.12]) {
    const { bounds } = fragment(
      {
        id: 'bounded-portal',
        chunkIndex: 0,
        fromX: 128,
        toX: 3200,
        rock: true,
      },
      false,
      (x) => x * grade,
    );
    expect(bounds[0]?.left).toBe(8);
    const angle = Math.atan(grade);
    const cornerReach = 90 * Math.cos(angle) + 236 * Math.abs(Math.sin(angle));
    expect(cornerReach + 2).toBeLessThanOrEqual(120);
    expect(bounds[0]?.left ?? Infinity).toBeLessThan(128 - cornerReach);
  }
});

it('D-033: a real portal shoulder owns vectors without an empty or inverted pixel band', () => {
  const { bounds } = fragment({
    id: 'shoulder',
    chunkIndex: 0,
    fromX: 1152,
    toX: 4480,
    rock: true,
  });
  expect(bounds).toHaveLength(0);
});

it('D-033 review-2: neighboring translucent rock fragments own disjoint drawing bounds', () => {
  const first = fragment({
    id: 'seam',
    chunkIndex: 0,
    fromX: 128,
    toX: 3200,
    rock: true,
  });
  const second = fragment({
    id: 'seam',
    chunkIndex: 1,
    fromX: -896,
    toX: 2176,
    rock: true,
  });
  expect(first.bounds[0]?.right).toBe(1024);
  expect(second.bounds[0]?.left).toBe(0);
});

it.each([false, true])(
  'D-033 review-1: opaque backing shares the face texture below the interior, art=%s',
  (artEnabled) => {
    const { view } = fragment(
      {
        id: 'backing',
        chunkIndex: 0,
        fromX: 128,
        toX: 3200,
        rock: true,
      },
      false,
      () => 0,
      new TextureMemory(),
      false,
      artEnabled,
    );
    view.update({ minX: 200, maxX: 400 }, 0);
    const backing = view.containers.find((c) => c.depth === 0);
    expect(backing).toBeDefined();
    expect(backing?.alpha).toBe(1);
    const face = backing?.list.find(
      (o) => o instanceof Phaser.GameObjects.Image,
    );
    expect(face).toBeInstanceOf(Phaser.GameObjects.Image);
    if (!(face instanceof Phaser.GameObjects.Image))
      throw new Error('backing face missing');
    expect(face.texture.key).toBe('ground:unit-rock');
    expect(view.containers.find((c) => c.depth === 3)?.alpha).toBe(0.5);
  },
);

it('D-033 review-2: opaque vector crest pads chunk edges without extending the fading texture', () => {
  const f = fragment({
    id: 'opaque-seam',
    chunkIndex: 1,
    fromX: -896,
    toX: 2176,
    rock: true,
  });
  expect(f.bounds[0]?.left).toBe(0);
  expect(f.bounds[0]?.right).toBe(1024);
  const crest = f.polygons.filter((p) => p.some((v) => v.y < -300));
  expect(crest.flatMap((p) => p.map((v) => v.x))).toContain(-2);
  expect(crest.flatMap((p) => p.map((v) => v.x))).toContain(1026);
});
