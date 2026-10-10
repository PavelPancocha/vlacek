import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { TRACK_GENERATOR_VERSION } from '../../../src/domain/world/TrackProfile.ts';
import {
  RideSimulation,
  type RideSetup,
} from '../../../src/domain/ride/RideSimulation.ts';
import type { VehicleGeometry } from '../../../src/domain/train/TrainGeometry.ts';
import type { NpcFleet } from '../../../src/domain/interaction/OncomingTrain.ts';
import { secondarySite } from '../../../src/domain/world/SecondaryTrack.ts';

const loco: VehicleGeometry = { lengthU: 156, bogieOffsetU: 46 };
const wagon: VehicleGeometry = { lengthU: 188, bogieOffsetU: 58 };

function setup(wagons: number, extra: Partial<RideSetup> = {}): RideSetup {
  return {
    seed: 4242,
    vehicles: [loco, ...Array.from({ length: wagons }, () => wagon)],
    speedFactor: 1,
    config: gameConfig,
    ...extra,
  };
}

describe('RideSimulation', () => {
  it('spawns stopped at chunk 0, x 512, with track behind the whole consist (TRN-07)', () => {
    const ride = new RideSimulation(setup(100));
    expect(ride.speedUPerSec).toBe(0);
    expect(ride.simulationTick).toBe(0);
    expect(ride.headCursor().chunkIndex).toBe(0);
    expect(ride.sample(ride.headS).x).toBeCloseTo(512, 6);
    expect(ride.track.startS).toBeLessThanOrEqual(
      ride.tailS - gameConfig.world.geometryTailMarginU,
    );
    expect(ride.track.endS).toBeGreaterThanOrEqual(
      ride.frontS + gameConfig.world.geometryLookAheadU,
    );
    expect(ride.track.firstChunkIndex).toBeLessThan(0);
  });

  it('applies the intent of each fixed step and counts ticks', () => {
    const ride = new RideSimulation(setup(0));
    const start = ride.headS;
    for (let i = 0; i < 60; i++) ride.step('THROTTLE');
    expect(ride.simulationTick).toBe(60);
    expect(ride.speedUPerSec).toBeGreaterThan(40);
    expect(ride.headS).toBeGreaterThan(start);
    expect(ride.previousHeadS).toBeLessThan(ride.headS);
  });

  it('remembers the intent of its last step for the effects (doc 14 §4)', () => {
    const ride = new RideSimulation(setup(0));
    expect(ride.lastIntent).toBe('COAST');
    ride.step('THROTTLE');
    expect(ride.lastIntent).toBe('THROTTLE');
    ride.step('BRAKE');
    expect(ride.lastIntent).toBe('BRAKE');
    ride.resetMotion();
    expect(ride.lastIntent).toBe('COAST');
  });

  it('uses the parent speed factor', () => {
    const ride = new RideSimulation(setup(0, { speedFactor: 0.65 }));
    let top = 0;
    for (let i = 0; i < 600; i++) {
      ride.step('THROTTLE');
      top = Math.max(top, ride.speedUPerSec);
    }
    const limit = gameConfig.train.maxSpeedUPerSec * 0.65;
    expect(top).toBeLessThanOrEqual(limit + 1e-9);
    expect(top).toBeGreaterThan(limit * 0.9);
  });

  it('stops immediately when motion is reset (pause/resume) without moving', () => {
    const ride = new RideSimulation(setup(10));
    for (let i = 0; i < 120; i++) ride.step('THROTTLE');
    const head = ride.headS;
    ride.resetMotion();
    expect(ride.speedUPerSec).toBe(0);
    expect(ride.headS).toBe(head);
    ride.step('COAST');
    expect(ride.headS).toBe(head);
  });

  it('GEN-10: a long ride keeps a bounded track window and covers the tail', () => {
    const ride = new RideSimulation(setup(100));
    let maxChunks = 0;
    for (let i = 0; i < 60 * 60 * 10; i++) {
      ride.step('THROTTLE');
      maxChunks = Math.max(maxChunks, ride.track.chunkCount);
    }
    expect(ride.headCursor().chunkIndex).toBeGreaterThan(100);
    expect(maxChunks).toBeLessThanOrEqual(30);
    expect(ride.track.startS).toBeLessThanOrEqual(ride.tailS);
  });

  it('GEN-11: restoring from a cursor and tick reproduces the position', () => {
    const ride = new RideSimulation(setup(5));
    for (let i = 0; i < 900; i++) ride.step(i < 600 ? 'THROTTLE' : 'COAST');
    const restored = new RideSimulation(
      setup(5, {
        head: ride.headCursor(),
        simulationTick: ride.simulationTick,
      }),
    );
    const a = ride.sample(ride.headS);
    const b = restored.sample(restored.headS);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
    expect(restored.speedUPerSec).toBe(0);
    expect(restored.simulationTick).toBe(ride.simulationTick);
  });

  it('places one interactive placeholder object per chunk with a stable id', () => {
    const ride = new RideSimulation(setup(0));
    const objects = ride.objectsBetween(ride.track.startS, ride.track.endS);
    const chunks = ride.track.lastChunkIndex - ride.track.firstChunkIndex + 1;
    expect(objects).toHaveLength(chunks);
    // Entity ids carry the generator version (doc 04 §3).
    expect(objects[0]?.id).toMatch(
      new RegExp(`^g${TRACK_GENERATOR_VERSION}:chunk:-?\\d+:object:0$`),
    );
    const again = new RideSimulation(setup(0)).objectsBetween(
      ride.track.startS,
      ride.track.endS,
    );
    expect(again).toEqual(objects);
  });

  it('INP-05: object activation respects the cooldown and emits one event', () => {
    const ride = new RideSimulation(setup(0));
    const [object] = ride.objectsBetween(ride.headS, ride.track.endS);
    if (!object) throw new Error('expected an object ahead');
    expect(ride.activateObject(object.id)).toBe(true);
    expect(ride.activateObject(object.id)).toBe(false);
    for (let i = 0; i < 90; i++) ride.step('COAST');
    expect(ride.activateObject(object.id)).toBe(true);
    expect(
      ride.drainEvents().filter((e) => e.type === 'objectReacted'),
    ).toHaveLength(2);
    expect(ride.drainEvents()).toEqual([]);
  });

  it('rate-limits the horn by simulation time', () => {
    const ride = new RideSimulation(setup(0));
    expect(ride.requestHorn()).toBe(true);
    expect(ride.requestHorn()).toBe(false);
    for (let i = 0; i < 42; i++) ride.step('COAST');
    expect(ride.requestHorn()).toBe(true);
  });

  it('keeps the event queue bounded even if nobody drains it', () => {
    const ride = new RideSimulation(setup(0));
    for (let i = 0; i < 1000; i++) {
      ride.requestHorn();
      for (let j = 0; j < 42; j++) ride.step('COAST');
    }
    expect(ride.drainEvents().length).toBeLessThanOrEqual(64);
  });
});

