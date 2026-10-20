/** Scratch storage owned by one scene; indices preserve Map order on equal distance. */
export class RideFrameCollections<T extends { id: string }> {
  readonly crossings = new Map<string, T>();
  readonly chunks: number[] = [];
  #center = 0;
  readonly #nearest = (a: number, b: number) =>
    Math.abs(a - this.#center) - Math.abs(b - this.#center);
  prepare(
    crossings: readonly T[],
    chunks: ReadonlyMap<number, unknown>,
    center: number,
  ): void {
    this.crossings.clear();
    for (const c of crossings) this.crossings.set(c.id, c);
    this.chunks.length = 0;
    for (const k of chunks.keys()) this.chunks.push(k);
    this.#center = center;
    this.chunks.sort(this.#nearest);
  }
}
