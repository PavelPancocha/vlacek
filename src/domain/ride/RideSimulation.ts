import {
  crossingCloseDistanceU,
  type GameConfig,
} from '../../config/gameConfig.ts';
import type { MotionIntent } from '../input/InputReducer.ts';
import { CooldownGate, ObjectReactions } from '../interaction/Cooldowns.ts';
import {
  LevelCrossing,
  type CrossingRules,
  type TrainSpan,
} from '../interaction/LevelCrossing.ts';
import {
  layoutConsist,
  poseVehicle,
  type ConsistLayout,
  type VehicleGeometry,
  type VehiclePose,
} from '../train/TrainGeometry.ts';
import {
  motionParams,
  stepMotion,
  type MotionParams,
} from '../train/TrainMotion.ts';
import type { TrackSample } from '../world/ArcLengthTable.ts';
import { chunkObjects, chunkOfEntityId } from '../world/ChunkObjects.ts';
import { crossingSite, crossingWorldX } from '../world/Crossings.ts';
import { generateTrackProfile } from '../world/TrackProfile.ts';
import { TrackWindow, type TrackCursor } from '../world/TrackWindow.ts';

export interface RideSetup {
  seed: number;
  /** Locomotive first, then wagons in order. */
  vehicles: readonly VehicleGeometry[];
  /** Parent setting: 1 or `train.slowModeSpeedFactor`. */
  speedFactor: number;
  config: GameConfig;
  /** Saved head position; a new journey spawns per doc 13 `world.spawn*`. */
  head?: TrackCursor;
  /**
   * The locomotive needs catenary: the whole journey is electrified
   * (doc 03 §9), for every kept and newly generated chunk.
   */
  electrified?: boolean;
  simulationTick?: number;
}

export interface PlacedObject {
  id: string;
  /** Window-local arc coordinate of the object's foot on the track. */
  s: number;
}

export type RideEvent =
  { type: 'objectReacted'; id: string } | { type: 'horn' };

const MAX_PENDING_EVENTS = 64;
/** Crossings stay alive this far behind the tail (until well clear). */
const CROSSING_BEHIND_U = 1024;
/** Crossings are known this far beyond Dclose ahead of the front. */
const CROSSING_AHEAD_U = 512;

/**
 * The single fixed-step ride simulation (doc 08 §3). Each step: motion from
 * the input intent, then track streaming for the whole consist, then
 * interaction cooldowns and the tick. Rendering only reads this state.
 */
export class RideSimulation {
  readonly track: TrackWindow;
  readonly layout: ConsistLayout;
  /** Catenary along the whole route (doc 03 §9); fixed for the journey. */
  readonly electrified: boolean;
  readonly #seed: number;
  readonly #vehicles: readonly VehicleGeometry[];
  readonly #config: GameConfig;
  readonly #motion: MotionParams;
  readonly #dtSec: number;
  readonly #reactions: ObjectReactions;
  readonly #horn: CooldownGate;
  /** Live level crossings by id (doc 05 §4), ahead and under the train. */
  readonly #crossings = new Map<string, LevelCrossing>();
  readonly #crossingRules: CrossingRules;
  #events: RideEvent[] = [];
  speedUPerSec = 0;
  simulationTick: number;
  /** Intent of the latest step, for the drive effects (doc 14 §4). */
  lastIntent: MotionIntent = 'COAST';
  headS: number;
  previousHeadS: number;

