export type AtlasStage =
  'prepare' | 'register' | 'upload' | 'worldActivate' | 'backdropActivate';
export class AtlasMetrics {
  readonly #samples: Record<AtlasStage, number[]> = {
    prepare: [],
    register: [],
    upload: [],
    worldActivate: [],
    backdropActivate: [],
  };
  readonly #frames = new Map<AtlasStage, number[]>();
  readonly #stageFollowing = new Map<AtlasStage, number>();
  readonly #slowest = new Map<AtlasStage, string>();
  readonly #max = new Map<AtlasStage, number>();
  readonly #count = new Map<AtlasStage, number>();
  readonly #baseline = frameHistogram();
  readonly #affected = frameHistogram();
  #last: number | undefined;
  #following = 0;
  constructor(
    readonly now: () => number = () => performance.now(),
    readonly onRecord?: (
      stage: AtlasStage,
      durationMs: number,
      detail?: string,
    ) => void,
  ) {}
  measure<T>(stage: AtlasStage, work: () => T, detail?: string): T {
    const from = this.now();
    try {
      return work();
    } finally {
      this.record(stage, this.now() - from, detail);
    }
  }
  record(stage: AtlasStage, durationMs: number, detail?: string): void {
    if (durationMs > (this.#max.get(stage) ?? 0))
      this.#slowest.set(stage, detail ?? stage);
    this.#max.set(stage, Math.max(this.#max.get(stage) ?? 0, durationMs));
    this.#count.set(stage, (this.#count.get(stage) ?? 0) + 1);
    this.#stageFollowing.set(stage, 2);
    const samples = this.#samples[stage];
    samples.push(durationMs);
    if (samples.length > 512) samples.shift();
    this.#following = 2;
    this.onRecord?.(stage, durationMs, detail);
  }
  reset(): void {
    for (const samples of Object.values(this.#samples)) samples.length = 0;
    this.#frames.clear();
    this.#stageFollowing.clear();
    this.#max.clear();
    this.#slowest.clear();
    this.#count.clear();
    for (const histogram of [this.#baseline, this.#affected]) {
      histogram.buckets.fill(0);
      histogram.count = 0;
      histogram.maxMs = 0;
    }
    this.#last = undefined;
    this.#following = 0;
  }
  frame(time: number): void {
    if (this.#last !== undefined) {
      const samples = this.#following ? this.#affected : this.#baseline;
      recordFrame(samples, time - this.#last);
      for (const [stage, following] of this.#stageFollowing) {
        if (!following) continue;
        const frames = this.#frames.get(stage) ?? [];
        frames.push(time - this.#last);
        if (frames.length > 512) frames.shift();
        this.#frames.set(stage, frames);
        this.#stageFollowing.set(stage, following - 1);
      }
    }
    this.#last = time;
    this.#following = Math.max(0, this.#following - 1);
  }
  get snapshot() {
    const stage = (key: AtlasStage) => ({
      ...summary(this.#samples[key]),
      count: this.#count.get(key) ?? 0,
      maxMs: this.#max.get(key) ?? 0,
      frames: summary(this.#frames.get(key) ?? []),
      slowest: this.#slowest.get(key),
    });
    const stages = {
      prepare: stage('prepare'),
      register: stage('register'),
      upload: stage('upload'),
      worldActivate: stage('worldActivate'),
      backdropActivate: stage('backdropActivate'),
    };
    const baseline = frameSummary(this.#baseline),
      affected = frameSummary(this.#affected);
    return {
      stages,
      baseline,
      affected,
      violations: Object.entries(stages)
        .filter(([, s]) => s.maxMs > 16.67)
        .map(([key]) => key),
      overheadP95Ms: Math.max(0, affected.p95Ms - baseline.p95Ms),
    };
  }
}
/** Whole-run frame distributions in bounded memory; p95 rounds up by at most 1 ms below 1 s. */
function frameHistogram() {
  return { buckets: Array<number>(1001).fill(0), count: 0, maxMs: 0 };
}
function recordFrame(
  histogram: ReturnType<typeof frameHistogram>,
  durationMs: number,
) {
  const bucket = Math.min(1000, Math.max(0, Math.ceil(durationMs)));
  histogram.buckets[bucket] = (histogram.buckets[bucket] ?? 0) + 1;
  histogram.count++;
  histogram.maxMs = Math.max(histogram.maxMs, durationMs);
}
function frameSummary(histogram: ReturnType<typeof frameHistogram>) {
  const rank = Math.ceil(histogram.count * 0.95);
  let count = 0,
    p95Ms = 0;
  for (let i = 0; i < histogram.buckets.length; i++) {
    count += histogram.buckets[i] ?? 0;
    if (count >= rank) {
      // A catastrophic >1 s tail uses its exact maximum as the upper bound.
      p95Ms = i === 1000 ? histogram.maxMs : Math.min(i, histogram.maxMs);
      break;
    }
  }
  return { count: histogram.count, p95Ms, maxMs: histogram.maxMs };
}
function summary(samples: readonly number[]) {
  const ordered = [...samples].sort((a, b) => a - b);
  return {
    count: ordered.length,
    p95Ms: ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? 0,
    maxMs: ordered.at(-1) ?? 0,
  };
}
