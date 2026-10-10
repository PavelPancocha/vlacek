import type { InputConfig } from '../../config/gameConfig.ts';

/** Driving intent for one simulation step (doc 02 §4). */
export type MotionIntent = 'THROTTLE' | 'COAST' | 'BRAKE';

/**
 * `ignored` marks pointers that must never drive: held across a resume
 * confirmation, or started while such a pointer was still held.
 */
export type PointerRole = 'drive' | 'brake' | 'ui' | 'ignored';

export interface PointerState {
  id: number;
  role: PointerRole;
  /** Gesture coordinates are CSS pixels, never render-buffer pixels. */
  startClientX: number;
  startClientY: number;
  downAtMs: number;
  brakeLatched: boolean;
  /** Held when a resume was confirmed; keeps the resume lock active. */
  heldAcrossResume: boolean;
}

type KeyControl = 'throttle' | 'brake';

export interface KeyState {
  code: string;
  control: KeyControl;
  heldAcrossResume: boolean;
}

export interface InputState {
  pointers: readonly PointerState[];
  keys: readonly KeyState[];
}

export type InputEvent =
  | {
      type: 'pointerDown';
      id: number;
      role: 'drive' | 'brake' | 'ui';
      clientX: number;
      clientY: number;
      timeMs: number;
    }
  | {
      type: 'pointerMove';
      id: number;
      clientX: number;
      clientY: number;
      timeMs: number;
      /** The pointer is inside the brake's enlarged hit area. */
      overBrake: boolean;
    }
  /** Also used for pointercancel and lost pointer capture. */
  | { type: 'pointerUp'; id: number }
  | { type: 'keyDown'; code: string; repeat: boolean }
  | { type: 'keyUp'; code: string }
  /** Pause, blur, hidden page, resize: forget every pointer and key. */
  | { type: 'clearAll' }
  /** "Pokračovat"/"Vyjet" confirmed: nothing held now may drive. */
  | { type: 'resumeLock' };

const KEY_CONTROLS: Readonly<Record<string, KeyControl>> = {
  ArrowRight: 'throttle',
  Space: 'throttle',
  ArrowLeft: 'brake',
};

export function initialInputState(): InputState {
  return { pointers: [], keys: [] };
}

function resumeLockActive(state: InputState): boolean {
  return (
    state.pointers.some((pointer) => pointer.heldAcrossResume) ||
    state.keys.some((key) => key.heldAcrossResume)
  );
}

function isLeftSwipe(
  pointer: PointerState,
  clientX: number,
  clientY: number,
  timeMs: number,
  config: InputConfig,
): boolean {
  const dx = clientX - pointer.startClientX;
  const dy = clientY - pointer.startClientY;
  return (
    timeMs - pointer.downAtMs <= config.leftSwipeMaxDurationMs &&
    -dx >= config.leftSwipeDistanceCssPx &&
    Math.abs(dx) >= config.leftSwipeHorizontalRatio * Math.abs(dy)
  );
}

export function reduceInput(
  state: InputState,
  event: InputEvent,
  config: InputConfig,
): InputState {
  switch (event.type) {
    case 'pointerDown': {
      if (state.pointers.some((pointer) => pointer.id === event.id))
        return state;
      if (state.pointers.length >= config.maxPointers) return state;
      const pointer: PointerState = {
        id: event.id,
        role: resumeLockActive(state) ? 'ignored' : event.role,
        startClientX: event.clientX,
        startClientY: event.clientY,
        downAtMs: event.timeMs,
        brakeLatched: false,
        heldAcrossResume: false,
      };
      return { ...state, pointers: [...state.pointers, pointer] };
    }
    case 'pointerMove': {
      const pointers = state.pointers.map((pointer) => {
        if (
          pointer.id !== event.id ||
          pointer.role !== 'drive' ||
          pointer.brakeLatched
        ) {
          return pointer;
        }
        const latch =
          event.overBrake ||
          isLeftSwipe(
            pointer,
            event.clientX,
            event.clientY,
            event.timeMs,
            config,
          );
        return latch ? { ...pointer, brakeLatched: true } : pointer;
      });
      return { ...state, pointers };
    }
    case 'pointerUp':
      return {
        ...state,
        pointers: state.pointers.filter((pointer) => pointer.id !== event.id),
      };
    case 'keyDown': {
      const control = KEY_CONTROLS[event.code];
      if (!control || event.repeat) return state;
      if (state.keys.some((key) => key.code === event.code)) return state;
      if (resumeLockActive(state)) return state;
      return {
        ...state,
        keys: [
          ...state.keys,
          { code: event.code, control, heldAcrossResume: false },
        ],
      };
    }
    case 'keyUp':
      return {
        ...state,
        keys: state.keys.filter((key) => key.code !== event.code),
      };
    case 'clearAll':
      return initialInputState();
    case 'resumeLock':
      return {
        pointers: state.pointers.map((pointer) => ({
          ...pointer,
          role: 'ignored',
          heldAcrossResume: true,
        })),
        keys: state.keys.map((key) => ({ ...key, heldAcrossResume: true })),
      };
  }
}

/** Brake wins over throttle; nothing held means coasting (doc 02 §4). */
export function motionIntent(state: InputState): MotionIntent {
  const activeKeys = state.keys.filter((key) => !key.heldAcrossResume);
  const braking =
    state.pointers.some(
      (pointer) =>
        pointer.role === 'brake' ||
        (pointer.role === 'drive' && pointer.brakeLatched),
    ) || activeKeys.some((key) => key.control === 'brake');
  if (braking) return 'BRAKE';
  const driving =
    state.pointers.some((pointer) => pointer.role === 'drive') ||
    activeKeys.some((key) => key.control === 'throttle');
  return driving ? 'THROTTLE' : 'COAST';
}
