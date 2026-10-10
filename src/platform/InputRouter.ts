import type { InputConfig } from '../config/gameConfig.ts';
import {
  initialInputState,
  motionIntent,
  reduceInput,
  type InputEvent,
  type InputState,
  type MotionIntent,
} from '../domain/input/InputReducer.ts';

/** Rectangle in CSS pixels relative to the viewport. */
export interface CssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface RouterHooks {
  /** World hit-test in CSS px; returns at most one interactive object id. */
  hitObject(clientX: number, clientY: number): string | undefined;
  onObjectTouched(id: string): void;
  onAction(action: string): void;
}

/** Normalized pointer event; `action` is the target control, if any. */
export interface PointerSample {
  id: number;
  clientX: number;
  clientY: number;
  timeMs: number;
  action?: string;
}

/** Actions of the ride HUD that fire on press (doc 02 §2). */
const RIDE_PRESS_ACTIONS = new Set(['horn', 'pause', 'sound']);
const KEY_ACTIONS: Readonly<Record<string, string>> = {
  KeyH: 'horn',
  Escape: 'pause',
};

const inside = (rect: CssRect | undefined, x: number, y: number) =>
  rect !== undefined &&
  x >= rect.left &&
  x <= rect.left + rect.width &&
  y >= rect.top &&
  y <= rect.top + rect.height;

/**
 * The single owner of input (doc 02 §3). Platform adapters feed it
 * normalized pointer/key events; it decides between UI, brake, throttle and
 * object hits, keeps the InputReducer state and exposes the motion intent.
 * It has no DOM dependency, so the same routing is tested in Node.
 */
export class InputRouter {
  readonly #config: InputConfig;
  readonly #hooks: RouterHooks;
  #state: InputState = initialInputState();
  #mode: 'ride' | 'menu' = 'menu';
  #brakeHitArea: CssRect | undefined;
  /** Menu pointers and the control they started on (activate on release). */
  readonly #pressedActions = new Map<number, string>();

  constructor(config: InputConfig, hooks: RouterHooks) {
    this.#config = config;
    this.#hooks = hooks;
  }

  get activePointerCount(): number {
    return this.#state.pointers.length;
  }

  get mode(): 'ride' | 'menu' {
    return this.#mode;
  }

  /** `ride` while RIDING; every other screen is `menu`. Input is not cleared. */
  setMode(mode: 'ride' | 'menu'): void {
    this.#mode = mode;
  }

  /** Enlarged brake hit area in CSS px (doc 02 §9: ≥ 80 px target). */
  setBrakeHitArea(rect: CssRect | undefined): void {
    this.#brakeHitArea = rect;
  }

  #reduce(event: InputEvent): void {
    this.#state = reduceInput(this.#state, event, this.#config);
  }

  pointerDown(pointer: PointerSample): void {
    const { id, clientX, clientY, timeMs, action } = pointer;
    if (this.#mode === 'menu') {
      this.#reduce({
        type: 'pointerDown',
        id,
        role: 'ui',
        clientX,
        clientY,
        timeMs,
      });
      if (action !== undefined) this.#pressedActions.set(id, action);
      return;
    }
    if (
      action === 'brake' ||
      (action === undefined && inside(this.#brakeHitArea, clientX, clientY))
    ) {
      this.#reduce({
        type: 'pointerDown',
        id,
        role: 'brake',
        clientX,
        clientY,
        timeMs,
      });
      return;
    }
    if (action !== undefined) {
      this.#reduce({
        type: 'pointerDown',
        id,
        role: 'ui',
        clientX,
        clientY,
        timeMs,
      });
      if (RIDE_PRESS_ACTIONS.has(action)) this.#hooks.onAction(action);
      return;
    }
    this.#reduce({
      type: 'pointerDown',
      id,
      role: 'drive',
      clientX,
      clientY,
      timeMs,
    });
    const accepted =
      this.#state.pointers.find((p) => p.id === id)?.role === 'drive';
    if (!accepted) return;
    const objectId = this.#hooks.hitObject(clientX, clientY);
    if (objectId !== undefined) this.#hooks.onObjectTouched(objectId);
  }

  pointerMove(pointer: PointerSample): void {
    const { id, clientX, clientY, timeMs } = pointer;
    this.#reduce({
      type: 'pointerMove',
      id,
      clientX,
      clientY,
      timeMs,
      overBrake:
        this.#mode === 'ride' && inside(this.#brakeHitArea, clientX, clientY),
    });
  }

  pointerUp(pointer: { id: number; action?: string }): void {
    this.#reduce({ type: 'pointerUp', id: pointer.id });
    const pressed = this.#pressedActions.get(pointer.id);
    this.#pressedActions.delete(pointer.id);
    if (
      this.#mode === 'menu' &&
      pressed !== undefined &&
      pressed === pointer.action
    ) {
      this.#hooks.onAction(pressed);
    }
  }

  /** pointercancel and lost pointer capture: end the pointer, never activate. */
  pointerCancel(pointer: { id: number }): void {
    this.#reduce({ type: 'pointerUp', id: pointer.id });
    this.#pressedActions.delete(pointer.id);
  }

  keyDown(key: { code: string; repeat: boolean }): void {
    const action = KEY_ACTIONS[key.code];
    if (action !== undefined) {
      if (this.#mode === 'ride' && !key.repeat) this.#hooks.onAction(action);
      return;
    }
    this.#reduce({ type: 'keyDown', code: key.code, repeat: key.repeat });
  }

  keyUp(key: { code: string }): void {
    this.#reduce({ type: 'keyUp', code: key.code });
  }

  /** A focused DOM button activated by Enter/Space (click with detail 0). */
  activateByKeyboard(action: string): void {
    if (action !== 'brake') this.#hooks.onAction(action);
  }

  /** Pause, blur, hidden page, resize or rotation: forget all input. */
  clearAll(): void {
    this.#reduce({ type: 'clearAll' });
    this.#pressedActions.clear();
  }

  /** Resume confirmed: nothing held now may drive (INP-11). */
  resumeLock(): void {
    this.#reduce({ type: 'resumeLock' });
    this.#pressedActions.clear();
  }

  intent(): MotionIntent {
    return this.#mode === 'ride' ? motionIntent(this.#state) : 'COAST';
  }
}
