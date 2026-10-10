import type { CrossingConfig } from '../../config/gameConfig.ts';
import { unitRandom } from '../world/Hash.ts';
import { TRACK_GENERATOR_VERSION } from '../world/TrackProfile.ts';

/** Phases of a level crossing (doc 05 §4). */
export type CrossingPhase =
  'OPEN' | 'CLEARING' | 'WARNING' | 'CLOSING' | 'CLOSED' | 'OPENING';

/** The whole train as an x interval (doc 05: not the single vehicles). */
export interface TrainSpan {
  tailX: number;
  frontX: number;
}

export interface CrossingRules {
  crossing: CrossingConfig;
  /** Dclose, derived from the top speed (`crossingCloseDistanceU`). */
  closeDistanceU: number;
}

export type RoadActorKind = 'car' | 'bike';

/**
 * A car or bike on the crossing road. The road runs into the depth: road
 * position 0 is the track, negative behind it (towards the horizon),
 * positive in front of it (towards the viewer).
 */
export interface RoadActor {
  id: string;
  kind: RoadActorKind;
  /** +1 drives towards the viewer, −1 away from them. */
  direction: 1 | -1;
  /** Road position of the actor's middle, u. */
  roadU: number;
  /** Stopped at the stop line, waiting for the barriers. */
  waiting: boolean;
}

/** Half the track bed along the road: the road actors' conflict zone. */
export const ROAD_CONFLICT_U = 30;
/**
 * Stop lines, measured from the track. Behind the track the road meets the
 * rails level; in front of it the road climbs the bank, so its barrier and
 * stop line stand at the bank's foot, further out (D-015).
 */
export const FAR_STOP_LINE_U = 40;
export const NEAR_STOP_LINE_U = 56;
/** Where traffic appears and disappears on the road. */
export const ROAD_FAR_END_U = -220;
export const ROAD_NEAR_END_U = 320;
/** Half the road width along the track: the train's conflict zone. */
export const TRACK_CONFLICT_U = 30;
/** The train counts as occupying the crossing this much earlier/later. */
const OCCUPANCY_MARGIN_U = 32;
/**
 * Half the extended conflict zone along the track; Dclose is measured from
 * its near edge (doc 13: to the nearer edge of the extended zone).
 */
export const CROSSING_ZONE_HALF_U = TRACK_CONFLICT_U + OCCUPANCY_MARGIN_U;

const LENGTH_U: Readonly<Record<RoadActorKind, number>> = { car: 26, bike: 14 };
const SPEED_U_PER_SEC: Readonly<Record<RoadActorKind, number>> = {
  car: 70,
  bike: 56,
};
/** Gap kept to the actor ahead in the same lane. */
const FOLLOW_GAP_U = 8;
/** Stop line of traffic coming from the far (+1) or near (−1) side. */
function stopLineU(direction: 1 | -1): number {
  return direction === 1 ? FAR_STOP_LINE_U : NEAR_STOP_LINE_U;
}

/**
 * Longest time a road actor just past its stop line needs until it is
 * clear of the conflict zone, also stuck behind the slowest actor. It must
 * fit `crossing.roadClearanceSeconds` (a test checks the default).
 */
export function worstClearingSeconds(): number {
  const longest = Math.max(...Object.values(LENGTH_U));
  const slowest = Math.min(...Object.values(SPEED_U_PER_SEC));
  const stop = Math.max(FAR_STOP_LINE_U, NEAR_STOP_LINE_U);
  return (stop + ROAD_CONFLICT_U + longest) / slowest;
}

const SPAWN_EVERY_SEC: readonly [number, number] = [3, 8];
const BIKE_SHARE = 0.25;

/**
 * A level crossing as a real state machine (doc 05 §4): it starts closing
 * when the train's front comes within Dclose or the train occupies the
 * crossing, lets committed road traffic clear, warns, lowers the barriers
 * and opens them again only when no part of the train is on it and none
 * is approaching. Road actors enter the conflict zone only while it is
 * open with no train predicted, and never stop inside it. Runs on fixed
 * simulation steps; pure (seeded traffic).
 */
