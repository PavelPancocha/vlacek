import type { MotionIntent } from '../../domain/input/InputReducer.ts';
import { EmissionClock } from './emission.ts';
import type { ParticleField } from './ParticleField.ts';
import { kindIndex, type ParticleKindName } from './particleKinds.ts';

/** Locomotive emitter in render coordinates, tilted with the vehicle. */
export interface PlacedEmitter {
  kind: 'steam' | 'diesel' | 'stars';
  x: number;
  y: number;
  tiltDeg: number;
}

export interface TrainEffectsInput {
  /** Simulation time since the last frame; 0 while paused. */
  dtSec: number;
  speedUPerSec: number;
  maxSpeedUPerSec: number;
  intent: MotionIntent;
  /** Emitters of the locomotive; none for an electric one. */
  emitters: readonly PlacedEmitter[];
  /** Radius of the steam locomotive's driving wheels (exhaust beats). */
  driverRadiusU: number | undefined;
  /** Wheel–rail contact points of drawn vehicles (brake sparks). */
  wheels: readonly { x: number; y: number }[];
  /** Where an electric locomotive's pantograph touches the wire. */
  pantograph?: { x: number; y: number };
  /** Front wheels of the locomotive and the ground under them. */
  front: { x: number; y: number; ground: 'snow' | 'leaves' | undefined };
  /** 1 standard, 0.5 for the low quality profile (doc 13). */
  rateScale: number;
}

/** Four exhaust beats per revolution of the driving wheels. */
const BEATS_PER_REVOLUTION = 4;
/** Standing steam locomotive: a gentle wisp and a little smoke. */
const IDLE_STEAM_PER_SEC = 1.2;
const IDLE_SMOKE_PER_SEC = 0.5;
/** Extra white steam while starting off (throttle below this speed share). */
const START_OFF_SHARE = 0.4;
const START_OFF_STEAM_PER_SEC = 6;
const DIESEL_IDLE_PER_SEC = 3;
const DIESEL_PULL_PER_SEC = 9;
const STARS_PER_SEC = 4;
const STARS_PER_SPEED = 4;
/** Sparks only when braking above this share of the top speed. */
const SPARK_MIN_SHARE = 0.3;
const SPARK_EVENTS_PER_SEC = 4;
/** Now and then a spark at the pantograph, above this speed share. */
const PANTOGRAPH_SPARK_MIN_SHARE = 0.3;
const PANTOGRAPH_SPARKS_PER_SEC = 0.35;
/** Snow and leaves only above this speed (u/s). */
const STIR_MIN_SPEED = 40;
const SNOW_PER_SEC = 70;
const LEAVES_PER_SEC = 10;
/** Share of the train's speed a puff keeps when it leaves the chimney. */
const PUFF_INHERIT = 0.3;

/**
 * The train's particles (doc 14 §4): smoke in exhaust beats of the steam
 * locomotive's driving wheels and white steam when it starts off, diesel
 * exhaust under throttle, stars from the fairy-tale chimney, rare sparks
 * when braking hard or at an electric locomotive's pantograph, and snow or
 * leaves stirred up only where they lie and only while moving. Pure: time,
 * state and randomness come in.
 */
export class TrainEffects {
  readonly #field: ParticleField;
  readonly #random: () => number;
  readonly #clocks = new Map<string, EmissionClock>();

  constructor(field: ParticleField, random: () => number) {
    this.#field = field;
    this.#random = random;
  }

