import { soundManifest, type SoundClip } from '../content/soundManifest.ts';
import { audioFileUrl } from '../content/audioFiles.ts';
import { VoiceBudget, type VoiceKind } from './VoiceBudget.ts';

export interface AudioLayer {
  key: string;
  id: string;
  gain: number;
  rate: number;
  priority: number;
  /** Distance-triggered chuffs share one scheduled engine voice. */
  pulsed?: boolean;
}
interface Voice {
  key: string;
  id: string;
  kind: VoiceKind;
  priority: number;
  gain: GainNode;
  source: AudioBufferSourceNode | undefined;
  strokes: Map<AudioBufferSourceNode, GainNode>;
}

/** One gesture-owned context; no automatic resume, external server or audio clock. */
export class AudioManager {
  #context: AudioContext | undefined;
  #resuming: Promise<void> | undefined;
  #filter: BiquadFilterNode | undefined;
  #delay: DelayNode | undefined;
  #echo: GainNode | undefined;
  #failed = false;
  #enabled = true;
  #epoch = 0;
  #covered = 0;
  #fadeSequence = 0;
  readonly #buffers = new Map<string, AudioBuffer>();
  readonly #loading = new Map<
    string,
    {
      controller: AbortController;
      promise: Promise<AudioBuffer | undefined>;
    }
  >();
  readonly #requests = new Set<AbortController>();
  readonly #pendingLayers = new Map<string, number>();
  readonly #failures = new Map<string, string>();
  readonly #voices = new Map<string, Voice>();
  readonly #layers = new Map<string, AudioLayer>();
  readonly #played: string[] = [];
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
  get diagnostics() {
    return {
      active: [...this.#voices.values()].map((v) => ({
        id: v.id,
        kind: v.kind,
        key: v.key,
      })),
      played: [...this.#played],
      loaded: this.#buffers.size,
      pending: this.#loading.size,
      pendingLayers: this.#pendingLayers.size,
      failures: [...this.#failures].map(([file, reason]) => ({ file, reason })),
      covered: this.#covered,
    };
  }

