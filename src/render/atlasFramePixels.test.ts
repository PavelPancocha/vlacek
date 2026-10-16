import type Phaser from 'phaser';
import { afterEach, expect, it, vi } from 'vitest';
import { atlasFramePixels } from './atlasFramePixels.ts';
import { TextureMemory } from './TextureMemory.ts';
afterEach(() => vi.unstubAllGlobals());
it('reads the resolved GPU frame with upright straight-alpha pixels and releases temporary copies', () => {
  const put = vi.fn();
  class Canvas {
    width = 0;
    height = 0;
    getContext() {
      return { putImageData: put };
    }
  }
  vi.stubGlobal('HTMLCanvasElement', Canvas);
  vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('WebGLFramebuffer', class {});
  vi.stubGlobal(
    'ImageData',
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  vi.stubGlobal('document', { createElement: () => new Canvas() });
  const gl = {
    FRAMEBUFFER: 1,
    FRAMEBUFFER_BINDING: 2,
    COLOR_ATTACHMENT0: 3,
    TEXTURE_2D: 4,
    RGBA: 5,
    UNSIGNED_BYTE: 6,
    createFramebuffer: vi.fn(() => ({})),
    deleteFramebuffer: vi.fn(),
    getParameter: vi.fn(() => null),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    readPixels: vi.fn((_x, _y, _w, _h, _format, _type, pixels: Uint8Array) =>
      pixels.set([0, 0, 255, 255, 128, 0, 0, 128]),
    ),
  };
  const getFrame = vi.fn(() => ({
    name: 'tree',
    cutX: 7,
    cutY: 9,
    cutWidth: 1,
    cutHeight: 2,
    source: { height: 100, image: null, glTexture: { webGLTexture: {} } },
  }));
  // Only the real texture/framebuffer boundary is replaced; pixel conversion runs unchanged.
  const scene = {
    game: { renderer: { gl } },
    textures: { getFrame },
  } as unknown as Phaser.Scene;
  const memory = new TextureMemory();
  const result = atlasFramePixels(
    scene,
    'second-page',
    'tree',
    memory,
    'readback',
  );
  expect(getFrame).toHaveBeenCalledWith('second-page', 'tree');
  expect(gl.readPixels).toHaveBeenCalledWith(
    7,
    89,
    1,
    2,
    5,
    6,
    expect.any(Uint8Array),
  );
  expect(Array.from((put.mock.calls[0]?.[0] as ImageData).data)).toEqual([
    255, 0, 0, 128, 0, 0, 255, 255,
  ]);
  expect(memory.snapshot.highWaterBytes).toBe(16);
  expect(memory.snapshot.bytes).toBe(8);
  result.release();
  expect(memory.snapshot.bytes).toBe(0);
  expect(result.image.width).toBe(1);
  expect(gl.deleteFramebuffer).toHaveBeenCalledOnce();
});
