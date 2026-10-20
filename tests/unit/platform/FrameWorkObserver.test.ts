import { afterEach, expect, it, vi } from 'vitest';
import { FramePacing } from '../../../src/platform/FrameStats.ts';
import {
  observeAudioDecodes,
  observeCompositionWork,
} from '../../../src/platform/FrameWorkObserver.ts';
import { TextureMemory } from '../../../src/render/TextureMemory.ts';

afterEach(() => vi.unstubAllGlobals());
it('records composition canvas-to-upload duration and actual GPU readbacks, and restores the ledger method', () => {
  const memory = new TextureMemory(),
    pacing = new FramePacing();
  const original: unknown = Reflect.get(memory, 'set');
  const stop = observeCompositionWork(memory, undefined, pacing);
  memory.set('canvas:composition:1', { canvas: 64 });
  memory.set('texture:composition:1', { canvas: 64 });
  expect(pacing.snapshot().events).toHaveLength(0);
  memory.set('texture:composition:1', { canvas: 64 });
  const events = pacing.snapshot().events;
  expect(events).toHaveLength(1);
  expect(events[0]?.slice(3)).toEqual([1, 0]);
  expect(memory.snapshot.bytes).toBe(128);
  stop();
  expect(Reflect.get(memory, 'set')).toBe(original);
  memory.set('canvas:composition:2', { canvas: 8 });
  expect(pacing.snapshot().events).toHaveLength(1);
});
it('preserves the successful decode promise identity, records success and restores on teardown', async () => {
  const decoded = Promise.resolve('buffer');
  class Context {
    decodeAudioData() {
      return decoded;
    }
  }
  vi.stubGlobal('AudioContext', Context);
  const original: unknown = Reflect.get(Context.prototype, 'decodeAudioData');
  const pacing = new FramePacing();
  const stop = observeAudioDecodes(pacing);
  const returned = new Context().decodeAudioData();
  expect(returned).toBe(decoded);
  expect(await returned).toBe('buffer');
  expect(pacing.snapshot().events[0]?.slice(3)).toEqual([6, 1]);
  stop();
  expect(Reflect.get(Context.prototype, 'decodeAudioData')).toBe(original);
});

it('preserves the rejected decode promise and rejection identity, recording failure detail 0', async () => {
  const error = new Error('decode failed');
  const decoded = Promise.reject(error);
  class Context {
    decodeAudioData() {
      return decoded;
    }
  }
  vi.stubGlobal('AudioContext', Context);
  const pacing = new FramePacing();
  const stop = observeAudioDecodes(pacing);
  try {
    const returned = new Context().decodeAudioData();
    expect(returned).toBe(decoded);
    await expect(returned).rejects.toBe(error);
    expect(pacing.snapshot().events[0]?.slice(3)).toEqual([6, 0]);
  } finally {
    stop();
  }
});

it('does not attribute an old journey decode to a reset ride', async () => {
  let resolve: (() => void) | undefined;
  class Context {
    decodeAudioData() {
      return new Promise<void>((done) => {
        resolve = done;
      });
    }
  }
  vi.stubGlobal('AudioContext', Context);
  const p = new FramePacing(),
    stop = observeAudioDecodes(p);
  const pending = new Context().decodeAudioData();
  p.reset();
  resolve?.();
  await pending;
  expect(p.snapshot().events).toEqual([]);
  stop();
});

it('counts only the readbacks enclosed by a composition and restores the exact GPU method', () => {
  const original = vi.fn();
  // Browser boundary double implements only the method this observer borrows.
  const gl = { readPixels: original } as unknown as WebGLRenderingContext;
  const memory = new TextureMemory(),
    pacing = new FramePacing();
  const stop = observeCompositionWork(memory, gl, pacing);
  gl.readPixels(0, 0, 1, 1, 0, 0, null);
  memory.set('canvas:composition:7', { canvas: 16 });
  gl.readPixels(0, 0, 1, 1, 0, 0, null);
  gl.readPixels(0, 0, 1, 1, 0, 0, null);
  memory.set('texture:composition:7', { canvas: 16 });
  memory.set('texture:composition:7', { canvas: 4, gpu: 16 });
  expect(pacing.snapshot().events[0]?.[4]).toBe(2);
  expect(original).toHaveBeenCalledTimes(3);
  stop();
  expect(Reflect.get(gl, 'readPixels')).toBe(original);
});
