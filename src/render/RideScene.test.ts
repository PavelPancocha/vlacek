import { locomotives } from '../content/vehicles.ts';
import EventEmitter from 'eventemitter3';
import { describe, expect, it, vi } from 'vitest';
import { RideScene, type RideSceneHost } from './RideScene.ts';
import { rebindWorldImage } from './worldImage.ts';

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
      Core: { Events: { POST_RENDER: 'postrender' } },
      Renderer: { Events: { POST_RENDER: 'postrender' } },
      Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    },
  };
});
vi.mock('./ArtAtlas.ts', () => ({
  ArtAtlas: class {
    destroy() {}
  },
}));
vi.mock('./Backdrop.ts', () => ({
  Backdrop: class {
    destroy() {}
  },
}));

function setup(catalog: ReturnType<RideSceneHost['catalogVehicles']> = []) {
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
