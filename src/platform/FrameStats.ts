export interface FrameSummary {
  samples: number;
  medianFps: number;
  p95FrameMs: number;
  worstFrameMs: number;
}

/**
 * Rolling frame-time statistics for diagnostics and measurements (doc 11
 * PERF): median FPS, 95th percentile and worst frame over the last frames.
 */
export class FrameStats {
  readonly #capacity: number;
  readonly #frames: Float64Array;
  #count = 0;

  constructor(capacity: number) {
    this.#capacity = capacity;
    this.#frames = new Float64Array(capacity);
  }

  add(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.#frames[this.#count++ % this.#capacity] = frameMs;
  }

  summary(): FrameSummary {
    const sorted = Array.from(
      this.#frames.subarray(0, Math.min(this.#count, this.#capacity)),
    ).sort((a, b) => a - b);
    const count = sorted.length;
    if (count === 0)
      return { samples: 0, medianFps: 0, p95FrameMs: 0, worstFrameMs: 0 };
    const at = (q: number) =>
      sorted[Math.min(count - 1, Math.floor(q * (count - 1)))] ?? 0;
    return {
      samples: count,
      medianFps: 1000 / at(0.5),
      p95FrameMs: at(0.95),
      worstFrameMs: sorted[count - 1] ?? 0,
    };
  }
}

