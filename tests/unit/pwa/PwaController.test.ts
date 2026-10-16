import { afterEach, expect, it, vi } from 'vitest';
import {
  PwaController,
  type PwaState,
} from '../../../src/platform/PwaController.ts';

afterEach(() => vi.unstubAllGlobals());

it('does not promise this page is offline-ready when registration downloaded a newer release', async () => {
  vi.stubGlobal('window', Object.assign(new EventTarget(), { setTimeout }));
  vi.stubGlobal(
    'document',
    Object.assign(new EventTarget(), { hidden: false }),
  );
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  const worker = {
    state: 'activated',
    postMessage: (_message: string, ports: MessagePort[]) => {
      ports[0]?.postMessage({ ready: true, buildId: 'new-release' });
    },
  };
  const registration = Object.assign(new EventTarget(), {
    active: worker,
    waiting: null,
    installing: null,
  });
  vi.stubGlobal('navigator', {
    serviceWorker: Object.assign(new EventTarget(), {
      controller: null,
      register: () => Promise.resolve(registration),
    }),
  });
  const states: PwaState[] = [];
  const controller = new PwaController(
    true,
    '/',
    'this-page-release',
    (state) => states.push(state),
  );
  try {
    controller.afterFirstFrame();
    await vi.waitFor(() => expect(states.at(-1)?.buildId).toBe('new-release'));
    expect(states.at(-1)?.offline).toBe('offline není dostupné');
  } finally {
    controller.dispose();
  }
});
