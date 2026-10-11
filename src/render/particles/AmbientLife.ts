import type { ParticleField } from './ParticleField.ts';
import { kindIndex } from './particleKinds.ts';

export interface AmbientInput {
  /** Simulation time since the last frame; 0 while paused. */
  dtSec: number;
  /** Visible world rectangle (render coordinates). */
  view: { left: number; top: number; width: number; height: number };
  /** Render y of the near meadow in the middle of the view. */
  meadowY: number;
  /** A flowery meadow is in view (butterflies may come). */
  meadow: boolean;
  rateScale: number;
}

export type AmbientEvent = 'birds' | 'butterflies';

/** Seconds between two events (an event lasts less than the minimum). */
const PAUSE_SEC: readonly [number, number] = [14, 28];
const FIRST_PAUSE_SEC: readonly [number, number] = [5, 10];
/** How long an event's particles live at most. */
const EVENT_SEC = 18;

/**
 * Now and then a little life (doc 14 §4: "občas pták či motýl, ne všechno
 * současně"): a small flock of birds crossing the sky or two butterflies
 * over a flowery meadow, never two events at once. Runs on simulation
 * time, so it waits while the ride is paused. Pure.
 */
export class AmbientLife {
  readonly #field: ParticleField;
  readonly #random: () => number;
  #wait: number;
  #active: number[] = [];
  #time = 0;

  constructor(field: ParticleField, random: () => number) {
    this.#field = field;
    this.#random = random;
    this.#wait = this.#between(FIRST_PAUSE_SEC);
  }

  /** Events whose particles may still be flying. */
  get activeEvents(): number {
    return this.#active.filter((end) => end > this.#time).length;
  }

  step(input: AmbientInput): AmbientEvent | undefined {
    if (input.dtSec <= 0) return undefined;
    this.#time += input.dtSec;
    this.#active = this.#active.filter((end) => end > this.#time);
    this.#wait -= input.dtSec;
    if (this.#wait > 0 || this.#active.length > 0) return undefined;
    // Fewer events in the low quality profile.
    this.#wait =
      this.#between(PAUSE_SEC) / Math.max(0.25, Math.min(1, input.rateScale));
    const event: AmbientEvent =
      input.meadow && this.#random() < 0.5 ? 'butterflies' : 'birds';
    const { view } = input;
    if (event === 'birds') {
      const count = 2 + Math.floor(this.#random() * 3);
      const y = view.top + view.height * (0.12 + this.#random() * 0.15);
      for (let i = 0; i < count; i++)
        this.#field.emit(
          kindIndex('bird'),
          view.left + view.width + 30 + i * 26,
          y + (i % 2) * 14,
          1,
        );
    } else {
      const kind = this.#random() < 0.5 ? 'butterfly-a' : 'butterfly-b';
      const x = view.left + view.width * (0.3 + this.#random() * 0.4);
      for (let i = 0; i < 2; i++)
        this.#field.emit(
          kindIndex(kind),
          x + i * 30,
          input.meadowY + 40 + this.#random() * 60,
          1,
          { jitterU: 10 },
        );
    }
    this.#active.push(this.#time + EVENT_SEC);
    return event;
  }

  #between(range: readonly [number, number]): number {
    return range[0] + (range[1] - range[0]) * this.#random();
  }
}
