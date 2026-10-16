import Phaser from 'phaser';
import { locomotives } from '../content/vehicles.ts';
import EventEmitter from 'eventemitter3';
import { describe, expect, it, vi } from 'vitest';
import { RideScene, drawnBounds, type RideSceneHost } from './RideScene.ts';
import { rebindWorldImage } from './worldImage.ts';

const readyTextures = vi.hoisted(() => new Set<string>());

vi.mock('phaser', () => {
  const graphics = {
    setDepth: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    lineBetween: vi.fn().mockReturnThis(),
    fillPoints: vi.fn().mockReturnThis(),
    generateTexture: vi.fn(),
    destroy: vi.fn(),
  };
  return {
    default: {
      Scene: class {
        game = { events: new EventEmitter(), renderer: new EventEmitter() };
        events = new EventEmitter();
        cameras = { main: { setBackgroundColor: vi.fn() } };
        add = { graphics: () => graphics };
        make = { graphics: () => graphics };
      },
      Math: { Vector2: class {} },
      Geom: {
        Rectangle: class {
          constructor(
            public x: number,
            public y: number,
            public width: number,
            public height: number,
          ) {}
          get bottom() {
            return this.y + this.height;
          }
        },
      },
      Core: { Events: { POST_RENDER: 'postrender' } },
      Renderer: { Events: { POST_RENDER: 'postrender' } },
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    },
  };
});
vi.mock('./ArtAtlas.ts', () => ({
  ArtAtlas: class {
    constructor(
      _scene: unknown,
      _sources: unknown,
      readonly options: { texturePrefix: string },
    ) {}
    get textureKey() {
      return readyTextures.has(this.options.texturePrefix)
        ? this.options.texturePrefix
        : undefined;
    }
    get info(): never {
      throw new Error('readiness must not collect diagnostics');
    }
    destroy() {}
  },
}));
vi.mock('./Backdrop.ts', () => ({
  Backdrop: class {
    destroy() {}
  },
}));

function setup(catalog: ReturnType<RideSceneHost['catalogVehicles']> = []) {
  readyTextures.clear();
  const worldDrawn = vi.fn();
  const host: RideSceneHost = {
    frame: () => 0,
    ride: () => undefined,
    worldHidden: () => false,
    worldDrawn,
    journeyVehicles: () => [],
    journeyNpcFleet: () => undefined,
    catalogVehicles: () => catalog,
    effectsQuality: () => 'standard',
    artQuality: () => 'standard',
  };
  const scene = new RideScene(host);
  scene.preload();
  scene.create();
  // Phaser Game.step emits Core.POST_RENDER even when the WebGL renderer
  // suppresses its own POST_RENDER during context loss.
  const frame = (contextLost: boolean) => {
    scene.rideFramesDrawn++;
    if (!contextLost) scene.game.renderer.emit('postrender');
    scene.game.events.emit('postrender');
  };
  return { scene, worldDrawn, frame };
}

describe('ride presentation signal', () => {
  it('initializes decorative effects without consuming global randomness', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('unseeded decorative randomness');
    });
    try {
      expect(() => setup()).not.toThrow();
    } finally {
      random.mockRestore();
    }
  });

  it('reports complete art from all three texture keys without collecting diagnostics', () => {
    const { scene } = setup();
    expect(scene.artReady).toBe(false);
    readyTextures.add('art@');
    expect(scene.artReady).toBe(false);
    readyTextures.add('vehicle@');
    expect(scene.artReady).toBe(false);
    readyTextures.add('backdrop@');
    expect(scene.artReady).toBe(true);
    readyTextures.delete('vehicle@');
    expect(scene.artReady).toBe(false);
  });

  it('keeps the curtain during context loss and releases it after restoration', () => {
    const { frame, worldDrawn } = setup();
    frame(true);
    frame(true);
    expect(worldDrawn).not.toHaveBeenCalled();
    frame(false);
    expect(worldDrawn).toHaveBeenCalledTimes(1);
  });

  it.each(['shutdown', 'destroy'])(
    'ignores unprepared renders and unsubscribes on %s',
    (event) => {
      const { scene, frame, worldDrawn } = setup();
      scene.game.renderer.emit('postrender');
      expect(worldDrawn).not.toHaveBeenCalled();
      frame(false);
      expect(worldDrawn).toHaveBeenCalledTimes(1);
      scene.game.renderer.emit('postrender');
      expect(worldDrawn).toHaveBeenCalledTimes(1);
      scene.events.emit(event);
      frame(false);
      expect(worldDrawn).toHaveBeenCalledTimes(1);
      expect(scene.game.renderer.listenerCount('postrender')).toBe(0);
      expect(scene.game.events.listenerCount('postrender')).toBe(0);
    },
  );
});