describe('RideSimulation restore guard', () => {
  it('rejects a head offset outside its chunk', () => {
    expect(
      () =>
        new RideSimulation(
          setup(0, { head: { chunkIndex: 3, arcOffsetU: 5000 } }),
        ),
    ).toThrow(RangeError);
    expect(
      () =>
        new RideSimulation(
          setup(0, { head: { chunkIndex: 3, arcOffsetU: -1 } }),
        ),
    ).toThrow(RangeError);
  });

  it('SCN-13: keeps its crossings working over the whole train, before Dclose and after the render window', () => {
    // Seed 4242's first crossing; the longest consist (≈ 1600 u).
    const ride = new RideSimulation(setup(8));
    const crossing = ride.crossings[0];
    expect(crossing).toBeDefined();
    if (!crossing) return;
    // Known from the start, long before the front is within Dclose.
    expect(crossing.worldX - ride.sample(ride.frontS).x).toBeGreaterThan(1000);
    let closedSeen = false;
    for (let i = 0; i < 60 * 60; i++) {
      ride.step(i % 900 < 700 ? 'THROTTLE' : 'BRAKE');
      const span = {
        tailX: ride.sample(ride.tailS).x,
        frontX: ride.sample(ride.frontS).x,
      };
      const same = ride.crossings.find((c) => c.id === crossing.id);
      if (span.tailX < crossing.worldX + 200) expect(same).toBe(crossing);
      if (crossing.trainInConflict(span)) {
        closedSeen = true;
        expect(crossing.barrier).toBe(1);
        expect(crossing.roadInConflict()).toBe(false);
      }
    }
    expect(closedSeen).toBe(true);
  });

  it('SCN-08: a journey restored on a crossing starts with it closed', () => {
    const first = new RideSimulation(setup(0));
    const crossing = first.crossings[0];
    if (!crossing) throw new Error('no crossing');
    const k = Math.floor(crossing.worldX / gameConfig.world.chunkWidthU);
    const restored = new RideSimulation(
      setup(4, {
        head: {
          chunkIndex: k,
          arcOffsetU: crossing.worldX - k * gameConfig.world.chunkWidthU + 300,
        },
      }),
    );
    const same = restored.crossings.find((c) => c.id === crossing.id);
    expect(same?.phase).toBe('CLOSED');
    expect(same?.barrier).toBe(1);
  });
});

