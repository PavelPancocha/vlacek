import { VoiceBudget } from './VoiceBudget.ts';

export type SoundId =
  'horn-steam' | 'horn-diesel' | 'horn-fantasy' | 'reaction' | 'train-full';

interface Tone {
  type: OscillatorType;
  frequencies: readonly number[];
  durationSec: number;
  volume: number;
  glideTo?: number;
}

/** PLACEHOLDER sounds synthesized with Web Audio (no audio files yet). */
const TONES: Record<SoundId, Tone> = {
  'horn-steam': {
    type: 'sine',
    frequencies: [880, 1108],
    durationSec: 0.7,
    volume: 0.18,
  },
  'horn-diesel': {
    type: 'triangle',
    frequencies: [220, 277, 330],
    durationSec: 0.8,
    volume: 0.16,
  },
  'horn-fantasy': {
    type: 'sine',
    frequencies: [1046, 1318, 1568],
    durationSec: 0.6,
    volume: 0.12,
  },
  reaction: {
    type: 'sine',
    frequencies: [620],
    durationSec: 0.25,
    volume: 0.15,
    glideTo: 420,
  },
  'train-full': {
    type: 'sine',
    frequencies: [196],
    durationSec: 0.3,
    volume: 0.12,
  },
};

/**
 * Owns the single AudioContext (doc 09 §6). It is created and resumed only
 * from a user gesture, suspended on pause or hidden page and never resumed
 * automatically. Failures keep the game silent but playable.
 */
export class AudioManager {
  #context: AudioContext | undefined;
  #failed = false;
  readonly #budget = new VoiceBudget({
    maxVoices: 8,
    maxLoopVoices: 3,
    maxOneShotVoices: 5,
  });

  get state(): 'locked' | 'running' | 'suspended' | 'unavailable' {
    if (this.#failed) return 'unavailable';
    if (!this.#context) return 'locked';
    return this.#context.state === 'running' ? 'running' : 'suspended';
  }

  /** Call from inside a pointerdown/keydown handler. */
  unlock(): void {
    if (this.#failed) return;
    try {
      this.#context ??= new AudioContext();
      if (this.#context.state === 'suspended')
        void this.#context.resume().catch(() => undefined);
    } catch {
      this.#failed = true;
    }
  }

  suspend(): void {
    if (this.#context?.state === 'running')
      void this.#context.suspend().catch(() => undefined);
  }

  play(id: SoundId): void {
    const context = this.#context;
    if (!context || context.state !== 'running') return;
    if (!this.#budget.acquire('oneShot')) return;
    const tone = TONES[id];
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.durationSec);
    gain.connect(context.destination);
    let remaining = tone.frequencies.length;
    for (const frequency of tone.frequencies) {
      const oscillator = context.createOscillator();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (tone.glideTo !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(
          tone.glideTo,
          now + tone.durationSec,
        );
      }
      oscillator.connect(gain);
      oscillator.addEventListener(
        'ended',
        () => {
          oscillator.disconnect();
          remaining -= 1;
          if (remaining === 0) {
            gain.disconnect();
            this.#budget.release('oneShot');
          }
        },
        { once: true },
      );
      oscillator.start(now);
      oscillator.stop(now + tone.durationSec + 0.02);
    }
  }

  dispose(): void {
    void this.#context?.close().catch(() => undefined);
    this.#context = undefined;
  }
}
