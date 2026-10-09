import { describe, expect, it } from 'vitest';
import { PRIMARY_KEY } from '../../src/platform/SaveRepository.ts';
import {
  MemoryStorage,
  buildAndDepart,
  createSession,
  release,
  runFor,
  tap,
  touchWorld,
} from './helpers.ts';

describe('GameSession: build → ride → pause → resume', () => {
  it('UI-01: a first run starts at locomotive selection without reading', () => {
    expect(createSession().screen).toEqual({
      name: 'SELECT_LOCO',
      origin: 'new',
    });
  });

  it('departs with the built train, stopped, and the Vyjet touch never drives', () => {
    const session = createSession();
    buildAndDepart(session, ['cargo_box', 'cargo_coal', 'fun_balloons']);
    expect(session.screen).toEqual({ name: 'RIDING' });
    expect(session.ride?.vehicleCount).toBe(4);
    runFor(session, 1);
    expect(session.ride?.speedUPerSec).toBe(0);
  });

  it('INP-01/02: holding the world drives, releasing coasts to a stop', () => {
    const session = createSession();
    buildAndDepart(session);
    const finger = touchWorld(session);
    runFor(session, 3);
    expect(session.ride?.speedUPerSec).toBeGreaterThan(150);
    release(session, finger);
    runFor(session, 7);
    expect(session.ride?.speedUPerSec).toBe(0);
  });

  it('INP-04: a second finger on the brake wins; lifting it resumes throttle', () => {
    const session = createSession();
    buildAndDepart(session);
    touchWorld(session);
    runFor(session, 2);
    const brakeFinger = 9001;
    session.router.pointerDown({
      id: brakeFinger,
      clientX: 50,
      clientY: 650,
      timeMs: 0,
      action: 'brake',
    });
    runFor(session, 0.5);
    const braking = session.ride?.speedUPerSec ?? -1;
    runFor(session, 0.5);
    expect(session.ride?.speedUPerSec).toBeLessThan(braking);
    session.router.pointerUp({ id: brakeFinger });
    runFor(session, 0.5);
    expect(session.ride?.speedUPerSec).toBeGreaterThan(0);
  });

  it('INP-06/11: pause freezes everything; resume is stopped and needs a new touch', () => {
    const session = createSession();
    buildAndDepart(session);
    const finger = touchWorld(session);
    runFor(session, 2);
    session.router.pointerDown({
      id: 500,
      clientX: 1240,
      clientY: 40,
      timeMs: 0,
      action: 'pause',
    });
    session.router.pointerUp({ id: 500 });
    expect(session.screen).toEqual({ name: 'PAUSED', reason: 'user' });
    const tick = session.ride?.simulationTick;
    const head = session.ride?.headS;
    runFor(session, 3);
    expect(session.ride?.simulationTick).toBe(tick);
    expect(session.ride?.headS).toBe(head);
    // A finger held on the world while confirming stays inert.
    const held = touchWorld(session);
    tap(session, 'resume');
    expect(session.screen).toEqual({ name: 'RIDING' });
    expect(session.ride?.speedUPerSec).toBe(0);
    runFor(session, 1);
    expect(session.ride?.speedUPerSec).toBe(0);
    release(session, held);
    release(session, finger);
    touchWorld(session);
    runFor(session, 1);
    expect(session.ride?.speedUPerSec).toBeGreaterThan(0);
  });

  it('INP-10/13: focus loss, hidden page or resize pause, clear input and save', () => {
    const storage = new MemoryStorage();
    const session = createSession(storage);
    buildAndDepart(session);
    touchWorld(session);
    runFor(session, 2);
    session.interrupt();
    expect(session.screen).toEqual({ name: 'PAUSED', reason: 'external' });
    expect(session.router.activePointerCount).toBe(0);
    const tick = session.ride?.simulationTick;
    runFor(session, 2);
    expect(session.ride?.simulationTick).toBe(tick);
    expect(storage.getItem(PRIMARY_KEY)).toContain('"simulationTick"');
  });

  it('INP-05: touching an object reacts once while the same touch drives', () => {
    const session = createSession();
    buildAndDepart(session);
    const ride = session.ride;
    const [object] = ride?.objectsBetween(ride.headS, ride.track.endS) ?? [];
    if (!object) throw new Error('expected an object ahead');
    session.setWorldHitTest(() => object.id);
    touchWorld(session);
    runFor(session, 4);
    const reactions = session
      .drainEvents()
      .filter((event) => event.type === 'objectReacted');
    expect(reactions).toHaveLength(1);
    expect(session.ride?.speedUPerSec).toBeGreaterThan(0);
  });

  it('horn from the HUD is rate limited and never drives', () => {
    const session = createSession();
    buildAndDepart(session);
    for (let i = 0; i < 5; i++) {
      session.router.pointerDown({
        id: 700 + i,
        clientX: 1200,
        clientY: 680,
        timeMs: 0,
        action: 'horn',
      });
      session.router.pointerUp({ id: 700 + i });
    }
    runFor(session, 1);
    expect(
      session.drainEvents().filter((event) => event.type === 'horn'),
    ).toHaveLength(1);
    expect(session.ride?.speedUPerSec).toBe(0);
  });

  it('INP-12: five fingers and 30 quick taps stay stable', () => {
    const session = createSession();
    buildAndDepart(session);
    const fingers = [
      touchWorld(session),
      touchWorld(session),
      touchWorld(session),
    ];
    session.router.pointerDown({
      id: 800,
      clientX: 50,
      clientY: 650,
      timeMs: 0,
      action: 'brake',
    });
    for (let i = 0; i < 30; i++) {
      const id = touchWorld(session);
      release(session, id);
    }
    runFor(session, 1);
    expect(session.ride?.speedUPerSec).toBe(0);
    session.router.pointerUp({ id: 800 });
    for (const id of fingers) release(session, id);
    expect(session.router.activePointerCount).toBe(0);
  });
});