export const FRAME_PHASES = [
  'worldWindow',
  'trackChunks',
  'effects',
  'objectsVehicles',
  'audio',
  'ui',
  'save',
  'simulation',
] as const;
export type FramePhase = (typeof FRAME_PHASES)[number];
export const FRAME_EVENTS = [
  'chunkCreated',
  'compositionBaked',
  'atlasSlice',
  'atlasUpload',
  'atlasActivation',
  'save',
  'audioDecode',
] as const;
export type FrameEvent = (typeof FRAME_EVENTS)[number];
const FRAME_COLUMNS = [
  'frame',
  'timeMs',
  'intervalMs',
  'cpuMs',
  'steps',
  'droppedSec',
  ...FRAME_PHASES,
] as const;
const STRIDE = FRAME_COLUMNS.length;
/** D-034: recording never allocates, sorts, formats strings or invokes callbacks. */
export class FramePacing {
  readonly #capacity: number;
  readonly #ring: Float64Array;
  readonly #events = new Float64Array(256 * 5);
  readonly #histogram = new Uint32Array(4001);
  readonly #gapsMs: Float64Array;
  readonly #gapsFrames: Float64Array;
  #epoch = 0;
  #count = 0;
  #eventCount = 0;
  #gapCount = 0;
  #medianBucket = 0;
  #below = 0;
  #overMedian = 0;
  #over50 = 0;
  #over100 = 0;
  #elapsedMs = 0;
  #lastLongTime = -1;
  #lastLongFrame = -1;
  #offset = 0;
  #active = false;
  #refreshMinimumMs = Infinity;
  #minRenderedVehicles = Infinity;
  #maxLiveChunks = 0;
  constructor(capacity = 1800) {
    this.#capacity = capacity;
    this.#ring = new Float64Array(capacity * STRIDE);
    this.#gapsMs = new Float64Array(capacity);
    this.#gapsFrames = new Float64Array(capacity);
  }
  reset(): void {
    this.#epoch++;
    this.#count =
      this.#eventCount =
      this.#gapCount =
      this.#medianBucket =
      this.#below =
        0;
    this.#overMedian = this.#over50 = this.#over100 = 0;
    this.#elapsedMs = 0;
    this.#lastLongTime = this.#lastLongFrame = -1;
    this.#active = false;
    this.#histogram.fill(0);
    this.#minRenderedVehicles = Infinity;
    this.#maxLiveChunks = 0;
  }
  /** Independent rAF minimum estimates panel rate even when Phaser caps updates. */
  refreshInterval(intervalMs: number): void {
    if (intervalMs >= 4 && intervalMs < this.#refreshMinimumMs)
      this.#refreshMinimumMs = intervalMs;
  }
  begin(timeMs: number, intervalMs: number): void {
    this.#active = true;
    this.#offset = (this.#count % this.#capacity) * STRIDE;
    this.#ring.fill(0, this.#offset, this.#offset + STRIDE);
    this.#ring[this.#offset] = this.#count;
    this.#ring[this.#offset + 1] = timeMs;
    this.#ring[this.#offset + 2] = intervalMs;
  }
  observeScene(renderedVehicles: number, liveChunks: number): void {
    this.#minRenderedVehicles = Math.min(
      this.#minRenderedVehicles,
      renderedVehicles,
    );
    this.#maxLiveChunks = Math.max(this.#maxLiveChunks, liveChunks);
  }
  phase(phase: FramePhase, durationMs: number): void {
    if (!this.#active) return;
    const at = this.#offset + 6 + FRAME_PHASES.indexOf(phase);
    this.#ring[at] = (this.#ring[at] ?? 0) + durationMs;
  }
  end(cpuMs: number, steps: number, droppedSec: number): void {
    if (!this.#active) return;
    this.#ring[this.#offset + 3] = cpuMs;
    this.#ring[this.#offset + 4] = steps;
    this.#ring[this.#offset + 5] = droppedSec;
    const interval = this.#ring[this.#offset + 2] ?? 0;
    this.#elapsedMs += interval;
    const time = this.#elapsedMs;
    const bucket = Math.min(4000, Math.max(0, Math.round(interval * 4)));
    this.#histogram[bucket] = (this.#histogram[bucket] ?? 0) + 1;
    if (bucket < this.#medianBucket) this.#below++;
    const rank = Math.floor(this.#count / 2);
    while (this.#below > rank) {
      this.#medianBucket--;
      this.#below -= this.#histogram[this.#medianBucket] ?? 0;
    }
    while (
      this.#below + (this.#histogram[this.#medianBucket] ?? 0) <= rank &&
      this.#medianBucket < 4000
    ) {
      this.#below += this.#histogram[this.#medianBucket] ?? 0;
      this.#medianBucket++;
    }
    if (interval > (this.#medianBucket / 4) * 1.5) {
      this.#overMedian++;
      if (this.#lastLongFrame >= 0) {
        const at = this.#gapCount++ % this.#capacity;
        this.#gapsMs[at] = time - this.#lastLongTime;
        this.#gapsFrames[at] = this.#count - this.#lastLongFrame;
      }
      this.#lastLongTime = time;
      this.#lastLongFrame = this.#count;
    }
    if (interval > 50) this.#over50++;
    if (interval > 100) this.#over100++;
    this.#count++;
    this.#active = false;
  }
  event(
    kind: FrameEvent,
    timeMs: number,
    durationMs: number,
    detail = 0,
    frameIndex = this.#count,
  ): void {
    const at = (this.#eventCount++ % 256) * 5;
    this.#events[at] = frameIndex;
    this.#events[at + 1] = timeMs;
    this.#events[at + 2] = durationMs;
    this.#events[at + 3] = FRAME_EVENTS.indexOf(kind);
    this.#events[at + 4] = detail;
  }
  get epoch(): number {
    return this.#epoch;
  }
  get frameIndex(): number {
    return this.#count;
  }
  get longThresholdMs(): number {
    return (this.#medianBucket / 4) * 1.5;
  }
  get longFrames(): number {
    return this.#overMedian;
  }
  get size(): number {
    return Math.min(this.#count, this.#capacity);
  }
  /** Ordered scalar access for the graph, without making a snapshot. */
  value(index: number, column: number): number {
    return (
      this.#ring[
        ((Math.max(0, this.#count - this.#capacity) + index) % this.#capacity) *
          STRIDE +
          column
      ] ?? 0
    );
  }
  snapshot() {
    const median = (values: Float64Array) => {
      const sorted = Array.from(
        values.subarray(0, Math.min(this.#gapCount, this.#capacity)),
      ).sort((a, b) => a - b);
      return sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
    };
    const intervals = Array.from({ length: this.size }, (_, i) =>
      this.value(i, 2),
    ).sort((a, b) => a - b);
    const cpu = Array.from({ length: this.size }, (_, i) =>
      this.value(i, 3),
    ).sort((a, b) => a - b);
    const at = (values: number[], fraction: number) =>
      values[Math.floor((values.length - 1) * fraction)] ?? 0;
    return {
      summary: {
        frames: this.#count,
        retainedFrames: this.size,
        minRenderedVehicles: Number.isFinite(this.#minRenderedVehicles)
          ? this.#minRenderedVehicles
          : undefined,
        maxLiveChunks: this.#maxLiveChunks,
        medianIntervalMs: at(intervals, 0.5),
        p95IntervalMs: at(intervals, 0.95),
        worstIntervalMs: at(intervals, 1),
        p95CpuMs: at(cpu, 0.95),
        runningMedianMs: this.#medianBucket / 4,
        overMedian: this.#overMedian,
        over50: this.#over50,
        over100: this.#over100,
        medianGapMs: median(this.#gapsMs),
        medianGapFrames: median(this.#gapsFrames),
        estimatedRefreshHz: Number.isFinite(this.#refreshMinimumMs)
          ? 1000 / this.#refreshMinimumMs
          : undefined,
      },
      columns: FRAME_COLUMNS,
      frames: Array.from({ length: this.size }, (_, i) =>
        Array.from({ length: STRIDE }, (_, c) =>
          c === 5 ? this.value(i, c) : Number(this.value(i, c).toFixed(3)),
        ),
      ),
      eventColumns: ['frame', 'timeMs', 'durationMs', 'kind', 'detail'],
      eventKinds: FRAME_EVENTS,
      events: Array.from(
        { length: Math.min(this.#eventCount, 256) },
        (_, i) => {
          const at = ((Math.max(0, this.#eventCount - 256) + i) % 256) * 5;
          return Array.from(this.#events.subarray(at, at + 5));
        },
      ),
    };
  }
}
