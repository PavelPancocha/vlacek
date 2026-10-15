import type { MotionIntent } from '../../domain/input/InputReducer.ts';
import { EmissionClock } from './emission.ts';
import type { EmitOptions, ParticleField } from './ParticleField.ts';
import { kindIndex, type ParticleKindName } from './particleKinds.ts';

/** Locomotive emitter in render coordinates, tilted with the vehicle. */
export interface PlacedEmitter {
  kind: 'steam' | 'diesel' | 'stars' | 'bubbles' | 'rainbow';
  x: number;
  y: number;
  tiltDeg: number;
}

export interface TrainEffectsInput {
  /** Simulation time since the last frame; 0 while paused. */
  dtSec: number;
  speedUPerSec: number;
  /** +1 drives right (the player's train), −1 left (oncoming trains). */
  travelDirection: 1 | -1;
  maxSpeedUPerSec: number;
  intent: MotionIntent;
  /** Emitters of the locomotive; none for an electric one. */
  emitters: readonly PlacedEmitter[];
  /** Radius of the steam locomotive's driving wheels (exhaust beats). */
  driverRadiusU: number | undefined;
  /** Wheel–rail contact points of drawn vehicles (brake sparks). */
  wheels: readonly { x: number; y: number }[];
  /** Where an electric locomotive's pantograph touches the wire. */
  pantograph?:
    | { x: number; y: number; outOfRange?: boolean; tiltDeg?: number }
    | undefined;
  /** Actual supports; each is also a junction of drawn wire spans (D-016). */
  catenarySupportXs?: readonly number[];
  /** seasons-life hook: set from effective winter climate, not ground decoration. */
  frostyWire?: boolean;
  /** Front wheels of the locomotive and the ground under them. */
  front: { x: number; y: number; ground: 'snow' | 'leaves' | undefined };
  /** 1 standard, 0.5 for the low quality profile (doc 13). */
  rateScale: number;
  /** Each bogie uses its local seasonal ground and continuous intensity. */
  groundAt?: (
    worldXU: number,
  ) => { kind: 'snow' | 'leaves'; strength: number } | undefined;
  /** False for a source point behind this train's rock cover. */
  canEmit?: (point: { x: number; y: number }) => boolean;
  /** Drawing layer of this train, retained by particles after entry. */
  depth?: number;
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
/** A slowly coasting contact is quiet; traction can spark at the first movement. */
const CONTACT_COAST_MIN_SHARE = 0.2;
const CONTACT_MAX_DT_SEC = 0.25;
/** Snow and leaves only above this speed (u/s). */
const STIR_MIN_SPEED = 40;
const SNOW_PER_SEC = 70;
const LEAVES_PER_SEC = 10;
/** Share of the train's speed a puff keeps when it leaves the chimney. */
const PUFF_INHERIT = 0.3;

/**
 * The train's particles (doc 14 §4): smoke in exhaust beats of the steam
 * locomotive's driving wheels and white steam when it starts off, diesel
 * exhaust under throttle, stars from the fairy-tale chimney, rare brake sparks
 * and gentle contact flicker at an electric pantograph, and snow or
 * leaves stirred up only where they lie and only while moving. Pure: time,
 * state and randomness come in.
 */
export class TrainEffects {
  readonly #field: ParticleField;
  readonly #random: () => number;
  readonly #clocks = new Map<string, EmissionClock>();
  #contactCarry = 0;
  #lastContactX: number | undefined;
  #contactStopped = false;
  readonly #contactAnchor = { x: 0, y: 0, active: false };
  readonly #contactOptions: EmitOptions = {};
  readonly #glowOptions: EmitOptions = { anchor: this.#contactAnchor };

  constructor(field: ParticleField, random: () => number) {
    this.#field = field;
    this.#random = random;
  }

  /** New journey: discard the previous train's fractional emission clocks. */
  reset(): void {
    this.#clocks.clear();
    this.#resetContact();
    this.#contactAnchor.active = false;
  }

