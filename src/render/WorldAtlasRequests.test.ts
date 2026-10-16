import { afterEach, expect, it, vi } from 'vitest';
import { atlasDoubles } from './atlasDoubles.test-helper.ts';
import type { ArtAtlas } from './ArtAtlas.ts';
import {
  WorldAtlasRequests,
  type WindowRequest,
} from './WorldAtlasRequests.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const request = (id: number, world: number, backdrop: number) =>
  ({
    id: `${id}`,
    world: { keys: ['w-one', 'w-two'], pxPerU: world },
    backdrop: { keys: ['b-one', 'b-two'], pxPerU: backdrop },
  }) satisfies WindowRequest;

it.each(['webgl', 'canvas'] as const)(
  '%s: a world request waits until cancelled backdrop decoding has settled',
  async (renderer) => {
    const doubles = atlasDoubles(renderer);
    const world = doubles.owner(
      'world@',
      ['w-one', 'w-two'].map((key) => ({
        key,
        url: key,
        widthU: 600,
        heightU: 300,
      })),
    );
    // Two 1500 u backdrops never share a 2048² page: the second page decodes
    // after the first has registered.
    const backdrop = doubles.owner(
      'backdrop@',
      ['b-one', 'b-two'].map((key) => ({
        key,
        url: key,
        widthU: 1500,
        heightU: 1500,
      })),
      { maxPxPerU: 1 },
    );
    const requests = new WorldAtlasRequests(world, backdrop, () => {});
    const activate = (isBackdrop: boolean) => {
      const owner = isBackdrop ? backdrop : world;
      owner.commitPrepared().forEach((key) => owner.release(key));
    };
    const allocations = (prefix: string, displayed: string | undefined) =>
      doubles.memory.snapshot.allocations
        .map((a) => a.key)
        .filter(
          (key) =>
            (key.startsWith(`decode:${prefix}`) ||
              key.startsWith(`texture:${prefix}`) ||
              key.startsWith(`canvas:${prefix}`)) &&
            key !== `texture:${displayed}`,
        );
    let overlap = 0;
    const frame = async (current: WindowRequest) => {
      requests.update(current, activate);
      await doubles.settled();
      const both =
        allocations('world@', world.textureKey).length > 0 &&
        allocations('backdrop@', backdrop.textureKey).length > 0;
      if (both && world.textureKey) overlap++;
    };
    const settleAll = async (current: WindowRequest) => {
      for (
        let i = 0;
        i < 30 &&
        (requests.pending ||
          doubles.bitmaps.length > 0 ||
          world.ready ||
          backdrop.ready);
        i++
      ) {
        doubles.bitmaps.splice(0).forEach((bitmap) => bitmap.settle());
        await frame(current);
      }
    };

    // First load: both prepare under the curtain.
    const first = request(1, 0.5, 0.5);
    await frame(first);
    await settleAll(first);
    expect(requests.pending).toBe(false);
    overlap = 0;

    // Resize: the world publishes, then the backdrop starts decoding.
    const resized = request(2, 0.75, 0.75);
    await frame(resized);
    // Settle only world bitmaps: the backdrop starts once the world is published.
    for (
      let i = 0;
      i < 30 && !world.ready && world.info?.pxPerU !== 0.75;
      i++
    ) {
      doubles.bitmaps.splice(0).forEach((bitmap) => bitmap.settle());
      await frame(resized);
    }
    await frame(resized);
    expect(world.info?.pxPerU).toBe(0.75);
    // Settle backdrop bitmaps one by one until a replacement page has
    // registered and the next bitmap is still pending.
    const registered = () =>
      allocations('backdrop@', backdrop.textureKey).filter(
        (key) =>
          key.startsWith('texture:') &&
          !backdrop.pages.some((page) => key === `texture:${page.key}`),
      );
    for (
      let i = 0;
      i < 10 && !(registered().length && doubles.bitmaps.length);
      i++
    ) {
      doubles.bitmaps.shift()?.settle();
      await frame(resized);
    }
    expect(registered().length).toBeGreaterThan(0);
    expect(doubles.bitmaps).toHaveLength(1);
    expect(backdrop.settling).toBe(true);

    // A new window request cancels the backdrop while its bitmap is pending.
    const displayed = world.textureKey;
    const next = request(3, 1, 1);
    for (let i = 0; i < 3; i++) await frame(next);
    expect(backdrop.settling).toBe(true);
    expect
      .soft(
        allocations('world@', displayed),
        'world allocations while backdrop settles',
      )
      .toEqual([]);
    expect
      .soft(
        allocations('backdrop@', backdrop.textureKey).filter((key) =>
          key.startsWith('texture:'),
        ),
        'unpublished backdrop pages after cancellation',
      )
      .toEqual([]);
    expect(world.textureKey).toBe(displayed);
    expect(requests.pending).toBe(true);
    expect(requests.busy).toBe(true);

    await settleAll(next);
    expect(requests.pending).toBe(false);
    expect([world.info?.pxPerU, backdrop.info?.pxPerU]).toEqual([1, 1]);
    expect.soft(overlap, 'frames with world and backdrop work at once').toBe(0);
    expect(
      doubles.memory.snapshot.allocations
        .map((a) => a.key)
        .filter(
          (key) =>
            key !== `texture:${world.textureKey}` &&
            !backdrop.pages.some((page) => key === `texture:${page.key}`),
        ),
    ).toEqual([]);
    expect(
      doubles.created.filter((bitmap) => !bitmap.close.mock.calls.length),
    ).toEqual([]);
    world.destroy();
    backdrop.destroy();
    expect(doubles.memory.snapshot.bytes).toBe(0);
  },
);

