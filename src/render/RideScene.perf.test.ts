import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceProbe } from '../platform/PerformanceProbe.ts';
import { gameConfig } from '../config/gameConfig.ts';
import { RideSimulation } from '../domain/ride/RideSimulation.ts';
import * as hash from '../domain/world/Hash.ts';
import { RideScene, type RideSceneHost } from './RideScene.ts';
import {
  WorldAtlasRequests,
  type WindowRequest,
} from './WorldAtlasRequests.ts';

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      sys = { setVisible: vi.fn(), isVisible: () => true };
    },
  },
}));

function setup() {
  const perf = new PerformanceProbe(() => 0);
  const host: RideSceneHost = {
    perf,
    frame: () => 0,
    ride: () => undefined,
    worldHidden: () => false,
    worldDrawn() {},
    journeyVehicles: () => [],
    journeyNpcFleet: () => undefined,
    catalogVehicles: () => [],
    effectsQuality: () => 'standard',
    artQuality: () => 'standard',
  };
  const scene = new RideScene(host);
  let time = 0;
  const now = vi
    .spyOn(scene.atlasMetrics, 'now')
    .mockImplementation(() => ++time);
  const assignments = vi.fn();
  const addCanvas = vi.fn<() => void>();
  const textures = {
    get addCanvas() {
      return addCanvas;
    },
    set addCanvas(value) {
      assignments(value);
    },
  };
  const atlas = () => ({
    ready: false,
    settling: false,
    textureKey: 'published',
    cancelPreparation() {},
    prepare() {
      scene.atlasMetrics.measure('prepare', () => {});
      scene.atlasMetrics.measure('upload', () => textures.addCanvas());
      this.ready = true;
      return Promise.resolve();
    },
  });
  const world = atlas(),
    backdrop = atlas();
  const errors = vi.fn();
  const requests = new WorldAtlasRequests(world, backdrop, errors);
  const activate = (isBackdrop: boolean) => {
    (isBackdrop ? backdrop : world).ready = false;
  };
  const request: WindowRequest = {
    id: '1/0.75/forest',
    world: { keys: ['forest'], pxPerU: 1 },
    backdrop: { keys: ['trees'], pxPerU: 0.75 },
  };
  const settle = async (wanted = request) => {
    requests.update(wanted, activate);
    await Promise.resolve();
    requests.update(wanted, activate);
    await Promise.resolve();
    requests.update(wanted, activate);
  };
  return {
    host,
    perf,
    scene,
    now,
    assignments,
    addCanvas,
    world,
    errors,
    requests,
    activate,
    request,
    settle,
  };
}

afterEach(() => vi.restoreAllMocks());

it('seeds effects only on ride changes, without hashing unchanged visible or hidden frames', () => {
  const h = setup();
  const ride = () =>
    new RideSimulation({
      seed: 2,
      vehicles: [{ lengthU: 156, bogieOffsetU: 46 }],
      speedFactor: 1,
      config: gameConfig,
    });
  const first = ride(),
    second = ride();
  h.host.ride = () => first;
  h.host.worldHidden = () => true;
  const hash32 = vi.spyOn(hash, 'hash32');
  h.scene.update(0, 0);
  expect(hash32).toHaveBeenCalledExactlyOnceWith(2, 'effects', 0);
  hash32.mockClear();
  for (const hidden of [true, false]) {
    h.host.worldHidden = () => hidden;
    for (let frame = 0; frame < 60; frame++) h.scene.update(frame * 16, 16);
  }
  expect(hash32).not.toHaveBeenCalled();
  first.step('COAST');
  hash32.mockClear();
  h.scene.update(2000, 16);
  expect(hash32).not.toHaveBeenCalled();
  h.host.ride = () => second;
  h.scene.update(2016, 16);
  expect(hash32).toHaveBeenCalledExactlyOnceWith(2, 'effects', 0);
});

describe('D-030 atlas timing overhead', () => {
  it('does zero timing or texture-wrapper work for 60 unchanged requests, but measures new content at the same scale', async () => {
    const h = setup();
    await h.settle();
    expect(h.perf.snapshot().atlas.packRasterMs).toBeGreaterThan(0);
    const initial = h.perf.snapshot().atlas;
    h.now.mockClear();
    h.addCanvas.mockClear();
    for (let frame = 0; frame < 60; frame++)
      h.requests.update(h.request, h.activate);
    expect({
      assignments: h.assignments.mock.calls.length,
      clock: h.now.mock.calls.length,
    }).toEqual({ assignments: 0, clock: 0 });
    expect(h.addCanvas).not.toHaveBeenCalled();
    expect(h.perf.snapshot().atlas).toEqual(initial);
    await h.settle({
      ...h.request,
      id: '1/0.75/lakes',
      world: { keys: ['water'], pxPerU: 1 },
    });
    expect(h.perf.snapshot().atlas.packRasterMs).toBeGreaterThan(
      initial.packRasterMs,
    );
    expect(h.perf.snapshot().atlas.uploadMs).toBeGreaterThan(initial.uploadMs);
    expect(h.now).toHaveBeenCalled();
    expect(h.assignments).not.toHaveBeenCalled();
  });

  it('keeps measuring after reset and scale changes, and never wraps textures on failure', async () => {
    const h = setup();
    await h.settle();
    const initial = h.perf.snapshot().atlas.packRasterMs;
    h.requests.reset();
    await h.settle();
    expect(h.perf.snapshot().atlas.packRasterMs).toBeGreaterThan(initial);
    await h.settle({
      ...h.request,
      id: '1.25/0.75/forest',
      world: { keys: ['forest'], pxPerU: 1.25 },
    });
    h.world.prepare = () => Promise.reject(new Error('atlas failed'));
    await h.settle({ ...h.request, id: 'failed' });
    expect(h.errors).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'atlas failed' }),
    );
    expect(h.world.textureKey).toBe('published');
    expect(h.assignments).not.toHaveBeenCalled();
  });
});