  /** Emits this frame's particles; returns the count per kind. */
  step(input: TrainEffectsInput): Map<string, number> {
    // Use the rendered contact on every frame, including zero-tick interpolation.
    // ParticleField ages the glow after emission but never extrapolates it ahead.
    const contact = input.pantograph;
    this.#contactAnchor.active = contact !== undefined && !contact.outOfRange;
    if (contact) {
      this.#contactAnchor.x = contact.x;
      this.#contactAnchor.y = contact.y;
    }
    const emitted = new Map<string, number>();
    const dt = input.dtSec;
    if (dt <= 0) {
      // Interpolation renders may have no simulation tick even while driving.
      // A paused/reset ride is stationary; only that clears contact carry.
      if (input.speedUPerSec <= 1) {
        this.#resetContact();
        this.#contactStopped = true;
      }
      return emitted;
    }
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
      if (count <= 0 || input.canEmit?.({ x, y }) === false) return;
      const n = this.#field.emit(kindIndex(kind), x, y, count, {
        ...options,
        ...(input.depth === undefined ? {} : { depth: input.depth }),
      });
      emitted.set(kind, (emitted.get(kind) ?? 0) + n);
    };
    const clock = (key: string) => {
      let found = this.#clocks.get(key);
      if (!found) {
        found = new EmissionClock(
          key.startsWith('ground:') ? this.#random() : 0,
        );
        this.#clocks.set(key, found);
      }
      return found;
    };

    for (const [i, emitter] of input.emitters.entries()) {
      const puff = {
        vxU: input.travelDirection * speed * PUFF_INHERIT,
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
      } else if (emitter.kind === 'stars') {
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
      } else if (emitter.kind === 'bubbles' || emitter.kind === 'rainbow') {
        const bubble = emitter.kind === 'bubbles';
        emit(
          bubble ? 'bubble' : 'rainbow-puff',
          emitter.x,
          emitter.y,
          clock(`${emitter.kind}${i}`).tick(
            (bubble ? 3 : 4) * (1 + share) * scale,
            dt,
          ),
          { ...puff, vxU: input.travelDirection * speed * 0.05 },
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

    this.#sparkContact(input, emitted);

    // Snow or leaves where they lie, only while moving.
    if (input.groundAt && speed > STIR_MIN_SPEED) {
      const points = input.wheels;
      // Reserve 30% of the existing snow rate for the trailing contact. Uniform
      // division across a long train otherwise leaves gaps behind its last car.
      let rear = points[0];
      for (const wheel of points)
        if (
          !rear ||
          input.travelDirection * wheel.x < input.travelDirection * rear.x
        )
          rear = wheel;
      for (const [i, wheel] of points.entries()) {
        const surface = input.groundAt(wheel.x);
        if (!surface) continue;
        const rate =
          (surface.kind === 'snow' ? SNOW_PER_SEC : LEAVES_PER_SEC) *
          share *
          surface.strength *
          scale *
          (surface.kind === 'snow'
            ? 0.7 / Math.max(1, points.length) + (wheel === rear ? 0.3 : 0)
            : 1 / Math.max(1, points.length));
        emit(
          surface.kind === 'snow' ? 'snow' : 'leaf',
          wheel.x,
          wheel.y,
          clock(`ground:${i}`).tick(rate, dt),
          {
            jitterU: 4,
            vxU: -input.travelDirection * speed * 0.08,
            sizeScale: surface.kind === 'snow' ? 1.5 : 1,
          },
        );
      }
    }
    const ground = input.groundAt ? undefined : input.front.ground;
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

  #resetContact(): void {
    this.#contactCarry = 0;
    this.#lastContactX = undefined;
    this.#contactStopped = false;
  }

  /** One calm burst at most per game step; reuses options and scalar state. */
  #sparkContact(input: TrainEffectsInput, emitted: Map<string, number>): void {
    const contact = input.pantograph;
    if (!contact || contact.outOfRange || input.dtSec >= CONTACT_MAX_DT_SEC) {
      this.#resetContact();
      return;
    }
    const speed = Math.max(0, input.speedUPerSec);
    const share = Math.min(1, speed / Math.max(1, input.maxSpeedUPerSec));
    const pulling = input.intent === 'THROTTLE';
    const started = this.#contactStopped && speed > 1 && pulling;
    this.#contactStopped = speed <= 1;
    const previousX = this.#lastContactX;
    this.#lastContactX = contact.x;
    if (
      speed <= 1 ||
      input.intent === 'BRAKE' ||
      (!pulling && share <= CONTACT_COAST_MIN_SHARE)
    ) {
      this.#contactCarry = 0;
      return;
    }
    let passedSupport = false;
    if (previousX !== undefined && input.catenarySupportXs)
      for (const x of input.catenarySupportXs) {
        if (
          input.travelDirection === 1
            ? previousX < x && contact.x >= x
            : previousX > x && contact.x <= x
        ) {
          passedSupport = true;
          break;
        }
      }
    const rate =
      (0.8 + 1.4 * share) *
      (pulling ? 1.25 : 1) *
      (input.frostyWire ? 1.25 : 1) *
      input.rateScale;
    this.#contactCarry += rate * input.dtSec;
    const special = started || passedSupport;
    if (!special && this.#contactCarry < 1) return;
    // Drop whole events instead of carrying a hitch or a support burst forward.
    this.#contactCarry = special ? 0 : this.#contactCarry % 1;
    if (input.canEmit?.(contact) === false) return;
    const low = input.rateScale < 1;
    const options = this.#contactOptions;
    if (input.depth === undefined) delete options.depth;
    else options.depth = input.depth;
    options.sizeScale = special ? 1.2 : 1;
    options.directionOffsetDeg =
      (contact.tiltDeg ?? 0) + (input.travelDirection === -1 ? 180 : 0);
    const count = this.#field.emit(
      kindIndex('contact-spark'),
      contact.x,
      contact.y,
      (special ? 6 : 4) / (low ? 2 : 1),
      options,
    );
    emitted.set('contact-spark', count);
    const glow = this.#glowOptions;
    if (input.depth === undefined) delete glow.depth;
    else glow.depth = input.depth;
    glow.sizeScale = (special ? 1.14 : 1) * (low ? 0.5 : 1);
    emitted.set(
      'contact-glow',
      this.#field.emit(
        kindIndex('contact-glow'),
        contact.x,
        contact.y,
        1,
        glow,
      ),
    );
  }
}

/**
 * Effects of the oncoming trains, one `TrainEffects` per train: two trains
 * can overlap (doc 05 §6), and a shared emission clock would hand one
 * train's puffs to the other by stepping order. A finished train's state
 * is dropped with it.
 */
export class TrainEffectsByTrain {
  readonly #field: ParticleField;
  readonly #random: () => number;
  readonly #trains = new Map<string, TrainEffects>();

  constructor(field: ParticleField, random: () => number) {
    this.#field = field;
    this.#random = random;
  }

  /** Emits this frame's particles of train `id`; see `TrainEffects`. */
  step(id: string, input: TrainEffectsInput): Map<string, number> {
    let effects = this.#trains.get(id);
    if (!effects) {
      effects = new TrainEffects(this.#field, this.#random);
      this.#trains.set(id, effects);
    }
    return effects.step(input);
  }

  /** Forgets the trains that are no longer running. */
  retain(running: ReadonlySet<string>): void {
    for (const id of this.#trains.keys())
      if (!running.has(id)) this.#trains.delete(id);
  }

  clear(): void {
    this.#trains.clear();
  }

  /** Trains with effect state (diagnostics, tests). */
  get size(): number {
    return this.#trains.size;
  }
}
