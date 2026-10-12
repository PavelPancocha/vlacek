import { describe, expect, it, vi } from 'vitest';
import { FullscreenController } from '../../../src/platform/FullscreenController.ts';

function browser(enabled: boolean | undefined) {
  const events = new EventTarget();
  const documentElement = {
    requestFullscreen: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  };
  const document = {
    fullscreenEnabled: enabled,
    fullscreenElement: null as unknown,
    documentElement,
    exitFullscreen: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  const changed = vi.fn();
  // Only the browser boundary is mocked; the controller reads real state/events.
  const controller = new FullscreenController(document, changed);
  return { document, controller, events, changed };
}

describe('FullscreenController (PWA-07 / PWA-08)', () => {
  it('requests the document element only on toggle and exits from real state', async () => {
    const { controller, document } = browser(true);
    expect(controller.supported).toBe(true);
    expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled();
    const entering = controller.toggle();
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    await entering;
    expect(controller.active).toBe(false);
    document.fullscreenElement = document.documentElement;
    expect(controller.active).toBe(true);
    await controller.toggle();
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
  });

  it.each([false, undefined])(
    'does nothing when fullscreenEnabled is %s',
    async (enabled) => {
      const { controller, document } = browser(enabled);
      expect(controller.supported).toBe(false);
      await controller.toggle();
      expect(document.documentElement.requestFullscreen).not.toHaveBeenCalled();
    },
  );

  it.each(['requestFullscreen', 'exitFullscreen'])(
    'hides partial APIs missing %s',
    async (method) => {
      const { controller, document } = browser(true);
      Object.defineProperty(
        method === 'requestFullscreen' ? document.documentElement : document,
        method,
        { value: undefined },
      );
      expect(controller.supported).toBe(false);
      await controller.toggle();
      expect(controller.failed).toBe(false);
    },
  );

  it('catches denial and prevents repeated requests for this page', async () => {
    const { controller, document, changed } = browser(true);
    document.documentElement.requestFullscreen.mockRejectedValue(
      new Error('denied'),
    );
    await controller.toggle();
    expect(controller.failed).toBe(true);
    expect(controller.pending).toBe(false);
    expect(controller.active).toBe(false);
    expect(changed).toHaveBeenCalled();
    await controller.toggle();
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce();
  });

  it('ignores another tap while a request is pending', async () => {
    const { controller, document } = browser(true);
    let finish: () => void = () => undefined;
    document.documentElement.requestFullscreen.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const entering = controller.toggle();
    expect(controller.pending).toBe(true);
    await controller.toggle();
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce();
    finish();
    await entering;
    expect(controller.pending).toBe(false);
  });

  it('catches a rejected exit without losing the real fullscreen state', async () => {
    const { controller, document } = browser(true);
    document.fullscreenElement = document.documentElement;
    document.exitFullscreen.mockRejectedValue(new Error('exit denied'));
    await controller.toggle();
    expect(controller.failed).toBe(true);
    expect(controller.active).toBe(true);
    await controller.toggle();
    expect(document.exitFullscreen).toHaveBeenCalledOnce();
  });

  it('does not notify or request after disposal, including a pending request', async () => {
    const { controller, document, changed } = browser(true);
    let finish: () => void = () => undefined;
    document.documentElement.requestFullscreen.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const entering = controller.toggle();
    controller.dispose();
    finish();
    await entering;
    expect(changed).not.toHaveBeenCalled();
    await controller.toggle();
    expect(document.documentElement.requestFullscreen).toHaveBeenCalledOnce();
  });

  it('reflects external fullscreen changes and releases its sole listener', () => {
    const { controller, document, events, changed } = browser(true);
    document.fullscreenElement = document.documentElement;
    events.dispatchEvent(new Event('fullscreenchange'));
    expect(controller.active).toBe(true);
    expect(changed).toHaveBeenCalledOnce();
    document.fullscreenElement = null;
    events.dispatchEvent(new Event('fullscreenchange'));
    expect(controller.active).toBe(false);
    expect(changed).toHaveBeenCalledTimes(2);
    controller.dispose();
    events.dispatchEvent(new Event('fullscreenchange'));
    expect(changed).toHaveBeenCalledTimes(2);
  });
});
