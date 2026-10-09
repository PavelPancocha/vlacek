import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  initialInputState,
  motionIntent,
  reduceInput,
  type InputEvent,
  type InputState,
} from '../../../src/domain/input/InputReducer.ts';

const config = gameConfig.input;

function apply(...events: InputEvent[]): InputState {
  return events.reduce(
    (state, event) => reduceInput(state, event, config),
    initialInputState(),
  );
}

const down = (
  id: number,
  role: 'drive' | 'brake' | 'ui',
  clientX = 600,
  clientY = 400,
  timeMs = 0,
): InputEvent => ({ type: 'pointerDown', id, role, clientX, clientY, timeMs });
const move = (
  id: number,
  clientX: number,
  clientY: number,
  timeMs: number,
  overBrake = false,
): InputEvent => ({
  type: 'pointerMove',
  id,
  clientX,
  clientY,
  timeMs,
  overBrake,
});
const up = (id: number): InputEvent => ({ type: 'pointerUp', id });
const keyDown = (code: string, repeat = false): InputEvent => ({
  type: 'keyDown',
  code,
  repeat,
});
const keyUp = (code: string): InputEvent => ({ type: 'keyUp', code });

describe('InputReducer', () => {
  it('coasts without any input', () => {
    expect(motionIntent(initialInputState())).toBe('COAST');
  });

  it('INP-04: brake wins over a held throttle and throttle resumes after it', () => {
    const both = apply(down(1, 'drive'), down(2, 'brake', 40, 680));
    expect(motionIntent(both)).toBe('BRAKE');
    expect(motionIntent(reduceInput(both, up(2), config))).toBe('THROTTLE');
  });

  it('INP-14: a world pointer is throttle wherever it starts', () => {
    expect(motionIntent(apply(down(1, 'drive', 10, 300)))).toBe('THROTTLE');
  });

  it('INP-06: UI pointers never drive, even when moved over the world', () => {
    const state = apply(down(1, 'ui', 1200, 40), move(1, 600, 400, 100));
    expect(motionIntent(state)).toBe('COAST');
  });

  it('INP-06: UI pointers never brake, even when moved over the brake', () => {
    const state = apply(down(1, 'ui', 1200, 680), move(1, 40, 680, 100, true));
    expect(motionIntent(state)).toBe('COAST');
  });

  describe('INP-07: left swipe', () => {
    it('latches the brake above the threshold until the pointer lifts', () => {
      const swiped = apply(
        down(1, 'drive', 600, 400, 0),
        move(1, 530, 410, 200),
      );
      expect(motionIntent(swiped)).toBe('BRAKE');
      const turnedBack = reduceInput(swiped, move(1, 700, 400, 400), config);
      expect(motionIntent(turnedBack)).toBe('BRAKE');
      expect(motionIntent(reduceInput(turnedBack, up(1), config))).toBe(
        'COAST',
      );
    });

    it('does not brake below the distance threshold', () => {
      expect(
        motionIntent(
          apply(down(1, 'drive', 600, 400, 0), move(1, 540, 400, 200)),
        ),
      ).toBe('THROTTLE');
    });

    it('does not brake after the recognition window', () => {
      expect(
        motionIntent(
          apply(down(1, 'drive', 600, 400, 0), move(1, 500, 400, 501)),
        ),
      ).toBe('THROTTLE');
    });

    it('does not brake for a mostly vertical drag', () => {
      expect(
        motionIntent(
          apply(down(1, 'drive', 600, 400, 0), move(1, 530, 460, 200)),
        ),
      ).toBe('THROTTLE');
    });

    it('starts as throttle again on the next touch', () => {
      const state = apply(
        down(1, 'drive', 600, 400, 0),
        move(1, 500, 400, 100),
        up(1),
        down(2, 'drive', 600, 400, 1000),
      );
      expect(motionIntent(state)).toBe('THROTTLE');
    });
  });

  it('INP-08: dragging a world pointer onto the brake latches the brake', () => {
    const onBrake = apply(
      down(1, 'drive', 600, 400, 0),
      move(1, 60, 680, 2000, true),
    );
    expect(motionIntent(onBrake)).toBe('BRAKE');
    const leftBrake = reduceInput(onBrake, move(1, 600, 400, 2500), config);
    expect(motionIntent(leftBrake)).toBe('BRAKE');
  });

  it('INP-09: lifting or cancelling ends throttle and brake; unknown ids are harmless', () => {
    expect(motionIntent(apply(down(1, 'drive'), up(1)))).toBe('COAST');
    expect(motionIntent(apply(down(1, 'brake'), up(1)))).toBe('COAST');
    expect(motionIntent(apply(up(42), move(43, 1, 1, 1)))).toBe('COAST');
  });

  it('INP-10: clearing input drops pointers and keys; stale events stay inert', () => {
    const state = apply(
      down(1, 'drive'),
      keyDown('ArrowRight'),
      { type: 'clearAll' },
      move(1, 300, 400, 100, true),
      keyDown('ArrowRight', true),
    );
    expect(motionIntent(state)).toBe('COAST');
    expect(state.pointers).toEqual([]);
  });

  describe('INP-11: resume lock', () => {
    it('the confirming touch never drives, even when held', () => {
      const state = apply(
        down(1, 'ui'),
        { type: 'resumeLock' },
        move(1, 600, 400, 100),
      );
      expect(motionIntent(state)).toBe('COAST');
    });

    it('new touches during the lock stay inert for their whole lifetime', () => {
      const state = apply(
        down(1, 'ui'),
        { type: 'resumeLock' },
        down(2, 'drive'),
        up(1),
      );
      expect(motionIntent(state)).toBe('COAST');
    });

    it('a fresh touch after all locked pointers are lifted drives', () => {
      const state = apply(
        down(1, 'ui'),
        { type: 'resumeLock' },
        down(2, 'drive'),
        up(1),
        up(2),
        down(3, 'drive'),
      );
      expect(motionIntent(state)).toBe('THROTTLE');
    });

    it('keys held across the confirmation stay inert until released', () => {
      const held = apply(keyDown('ArrowRight'), { type: 'resumeLock' });
      expect(motionIntent(held)).toBe('COAST');
      expect(
        motionIntent(reduceInput(held, keyDown('ArrowRight', true), config)),
      ).toBe('COAST');
      const again = apply(
        keyDown('ArrowRight'),
        { type: 'resumeLock' },
        keyUp('ArrowRight'),
        keyDown('ArrowRight'),
      );
      expect(motionIntent(again)).toBe('THROTTLE');
    });
  });

  it('INP-12: tracks five pointers, ignores more, keeps a held brake', () => {
    const state = apply(
      down(1, 'brake'),
      down(2, 'drive'),
      down(3, 'drive'),
      down(4, 'drive'),
      down(5, 'drive'),
      down(6, 'drive'),
    );
    expect(state.pointers).toHaveLength(5);
    expect(motionIntent(state)).toBe('BRAKE');
    const released = apply(
      down(1, 'brake'),
      down(2, 'drive'),
      down(3, 'drive'),
      down(4, 'drive'),
      down(5, 'drive'),
      down(6, 'drive'),
      up(1),
      up(2),
      up(3),
      up(4),
      up(5),
    );
    // Pointer 6 was never tracked, so lifting the others leaves nothing.
    expect(motionIntent(released)).toBe('COAST');
  });

  it('INP-12: alternating cancels and taps stay consistent', () => {
    let state = initialInputState();
    for (let i = 0; i < 30; i++) {
      state = reduceInput(
        state,
        down(i, i % 3 === 0 ? 'brake' : 'drive'),
        config,
      );
      state = reduceInput(state, up(i), config);
    }
    expect(state.pointers).toEqual([]);
    expect(motionIntent(state)).toBe('COAST');
  });

  describe('keyboard', () => {
    it('ArrowRight and Space throttle; auto-repeat does not stack', () => {
      expect(motionIntent(apply(keyDown('ArrowRight')))).toBe('THROTTLE');
      expect(
        motionIntent(
          apply(
            keyDown('Space'),
            keyDown('Space', true),
            keyDown('Space', true),
            keyUp('Space'),
          ),
        ),
      ).toBe('COAST');
    });

    it('ArrowLeft brakes and wins over throttle keys', () => {
      expect(
        motionIntent(apply(keyDown('ArrowRight'), keyDown('ArrowLeft'))),
      ).toBe('BRAKE');
    });

    it('releasing one of two throttle keys keeps throttle', () => {
      expect(
        motionIntent(
          apply(keyDown('ArrowRight'), keyDown('Space'), keyUp('Space')),
        ),
      ).toBe('THROTTLE');
    });

    it('ignores keys that are not driving controls', () => {
      expect(motionIntent(apply(keyDown('KeyH'), keyDown('Escape')))).toBe(
        'COAST',
      );
    });

    it('an auto-repeat without a prior press does not start throttle', () => {
      expect(motionIntent(apply(keyDown('ArrowRight', true)))).toBe('COAST');
    });
  });
});
