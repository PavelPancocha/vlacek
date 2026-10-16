import { afterEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { gpuAtlasPage, atlasUploadTiles } from './atlasGpu.ts';
import { TextureMemory } from './TextureMemory.ts';
afterEach(() => vi.unstubAllGlobals());

it('bounds tall and wide upload payloads without gaps or overlaps', () => {
  for (const [width, height] of [
    [2044, 174],
    [174, 2044],
  ]) {
    if (width === undefined || height === undefined)
      throw new Error('fixture missing');
    const tiles = atlasUploadTiles(width, height);
    expect(tiles.reduce((sum, tile) => sum + tile.width * tile.height, 0)).toBe(
      width * height,
    );
    expect(
      tiles.every(
        (tile) =>
          tile.width <= 256 &&
          tile.height <= 256 &&
          tile.x + tile.width <= width &&
          tile.y + tile.height <= height,
      ),
    ).toBe(true);
    for (let i = 0; i < tiles.length; i++)
      for (const other of tiles.slice(i + 1)) {
        const tile = tiles[i];
        if (!tile) throw new Error('tile missing');
        expect(
          tile.x + tile.width <= other.x ||
            other.x + other.width <= tile.x ||
            tile.y + tile.height <= other.y ||
            other.y + other.height <= tile.y,
        ).toBe(true);
      }
  }
});
it('uploads the top-origin atlas frame in Phaser orientation, including an asymmetric page offset', () => {
  const gl = {
    LINEAR: 1,
    CLAMP_TO_EDGE: 2,
    RGBA: 3,
    TEXTURE_2D: 4,
    UNSIGNED_BYTE: 5,
    texSubImage2D: vi.fn(),
  };
  const texturing = vi.fn();
  const renderer = {
    gl,
    createTexture2D: vi.fn(() => ({})),
    glTextureUnits: { bind: vi.fn() },
    glWrapper: { updateTexturing: texturing },
  };
  const scene = { game: { renderer }, textures: { addGLTexture: () => ({}) } };
  // Adapter boundary supplies the exact Phaser WebGL calls used by the uploader.
  const page = gpuAtlasPage(
    scene as unknown as Phaser.Scene,
    'page',
    100,
    200,
    new TextureMemory(),
    undefined,
  );
  const canvas = { width: 10, height: 20 } as HTMLCanvasElement;
  page.upload(canvas, 2, 3);
  expect(texturing).toHaveBeenCalledWith({
    texturing: { flipY: true, premultiplyAlpha: true },
  });
  expect(gl.texSubImage2D).toHaveBeenCalledWith(4, 0, 2, 177, 3, 5, canvas);
});

it.each(['allocate', 'register'])(
  'releases attempted GPU ownership when %s fails',
  (failure) => {
    const memory = new TextureMemory();
    const wrapper = {};
    const remove = vi.fn();
    const renderer = {
      gl: { LINEAR: 1, CLAMP_TO_EDGE: 2, RGBA: 3 },
      deleteTexture: remove,
      createTexture2D: () => {
        if (failure === 'allocate') throw new Error('GPU lost');
        return wrapper;
      },
    };
    const scene = {
      game: { renderer },
      textures: {
        addGLTexture: () => {
          throw new Error('GPU lost');
        },
      },
    };
    // Allocation/registration failure is supplied at the native adapter boundary.
    expect(() =>
      gpuAtlasPage(
        scene as unknown as Phaser.Scene,
        'failed',
        100,
        100,
        memory,
        undefined,
      ),
    ).toThrow('GPU lost');
    expect(memory.snapshot.bytes).toBe(0);
    if (failure === 'register') expect(remove).toHaveBeenCalledWith(wrapper);
  },
);

it('preserves distinct WebGL2 read/draw framebuffer bindings while copying live pixels', () => {
  class Framebuffer {}
  class GL2 {}
  vi.stubGlobal('WebGLFramebuffer', Framebuffer);
  vi.stubGlobal('WebGL2RenderingContext', GL2);
  const read = new Framebuffer(),
    draw = new Framebuffer(),
    temporary = new Framebuffer();
  const bind = vi.fn(),
    copy = vi.fn(),
    remove = vi.fn();
  const gl = Object.assign(new GL2(), {
    LINEAR: 1,
    CLAMP_TO_EDGE: 2,
    RGBA: 3,
    TEXTURE_2D: 4,
    FRAMEBUFFER: 5,
    FRAMEBUFFER_BINDING: 6,
    COLOR_ATTACHMENT0: 7,
    READ_FRAMEBUFFER: 8,
    DRAW_FRAMEBUFFER: 9,
    READ_FRAMEBUFFER_BINDING: 10,
    getParameter: (key: number) => (key === 10 ? read : draw),
    createFramebuffer: () => temporary,
    bindFramebuffer: bind,
    framebufferTexture2D: vi.fn(),
    copyTexSubImage2D: copy,
    deleteFramebuffer: remove,
  });
  const renderer = {
    gl,
    createTexture2D: () => ({}),
    glTextureUnits: { bind: vi.fn() },
  };
  const scene = { game: { renderer }, textures: { addGLTexture: () => ({}) } };
  // Concrete GL boundary exercises state restoration without a browser-global Phaser scene.
  const page = gpuAtlasPage(
    scene as unknown as Phaser.Scene,
    'page',
    100,
    200,
    new TextureMemory(),
    undefined,
  );
  page.copy(
    {
      cutX: 3,
      cutY: 4,
      source: { height: 100, glTexture: { webGLTexture: {} } },
    } as unknown as Phaser.Textures.Frame,
    2,
    7,
    10,
    20,
  );
  expect(copy).toHaveBeenCalledWith(4, 0, 2, 173, 4, 75, 10, 20);
  expect(bind).toHaveBeenCalledWith(9, draw);
  expect(bind).toHaveBeenCalledWith(8, read);
  expect(remove).toHaveBeenCalledWith(temporary);
});

it('rejects a native GPU upload error before a page can be published', () => {
  const renderer = {
    gl: {
      LINEAR: 1,
      CLAMP_TO_EDGE: 2,
      RGBA: 3,
      NO_ERROR: 0,
      getError: () => 1285,
    },
    createTexture2D: () => ({}),
  };
  const scene = { game: { renderer }, textures: { addGLTexture: () => ({}) } };
  // WebGL reports allocation/upload errors through getError rather than throwing.
  const page = gpuAtlasPage(
    scene as unknown as Phaser.Scene,
    'page',
    100,
    100,
    new TextureMemory(),
    undefined,
  );
  expect(() => page.verify()).toThrow('GPU atlas error 1285');
});
