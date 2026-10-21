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
const MAX_RETIRING_SOURCES = 2;
const SHORT_FADE_SEC = 0.01;

interface Voice {
  key: string;
  layerKey: string;
  id: string;
  kind: VoiceKind;
  priority: number;
  gain: GainNode;
  source: AudioBufferSourceNode | undefined;
  strokes: Map<AudioBufferSourceNode, { envelope: GainNode; endSec: number }>;
  pendingStrokeSec: number | undefined;
  retiringStroke: AudioBufferSourceNode | undefined;
}

interface ReadyShot {
  id: string;
  clip: SoundClip;
  buffer: AudioBuffer;
  gainFactor: number;
  priority: number;
  epoch: number;
  expiresAtSec: number;
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
  // Retired envelopes own their nodes until ended, but relinquish admission slots now.
  readonly #tails = new Map<Voice, number>();
  #pendingShot: ReadyShot | undefined;
  #ambientTimeline: { id: string; startedAtSec: number } | undefined;
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
      sourceCount: [...this.#voices.values(), ...this.#tails.keys()].reduce(
        (sum, voice) => sum + this.#sourceCount(voice),
        0,
      ),
      retiring: [...this.#tails.keys()].map((voice) => ({
        key: voice.layerKey,
        sources: this.#sourceCount(voice),
      })),
      retiringSources: [...this.#tails.keys()].reduce(
        (sum, voice) => sum + this.#sourceCount(voice),
        0,
      ),
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
  /** Explicit developer-menu gesture; replaces the previous audition. */
  audition(id: string): void {
    this.stopAll();
    this.unlock();
    this.play(id, 1, 100, Infinity);
  }
  suspend(): void {
    this.#epoch += 1;
    this.#pendingShot = undefined;
    this.#resuming = undefined;
    this.#layers.clear();
    this.#ambientTimeline = undefined;
    for (const voice of [...this.#voices.values(), ...this.#tails.keys()])
      this.#stop(voice);
    if (this.#context?.state === 'running')
      void this.#context
        .suspend()
        .catch(() => this.#failures.set('context', 'suspend failed'));
  }
  /** Release every old-journey source and async consumer without resuming the context. */
  stopAll(): void {
    this.#epoch += 1;
    this.#pendingShot = undefined;
    this.#resuming = undefined;
    this.#layers.clear();
    for (const request of this.#requests) request.abort();
    this.#requests.clear();
    this.#loading.clear();
    this.#pendingLayers.clear();
    this.#ambientTimeline = undefined;
    for (const voice of [...this.#voices.values(), ...this.#tails.keys()])
      this.#stop(voice);
    this.setCovered(0);
    const context = this.#context;
    if (context && this.#filter && this.#delay && this.#echo) {
      // Suspension preserves buffered samples; a new journey needs an empty DSP path.
      this.#echo.gain.cancelScheduledValues(context.currentTime);
      this.#echo.gain.setValueAtTime(0, context.currentTime);
      this.#filter.disconnect(this.#delay);
      this.#delay.disconnect();
      this.#delay = context.createDelay(0.2);
      this.#delay.delayTime.value = 0.09;
      this.#filter.connect(this.#delay);
      this.#delay.connect(this.#echo);
    }
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
    return this.#fadeOut(victim) && this.#budget.acquire(kind);
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
      layerKey: key,
      id,
      kind,
      priority,
      gain,
      source: undefined,
      strokes: new Map(),
      pendingStrokeSec: undefined,
      retiringStroke: undefined,
    };
    this.#voices.set(key, voice);
    return voice;
  }
  #remember(id: string): void {
    this.#played.push(id);
    if (this.#played.length > 32) this.#played.shift();
  }
  #stop(voice: Voice): boolean {
    if (this.#voices.get(voice.key) === voice) {
      this.#voices.delete(voice.key);
      this.#budget.release(voice.kind);
    } else if (!this.#tails.delete(voice)) return false;
    voice.pendingStrokeSec = undefined;
    voice.retiringStroke = undefined;
    voice.source?.stop();
    voice.source?.disconnect();
    for (const [stroke, { envelope }] of voice.strokes) {
      stroke.stop();
      stroke.disconnect();
      envelope.disconnect();
    }
    voice.strokes.clear();
    voice.gain.disconnect();
    return true;
  }
  #ended(voice: Voice): void {
    // Explicit cleanup already released ownership; its late ended must do nothing.
    if (this.#stop(voice)) this.#reconcile();
  }
  #reconcile(): void {
    if (this.#context?.state !== 'running' || !this.#enabled) return;
    const shot = this.#pendingShot;
    this.#pendingShot = undefined;
    if (shot) this.#playReady(shot);
    // Empty is also a desired state: a coalesced removal must finish on its own.
    this.setLayers([...this.#layers.values()]);
  }
  #sourceCount(voice: Voice): number {
    return (voice.source ? 1 : 0) + voice.strokes.size;
  }
  /** Hand over the slot now; Web Audio's ended event releases the fading nodes. */
  #fadeOut(voice: Voice): boolean {
    const context = this.#context;
    if (!context || this.#voices.get(voice.key) !== voice) return false;
    const cost = this.#sourceCount(voice);
    if (cost === 0) {
      this.#stop(voice);
      return true;
    }
    const tails = [...this.#tails.keys()];
    const sameLayer = tails.find((tail) => tail.layerKey === voice.layerKey);
    if (
      sameLayer ||
      tails.reduce((sum, tail) => sum + this.#sourceCount(tail), 0) + cost >
        MAX_RETIRING_SOURCES
    ) {
      // Coalesce the latest desired layer until a bounded tail has ended.
      const oldest = sameLayer ?? tails[0];
      if (
        oldest &&
        (this.#tails.get(oldest) ?? 0) > context.currentTime + SHORT_FADE_SEC
      )
        this.#rampOut(oldest, SHORT_FADE_SEC);
      return false;
    }
    this.#voices.delete(voice.key);
    this.#budget.release(voice.kind);
    this.#rampOut(voice, 0.15);
    return true;
  }
  #rampOut(voice: Voice, durationSec: number): void {
    const now = this.#context?.currentTime ?? 0;
    const end = now + durationSec;
    voice.pendingStrokeSec = undefined;
    this.#tails.set(voice, end);
    const heldGain = voice.gain.gain.value;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(heldGain, now);
    voice.gain.gain.linearRampToValueAtTime(0, end);
    voice.source?.stop(end);
    for (const stroke of voice.strokes.keys())
      // A layer fade must not extend a stroke already shortened for admission.
      if (stroke !== voice.retiringStroke) stroke.stop(end);
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
        if (buffer)
          this.#playReady({
            id,
            clip,
            buffer,
            gainFactor,
            priority,
            epoch,
            expiresAtSec,
          });
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

  #playReady(request: ReadyShot): void {
    let shot = request;
    const context = this.#context;
    const { id, clip, buffer, gainFactor, priority, epoch, expiresAtSec } =
      shot;
    if (
      !context ||
      this.#epoch !== epoch ||
      context.state !== 'running' ||
      context.currentTime > expiresAtSec ||
      !this.#enabled
    )
      return;
    if (
      this.#pendingShot &&
      context.currentTime > this.#pendingShot.expiresAtSec
    )
      this.#pendingShot = undefined;
    const waiting = this.#pendingShot;
    if (waiting?.id === id) {
      if (waiting.priority >= priority) return;
      // A stronger duplicate takes over the waiting record, never its deadline.
      this.#pendingShot = undefined;
      shot = {
        ...shot,
        epoch: waiting.epoch,
        expiresAtSec: waiting.expiresAtSec,
      };
    }
    if ([...this.#tails.keys()].some((voice) => voice.id === id)) return;
    const previous = this.#voices.get(`shot:${id}`);
    if (previous) {
      if (clip.category !== 'horn' || previous.priority >= priority) return;
      this.#stop(previous);
    }
    try {
      const voice = this.#voice(`shot:${id}`, id, 'oneShot', priority, clip);
      if (!voice) {
        // Only a priority eviction blocked by tails waits; never queue ordinary spam.
        if (
          [...this.#voices.values()].some(
            (candidate) =>
              candidate.kind === 'oneShot' && candidate.priority < priority,
          ) &&
          (!this.#pendingShot || this.#pendingShot.priority < priority)
        )
          this.#pendingShot = shot;
        return;
      }
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
      source.addEventListener('ended', () => this.#ended(voice), {
        once: true,
      });
      source.start();
      this.#remember(id);
    } catch (error) {
      this.#failures.set(
        `play:${id}`,
        error instanceof Error ? error.message : 'playback failed',
      );
      const voice = this.#voices.get(`shot:${id}`);
      if (voice) this.#stop(voice);
    }
  }

  /** Reconciles a bounded desired set. Priority evicts decoration for a nearby bell. */
  setLayers(layers: readonly AudioLayer[]): void {
    const context = this.#context;
    if (!context || context.state !== 'running' || !this.#enabled) return;
    this.#layers.clear();
    for (const layer of layers)
      if (layer.gain > 0) this.#layers.set(layer.key, layer);
    const engine = this.#voices.get('engine');
    const desiredEngine = this.#layers.get('engine');
    if (
      engine &&
      (desiredEngine?.id !== 'steam-chuff' || !desiredEngine.pulsed)
    )
      engine.pendingStrokeSec = undefined;
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
      } else this.#fadeOut(voice);
    }
    for (const layer of [...this.#layers.values()].sort(
      (a, b) => b.priority - a.priority,
    )) {
      const clip = this.#clip(layer.id);
      if (!clip) continue;
      const voice = this.#voices.get(layer.key);
      if (voice) {
        if (voice.id === layer.id) this.#adjust(voice, layer, clip);
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
        source.addEventListener('ended', () => this.#ended(created), {
          once: true,
        });
        let offsetSec = source.loopStart;
        if (key === 'ambient') {
          if (this.#ambientTimeline?.id !== desired.id)
            this.#ambientTimeline = {
              id: desired.id,
              startedAtSec: context.currentTime,
            };
          const elapsedSec =
            context.currentTime - this.#ambientTimeline.startedAtSec;
          const loopDurationSec = source.loopEnd - source.loopStart;
          if (loopDurationSec > 0)
            offsetSec +=
              (elapsedSec * clip.rate * desired.rate) % loopDurationSec;
        }
        source.start(0, offsetSec);
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
      !this.#enabled ||
      !voice ||
      voice.id !== 'steam-chuff' ||
      voice.source !== undefined ||
      this.#layers.get('engine')?.id !== 'steam-chuff' ||
      !this.#layers.get('engine')?.pulsed ||
      !buffer
    )
      return;
    // Retiring engine voices still own live sources until their ended events.
    const strokeOwners = [...this.#tails.keys(), voice];
    const strokeCount = strokeOwners.reduce(
      (sum, owner) => sum + owner.strokes.size,
      0,
    );
    if (voice.retiringStroke || strokeCount >= 2) {
      voice.pendingStrokeSec = durationSec;
      if (!voice.retiringStroke) {
        const owner = strokeOwners.find((owner) => owner.strokes.size > 0);
        const oldest = owner?.strokes.entries().next().value;
        if (!owner || !oldest) return;
        const [stroke, { envelope, endSec }] = oldest;
        if (owner.retiringStroke !== stroke) {
          owner.retiringStroke = stroke;
          const now = context.currentTime;
          const end = Math.min(
            now + SHORT_FADE_SEC,
            endSec,
            this.#tails.get(owner) ?? Infinity,
          );
          // An elapsed stroke keeps its release while waiting for ended delivery.
          if (end > now) {
            const heldGain = envelope.gain.value;
            envelope.gain.cancelScheduledValues(now);
            envelope.gain.setValueAtTime(heldGain, now);
            envelope.gain.linearRampToValueAtTime(0, end);
            stroke.stop(end);
          }
        }
        voice.retiringStroke = stroke;
      }
      return;
    }
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
    voice.strokes.set(source, { envelope, endSec: now + duration });
    source.addEventListener(
      'ended',
      () => {
        if (!voice.strokes.has(source)) return;
        source.disconnect();
        envelope.disconnect();
        voice.strokes.delete(source);
        const waitingEngine = this.#voices.get('engine');
        const retired = waitingEngine?.retiringStroke === source;
        if (voice.retiringStroke === source) voice.retiringStroke = undefined;
        if (retired && waitingEngine) waitingEngine.retiringStroke = undefined;
        if (voice.strokes.size === 0 && this.#tails.has(voice))
          this.#stop(voice);
        this.#reconcile();
        if (retired && waitingEngine?.pendingStrokeSec !== undefined) {
          const durationSec = waitingEngine.pendingStrokeSec;
          waitingEngine.pendingStrokeSec = undefined;
          if (this.#voices.get('engine') === waitingEngine)
            this.chuff(durationSec);
        }
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
