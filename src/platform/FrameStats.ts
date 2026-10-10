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
  readonly #frames: number[] = [];

  constructor(capacity: number) {
    this.#capacity = capacity;
  }

  add(frameMs: number): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return;
    this.#frames.push(frameMs);
    if (this.#frames.length > this.#capacity) this.#frames.shift();
  }

  summary(): FrameSummary {
    const sorted = [...this.#frames].sort((a, b) => a - b);
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