  /** Emits this frame's particles; returns the count per kind. */
  step(input: TrainEffectsInput): Map<string, number> {
    const emitted = new Map<string, number>();
    const dt = input.dtSec;
    if (dt <= 0) return emitted;
    const scale = input.rateScale;
    const speed = Math.max(0, input.speedUPerSec);
    const share = speed / Math.max(1, input.maxSpeedUPerSec);
    const emit = (
      kind: ParticleKindName,
      x: number,
      y: number,
      count: number,
      options: Parameters<ParticleField['emit']>[4] = {},
    ) => {
      if (count <= 0) return;
      const n = this.#field.emit(kindIndex(kind), x, y, count, options);
      emitted.set(kind, (emitted.get(kind) ?? 0) + n);
    };
    const clock = (key: string) => {
      let found = this.#clocks.get(key);
      if (!found) {
        found = new EmissionClock();
        this.#clocks.set(key, found);
      }
      return found;
    };

    for (const [i, emitter] of input.emitters.entries()) {
      const puff = {
        vxU: speed * PUFF_INHERIT,
        jitterU: 1.5,
        directionOffsetDeg: emitter.tiltDeg,
      };
      if (emitter.kind === 'steam') {
        const radius = input.driverRadiusU ?? 12;
        const beatsPerU = BEATS_PER_REVOLUTION / (2 * Math.PI * radius);
        emit(
          'smoke',
          emitter.x,
          emitter.y,
          clock(`beat${i}`).tick(beatsPerU * scale, speed * dt, 12),
          { ...puff, sizeScale: 1 + 0.3 * share },
        );
        if (speed < 1) {
          emit(
            'smoke',
            emitter.x,
            emitter.y,
            clock(`idle-smoke${i}`).tick(IDLE_SMOKE_PER_SEC * scale, dt),
            puff,
          );
          emit(
            'steam',
            emitter.x,
            emitter.y,
            clock(`idle-steam${i}`).tick(IDLE_STEAM_PER_SEC * scale, dt),
            { ...puff, sizeScale: 0.6 },
          );
        }
        if (input.intent === 'THROTTLE' && share < START_OFF_SHARE)
          emit(
            'steam',
            emitter.x,
            emitter.y,
            clock(`start${i}`).tick(START_OFF_STEAM_PER_SEC * scale, dt),
            { ...puff, sizeScale: 1.2 },
          );
      } else if (emitter.kind === 'diesel') {
        const pulling = input.intent === 'THROTTLE';
        const rate = pulling
          ? DIESEL_IDLE_PER_SEC + DIESEL_PULL_PER_SEC
          : DIESEL_IDLE_PER_SEC;
        emit(
          'diesel',
          emitter.x,
          emitter.y,
          clock(`diesel${i}`).tick(rate * scale, dt),
          { ...puff, sizeScale: pulling ? 1.4 : 1 },
        );
      } else {
        emit(
          'star',
          emitter.x,
          emitter.y,
          clock(`stars${i}`).tick(
            (STARS_PER_SEC + STARS_PER_SPEED * share) * scale,
            dt,
          ),
          puff,
        );
      }
    }

    // Brake sparks: a few at a random wheel, only when braking hard.
    if (
      input.intent === 'BRAKE' &&
      share > SPARK_MIN_SHARE &&
      input.wheels.length > 0
    ) {
      const strength = (share - SPARK_MIN_SHARE) / (1 - SPARK_MIN_SHARE);
      const events = clock('sparks').tick(
        SPARK_EVENTS_PER_SEC * strength * scale,
        dt,
      );
      for (let e = 0; e < events; e++) {
        const wheel =
          input.wheels[Math.floor(this.#random() * input.wheels.length)];
        if (wheel)
          emit('spark', wheel.x, wheel.y, 2 + Math.floor(this.#random() * 2));
      }
    }

    // Now and then a spark where the pantograph slides along the wire.
    const contact = input.pantograph;
    if (contact && share > PANTOGRAPH_SPARK_MIN_SHARE) {
      const events = clock('pantograph').tick(
        PANTOGRAPH_SPARKS_PER_SEC * share * scale,
        dt,
      );
      for (let e = 0; e < events; e++)
        emit('spark', contact.x, contact.y, 1 + Math.floor(this.#random() * 2));
    }

    // Snow or leaves where they lie, only while moving.
    const ground = input.front.ground;
    if (ground !== undefined && speed > STIR_MIN_SPEED) {
      const rate = (ground === 'snow' ? SNOW_PER_SEC : LEAVES_PER_SEC) * share;
      emit(
        ground === 'snow' ? 'snow' : 'leaf',
        input.front.x,
        input.front.y,
        clock(ground).tick(rate * scale, dt),
        { jitterU: 4 },
      );
    }
    return emitted;
  }
}
