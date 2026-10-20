import type { TextureMemory } from '../render/TextureMemory.ts';
import type { FramePacing } from './FrameStats.ts';

/** Debug-only observers; one installation per scene/context, restored by the owner. */
export function observeCompositionWork(
  memory: TextureMemory,
  gl: WebGLRenderingContext | WebGL2RenderingContext | undefined,
  pacing: FramePacing,
): () => void {
  // Borrow native methods without binding them: exact identity is restored on teardown.
  const set: unknown = Reflect.get(memory, 'set');
  if (typeof set !== 'function')
    throw new TypeError('missing texture ledger method');
  const read: unknown = gl ? Reflect.get(gl, 'readPixels') : undefined;
  let active: string | undefined;
  let start = 0,
    readbacks = 0,
    transfers = 0;
  const wrappedSet: TextureMemory['set'] = function (key, allocation) {
    if (key.startsWith('canvas:composition:')) {
      active = key.slice('canvas:'.length);
      start = performance.now();
      readbacks = transfers = 0;
    }
    Reflect.apply(set, memory, [key, allocation]);
    // immutableTexture transfers accounting before create(), then records final ownership.
    if (active && key === `texture:${active}` && ++transfers === 2) {
      pacing.event(
        'compositionBaked',
        start,
        performance.now() - start,
        readbacks,
      );
      active = undefined;
    }
  };
  const wrappedRead =
    typeof read === 'function'
      ? new Proxy(read, {
          apply(target, receiver, args) {
            if (active) readbacks++;
            Reflect.apply(target, receiver, args);
          },
        })
      : undefined;
  memory.set = wrappedSet;
  if (gl && wrappedRead) Reflect.set(gl, 'readPixels', wrappedRead);
  return () => {
    if (Reflect.get(memory, 'set') === wrappedSet)
      Reflect.set(memory, 'set', set);
    if (gl && wrappedRead && Reflect.get(gl, 'readPixels') === wrappedRead)
      Reflect.set(gl, 'readPixels', read);
  };
}

/** Wall latency of asynchronous decode, not main-thread CPU or fetch duration. */
export function observeAudioDecodes(pacing: FramePacing): () => void {
  if (typeof AudioContext === 'undefined') return () => {};
  const prototype = AudioContext.prototype;
  const decode: unknown = Reflect.get(prototype, 'decodeAudioData');
  if (typeof decode !== 'function') return () => {};
  const wrapped = new Proxy(decode, {
    apply(target, receiver, args) {
      const started = performance.now(),
        frame = pacing.frameIndex,
        epoch = pacing.epoch;
      const result: unknown = Reflect.apply(target, receiver, args);
      if (result instanceof Promise) {
        const record = (success: number) => {
          if (epoch === pacing.epoch)
            pacing.event(
              'audioDecode',
              started,
              performance.now() - started,
              success,
              frame,
            );
        };
        void result.then(
          () => record(1),
          () => record(0),
        );
      }
      return result;
    },
  });
  Reflect.set(prototype, 'decodeAudioData', wrapped);
  return () => {
    if (Reflect.get(prototype, 'decodeAudioData') === wrapped)
      Reflect.set(prototype, 'decodeAudioData', decode);
  };
}