export class LevelCrossing {
  readonly id: string;
  readonly worldX: number;
  readonly #seed: number;
  readonly #rules: CrossingRules;
  #phase: CrossingPhase;
  #phaseSec = 0;
  #barrier: number;
  #time = 0;
  #nextSpawnSec: number;
  #spawned = 0;
  #crossed = 0;
  #actors: RoadActor[] = [];
  #needClosed: boolean;

  constructor(
    id: string,
    worldX: number,
    seed: number,
    rules: CrossingRules,
    train: TrainSpan,
  ) {
    this.id = id;
    this.worldX = worldX;
    this.#seed = seed;
    this.#rules = rules;
    // Restored with a train on or near it: closed before the first frame,
    // and traffic only appears later, outside the crossing (SCN-08).
    this.#needClosed = this.#closureNeeded(train);
    this.#phase = this.#needClosed ? 'CLOSED' : 'OPEN';
    this.#barrier = this.#needClosed ? 1 : 0;
    this.#nextSpawnSec = this.#spawnPause();
  }

  get phase(): CrossingPhase {
    return this.#phase;
  }

  /** 0 barriers up … 1 barriers down. */
  get barrier(): number {
    return this.#barrier;
  }

  /** Road actors that have crossed the track so far. */
  get crossedCount(): number {
    return this.#crossed;
  }

  get actors(): readonly RoadActor[] {
    return this.#actors;
  }

  /** The warning lights flash (red) in every phase but OPEN. */
  get warning(): boolean {
    return this.#phase !== 'OPEN';
  }

  step(dtSec: number, train: TrainSpan): void {
    this.#time += dtSec;
    this.#phaseSec += dtSec;
    this.#needClosed = this.#closureNeeded(train);
    const { crossing } = this.#rules;
    switch (this.#phase) {
      case 'OPEN':
        if (this.#needClosed) this.#enter('CLEARING');
        break;
      case 'CLEARING':
        // Traffic already committed finishes; nobody new enters.
        if (!this.roadCommitted()) this.#enter('WARNING');
        break;
      case 'WARNING':
        if (this.#phaseSec >= crossing.warningSeconds) this.#enter('CLOSING');
        break;
      case 'CLOSING':
        this.#barrier = Math.min(
          1,
          this.#barrier + dtSec / crossing.closingSeconds,
        );
        if (this.#barrier >= 1) this.#enter('CLOSED');
        break;
      case 'CLOSED':
        if (!this.#needClosed) this.#enter('OPENING');
        break;
      case 'OPENING':
        if (this.#needClosed) {
          // Another train: back down, the road stays blocked (SCN-07).
          this.#enter('CLOSING');
          break;
        }
        this.#barrier = Math.max(
          0,
          this.#barrier - dtSec / crossing.openingSeconds,
        );
        if (this.#barrier <= 0) this.#enter('OPEN');
        break;
    }
    this.#moveTraffic(dtSec);
    this.#spawnTraffic();
  }

  /** May a road actor pass the stop line now? */
  roadPermitted(): boolean {
    return this.#phase === 'OPEN' && !this.#needClosed;
  }

  /** Some road actor is past a stop line and not yet clear of the track. */
  roadCommitted(): boolean {
    return this.#actors.some((actor) => this.#committed(actor));
  }

  /** Some road actor overlaps the track's conflict zone. */
  roadInConflict(): boolean {
    return this.#actors.some((actor) => {
      const half = LENGTH_U[actor.kind] / 2;
      return (
        actor.roadU + half > -ROAD_CONFLICT_U &&
        actor.roadU - half < ROAD_CONFLICT_U
      );
    });
  }

  /** Some part of the train is on the road. */
  trainInConflict(train: TrainSpan): boolean {
    return (
      train.frontX > this.worldX - TRACK_CONFLICT_U &&
      train.tailX < this.worldX + TRACK_CONFLICT_U
    );
  }

  count(kind: RoadActorKind): number {
    return this.#actors.filter((actor) => actor.kind === kind).length;
  }

  waitingCount(): number {
    return this.#actors.filter((actor) => actor.waiting).length;
  }

  #enter(phase: CrossingPhase): void {
    this.#phase = phase;
    this.#phaseSec = 0;
  }