it('restores a fallback prop pivot when its art becomes ready', () => {
  const image = {
    frame: { name: '__BASE', width: 142, height: 112 },
    getData: () => 'back.barn',
    setTexture: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
  };
  // Boundary fixture supplies only the image methods used by rebinding.
  rebindWorldImage(
    image as unknown as import('phaser').GameObjects.Image,
    () => 'ready@1',
    1,
  );
  expect(image.setTexture).toHaveBeenCalledWith('ready@1', 'back.barn');
  expect(image.setOrigin).toHaveBeenCalledWith(0.5, 111 / 112);
});

it('does not allocate unused vehicle silhouette textures when the catalogue is available', () => {
  const vehicle = locomotives[0];
  if (!vehicle) throw new Error('catalogue missing');
  const { scene } = setup([vehicle]);
  expect(
    // Native graphics method is inspected as a boundary spy, not called unbound.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    scene.make.graphics({}, false).generateTexture,
  ).not.toHaveBeenCalledWith(
    `vehicle-${vehicle.id}`,
    expect.any(Number),
    expect.any(Number),
  );
});

// Platform image double: run the actual diagnostic geometry, including parent transforms.
it.each([0.5, 1, 1.25])(
  'crossing diagnostic excludes the crane body transparent lower margin at %s px/u',
  (scale) => {
    const image = {
      frame: { name: 'service_crane.body' },
      texture: { key: 'vehicle@1' },
      displayOriginX: 94 * scale + 1,
      displayOriginY: 84 * scale + 1,
      getBounds: () => new Phaser.Geom.Rectangle(1000 - 94, 200 - 84, 188, 84),
      getWorldTransformMatrix: () => ({
        a: 1 / scale,
        b: 0,
        c: 0,
        d: 1 / scale,
        tx: 1000,
        ty: 200,
      }),
    };
    const [bounds] = drawnBounds(
      image as unknown as Phaser.GameObjects.Image,
      scale,
    );
    if (!bounds) throw new Error('missing body bounds');
    expect(bounds.bottom).toBeCloseTo(185);
    expect(bounds.width).toBeCloseTo(188);
  },
);

it('rotates and mirrors the crane painted bounds with its parent', () => {
  const image = {
    frame: { name: 'service_crane.body' },
    texture: { key: 'vehicle@1' },
    displayOriginX: 95,
    displayOriginY: 85,
    getBounds: () => new Phaser.Geom.Rectangle(0, 0, 84, 188),
    getWorldTransformMatrix: () => ({
      a: 0,
      b: -1,
      c: -1,
      d: 0,
      tx: 1000,
      ty: 200,
    }),
  };
  const [bounds] = drawnBounds(image as unknown as Phaser.GameObjects.Image, 1);
  if (!bounds) throw new Error('missing body bounds');
  expect(bounds.x).toBeCloseTo(1015);
  expect(bounds.width).toBeCloseTo(69);
  expect(bounds.height).toBeCloseTo(188);
});

it('crossing diagnostic leaves the transparent gap between the crane bogies clear', () => {
  const image = {
    frame: { name: 'service_crane.overlay' },
    texture: { key: 'vehicle@1' },
    displayOriginX: 95,
    displayOriginY: 85,
    getBounds: () => new Phaser.Geom.Rectangle(906, 116, 188, 84),
    getWorldTransformMatrix: () => ({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: 1000,
      ty: 200,
    }),
  };
  const bounds = drawnBounds(image as unknown as Phaser.GameObjects.Image, 1);
  expect(bounds).toHaveLength(2);
  expect(bounds.some((b) => b.x < 1000 && b.x + b.width > 1000)).toBe(false);
  expect(bounds.some((b) => b.x <= 940 && b.x + b.width >= 940)).toBe(true);
  expect(bounds.some((b) => b.x <= 1050 && b.x + b.width >= 1050)).toBe(true);
});