  constructor(setup: RideSetup) {
    const { config } = setup;
    const world = config.world;
    this.#seed = setup.seed;
    this.#vehicles = setup.vehicles;
    this.electrified = setup.electrified ?? false;
    this.#config = config;
    this.#motion = motionParams(config, setup.speedFactor);
    this.#dtSec = 1 / config.simulation.fixedHz;
    this.#reactions = new ObjectReactions(
      Math.round(
        config.interaction.defaultCooldownSeconds * config.simulation.fixedHz,
      ),
    );
    this.#horn = new CooldownGate(
      Math.round(
        config.interaction.hornMinIntervalSeconds * config.simulation.fixedHz,
      ),
    );
    this.layout = layoutConsist(setup.vehicles, config.train.couplerGapU);
    this.#crossingRules = {
      crossing: config.crossing,
      closeDistanceU: crossingCloseDistanceU(
        config.crossing,
        config.train.maxSpeedUPerSec,
      ),
    };
    const anchor = setup.head?.chunkIndex ?? world.spawnChunkIndex;
    this.track = new TrackWindow(
      (k) => generateTrackProfile(this.#seed, k),
      anchor,
      world,
    );
    if (setup.head) {
      // The fresh window holds only the anchor chunk, spanning [0, its length].
      if (!(
        setup.head.arcOffsetU >= 0 && setup.head.arcOffsetU <= this.track.endS
      )) {
        throw new RangeError(
          `Head offset ${setup.head.arcOffsetU} is outside its chunk`,
        );
      }
      this.headS = this.track.sAt(setup.head);
    } else {
      this.headS = this.track.sFromLocalX(anchor, world.spawnLocalXU);
    }
    this.previousHeadS = this.headS;
    this.simulationTick = setup.simulationTick ?? 0;
    // The whole consist has track before the first frame (TRN-07).
    this.#streamTrack();
    // Crossings exist before the first frame; one under the train starts
    // closed (SCN-08).
    this.#updateCrossings(0);
  }

  /** Level crossings from behind the train to beyond Dclose ahead. */
  get crossings(): readonly LevelCrossing[] {
    return [...this.#crossings.values()];
  }

  /** The whole train as an x interval (doc 05 §4). */
  #trainSpan(): TrainSpan {
    return {
      tailX: this.track.sample(this.tailS).x,
      frontX: this.track.sample(this.frontS).x,
    };
  }

  #updateCrossings(dtSec: number): void {
    const span = this.#trainSpan();
    const width = this.#config.world.chunkWidthU;
    const behindX = span.tailX - CROSSING_BEHIND_U;
    const first = Math.floor(behindX / width);
    const last = Math.floor(
      (span.frontX + this.#crossingRules.closeDistanceU + CROSSING_AHEAD_U) /
        width,
    );
    for (let k = first; k <= last; k++) {
      const site = crossingSite(this.#seed, k);
      if (site && !this.#crossings.has(site.id))
        this.#crossings.set(
          site.id,
          new LevelCrossing(
            site.id,
            crossingWorldX(site),
            this.#seed,
            this.#crossingRules,
            span,
          ),
        );
    }
    for (const [id, crossing] of this.#crossings) {
      if (crossing.worldX < behindX) this.#crossings.delete(id);
      else if (dtSec > 0) crossing.step(dtSec, span);
    }
  }

  get frontS(): number {
    return this.headS + this.layout.frontOffsetU;
  }

  get tailS(): number {
    return this.headS - this.layout.tailOffsetU;
  }

  get vehicleCount(): number {
    return this.#vehicles.length;
  }

  /** World seed of the journey, for seeded scenery around the track. */
  get seed(): number {
    return this.#seed;
  }

  sample(s: number): TrackSample {
    return this.track.sample(s);
  }

  headCursor(): TrackCursor {
    return this.track.cursorAt(this.headS);
  }

  /** Pose of vehicle `index` for a (possibly interpolated) head position. */
  vehiclePose(index: number, headS: number = this.headS): VehiclePose {
    const vehicle = this.#vehicles[index];
    const offset = this.layout.centerOffsetsU[index];
    if (!vehicle || offset === undefined)
      throw new RangeError(`No vehicle ${index}`);
    return poseVehicle((s) => this.track.sample(s), headS - offset, vehicle);
  }

  #streamTrack(): void {
    const { geometryTailMarginU, geometryLookAheadU } = this.#config.world;
    const change = this.track.ensureRange(
      this.tailS - geometryTailMarginU,
      this.frontS + geometryLookAheadU,
    );
    for (const chunk of change.removed) this.#reactions.forgetChunk(chunk);
  }

  step(intent: MotionIntent): void {
    this.lastIntent = intent;
    this.previousHeadS = this.headS;
    const grade = this.track.sample(this.headS).grade;
    const motion = stepMotion(
      this.speedUPerSec,
      intent,
      grade,
      this.#motion,
      this.#dtSec,
    );
    this.speedUPerSec = motion.speedUPerSec;
    this.headS += motion.distanceU;
    this.#streamTrack();
    this.#updateCrossings(this.#dtSec);
    this.simulationTick += 1;
    this.#reactions.prune(this.simulationTick);
  }

  /** After pause, focus loss or restore: stopped, no catch-up movement. */
  resetMotion(): void {
    this.lastIntent = 'COAST';
    this.speedUPerSec = 0;
    this.previousHeadS = this.headS;
  }

  objectsBetween(fromS: number, toS: number): PlacedObject[] {
    const placed: PlacedObject[] = [];
    for (
      let k = this.track.firstChunkIndex;
      k <= this.track.lastChunkIndex;
      k++
    ) {
      for (const object of chunkObjects(this.#seed, k)) {
        const s = this.track.sFromLocalX(k, object.localXU);
        if (s >= fromS && s <= toS) placed.push({ id: object.id, s });
      }
    }
    return placed;
  }

  /** Reaction ticks elapsed since the object's current reaction began. */
  reactionAge(id: string): number | undefined {
    const tick = this.#reactions.activatedTick(id);
    return tick === undefined ? undefined : this.simulationTick - tick;
  }

  activateObject(id: string): boolean {
    const chunk = chunkOfEntityId(id);
    if (
      chunk === undefined ||
      chunk < this.track.firstChunkIndex ||
      chunk > this.track.lastChunkIndex ||
      !this.#reactions.activate(id, this.simulationTick)
    ) {
      return false;
    }
    this.#emit({ type: 'objectReacted', id });
    return true;
  }

  requestHorn(): boolean {
    if (!this.#horn.tryPass(this.simulationTick)) return false;
    this.#emit({ type: 'horn' });
    return true;
  }

  #emit(event: RideEvent): void {
    this.#events.push(event);
    if (this.#events.length > MAX_PENDING_EVENTS) this.#events.shift();
  }

  drainEvents(): RideEvent[] {
    const events = this.#events;
    this.#events = [];
    return events;
  }
}
