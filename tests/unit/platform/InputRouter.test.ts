import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { InputRouter } from '../../../src/platform/InputRouter.ts';

function setup(objectAt?: (x: number, y: number) => string | undefined) {
  const actions: string[] = [];
  const touched: string[] = [];
  const router = new InputRouter(gameConfig.input, {
    hitObject: objectAt ?? (() => undefined),
    onObjectTouched: (id) => touched.push(id),
    onAction: (action) => actions.push(action),
  });
  router.setBrakeHitArea({ left: 0, top: 560, width: 160, height: 160 });
  return { router, actions, touched };
}

const at = (
  id: number,
  clientX: number,
  clientY: number,
  timeMs = 0,
  action?: string,
) =>
  action === undefined
    ? { id, clientX, clientY, timeMs }
    : { id, clientX, clientY, timeMs, action };

describe('InputRouter (ride mode)', () => {
  it('INP-14: a world touch anywhere outside controls is throttle, also on the left', () => {
    const { router } = setup();
    router.setMode('ride');
    router.pointerDown(at(1, 200, 300));
    expect(router.intent()).toBe('THROTTLE');
  });

  it('the brake area (and its enlarged hit rect) brakes, never throttles', () => {
    const { router } = setup();
    router.setMode('ride');
    router.pointerDown(at(1, 150, 570));
    expect(router.intent()).toBe('BRAKE');
  });

  it('INP-06: HUD buttons act on press and never drive or touch objects', () => {
    const { router, actions, touched } = setup(() => 'g0:chunk:1:object:0');
    router.setMode('ride');
    router.pointerDown(at(1, 1200, 680, 0, 'horn'));
    router.pointerDown(at(2, 1240, 40, 0, 'pause'));
    expect(actions).toEqual(['horn', 'pause']);
    expect(touched).toEqual([]);
    expect(router.intent()).toBe('COAST');
  });

  it('INP-05: touching an object reacts once and drives at the same time', () => {
    const { router, touched } = setup(() => 'g0:chunk:1:object:0');
    router.setMode('ride');
    router.pointerDown(at(1, 700, 420));
    router.pointerMove(at(1, 720, 420, 100));
    expect(touched).toEqual(['g0:chunk:1:object:0']);
    expect(router.intent()).toBe('THROTTLE');
  });

  it('INP-08: dragging from the world onto the brake latches it until lifted', () => {
    const { router } = setup();
    router.setMode('ride');
    router.pointerDown(at(1, 700, 420, 0));
    router.pointerMove(at(1, 80, 640, 1500));
    router.pointerMove(at(1, 700, 420, 1800));
    expect(router.intent()).toBe('BRAKE');
    router.pointerUp({ id: 1 });
    expect(router.intent()).toBe('COAST');
  });

  it('INP-09: cancel ends input like lifting', () => {
    const { router } = setup();
    router.setMode('ride');
    router.pointerDown(at(1, 700, 420));
    router.pointerCancel({ id: 1 });
    expect(router.intent()).toBe('COAST');
  });

  it('keyboard: H horns once per press, Escape pauses, arrows drive', () => {
    const { router, actions } = setup();
    router.setMode('ride');
    router.keyDown({ code: 'KeyH', repeat: false });
    router.keyDown({ code: 'KeyH', repeat: true });
    router.keyDown({ code: 'Escape', repeat: false });
    router.keyDown({ code: 'ArrowRight', repeat: false });
    expect(actions).toEqual(['horn', 'pause']);
    expect(router.intent()).toBe('THROTTLE');
  });
});

describe('InputRouter (menu mode)', () => {
  it('never drives; buttons activate on release over the same target', () => {
    const { router, actions } = setup();
    router.setMode('menu');
    router.pointerDown(at(1, 600, 400));
    router.pointerDown(at(2, 600, 600, 0, 'resume'));
    expect(router.intent()).toBe('COAST');
    router.pointerUp({ id: 2, action: 'resume' });
    expect(actions).toEqual(['resume']);
  });

  it('a press that ends elsewhere or is cancelled (e.g. scrolling) does not activate', () => {
    const { router, actions } = setup();
    router.setMode('menu');
    router.pointerDown(at(1, 100, 100, 0, 'add:cargo_box'));
    router.pointerUp({ id: 1, action: 'add:cargo_coal' });
    router.pointerDown(at(2, 100, 100, 0, 'add:cargo_box'));
    router.pointerCancel({ id: 2 });
    expect(actions).toEqual([]);
  });

  it('keyboard activation of a focused button maps to the same action', () => {
    const { router, actions } = setup();
    router.setMode('menu');
    router.activateByKeyboard('depart');
    expect(actions).toEqual(['depart']);
  });

  it('INP-11: fingers held while resuming stay inert; a fresh touch drives', () => {
    const { router } = setup();
    router.setMode('menu');
    router.pointerDown(at(1, 600, 400));
    router.pointerDown(at(2, 600, 600, 0, 'resume'));
    router.pointerUp({ id: 2, action: 'resume' });
    router.setMode('ride');
    router.resumeLock();
    router.pointerMove(at(1, 610, 400, 100));
    router.pointerDown(at(3, 700, 300, 200));
    expect(router.intent()).toBe('COAST');
    router.pointerUp({ id: 1 });
    router.pointerUp({ id: 3 });
    router.pointerDown(at(4, 700, 300, 400));
    expect(router.intent()).toBe('THROTTLE');
  });

  it('INP-10/13: clearAll drops everything; stale pointer events stay inert', () => {
    const { router } = setup();
    router.setMode('ride');
    router.pointerDown(at(1, 700, 420));
    router.clearAll();
    router.pointerMove(at(1, 80, 640, 100));
    expect(router.intent()).toBe('COAST');
    expect(router.activePointerCount).toBe(0);
  });
});
