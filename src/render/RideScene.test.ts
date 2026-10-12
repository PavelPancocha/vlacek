import EventEmitter from 'eventemitter3';
import { describe, expect, it, vi } from 'vitest';
import { RideScene, type RideSceneHost } from './RideScene.ts';

vi.mock('phaser', () => {
  const graphics = {
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

function setup() {
  const worldDrawn = vi.fn();
  const host: RideSceneHost = {
    frame: () => 0,
    ride: () => undefined,
    worldHidden: () => false,
    worldDrawn,
    journeyVehicles: () => [],
    journeyNpcFleet: () => undefined,
    catalogVehicles: () => [],
    effectsQuality: () => 'standard',
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
