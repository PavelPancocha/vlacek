import type { InputRouter } from './InputRouter.ts';

export type InterruptReason = 'blur' | 'hidden' | 'resize';

export interface DomInputOptions {
  /** Element containing the canvas and all UI; receives every pointer. */
  root: HTMLElement;
  router: InputRouter;
  /** Called inside each user gesture (audio unlock, doc 09 §6). */
  onGesture(): void;
  onInterrupt(reason: InterruptReason): void;
  /** Layout changed: re-measure hit areas. */
  onLayout(): void;
}

const DRIVING_KEYS = new Set(['Space', 'ArrowRight', 'ArrowLeft']);
const ACTIVATION_KEYS = new Set(['Space', 'Enter', 'NumpadEnter']);

function actionAt(target: Element | null): string | undefined {
  const control = target?.closest<HTMLElement>('[data-action]');
  if (!control || control.matches(':disabled, [aria-disabled="true"]'))
    return undefined;
  return control.dataset['action'];
}

/**
 * The only DOM listener set for input (doc 02 §3). Pointer Events with
 * pointer ids, capture during the ride, cancel/lost-capture cleanup, keys,
 * focus and visibility. All listeners share one AbortController for disposal.
 */
export class DomInputAdapter {
  readonly #controller = new AbortController();
  #size: { width: number; height: number } | undefined;

  constructor(options: DomInputOptions) {
    const { root, router } = options;
    const signal = this.#controller.signal;
    const listen = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement,
      type: K,
      handler: (event: HTMLElementEventMap[K]) => void,
    ) => target.addEventListener(type, handler, { signal, passive: false });

    listen(root, 'pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      options.onGesture();
      const action = actionAt(
        event.target instanceof Element ? event.target : null,
      );
      if (router.mode === 'ride') {
        event.preventDefault();
        try {
          root.setPointerCapture(event.pointerId);
        } catch {
          // Capture is an improvement, not a requirement (doc 02 §3).
        }
      }
      router.pointerDown({
        id: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        timeMs: event.timeStamp,
        ...(action === undefined ? {} : { action }),
      });
    });
    listen(root, 'pointermove', (event) => {
      router.pointerMove({
        id: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        timeMs: event.timeStamp,
      });
    });
    listen(root, 'pointerup', (event) => {
      // Touch pointers are implicitly captured: ask what is under the finger.
      const action = actionAt(
        document.elementFromPoint(event.clientX, event.clientY),
      );
      router.pointerUp({
        id: event.pointerId,
        ...(action === undefined ? {} : { action }),
      });
    });
    listen(root, 'pointercancel', (event) =>
      router.pointerCancel({ id: event.pointerId }),
    );
    listen(root, 'lostpointercapture', (event) => {
      // Moving capture to the root makes the touched child lose its implicit
      // capture first; only the root's own capture loss ends the pointer.
      if (event.target === root) router.pointerCancel({ id: event.pointerId });
    });
    listen(root, 'contextmenu', (event) => event.preventDefault());
    listen(root, 'click', (event) => {
      // Pointer clicks were handled on pointerup; detail 0 = keyboard activation.
      if (event.detail !== 0) return;
      const action = actionAt(
        event.target instanceof Element ? event.target : null,
      );
      if (action !== undefined) router.activateByKeyboard(action);
    });

    window.addEventListener(
      'keydown',
      (event) => {
        options.onGesture();
        // A keyboard-focused control keeps its native Space/Enter activation
        // (reported as a click with detail 0) instead of driving the train.
        const target = event.target instanceof Element ? event.target : null;
        if (ACTIVATION_KEYS.has(event.code) && actionAt(target) !== undefined)
          return;
        if (router.mode === 'ride' && DRIVING_KEYS.has(event.code))
          event.preventDefault();
        router.keyDown({ code: event.code, repeat: event.repeat });
      },
      { signal },
    );
    window.addEventListener(
      'keyup',
      (event) => router.keyUp({ code: event.code }),
      { signal },
    );
    window.addEventListener('blur', () => options.onInterrupt('blur'), {
      signal,
    });
    window.addEventListener('pagehide', () => options.onInterrupt('hidden'), {
      signal,
    });
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden')
          options.onInterrupt('hidden');
      },
      { signal },
    );

    const observer = new ResizeObserver(() => {
      const rect = root.getBoundingClientRect();
      const size = {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      const previous = this.#size;
      this.#size = size;
      options.onLayout();
      if (
        previous &&
        (previous.width !== size.width || previous.height !== size.height)
      ) {
        options.onInterrupt('resize');
      }
    });
    observer.observe(root);
    signal.addEventListener('abort', () => observer.disconnect(), {
      once: true,
    });
  }

  dispose(): void {
    this.#controller.abort();
  }
}
