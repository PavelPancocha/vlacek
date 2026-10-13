import { soundTones } from '../content/soundTones.ts';
import { VoiceBudget } from './VoiceBudget.ts';

/**
 * Owns the single AudioContext (doc 09 §6). It is created and resumed only
 * from a user gesture, suspended on pause or hidden page and never resumed
 * automatically. Failures keep the game silent but playable.
 */
export class AudioManager {
  #context: AudioContext | undefined;
  #failed = false;
  readonly #voices = new Set<() => void>();
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

  /** Stop/disconnect all sources and release their budget; never unlock or resume. */
  stopAll(): void {
    for (const stop of this.#voices) stop();
  }

  play(id: string): void {
    const context = this.#context;
    const tone = Object.hasOwn(soundTones, id) ? soundTones[id] : undefined;
    if (!context || context.state !== 'running' || !tone) return;
    if (!this.#budget.acquire('oneShot')) return;
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(tone.volume, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.durationSec);
    gain.connect(context.destination);
    const oscillators = new Set<OscillatorNode>();
    const release = () => {
      gain.disconnect();
      this.#budget.release('oneShot');
      this.#voices.delete(stop);
    };
    const stop = () => {
      for (const oscillator of oscillators) {
        oscillator.stop();
        oscillator.disconnect();
      }
      // Late ended events must not release the next journey's voice budget.
      oscillators.clear();
      release();
    };
    this.#voices.add(stop);
    for (const frequency of tone.frequencies) {
      const oscillator = context.createOscillator();
      oscillators.add(oscillator);
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
          if (!oscillators.delete(oscillator)) return;
          oscillator.disconnect();
          if (oscillators.size === 0) release();
        },
        { once: true },
      );
      oscillator.start(now);
      oscillator.stop(now + tone.durationSec + 0.02);
    }
  }

  dispose(): void {
    this.stopAll();
    void this.#context?.close().catch(() => undefined);
    this.#context = undefined;
  }
}
