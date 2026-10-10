import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { consistLengthU } from '../../src/domain/consist/ConsistEditor.ts';
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
  it('doc 14 §2: wagons stop at the length limit with a gentle signal', () => {
    const session = createSession();
    tap(session, 'loco:steam_local');
    tap(session, 'to-depot');
    for (let i = 0; i < 30; i++) tap(session, 'add:cargo_box');
    const rules = session.lengthRules;
    const lengthU = consistLengthU(session.draft.consist, rules);
    expect(rules.maxLengthU).toBe(gameConfig.train.maxConsistLengthU);
    expect(lengthU).toBeLessThanOrEqual(rules.maxLengthU);
    expect(lengthU + rules.couplerGapU + 164).toBeGreaterThan(rules.maxLengthU);
    const count = session.draft.consist.wagons.length;
    const before = session.fullSignals;
    tap(session, 'add:cargo_box');
    expect(session.draft.consist.wagons).toHaveLength(count);
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

describe('GameSession: UI-only actions', () => {
  it('passes actions it does not own to the shell (e.g. strip scrolling)', () => {
    const session = createSession();
    const seen: string[] = [];
    session.setUnhandledActionHandler((action) => seen.push(action));
    tap(session, 'loco:steam_local');
    tap(session, 'to-depot');
    tap(session, 'strip-start');
    expect(seen).toEqual(['strip-start']);
  });
});

describe('GameSession: restoring a saved depot draft', () => {
  function editDraftThenReload() {
    const storage = new MemoryStorage();
    const first = createSession(storage);
    buildAndDepart(first, ['cargo_box']);
    tap(first, 'pause');
    tap(first, 'open-depot');
    tap(first, 'add:fun_balloons');
    // The debounced edit save is written on the next frames.
    runFor(first, 0.5, 10_000);
    return createSession(storage);
  }

  it('reopening the depot after a reload shows the saved draft, not the journey copy', () => {
    const later = editDraftThenReload();
    expect(later.screen).toEqual({ name: 'HOME' });
    tap(later, 'continue');
    tap(later, 'open-depot');
    expect(later.draft.consist.wagons.map((w) => w.definitionId)).toEqual([
      'cargo_box',
      'fun_balloons',
    ]);
    expect(later.journeyConsist?.wagons).toHaveLength(1);
    // Used once: "Zpět" discards it and the next copy comes from the journey.
    tap(later, 'back');
    tap(later, 'open-depot');
    expect(later.draft.consist.wagons).toHaveLength(1);
  });

  it('keeps the saved draft through ride checkpoints until the depot uses it', () => {
    const storage = new MemoryStorage();
    const first = createSession(storage);
    buildAndDepart(first, ['cargo_box']);
    tap(first, 'pause');
    tap(first, 'open-depot');
    tap(first, 'add:fun_balloons');
    runFor(first, 0.5, 10_000);
    // Reload, keep riding past a 5 s checkpoint, reload again.
    const second = createSession(storage);
    tap(second, 'continue');
    tap(second, 'resume');
    const finger = touchWorld(second);
    runFor(second, 6, 20_000);
    release(second, finger);
    const third = createSession(storage);
    tap(third, 'continue');
    tap(third, 'open-depot');
    expect(third.draft.consist.wagons.map((w) => w.definitionId)).toEqual([
      'cargo_box',
      'fun_balloons',
    ]);
  });

  it('Postavit vlak on HOME also continues the saved draft', () => {
    const later = editDraftThenReload();
    tap(later, 'build-new');
    expect(later.draft.consist.wagons).toHaveLength(2);
  });
});

describe('GameSession: a longer train saved by version 0.1', () => {
  /** A real 0.1 save (schema 1) whose journey has 60 box wagons. */
  function legacyStorage(): MemoryStorage {
    const save = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, '../fixtures/save/v1-journey.json'),
        'utf8',
      ),
    ) as { journey: { consist: { wagons: unknown[] } }; lastConsist: unknown };
    save.journey.consist.wagons = Array.from({ length: 60 }, (_, i) => ({
      instanceId: `w${i + 1}`,
      definitionId: 'cargo_box',
      visualSeed: i,
    }));
    save.lastConsist = save.journey.consist;
    const storage = new MemoryStorage();
    storage.data.set(PRIMARY_KEY, JSON.stringify(save));
    return storage;
  }

  it('keeps every wagon, tells why, and does not ride a train that cannot be seen', () => {
    const storage = legacyStorage();
    const session = createSession(storage);
    expect(session.ride).toBeUndefined();
    expect(session.notices).toContain('train-too-long');
    expect(session.draft.consist.wagons).toHaveLength(60);
    tap(session, 'to-depot');
    expect(session.screen.name).toBe('BUILD_TRAIN');
    tap(session, 'depart');
    expect(session.screen.name).toBe('BUILD_TRAIN');
    expect(session.ride).toBeUndefined();
    // Nothing is dropped from storage behind the child's back.
    runFor(session, 0.5, 10_000);
    const stored = JSON.parse(storage.data.get(PRIMARY_KEY) ?? '{}') as {
      lastConsist?: { wagons: unknown[] };
      builderDraft?: { wagons: unknown[] };
    };
    expect((stored.builderDraft ?? stored.lastConsist)?.wagons.length).toBe(60);
  });

  it('departs once wagons are removed until the train fits', () => {
    const session = createSession(legacyStorage());
    tap(session, 'to-depot');
    while (
      consistLengthU(session.draft.consist, session.lengthRules) >
      session.lengthRules.maxLengthU
    ) {
      const last = session.draft.consist.wagons.at(-1)?.instanceId ?? 'none';
      tap(session, `wagon:${last}`);
      tap(session, 'remove');
    }
    tap(session, 'depart');
    expect(session.screen.name).toBe('RIDING');
    expect(session.notices).not.toContain('train-too-long');
  });
});
