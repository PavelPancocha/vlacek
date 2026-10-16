import { afterEach, expect, it, vi } from 'vitest';
import { svgDocument, svgSource } from './svgSource.ts';
import { AtlasMetrics } from './AtlasMetrics.ts';
import { TextureMemory } from './TextureMemory.ts';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const part = { key: 'part', url: 'part.svg', widthU: 20, heightU: 10 };
it('sizes a vector envelope at the required resolution while preserving the source coordinate system', () => {
  const source =
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10" viewBox="-1 -2 20 10"><path d="M0 0 L20 10"/></svg>';
  const result = svgDocument(part, source, 2);
  expect(result).toContain('width="40" height="20" viewBox="0 0 20 10"');
  expect(result).toContain(source);
});

it('rejects a slow synchronous image decoder entry in the preparation gate', async () => {
  let time = 0;
  const metrics = new AtlasMetrics(() => time);
  class Source {
    set src(_value: string) {
      time += 90;
    }
    decode() {
      time += 20;
      return Promise.resolve();
    }
    removeAttribute() {}
  }
  vi.stubGlobal('Image', Source);
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ close() {} }));
  const source = await svgSource(
    part,
    1,
    new AbortController().signal,
    '<svg/>',
    metrics,
    new TextureMemory(),
    'part',
  );
  source.release();
  expect(metrics.snapshot.stages.prepare.maxMs).toBe(110);
  expect(metrics.snapshot.violations).toContain('prepare');
});
it('rejects a non-SVG response instead of rasterising an empty envelope', () => {
  expect(() => svgDocument(part, '<html>missing</html>', 2)).toThrow(
    'invalid SVG part',
  );
});

it('lets an aborted decode finish instead of detaching it, then releases its accounting', async () => {
  // Chromium (probed with Playwright 1.64): removing src while decode() is pending leaves it unsettled forever.
  const decodes: (() => void)[] = [];
  class Source {
    #src = '';
    set src(value: string) {
      this.#src = value;
    }
    decode() {
      return new Promise<void>((resolve) =>
        decodes.push(() => {
          if (this.#src) resolve();
        }),
      );
    }
    removeAttribute() {
      this.#src = '';
    }
  }
  const bitmap = vi.fn(() => Promise.resolve({ close() {} }));
  vi.stubGlobal('Image', Source);
  vi.stubGlobal('createImageBitmap', bitmap);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:part');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const memory = new TextureMemory();
  const build = new AbortController();
  let outcome = 'pending';
  void svgSource(
    part,
    1,
    build.signal,
    '<svg/>',
    undefined,
    memory,
    'decode:part',
  ).then(
    () => (outcome = 'resolved'),
    () => (outcome = 'rejected'),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  build.abort();
  expect(memory.snapshot.sources).toBe(20 * 10 * 4);
  decodes.forEach((finish) => finish());
  for (let i = 0; i < 5; i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
  expect(outcome).toBe('rejected');
  // The aborted source never starts a bitmap after its decode finished.
  expect(bitmap).not.toHaveBeenCalled();
  expect(memory.snapshot.bytes).toBe(0);
});
