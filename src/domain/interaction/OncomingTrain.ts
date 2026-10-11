import type { GameConfig } from '../../config/gameConfig.ts';
import {
  layoutConsist,
  poseVehicle,
  type ConsistLayout,
  type VehiclePose,
} from '../train/TrainGeometry.ts';
import { unitRandom } from '../world/Hash.ts';
import {
  SECONDARY_SCALE,
  SecondaryLine,
  type SecondarySite,
} from '../world/SecondaryTrack.ts';
import { TRACK_GENERATOR_VERSION } from '../world/TrackProfile.ts';

/** A catalog vehicle the oncoming train may be made of. */
export interface NpcVehicle {
  id: string;
  lengthU: number;
  bogieOffsetU: number;
  wheelRadiusU: number;
}

/** Vehicles for oncoming trains: steam or diesel locomotives, wagons. */
export interface NpcFleet {
  locomotives: readonly NpcVehicle[];
  wagons: readonly NpcVehicle[];
}

/**
 * The oncoming train on a second track (doc 05 §6): a steam or diesel
 * locomotive with 1–5 wagons at a constant 100–160 u/s, chosen by the seed.
 * It drives right to left (d = −1): vehicle i is at `headS +
 * centerOffsetsU[i]`, wagons to the right of the locomotive. It starts
 * whole in the hidden right part of its line, comes out of the right
 * portal, crosses the visible stretch and is done once its last vehicle
 * is hidden in the left portal. Laid out at the deeper layer's scale.
 * Never on the player's track: it has its own line. Pure.
 */
export class OncomingTrain {
  readonly id: string;
  readonly site: SecondarySite;
  readonly vehicles: readonly NpcVehicle[];
  readonly layout: ConsistLayout;
  readonly speedUPerSec: number;
  readonly line: SecondaryLine;
  /** Arc coordinate of the locomotive's centre on its line. */
  headS: number;
  readonly #startS: number;

  constructor(
    seed: number,
    site: SecondarySite,
    fleet: NpcFleet,
    config: GameConfig,
  ) {
    this.id = `${site.id}:train`;
    this.site = site;
    const { interaction, world, train } = config;
    const roll = (key: string, n = 0) =>
      unitRandom(seed, TRACK_GENERATOR_VERSION, key, site.id, n);
    const pick = (from: readonly NpcVehicle[], key: string, n = 0) => {
      const vehicle = from[Math.floor(roll(key, n) * from.length)];
      if (!vehicle) throw new RangeError('No vehicles for an oncoming train');
      return vehicle;
    };
    const wagonCount =
      1 + Math.floor(roll('npc-wagons') * interaction.npcTrainMaxWagons);
    const chosen = [
      pick(fleet.locomotives, 'npc-loco'),
      ...Array.from({ length: wagonCount }, (_, i) =>
        pick(fleet.wagons, 'npc-wagon', i),
      ),
    ];
    this.vehicles = chosen.map((vehicle) => ({
      id: vehicle.id,
      lengthU: vehicle.lengthU * SECONDARY_SCALE,
      bogieOffsetU: vehicle.bogieOffsetU * SECONDARY_SCALE,
      wheelRadiusU: vehicle.wheelRadiusU * SECONDARY_SCALE,
    }));
    this.speedUPerSec =
      interaction.npcTrainMinSpeedUPerSec +
      (interaction.npcTrainMaxSpeedUPerSec -
        interaction.npcTrainMinSpeedUPerSec) *
        roll('npc-speed');
    this.layout = layoutConsist(
      this.vehicles,
      train.couplerGapU * SECONDARY_SCALE,
    );
    // Hidden ends hold the whole train plus a margin (doc 04 §7).
    const lengthU = this.layout.frontOffsetU + this.layout.tailOffsetU;
    this.line = new SecondaryLine(
      seed,
      site,
      lengthU + world.npcHiddenPathMarginU,
    );
    // The locomotive's front end just inside the right portal.
    this.headS = this.line.sAtX(site.toX) + this.layout.frontOffsetU + 1;
    this.#startS = this.headS;
  }

  /** Distance driven so far (turns the wheels). */
  get travelledU(): number {
    return this.#startS - this.headS;
  }

  step(dtSec: number): void {
    if (!this.done) this.headS -= this.speedUPerSec * dtSec;
  }

  /** The last vehicle is hidden in the left portal. */
  get done(): boolean {
    return this.xSpan().maxX <= this.site.fromX;
  }

  vehiclePose(index: number): VehiclePose {
    const vehicle = this.vehicles[index];
    const offset = this.layout.centerOffsetsU[index];
    if (!vehicle || offset === undefined)
      throw new RangeError(`No vehicle ${index}`);
    return poseVehicle(
      (s) => this.line.sample(s),
      this.headS + offset,
      vehicle,
    );
  }

  /** World x interval of the whole train, front end to tail end. */
  xSpan(): { minX: number; maxX: number } {
    return {
      minX: this.line.sample(this.headS - this.layout.frontOffsetU).x,
      maxX: this.line.sample(this.headS + this.layout.tailOffsetU).x,
    };
  }
}