const npcFleet: NpcFleet = {
  locomotives: [
    { id: 'steam_local', lengthU: 156, bogieOffsetU: 46, wheelRadiusU: 15 },
  ],
  wagons: [
    { id: 'cargo_box', lengthU: 164, bogieOffsetU: 51, wheelRadiusU: 12 },
  ],
};
const { chunkWidthU, forcedSecondaryBiomeBlock, npcTriggerBeforeFeatureU } =
  gameConfig.world;
const site = secondarySite(4242, forcedSecondaryBiomeBlock);
if (!site) throw new Error('no forced second track');
const triggerX = site.fromX - npcTriggerBeforeFeatureU;
const frontX = (ride: RideSimulation) => ride.sample(ride.frontS).x;

/** A ride stopped this far (u) before the second track's trigger. */
function beforeTrigger(gapU: number): RideSimulation {
  const x = triggerX - gapU - 100;
  const k = Math.floor(x / chunkWidthU);
  return new RideSimulation(
    setup(2, {
      npcFleet,
      head: { chunkIndex: k, arcOffsetU: x - k * chunkWidthU },
    }),
  );
}

describe('RideSimulation: the oncoming train (doc 05 §6, SCN-09/10)', () => {
  it('starts once when the front comes within 512 u of the second track, and drives on when the player stops', () => {
    const ride = beforeTrigger(300);
    expect(frontX(ride)).toBeLessThan(triggerX);
    let started = -1;
    for (let i = 0; i < 60 * 20 && frontX(ride) < triggerX + 200; i++) {
      ride.step('THROTTLE');
      if (started < 0 && ride.oncomingTrains.length > 0) started = i;
      if (frontX(ride) < triggerX) expect(ride.oncomingTrains).toHaveLength(0);
    }
    expect(started).toBeGreaterThanOrEqual(0);
    expect(ride.oncomingTrains).toHaveLength(1);
    // The player stops; the oncoming train runs its whole way and leaves.
    let seen = 0;
    for (let i = 0; i < 60 * 90; i++) {
      ride.step('BRAKE');
      seen = Math.max(seen, ride.oncomingTrains.length);
    }
    expect(seen).toBe(1);
    expect(ride.oncomingTrains).toHaveLength(0);
  });

  it('never pops up in the open after a restore past its start', () => {
    const k = Math.floor((site.fromX + 300) / chunkWidthU);
    const ride = new RideSimulation(
      setup(2, {
        npcFleet,
        head: { chunkIndex: k, arcOffsetU: site.fromX + 300 - k * chunkWidthU },
      }),
    );
    for (let i = 0; i < 60 * 10; i++) ride.step('THROTTLE');
    expect(ride.oncomingTrains).toHaveLength(0);
  });

  it('answers the horn at most every 8 s and never itself; greets once when meeting', () => {
    const ride = beforeTrigger(50);
    for (let i = 0; i < 60 * 3; i++) ride.step('THROTTLE');
    expect(ride.oncomingTrains).toHaveLength(1);
    // Hold still in range; it comes along and meets the player.
    const npcHorns: number[] = [];
    let horns = 0;
    for (let i = 0; i < 60 * 60; i++) {
      ride.step('BRAKE');
      if (i % 42 === 0 && ride.requestHorn()) horns += 1;
      for (const event of ride.drainEvents())
        if (event.type === 'npcHorn') npcHorns.push(i / 60);
    }
    expect(horns).toBeGreaterThan(40);
    expect(npcHorns.length).toBeGreaterThan(0);
    for (let n = 1; n < npcHorns.length; n++)
      expect(
        (npcHorns[n] ?? 0) - (npcHorns[n - 1] ?? 0),
      ).toBeGreaterThanOrEqual(gameConfig.interaction.npcHornCooldownSeconds);
  });

  it('greets just once on its own, without any horn from the player', () => {
    const ride = beforeTrigger(50);
    for (let i = 0; i < 60 * 3; i++) ride.step('THROTTLE');
    let greetings = 0;
    for (let i = 0; i < 60 * 60; i++) {
      ride.step('BRAKE');
      for (const event of ride.drainEvents())
        if (event.type === 'npcHorn') greetings += 1;
    }
    expect(greetings).toBe(1);
  });
});
