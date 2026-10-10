/**
 * Per-object reaction cooldowns in simulation ticks (doc 05, doc 13
 * `interaction.defaultCooldownSeconds`). Entries exist only while a cooldown
 * runs and are dropped with their chunk, so memory never grows with history.
 */
export class ObjectReactions {
  readonly #cooldownTicks: number;
  readonly #activatedAt = new Map<string, number>();

  constructor(cooldownTicks: number) {
    this.#cooldownTicks = cooldownTicks;
  }

  get size(): number {
    return this.#activatedAt.size;
  }

  /** Starts a reaction unless this object is still cooling down. */
  activate(id: string, tick: number): boolean {
    const last = this.#activatedAt.get(id);
    if (last !== undefined && tick - last < this.#cooldownTicks) return false;
    this.#activatedAt.set(id, tick);
    return true;
  }

  activatedTick(id: string): number | undefined {
    return this.#activatedAt.get(id);
  }

  prune(tick: number): void {
    for (const [id, last] of this.#activatedAt) {
      if (tick - last >= this.#cooldownTicks) this.#activatedAt.delete(id);
    }
  }

  forgetChunk(chunkIndex: number): void {
    const marker = `:chunk:${chunkIndex}:`;
    for (const id of this.#activatedAt.keys()) {
      if (id.includes(marker)) this.#activatedAt.delete(id);
    }
  }
}

/** Minimum interval between repeated actions, e.g. the player's horn. */
export class CooldownGate {
  readonly #intervalTicks: number;
  #lastTick: number | undefined;

  constructor(intervalTicks: number) {
    this.#intervalTicks = intervalTicks;
  }

  tryPass(tick: number): boolean {
    if (
      this.#lastTick !== undefined &&
      tick - this.#lastTick < this.#intervalTicks
    ) {
      return false;
    }
    this.#lastTick = tick;
    return true;
  }
}