it.each(['webgl', 'canvas'] as const)(
  '%s: after a resize the vehicles prepare first, then the world, then the backdrop',
  async (renderer) => {
    const doubles = atlasDoubles(renderer);
    const sources = (keys: string[], widthU: number, heightU: number) =>
      keys.map((key) => ({ key, url: key, widthU, heightU }));
    const order: string[] = [];
    const logged = (name: string, owner: ArtAtlas) => {
      const prepare = owner.prepare.bind(owner);
      owner.prepare = (keys, zoom) => {
        order.push(name);
        return prepare(keys, zoom);
      };
      return owner;
    };
    const world = logged(
      'world',
      doubles.owner('world@', sources(['w-one', 'w-two'], 600, 300)),
    );
    const backdrop = logged(
      'backdrop',
      doubles.owner('backdrop@', sources(['b-one', 'b-two'], 1500, 1500), {
        maxPxPerU: 1,
      }),
    );
    const vehicles = logged(
      'vehicles',
      doubles.owner('vehicle@', sources(['v-one', 'v-two'], 400, 200)),
    );
    const requests = new WorldAtlasRequests(
      world,
      backdrop,
      () => {},
      vehicles,
    );
    const activate = (isBackdrop: boolean) => {
      const owner = isBackdrop ? backdrop : world;
      owner.commitPrepared().forEach((key) => owner.release(key));
    };
    const working = (
      prefix: string,
      owner: { readonly textureKey: string | undefined },
    ) =>
      doubles.memory.snapshot.allocations
        .map((a) => a.key)
        .some(
          (key) =>
            (key.startsWith(`decode:${prefix}`) ||
              key.startsWith(`texture:${prefix}`) ||
              key.startsWith(`canvas:${prefix}`)) &&
            key !== `texture:${owner.textureKey}`,
        );
    // RideScene's frame protocol: vehicle request, vehicle commit, then the
    // window update unless a vehicle raster is in flight.
    let vehicleId: string | undefined;
    let vehiclePending = false;
    let overlap = 0;
    const frame = async (window: WindowRequest, vehicleScale: number) => {
      const id = `journey/${vehicleScale}`;
      if (id !== vehicleId) {
        vehicleId = id;
        requests.requestVehicles({
          id,
          prepare: () => {
            vehiclePending = true;
            return vehicles
              .prepare(['v-one', 'v-two'], vehicleScale)
              .then(() => {
                if (vehicleId === id) vehiclePending = false;
              });
          },
        });
      }
      if (vehicles.ready)
        vehicles.commitPrepared().forEach((key) => vehicles.release(key));
      if (!vehiclePending && !vehicles.settling)
        requests.update(window, activate);
      await doubles.settled();
      if (
        working('vehicle@', vehicles) &&
        (working('world@', world) || working('backdrop@', backdrop))
      )
        overlap++;
    };
    const settleUntil = async (
      window: WindowRequest,
      vehicleScale: number,
      done: () => boolean,
    ) => {
      for (let i = 0; i < 60 && !done(); i++) {
        doubles.bitmaps.splice(0).forEach((bitmap) => bitmap.settle());
        await frame(window, vehicleScale);
      }
      expect(done()).toBe(true);
    };
    const idle = () =>
      !requests.pending &&
      !vehiclePending &&
      !vehicles.settling &&
      !vehicles.ready &&
      !world.ready &&
      !backdrop.ready &&
      doubles.bitmaps.length === 0;

    // Restore: vehicles, then the window under the curtain.
    const first = request(1, 0.5, 0.5);
    await frame(first, 0.5);
    await settleUntil(first, 0.5, idle);
    // A window change: the world publishes, then the backdrop starts decoding.
    const moved = request(2, 0.75, 0.75);
    await settleUntil(moved, 0.5, () => backdrop.settling && !world.ready);
    expect(world.info?.pxPerU).toBe(0.75);

    // Resize while the backdrop decodes: vehicle and window scales change.
    order.length = 0;
    overlap = 0;
    const resized = request(3, 1, 1);
    await frame(resized, 1);
    await settleUntil(resized, 1, idle);
    expect(order.filter((name, i) => order.indexOf(name) === i)).toEqual([
      'vehicles',
      'world',
      'backdrop',
    ]);
    expect(overlap, 'frames with vehicle and world/backdrop work').toBe(0);
    expect([
      vehicles.info?.pxPerU,
      world.info?.pxPerU,
      backdrop.info?.pxPerU,
    ]).toEqual([1, 1, 1]);
    world.destroy();
    backdrop.destroy();
    vehicles.destroy();
    expect(doubles.memory.snapshot.bytes).toBe(0);
  },
);
