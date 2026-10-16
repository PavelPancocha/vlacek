import { expect, it } from 'vitest';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { PRIMARY_KEY } from '../../src/platform/SaveRepository.ts';
import {
  MemoryStorage,
  buildAndDepart,
  createSession,
  runFor,
  tap,
  touchWorld,
} from './helpers.ts';

it('restarts from the initial cursor and tick with the same consist and selected seed', () => {
  const storage = new MemoryStorage();
  const session = createSession(storage);
  buildAndDepart(session, ['cargo_box', 'cargo_coal']);
  const start = session.ride?.headCursor();
  const consist = session.journeyConsist;
  touchWorld(session);
  runFor(session, 2);
  tap(session, 'pause');
  for (const seed of [session.journeySeed ?? 0, 345]) {
    expect(session.restartJourney(seed)).toBe('saved');
    expect(session.journeySeed).toBe(seed);
    expect(session.journeyConsist).toEqual(consist);
    expect(session.ride?.sample(session.ride.headS).x).toBeCloseTo(
      gameConfig.world.spawnChunkIndex * gameConfig.world.chunkWidthU +
        gameConfig.world.spawnLocalXU,
      8,
    );
    if (seed === 1000) expect(session.ride?.headCursor()).toEqual(start);
    expect(session.ride?.simulationTick).toBe(0);
    expect(session.ride?.speedUPerSec).toBe(0);
    expect(session.router.activePointerCount).toBe(0);
    expect(session.screen.name).toBe('PAUSED');
    const restored = createSession(storage);
    expect(restored.journeySeed).toBe(seed);
    expect(restored.journeyConsist).toEqual(consist);
    expect(restored.ride?.headCursor()).toEqual(session.ride?.headCursor());
  }
});

for (const failAt of [1, 2]) {
  it(`keeps the old journey when restart save ${failAt} fails`, () => {
    const storage = new MemoryStorage();
    const session = createSession(storage);
    buildAndDepart(session);
    touchWorld(session);
    runFor(session, 2);
    tap(session, 'pause');
    const ride = session.ride;
    const before = storage.getItem(PRIMARY_KEY);
    let writes = 0;
    storage.setItem = (key, value) => {
      if (key === PRIMARY_KEY && ++writes === failAt) throw new Error('quota');
      storage.data.set(key, value);
    };
    expect(session.restartJourney(345)).toBe('save-failed');
    expect(session.ride).toBe(ride);
    expect(session.journeySeed).toBe(1000);
    expect(storage.getItem(PRIMARY_KEY)).toBe(before);
    expect(createSession(storage).ride?.headCursor()).toEqual(
      ride?.headCursor(),
    );
  });
}

it('refuses restart outside pause and rejects invalid seeds without changing the journey', () => {
  const session = createSession();
  buildAndDepart(session);
  const ride = session.ride;
  expect(session.restartJourney(123)).toBe('start-failed');
  tap(session, 'pause');
  for (const seed of [-1, 4294967296, 1.5, NaN])
    expect(session.restartJourney(seed)).toBe('start-failed');
  expect(session.ride).toBe(ride);
});

it('keeps the old journey when creating the initial world fails', () => {
  const config = structuredClone(gameConfig);
  const storage = new MemoryStorage();
  const session = createSession(storage, { config });
  buildAndDepart(session);
  tap(session, 'pause');
  const ride = session.ride;
  const before = storage.getItem(PRIMARY_KEY);
  config.world.spawnChunkIndex = NaN;
  expect(session.restartJourney(345)).toBe('start-failed');
  expect(session.ride).toBe(ride);
  expect(storage.getItem(PRIMARY_KEY)).toBe(before);
});

it('ends a diagnostic test-scene ride before saving the restarted ordinary journey', () => {
  const storage = new MemoryStorage();
  const session = createSession(storage);
  buildAndDepart(session, ['cargo_box']);
  tap(session, 'pause');
  const original = session.ride;
  expect(session.startDiagnosticRide({ chunkIndex: 20, arcOffsetU: 0 })).toBe(
    true,
  );
  tap(session, 'pause');
  expect(session.diagnosticRide).toBe(true);
  expect(session.restartJourney(345)).toBe('saved');
  expect(session.diagnosticRide).toBe(false);
  const restarted = session.ride;
  expect(restarted).not.toBe(original);
  expect(restarted?.simulationTick).toBe(0);
  const restored = createSession(storage);
  expect(restored.journeySeed).toBe(345);
  expect(restored.ride?.headCursor()).toEqual(restarted?.headCursor());
  session.endDiagnosticRide();
  expect(session.ride).toBe(restarted);
  expect(session.journeySeed).toBe(345);
});
