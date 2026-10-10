/**
 * Diagnostics: the distinct phases each crossing went through, newest
 * last, recorded every frame so a short phase is never missed between two
 * reads of the debug snapshot. Bounded per crossing; crossings that left
 * the ride are forgotten.
 */
export class PhaseLog {
  readonly #limit: number;
  readonly #byId = new Map<string, string[]>();

  constructor(limit = 8) {
    this.#limit = limit;
  }

  record(current: readonly { id: string; phase: string }[]): void {
    const live = new Set<string>();
    for (const { id, phase } of current) {
      live.add(id);
      const list = this.#byId.get(id) ?? [];
      if (list.at(-1) !== phase) {
        list.push(phase);
        if (list.length > this.#limit) list.shift();
      }
      this.#byId.set(id, list);
    }
    for (const id of this.#byId.keys())
      if (!live.has(id)) this.#byId.delete(id);
  }

  phases(id: string): readonly string[] {
    return this.#byId.get(id) ?? [];
  }
}
