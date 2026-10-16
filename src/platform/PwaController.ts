export interface PwaState {
  offline:
    | 'online'
    | 'připravuje se offline balík'
    | 'offline připraveno'
    | 'offline není dostupné';
  buildId?: string;
  updateWaiting: boolean;
  installAvailable: boolean;
}
export const initialPwaState: PwaState = {
  offline: 'online',
  updateWaiting: false,
  installAvailable: false,
};
interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
}
function installPrompt(event: Event): event is InstallPrompt {
  return 'prompt' in event && typeof event.prompt === 'function';
}

/** Optional browser boundary: no simulation, reload, or save writes. */
export class PwaController {
  readonly #scope = new AbortController();
  readonly #pending = new Set<() => void>();
  readonly #changed: (state: PwaState) => void;
  readonly #enabled: boolean;
  readonly #base: string;
  readonly #buildId: string;
  #state: PwaState = initialPwaState;
  #registration: ServiceWorkerRegistration | undefined;
  #prompt: InstallPrompt | undefined;
  #frame: number | undefined;
  #started = false;
  #statusRevision = 0;

  constructor(
    enabled: boolean,
    base: string,
    buildId: string,
    changed: (state: PwaState) => void,
  ) {
    this.#enabled = enabled;
    this.#base = base;
    this.#buildId = buildId;
    this.#changed = changed;
    const signal = this.#scope.signal;
    window.addEventListener(
      'beforeinstallprompt',
      (event) => {
        if (!enabled || !installPrompt(event)) return;
        event.preventDefault();
        this.#prompt = event;
        this.#publish({ ...this.#state, installAvailable: true });
      },
      { signal },
    );
    window.addEventListener(
      'appinstalled',
      () => {
        this.#prompt = undefined;
        this.#publish({ ...this.#state, installAvailable: false });
      },
      { signal },
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) void this.#refresh();
      },
      { signal },
    );
    window.addEventListener(
      'online',
      () => {
        void this.#refresh();
      },
      { signal },
    );
  }

  /** Called after Phaser is ready; one frame gives the online UI its first paint. */
  afterFirstFrame(): void {
    if (!this.#enabled || this.#started || this.#scope.signal.aborted) return;
    this.#started = true;
    this.#frame = requestAnimationFrame(() => {
      this.#frame = undefined;
      void this.#register();
    });
  }

  #publish(state: PwaState): void {
    if (this.#scope.signal.aborted) return;
    this.#state = state;
    this.#changed(state);
  }

  async #register(): Promise<void> {
    try {
      const container = navigator.serviceWorker;
      if (!container) {
        this.#publish({ ...this.#state, offline: 'offline není dostupné' });
        return;
      }
      this.#publish({ ...this.#state, offline: 'připravuje se offline balík' });
      const registration = await container.register(`${this.#base}sw.js`, {
        scope: this.#base,
        updateViaCache: 'none',
      });
      if (this.#scope.signal.aborted) return;
      this.#registration = registration;
      const watchInstalling = () => {
        registration.installing?.addEventListener(
          'statechange',
          () => {
            void this.#refresh();
          },
          { signal: this.#scope.signal },
        );
        void this.#refresh();
      };
      registration.addEventListener('updatefound', watchInstalling, {
        signal: this.#scope.signal,
      });
      container.addEventListener(
        'controllerchange',
        () => {
          void this.#refresh();
        },
        { signal: this.#scope.signal },
      );
      watchInstalling();
    } catch {
      this.#publish({ ...this.#state, offline: 'offline není dostupné' });
    }
  }

  async #refresh(): Promise<void> {
    const registration = this.#registration;
    if (!registration || this.#scope.signal.aborted) return;
    const revision = ++this.#statusRevision;
    const worker = navigator.serviceWorker.controller ?? registration.active;
    const updating = registration.installing !== null;
    let offline: PwaState['offline'] = updating
      ? 'připravuje se offline balík'
      : 'offline není dostupné';
    let buildId: string | undefined;
    if (worker?.state === 'activated') {
      const result = await this.#workerStatus(worker);
      if (
        typeof result === 'object' &&
        result !== null &&
        'ready' in result &&
        result.ready === true &&
        'buildId' in result &&
        typeof result.buildId === 'string'
      ) {
        buildId = result.buildId;
        offline =
          buildId === this.#buildId
            ? 'offline připraveno'
            : 'offline není dostupné';
      }
    }
    if (revision !== this.#statusRevision) return;
    this.#publish({
      offline,
      ...(buildId === undefined ? {} : { buildId }),
      updateWaiting: registration.waiting !== null,
      installAvailable: this.#prompt !== undefined,
    });
  }

  #workerStatus(worker: ServiceWorker): Promise<unknown> {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (value?: unknown) => {
        clearTimeout(timeout);
        channel.port1.close();
        channel.port2.close();
        this.#pending.delete(cancel);
        resolve(value);
      };
      const cancel = () => finish();
      // A stale/foreign worker may not implement this protocol; one bounded request.
      const timeout = window.setTimeout(cancel, 5_000);
      this.#pending.add(cancel);
      channel.port1.onmessage = (event: MessageEvent<unknown>) =>
        finish(event.data);
      try {
        worker.postMessage('offline-status', [channel.port2]);
      } catch {
        finish();
      }
    });
  }

  async install(): Promise<void> {
    const prompt = this.#prompt;
    if (!prompt) return;
    this.#prompt = undefined;
    this.#publish({ ...this.#state, installAvailable: false });
    try {
      await prompt.prompt();
    } catch {
      /* Browser rejection leaves the online game available. */
    }
  }

  dispose(): void {
    this.#scope.abort();
    if (this.#frame !== undefined) cancelAnimationFrame(this.#frame);
    for (const cancel of this.#pending) cancel();
    this.#prompt = undefined;
  }
}