  /** Occupied (with a margin) or the front within Dclose of the zone. */
  #closureNeeded(train: TrainSpan): boolean {
    const from = this.worldX - CROSSING_ZONE_HALF_U;
    const to = this.worldX + CROSSING_ZONE_HALF_U;
    const occupied = train.frontX > from && train.tailX < to;
    const approaching =
      train.frontX <= from && from - train.frontX <= this.#rules.closeDistanceU;
    return occupied || approaching;
  }

  /** Past its stop line towards the track and not yet clear of it. */
  #committed(actor: RoadActor): boolean {
    const half = LENGTH_U[actor.kind] / 2;
    const front = actor.roadU + actor.direction * half;
    const back = actor.roadU - actor.direction * half;
    // Front beyond the stop line on its side, back not yet past the
    // conflict zone on the far side.
    return (
      actor.direction * front > -stopLineU(actor.direction) &&
      actor.direction * back < ROAD_CONFLICT_U
    );
  }

  #moveTraffic(dtSec: number): void {
    const permitted = this.roadPermitted();
    for (const direction of [1, -1] as const) {
      // Leading actor first.
      const lane = this.#actors
        .filter((actor) => actor.direction === direction)
        .sort((a, b) => direction * (b.roadU - a.roadU));
      let limit = Infinity;
      for (const actor of lane) {
        const half = LENGTH_U[actor.kind] / 2;
        const committed = this.#committed(actor);
        let target =
          direction * actor.roadU + SPEED_U_PER_SEC[actor.kind] * dtSec;
        // Keep the gap to the actor ahead.
        target = Math.min(target, limit - half - FOLLOW_GAP_U);
        // Stop with the front at the stop line unless allowed across.
        const stopAt = -stopLineU(direction) - half;
        const atLine = direction * actor.roadU <= stopAt + 1e-9;
        if (!committed && !permitted && atLine)
          target = Math.min(target, stopAt);
        const progress = Math.max(direction * actor.roadU, target);
        actor.waiting = progress - direction * actor.roadU < 1e-6;
        const crossedBefore = direction * actor.roadU > ROAD_CONFLICT_U + half;
        actor.roadU = direction * progress;
        if (!crossedBefore && direction * actor.roadU > ROAD_CONFLICT_U + half)
          this.#crossed += 1;
        limit = direction * actor.roadU - half;
      }
    }
    this.#actors = this.#actors.filter(
      (actor) =>
        actor.roadU > ROAD_FAR_END_U - 1 && actor.roadU < ROAD_NEAR_END_U + 1,
    );
  }

  #spawnTraffic(): void {
    if (this.#time < this.#nextSpawnSec) return;
    this.#nextSpawnSec = this.#time + this.#spawnPause();
    const n = this.#spawned;
    const direction: 1 | -1 = n % 2 === 0 ? 1 : -1;
    const roll = unitRandom(
      this.#seed,
      TRACK_GENERATOR_VERSION,
      'crossing-traffic',
      this.id,
      n,
    );
    const { maxQueuedCars, maxQueuedBikes } = this.#rules.crossing;
    const wantBike = roll < BIKE_SHARE;
    const kind: RoadActorKind | undefined =
      wantBike && this.count('bike') < maxQueuedBikes
        ? 'bike'
        : this.count('car') < maxQueuedCars
          ? 'car'
          : undefined;
    if (kind === undefined) return;
    const half = LENGTH_U[kind] / 2;
    const roadU =
      direction === 1 ? ROAD_FAR_END_U + half : ROAD_NEAR_END_U - half;
    // Only where the lane's entry is free.
    const blocked = this.#actors.some(
      (actor) =>
        actor.direction === direction &&
        Math.abs(actor.roadU - roadU) <
          half + LENGTH_U[actor.kind] / 2 + FOLLOW_GAP_U,
    );
    if (blocked) return;
    this.#spawned += 1;
    this.#actors.push({
      id: `${this.id}:road:${n}`,
      kind,
      direction,
      roadU,
      waiting: false,
    });
  }

  #spawnPause(): number {
    const roll = unitRandom(
      this.#seed,
      TRACK_GENERATOR_VERSION,
      'crossing-pause',
      this.id,
      this.#spawned,
      Math.floor(this.#time),
    );
    return (
      SPAWN_EVERY_SEC[0] + (SPAWN_EVERY_SEC[1] - SPAWN_EVERY_SEC[0]) * roll
    );
  }
}
