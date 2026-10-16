/** The descriptor lives with its chunk; only the baked pixels have viewport residency. */
export class VisibleComposition {
  #release: (() => void) | undefined;
  #visible = false;
  constructor(
    readonly bake: () => () => void,
    readonly unavailableFrames: () => readonly string[] = () => [],
  ) {}
  get missingFrames(): readonly string[] {
    return this.#visible && !this.#release ? this.unavailableFrames() : [];
  }
  setVisible(visible: boolean): void {
    this.#visible = visible;
    if (visible) {
      if (!this.#release && this.missingFrames.length === 0)
        this.#release = this.bake();
    } else this.destroy();
  }
  destroy(): void {
    this.#visible = false;
    this.#release?.();
    this.#release = undefined;
  }
}