describe('GameSession: depot, saving and restoring', () => {
  it('UI-03: the 101st wagon is refused with a gentle signal', () => {
    const session = createSession();
    tap(session, 'loco:steam_local');
    tap(session, 'to-depot');
    for (let i = 0; i < 100; i++) tap(session, 'add:cargo_box');
    const before = session.fullSignals;
    tap(session, 'add:cargo_box');
    expect(session.draft.consist.wagons).toHaveLength(100);
    expect(session.fullSignals).toBe(before + 1);
  });

  it('DATA-01/08: a reload continues the same stopped journey without adding real time', () => {
    const storage = new MemoryStorage();
    const first = createSession(storage);
    buildAndDepart(first, ['cargo_box', 'fun_balloons']);
    const finger = touchWorld(first);
    runFor(first, 6);
    release(first, finger);
    tap(first, 'pause');
    const ride = first.ride;
    if (!ride) throw new Error('no ride');
    const where = ride.sample(ride.headS);

    const later = createSession(storage, {
      nowIso: () => '2026-10-09T19:30:00.000Z',
    });
    expect(later.screen).toEqual({ name: 'HOME' });
    tap(later, 'continue');
    expect(later.screen).toEqual({ name: 'PAUSED', reason: 'restore' });
    const restored = later.ride;
    if (!restored) throw new Error('no restored ride');
    expect(restored.simulationTick).toBe(ride.simulationTick);
    expect(restored.sample(restored.headS).x).toBeCloseTo(where.x, 6);
    expect(later.journeyConsist?.wagons.map((w) => w.definitionId)).toEqual([
      'cargo_box',
      'fun_balloons',
    ]);
    tap(later, 'resume');
    runFor(later, 2);
    expect(later.ride?.speedUPerSec).toBe(0);
  });

  it('UI-04: a depot copy from pause does not replace the journey until Vyjet', () => {
    const session = createSession();
    buildAndDepart(session, ['cargo_box']);
    touchWorld(session);
    runFor(session, 2);
    tap(session, 'pause');
    const seed = session.journeySeed;
    tap(session, 'open-depot');
    expect(session.screen).toEqual({ name: 'BUILD_TRAIN', origin: 'pause' });
    tap(session, 'add:fun_balloons');
    tap(session, 'back');
    expect(session.screen).toEqual({ name: 'PAUSED', reason: 'user' });
    expect(session.journeySeed).toBe(seed);
    expect(session.journeyConsist?.wagons).toHaveLength(1);
    tap(session, 'open-depot');
    tap(session, 'add:fun_balloons');
    tap(session, 'depart');
    expect(session.screen).toEqual({ name: 'RIDING' });
    expect(session.journeySeed).not.toBe(seed);
    expect(session.journeyConsist?.wagons).toHaveLength(2);
  });

  it('DATA-10: a failed start keeps the previous journey restorable', () => {
    const storage = new MemoryStorage();
    let failing = false;
    let seed = 7;
    const session = createSession(storage, {
      randomSeed: () => {
        if (failing) throw new Error('no randomness');
        return seed++;
      },
    });
    buildAndDepart(session);
    tap(session, 'pause');
    const saved = storage.getItem(PRIMARY_KEY);
    failing = true;
    tap(session, 'open-depot');
    tap(session, 'depart');
    expect(session.screen).toEqual({ name: 'BUILD_TRAIN', origin: 'pause' });
    expect(session.notices).toContain('start-failed');
    expect(storage.getItem(PRIMARY_KEY)).toBe(saved);
    tap(session, 'back');
    expect(session.screen).toEqual({ name: 'PAUSED', reason: 'user' });
  });

  it('saves debounced depot edits', () => {
    const storage = new MemoryStorage();
    const session = createSession(storage);
    tap(session, 'loco:magic_stars');
    tap(session, 'to-depot');
    tap(session, 'add:cargo_coal');
    session.frame(0.016, 100);
    expect(storage.getItem(PRIMARY_KEY)).toBeNull();
    session.frame(0.016, 400);
    expect(storage.getItem(PRIMARY_KEY)).toContain('cargo_coal');
  });

  it('DATA-02/04: corrupt or newer saves never crash the boot', () => {
    const corrupt = new MemoryStorage();
    corrupt.data.set(PRIMARY_KEY, '{"schemaVersion":1,');
    const a = createSession(corrupt);
    expect(a.screen).toEqual({ name: 'SELECT_LOCO', origin: 'new' });
    expect(a.notices).toContain('corrupt-save-discarded');
    const newer = new MemoryStorage();
    newer.data.set(PRIMARY_KEY, '{"schemaVersion":5}');
    const b = createSession(newer);
    expect(b.notices).toContain('newer-save-kept');
    buildAndDepart(b);
    tap(b, 'pause');
    expect(newer.getItem(PRIMARY_KEY)).toBe('{"schemaVersion":5}');
  });
});
