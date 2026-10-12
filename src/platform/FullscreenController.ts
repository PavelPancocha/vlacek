/** Minimal browser boundary so Node tests need no DOM globals. */
interface FullscreenDocument {
  readonly fullscreenEnabled?: boolean | undefined;
  readonly fullscreenElement: unknown;
  readonly documentElement: { requestFullscreen(): Promise<void> };
  exitFullscreen(): Promise<void>;
  addEventListener(type: 'fullscreenchange', listener: () => void): void;
  removeEventListener(type: 'fullscreenchange', listener: () => void): void;
}

/** Browser-only fullscreen state; the shell owns this controller's lifetime. */
export class FullscreenController {
  readonly #document: FullscreenDocument;
  readonly #onChange: () => void;
  #disposed = false;
  pending = false;
  failed = false;

  constructor(document: FullscreenDocument, onChange: () => void) {
    this.#document = document;
    this.#onChange = onChange;
    document.addEventListener('fullscreenchange', onChange);
  }

  get supported(): boolean {
    return (
      this.#document.fullscreenEnabled === true &&
      typeof this.#document.documentElement.requestFullscreen === 'function' &&
      typeof this.#document.exitFullscreen === 'function'
    );
  }

  get active(): boolean {
    return this.#document.fullscreenElement != null;
  }

  /** Called only by the input router inside a user's gesture. */
  async toggle(): Promise<void> {
    if (this.#disposed || !this.supported || this.pending || this.failed)
      return;
    this.pending = true;
    try {
      if (this.active) await this.#document.exitFullscreen();
      else await this.#document.documentElement.requestFullscreen();
    } catch {
      this.failed = true;
    } finally {
      this.pending = false;
      if (!this.#disposed) this.#onChange();
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#document.removeEventListener('fullscreenchange', this.#onChange);
  }
}