  /** Only call inside a pointerdown/keydown handler, including the sound toggle. */
  unlock(): void {
    if (this.#failed || !this.#enabled) return;
    try {
      if (!this.#context) {
        const context = new AudioContext();
        this.#context = context;
        this.#filter = context.createBiquadFilter();
        this.#filter.type = 'lowpass';
        this.#filter.frequency.value = 18000;
        this.#filter.connect(context.destination);
        this.#delay = context.createDelay(0.2);
        this.#delay.delayTime.value = 0.09;
        this.#echo = context.createGain();
        this.#echo.gain.value = 0;
        this.#filter.connect(this.#delay);
        this.#delay.connect(this.#echo);
        this.#echo.connect(context.destination);
      }
      if (this.#context.state === 'suspended') {
        this.#resuming = this.#context
          .resume()
          .catch(() => {
            this.#failures.set('context', 'resume failed');
          })
          .finally(() => {
            this.#resuming = undefined;
          });
      }
    } catch {
      this.#failed = true;
      this.#failures.set('context', 'AudioContext unavailable');
    }
  }
  setEnabled(enabled: boolean): void {
    if (this.#enabled === enabled) return;
    this.#enabled = enabled;
    if (!enabled) this.suspend();
  }
  suspend(): void {
    this.#epoch += 1;
    this.#resuming = undefined;
    this.#layers.clear();
    for (const voice of [...this.#voices.values()]) this.#stop(voice);
    if (this.#context?.state === 'running')
      void this.#context
        .suspend()
        .catch(() => this.#failures.set('context', 'suspend failed'));
  }
  /** Release every old-journey source and async consumer without resuming the context. */
  stopAll(): void {
    this.#epoch += 1;
    this.#resuming = undefined;
    this.#layers.clear();
    for (const request of this.#requests) request.abort();
    this.#requests.clear();
    this.#loading.clear();
    this.#pendingLayers.clear();
    for (const voice of [...this.#voices.values()]) this.#stop(voice);
    this.setCovered(0);
  }

  #clip(id: string): SoundClip | undefined {
    return Object.hasOwn(soundManifest, id) ? soundManifest[id] : undefined;
  }
  async #load(clip: SoundClip): Promise<AudioBuffer | undefined> {
    const context = this.#context;
    if (!context || !this.#enabled) return undefined;
    const cached = this.#buffers.get(clip.file);
    if (cached) return cached;
    if (this.#failures.has(clip.file)) return undefined;
    const pending = this.#loading.get(clip.file);
    if (pending) return pending.promise;
    const epoch = this.#epoch;
    const controller = new AbortController();
    this.#requests.add(controller);
    const request = (async () => {
      try {
        const response = await fetch(audioFileUrl(clip.file), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        // Muting during a fetch must not start decoding or late playback.
        if (
          !this.#enabled ||
          this.#context !== context ||
          this.#epoch !== epoch
        )
          return undefined;
        const buffer = await context.decodeAudioData(bytes);
        if (this.#context !== context || controller.signal.aborted)
          return undefined;
        this.#buffers.set(clip.file, buffer);
        return buffer;
      } catch (error) {
        if (this.#context === context && !controller.signal.aborted)
          this.#failures.set(
            clip.file,
            error instanceof Error ? error.message : 'decode failed',
          );
        return undefined;
      } finally {
        this.#requests.delete(controller);
        if (this.#loading.get(clip.file)?.controller === controller)
          this.#loading.delete(clip.file);
      }
    })();
    this.#loading.set(clip.file, { controller, promise: request });
    return request;
  }
  #reserve(kind: VoiceKind, priority: number): boolean {
    if (this.#budget.acquire(kind)) return true;
    const victim = [...this.#voices.values()]
      .filter((v) => v.kind === kind && v.priority < priority)
      .sort((a, b) => a.priority - b.priority)[0];
    if (!victim) return false;
    this.#stop(victim);
    return this.#budget.acquire(kind);
  }
  #voice(
    key: string,
    id: string,
    kind: VoiceKind,
    priority: number,
    clip: SoundClip,
  ): Voice | undefined {
    const context = this.#context;
    if (!context || !this.#reserve(kind, priority)) return undefined;
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(
      (clip.category === 'engine' || clip.category === 'wheels') && this.#filter
        ? this.#filter
        : context.destination,
    );
    const voice: Voice = {
      key,
      id,
      kind,
      priority,
      gain,
      source: undefined,
      strokes: new Map(),
    };
    this.#voices.set(key, voice);
    return voice;
  }
  #remember(id: string): void {
    this.#played.push(id);
    if (this.#played.length > 32) this.#played.shift();
  }
  #stop(voice: Voice): void {
    if (this.#voices.get(voice.key) !== voice) return;
    this.#voices.delete(voice.key);
    this.#budget.release(voice.kind);
    voice.source?.stop();
    voice.source?.disconnect();
    for (const [stroke, envelope] of voice.strokes) {
      stroke.stop();
      stroke.disconnect();
      envelope.disconnect();
    }
    voice.strokes.clear();
    voice.gain.disconnect();
  }
  play(id: string, gainFactor = 1, priority = 100, maxDelaySec?: number): void {
    const clip = this.#clip(id);
    const context = this.#context;
    if (
      !clip ||
      !context ||
      (context.state !== 'running' && !this.#resuming) ||
      !this.#enabled ||
      this.#failed
    )
      return;
    const epoch = this.#epoch;
    // Horns answer an explicit request; incidental reactions must still be timely.
    const expiresAtSec =
      context.currentTime +
      (maxDelaySec ?? (clip.category === 'horn' ? Infinity : 0.25));
    void Promise.all([this.#load(clip), this.#resuming])
      .then(([buffer]) => {
        if (
          !buffer ||
          this.#epoch !== epoch ||
          context.state !== 'running' ||
          context.currentTime > expiresAtSec ||
          !this.#enabled
        )
          return;
        const previous = this.#voices.get(`shot:${id}`);
        if (previous) {
          if (clip.category !== 'horn' || previous.priority >= priority) return;
          this.#stop(previous);
        }
        const voice = this.#voice(`shot:${id}`, id, 'oneShot', priority, clip);
        if (!voice) return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = clip.rate;
        source.connect(voice.gain);
        voice.source = source;
        voice.gain.gain.setTargetAtTime(
          clip.gain * Math.max(0, Math.min(1, gainFactor)),
          context.currentTime,
          0.015,
        );
        source.addEventListener('ended', () => this.#stop(voice), {
          once: true,
        });
        source.start();
        this.#remember(id);
      })
      .catch((error) => {
        this.#failures.set(
          `play:${id}`,
          error instanceof Error ? error.message : 'playback failed',
        );
        const voice = this.#voices.get(`shot:${id}`);
        if (voice) this.#stop(voice);
      });
  }

  /** Reconciles a bounded desired set. Priority evicts decoration for a nearby bell. */
  setLayers(layers: readonly AudioLayer[]): void {
    const context = this.#context;
    if (!context || context.state !== 'running' || !this.#enabled) return;
    this.#layers.clear();
    for (const layer of layers)
      if (layer.gain > 0) this.#layers.set(layer.key, layer);
    for (const voice of [...this.#voices.values()]) {
      if (voice.kind !== 'loop' || voice.key.startsWith('fade:')) continue;
      if (this.#layers.get(voice.key)?.id === voice.id) continue;
      if (voice.key === 'ambient' && voice.source) {
        this.#voices.delete(voice.key);
        voice.key = `fade:${this.#fadeSequence++}:${voice.id}`;
        voice.priority = 0;
        this.#voices.set(voice.key, voice);
        voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.5);
        voice.source.stop(context.currentTime + 2);
      } else this.#stop(voice);
    }
    for (const layer of [...this.#layers.values()].sort(
      (a, b) => b.priority - a.priority,
    )) {
      const clip = this.#clip(layer.id);
      if (!clip) continue;
      const voice = this.#voices.get(layer.key);
      if (voice) {
        this.#adjust(voice, layer, clip);
        continue;
      }
      if (!this.#pendingLayers.has(layer.key)) void this.#startLayer(layer.key);
    }
  }
  async #startLayer(key: string): Promise<void> {
    const context = this.#context;
    const layer = this.#layers.get(key);
    const clip = layer && this.#clip(layer.id);
    if (
      !context ||
      context.state !== 'running' ||
      !this.#enabled ||
      !layer ||
      !clip ||
      this.#failures.has(clip.file) ||
      this.#pendingLayers.has(key)
    )
      return;
    const epoch = this.#epoch;
    this.#pendingLayers.set(key, epoch);
    try {
      const buffer = await this.#load(clip);
      const desired = this.#layers.get(key);
      if (
        !buffer ||
        this.#context !== context ||
        this.#epoch !== epoch ||
        desired?.id !== layer.id ||
        this.#voices.has(key) ||
        context.state !== 'running'
      )
        return;
      const created = this.#voice(
        key,
        desired.id,
        'loop',
        desired.priority,
        clip,
      );
      if (!created) return;
      if (!desired.pulsed) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = clip.loopStartSec ?? 0;
        source.loopEnd = Math.min(
          clip.loopEndSec ?? buffer.duration,
          buffer.duration,
        );
        source.connect(created.gain);
        created.source = source;
        source.addEventListener('ended', () => this.#stop(created), {
          once: true,
        });
        source.start(0, source.loopStart);
      }
      this.#adjust(created, desired, clip);
      this.#remember(layer.id);
    } catch (error) {
      this.#failures.set(
        `play:${layer.id}`,
        error instanceof Error ? error.message : 'playback failed',
      );
      const voice = this.#voices.get(key);
      if (voice) this.#stop(voice);
    } finally {
      // A stopped journey must not delete or reconcile the new journey's consumer.
      if (this.#pendingLayers.get(key) === epoch) {
        this.#pendingLayers.delete(key);
        // A changed clip or explicit resume reconciles once, using the latest frame.
        if (
          this.#context === context &&
          (this.#layers.get(key)?.id !== layer.id || this.#epoch !== epoch)
        )
          void this.#startLayer(key);
      }
    }
  }
  #adjust(voice: Voice, layer: AudioLayer, clip: SoundClip): void {
    const now = this.#context?.currentTime ?? 0;
    voice.gain.gain.setTargetAtTime(
      clip.gain * layer.gain,
      now,
      layer.key === 'ambient' ? 0.7 : 0.08,
    );
    voice.source?.playbackRate.setTargetAtTime(
      clip.rate * layer.rate,
      now,
      0.08,
    );
  }
  chuff(durationSec: number): void {
    const context = this.#context;
    const voice = this.#voices.get('engine');
    const buffer = this.#buffers.get('steam-chuff.mp3');
    if (
      !context ||
      context.state !== 'running' ||
      !voice ||
      voice.id !== 'steam-chuff' ||
      !buffer ||
      voice.strokes.size >= 2
    )
      return;
    const source = context.createBufferSource();
    const envelope = context.createGain();
    const now = context.currentTime;
    const duration = Math.min(buffer.duration, durationSec);
    const edge = Math.min(0.015, duration / 3);
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + edge);
    envelope.gain.setValueAtTime(1, now + duration - edge);
    envelope.gain.linearRampToValueAtTime(0, now + duration);
    source.buffer = buffer;
    source.connect(envelope);
    envelope.connect(voice.gain);
    voice.strokes.set(source, envelope);
    source.addEventListener(
      'ended',
      () => {
        if (!voice.strokes.has(source)) return;
        source.disconnect();
        envelope.disconnect();
        voice.strokes.delete(source);
      },
      { once: true },
    );
    source.start(now, 0, duration);
  }
  setCovered(fraction: number): void {
    this.#covered = Math.max(0, Math.min(1, fraction));
    const now = this.#context?.currentTime ?? 0;
    this.#filter?.frequency.setTargetAtTime(
      18000 * (1100 / 18000) ** this.#covered,
      now,
      0.12,
    );
    this.#echo?.gain.setTargetAtTime(0.12 * this.#covered, now, 0.12);
  }
  dispose(): void {
    this.suspend();
    this.stopAll();
    this.#filter?.disconnect();
    this.#delay?.disconnect();
    this.#echo?.disconnect();
    void this.#context?.close().catch(() => undefined);
    this.#context = undefined;
    this.#buffers.clear();
  }
}
