export interface PixelCopies {
  canvas: number;
  imageData: number;
  sources: number;
  gpu: number;
}
const empty = (): PixelCopies => ({
  canvas: 0,
  imageData: 0,
  sources: 0,
  gpu: 0,
});
/** Allocation ledger; high water is updated before a synchronous upload or release. */
export class TextureMemory {
  readonly #allocations = new Map<string, PixelCopies>();
  #highWater = 0;
  set(key: string, copies: Partial<PixelCopies>): void {
    this.#allocations.set(key, { ...empty(), ...copies });
    this.#highWater = Math.max(this.#highWater, this.snapshot.bytes);
  }
  remove(key: string): void {
    this.#allocations.delete(key);
  }
  get snapshot() {
    const copies = empty();
    for (const value of this.#allocations.values())
      for (const key of ['canvas', 'imageData', 'sources', 'gpu'] as const)
        copies[key] += value[key];
    return {
      ...copies,
      bytes: copies.canvas + copies.imageData + copies.sources + copies.gpu,
      highWaterBytes: this.#highWater,
      allocations: [...this.#allocations].map(([key, copies]) => ({
        key,
        ...copies,
      })),
    };
  }
}

export interface AtlasLifetimePlan {
  /** RGBA8 allocations shared by all phases; excludes every atlas and baked chunk. */
  sourcesBytes: number;
  auxiliaryBytes: number;
  vehicle: {
    oldBytes: number;
    newBytes: number;
    releaseOldFirst: boolean;
    decodeBytes?: number;
  };
  ground: {
    /** All retained ground and visible composition pixels. */
    oldBytes: number;
    newBytes: number;
    largestNewBytes: number;
    /** Max simultaneous scratch/readback/upload beyond retained pixels; baking can overlap preparation. */
    preparationBytes?: number;
  };
  world: { oldBytes: number; newBytes: number; decodeBytes: number };
  backdrop: { oldBytes: number; newBytes: number; decodeBytes: number };
  gpu: boolean;
}
/** Vehicle resize, world publication, ground recreation, backdrop publication: disjoint lifetimes. */
export function atlasLifetimePeak(plan: AtlasLifetimePlan) {
  const { vehicle: v, ground: g, world: w, backdrop: b, gpu } = plan;
  const base = plan.sourcesBytes + plan.auxiliaryBytes;
  // SVG + bitmap can overlap, but the upload canvas is allocated after SVG release.
  const decode = (bytes: number) =>
    Math.max(2 * bytes, bytes + (gpu ? 256 * 256 * 4 : 0));
  const work = g.preparationBytes ?? (gpu ? g.largestNewBytes : 0);
  const phases = {
    // First load/context restore has no displayed chunks; both atlas decoders may run under the curtain.
    cold:
      base +
      v.newBytes +
      w.newBytes +
      b.newBytes +
      decode(w.decodeBytes) +
      decode(b.decodeBytes),
    vehicle:
      base +
      g.oldBytes +
      w.oldBytes +
      b.oldBytes +
      (v.releaseOldFirst ? 0 : v.oldBytes) +
      v.newBytes * (gpu && v.decodeBytes === undefined ? 2 : 1) +
      (v.decodeBytes === undefined ? 0 : decode(v.decodeBytes)) +
      work,
    world:
      base +
      g.oldBytes +
      v.newBytes +
      w.oldBytes +
      w.newBytes +
      b.oldBytes +
      decode(w.decodeBytes) +
      work,
    ground: base + g.newBytes + v.newBytes + w.newBytes + b.oldBytes + work,
    backdrop:
      base +
      g.newBytes +
      v.newBytes +
      w.newBytes +
      b.oldBytes +
      b.newBytes +
      decode(b.decodeBytes) +
      work,
  };
  return { phases, peakBytes: Math.max(...Object.values(phases)) };
}
