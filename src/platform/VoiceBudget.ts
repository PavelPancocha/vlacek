export type VoiceKind = 'oneShot' | 'loop';

/**
 * Bounded audio voices (doc 07 §6, doc 13 `audio`): a new sound is refused
 * when its kind or the total is at the limit; nothing queues up.
 */
export class VoiceBudget {
  readonly #limits: {
    maxVoices: number;
    maxLoopVoices: number;
    maxOneShotVoices: number;
  };
  #oneShots = 0;
  #loops = 0;

  constructor(limits: {
    maxVoices: number;
    maxLoopVoices: number;
    maxOneShotVoices: number;
  }) {
    this.#limits = limits;
  }

  get active(): number {
    return this.#oneShots + this.#loops;
  }

  acquire(kind: VoiceKind): boolean {
    if (this.active >= this.#limits.maxVoices) return false;
    if (kind === 'loop') {
      if (this.#loops >= this.#limits.maxLoopVoices) return false;
      this.#loops += 1;
    } else {
      if (this.#oneShots >= this.#limits.maxOneShotVoices) return false;
      this.#oneShots += 1;
    }
    return true;
  }

  release(kind: VoiceKind): void {
    if (kind === 'loop') this.#loops = Math.max(0, this.#loops - 1);
    else this.#oneShots = Math.max(0, this.#oneShots - 1);
  }
}
