/**
 * When to write a save (doc 08 §6): every `intervalTicks` of riding, and once
 * ~`editDebounceMs` after the last of several rapid edits. Event-driven saves
 * (pause, menu, hidden page) are requested directly by the caller.
 */
export class SaveScheduler {
  readonly #intervalTicks: number;
  readonly #editDebounceMs: number;
  #editDueAtMs: number | undefined;

  constructor(options: { intervalTicks: number; editDebounceMs: number }) {
    this.#intervalTicks = options.intervalTicks;
    this.#editDebounceMs = options.editDebounceMs;
  }

  isTickCheckpoint(tick: number): boolean {
    return tick > 0 && tick % this.#intervalTicks === 0;
  }

  noteEdit(nowMs: number): void {
    this.#editDueAtMs = nowMs + this.#editDebounceMs;
  }

  /** True once when the debounced edit save is due. */
  takeDueEdit(nowMs: number): boolean {
    if (this.#editDueAtMs === undefined || nowMs < this.#editDueAtMs)
      return false;
    this.#editDueAtMs = undefined;
    return true;
  }

  /** Consumes a pending edit so an immediate save can include it. */
  flushPendingEdit(): boolean {
    const pending = this.#editDueAtMs !== undefined;
    this.#editDueAtMs = undefined;
    return pending;
  }
}
