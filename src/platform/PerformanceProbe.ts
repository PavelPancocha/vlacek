import { FramePacing } from './FrameStats.ts';
/** CPU timings in navigation-relative ms; never feeds simulation or scheduling. */
export interface PerformanceSnapshot {
  startInteractiveMs: number | undefined;
  ride:
    | {
        requestedAtMs: number;
        firstFrameMs: number | undefined;
        artReadyMs: number | undefined;
        ridingAtMs: number | undefined;
      }
    | undefined;
  svg: {
    fetchCount: number;
    fetchMs: number;
    decodeCount: number;
    decodeMs: number;
  };
  atlas: { count: number; packRasterMs: number; uploadMs: number };
  chunks: { index: number; generationMs: number; bakeMs: number }[];
  longTasks: {
    supported: boolean;
    count: number;
    totalMs: number;
    maxMs: number;
  };
}

/** Bounded, read-only diagnostic sample. The caller owns clock and observers. */
export class PerformanceProbe {
  readonly framePacing = new FramePacing();
  readonly #now: () => number;
  readonly #decoding = new Map<string, number>();
  readonly #data: PerformanceSnapshot = {
    startInteractiveMs: undefined,
    ride: undefined,
    svg: { fetchCount: 0, fetchMs: 0, decodeCount: 0, decodeMs: 0 },
    atlas: { count: 0, packRasterMs: 0, uploadMs: 0 },
    chunks: [],
    longTasks: { supported: false, count: 0, totalMs: 0, maxMs: 0 },
  };

  constructor(now: () => number) {
    this.#now = now;
  }

  markStartInteractive(): void {
    this.#data.startInteractiveMs ??= this.#now();
  }

  requestRide(): void {
    this.#data.ride = {
      requestedAtMs: this.#now(),
      firstFrameMs: undefined,
      artReadyMs: undefined,
      ridingAtMs: undefined,
    };
    this.#data.chunks = [];
    Object.assign(this.#data.longTasks, { count: 0, totalMs: 0, maxMs: 0 });
  }

  presented(artReady: boolean, riding: boolean): void {
    const ride = this.#data.ride;
    if (!ride) return;
    const now = this.#now();
    ride.firstFrameMs ??= now - ride.requestedAtMs;
    if (artReady) ride.artReadyMs ??= now - ride.requestedAtMs;
    if (riding) ride.ridingAtMs ??= now;
  }

  /** Phaser load → filecomplete includes SVG parsing, image decode and source upload. */
  svgFetched(key: string, durationMs: number): void {
    this.#data.svg.fetchCount++;
    this.#data.svg.fetchMs += durationMs;
    this.#decoding.set(key, this.#now());
  }

  svgDecoded(key: string): void {
    const started = this.#decoding.get(key);
    if (started === undefined) return;
    this.#data.svg.decodeCount++;
    this.#data.svg.decodeMs += this.#now() - started;
    this.#decoding.delete(key);
  }

  finishLoading(): void {
    this.#decoding.clear();
  }

  atlas(totalMs: number, uploadMs: number): void {
    this.#data.atlas.count++;
    this.#data.atlas.packRasterMs += Math.max(0, totalMs - uploadMs);
    this.#data.atlas.uploadMs += uploadMs;
  }

  /** D-030 already measures CPU phases; reuse those clocks without wrapping texture methods. */
  atlasWork(durationMs: number, upload: boolean): void {
    this.framePacing.event(
      upload ? 'atlasUpload' : 'atlasSlice',
      this.#now() - durationMs,
      durationMs,
    );
    if (upload) this.#data.atlas.uploadMs += durationMs;
    else this.#data.atlas.packRasterMs += durationMs;
  }

  chunk(index: number, phase: 'generation' | 'bake', ms: number): void {
    let sample = this.#data.chunks.find((chunk) => chunk.index === index);
    if (!sample) {
      if (this.#data.chunks.length === 12) return;
      sample = { index, generationMs: 0, bakeMs: 0 };
      this.#data.chunks.push(sample);
    }
    if (phase === 'generation') sample.generationMs += ms;
    else sample.bakeMs += ms;
  }

  longTasksSupported(): void {
    this.#data.longTasks.supported = true;
  }

  longTask(startTime: number, duration: number): void {
    const start = this.#data.ride?.ridingAtMs;
    if (
      start === undefined ||
      duration <= 50 ||
      startTime < start ||
      startTime >= start + 15000
    )
      return;
    const tasks = this.#data.longTasks;
    tasks.count++;
    tasks.totalMs += duration;
    tasks.maxMs = Math.max(tasks.maxMs, duration);
  }

  snapshot(): PerformanceSnapshot {
    return {
      ...this.#data,
      ride: this.#data.ride && { ...this.#data.ride },
      svg: { ...this.#data.svg },
      atlas: { ...this.#data.atlas },
      chunks: this.#data.chunks.map((chunk) => ({ ...chunk })),
      longTasks: { ...this.#data.longTasks },
    };
  }
}

export function observeLongTasks(probe: PerformanceProbe): () => void {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes.includes('longtask')
  )
    return () => {};
  probe.longTasksSupported();
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      probe.longTask(entry.startTime, entry.duration);
  });
  observer.observe({ type: 'longtask', buffered: true });
  return () => observer.disconnect();
}
