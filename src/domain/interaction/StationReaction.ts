/** One cosmetic actor; explicit simulation ticks, no input or movement side effects. */
export class StationReaction {
  #near = false;
  #stoppedSince: number | undefined;
  #stopReacted = false;
  #waveTick: number | undefined;
  readonly #stopTicks: number;
  readonly #cooldownTicks: number;
  constructor(
    readonly fromXU: number,
    readonly toXU: number,
    readonly fixedHz: number,
    readonly stopSpeedUPerSec: number,
    stopSeconds: number,
    cooldownSeconds: number,
  ) {
    this.#stopTicks = Math.round(stopSeconds * fixedHz);
    this.#cooldownTicks = Math.round(cooldownSeconds * fixedHz);
  }
  step(tick: number, headXU: number, speedUPerSec: number): number | undefined {
    const near = headXU >= this.fromXU - 640 && headXU <= this.toXU;
    const stopped =
      headXU >= this.fromXU &&
      headXU <= this.toXU &&
      speedUPerSec < this.stopSpeedUPerSec;
    if (stopped) this.#stoppedSince ??= tick;
    else {
      this.#stoppedSince = undefined;
      this.#stopReacted = false;
    }
    const stopReady =
      this.#stoppedSince !== undefined &&
      tick - this.#stoppedSince >= this.#stopTicks &&
      !this.#stopReacted;
    const cooldownReady =
      this.#waveTick === undefined ||
      tick - this.#waveTick >= this.#cooldownTicks;
    if (cooldownReady && ((near && !this.#near) || stopReady)) {
      this.#waveTick = tick;
      if (stopReady) this.#stopReacted = true;
    }
    this.#near = near;
    const age =
      this.#waveTick === undefined
        ? undefined
        : (tick - this.#waveTick) / this.fixedHz;
    return age !== undefined && age < 2 ? age : undefined;
  }
}
