import { vi } from 'vitest';
import type Phaser from 'phaser';
import { ArtAtlas, type ArtAtlasOptions, type ArtSource } from './ArtAtlas.ts';
import { TextureMemory } from './TextureMemory.ts';

class SourceImage {
  removeAttribute = vi.fn();
}

/**
 * Browser boundary for real ArtAtlas/svgSource preparation: Canvas or WebGL
 * texture API, a Chromium-like decoder (decode() never settles once src is
 * removed while pending) and deferred createImageBitmap results.
 */
export function atlasDoubles(renderer: 'canvas' | 'webgl') {
  const textures = new Map<string, unknown>();
  const gl = {
    LINEAR: 1,
    CLAMP_TO_EDGE: 2,
    RGBA: 3,
    TEXTURE_2D: 4,
    UNSIGNED_BYTE: 5,
    NO_ERROR: 0,
    getError: () => 0,
    texSubImage2D: vi.fn(),
  };
  const scene = {
    game: {
      renderer:
        renderer === 'webgl'
          ? {
              gl,
              createTexture2D: () => ({}),
              deleteTexture: vi.fn(),
              glTextureUnits: { bind: vi.fn() },
              glWrapper: { updateTexturing: vi.fn() },
            }
          : {},
    },
    textures: {
      exists: (key: string) => textures.has(key),
      get: (key: string) => ({ getSourceImage: () => textures.get(key) }),
      remove: (key: string) => textures.delete(key),
      addGLTexture: (key: string) => {
        const texture = { add() {} };
        textures.set(key, texture);
        return texture;
      },
      create: (key: string, canvas: unknown) => {
        textures.set(key, canvas);
        return { add() {} };
      },
    },
  };
  vi.stubGlobal('HTMLImageElement', SourceImage);
  vi.stubGlobal('HTMLCanvasElement', SourceImage);
  vi.stubGlobal('document', {
    createElement: () =>
      Object.assign(new SourceImage(), {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
      }),
  });
  vi.stubGlobal(
    'Image',
    class {
      src = '';
      decode() {
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            if (this.src) resolve();
          }, 0),
        );
      }
      removeAttribute() {
        this.src = '';
      }
    },
  );
  vi.stubGlobal('fetch', () => Promise.resolve(new Response('<svg/>')));
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:part');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const bitmaps: { settle: () => void }[] = [];
  const created: { close: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    'createImageBitmap',
    () =>
      new Promise((resolve) => {
        const bitmap = { close: vi.fn() };
        created.push(bitmap);
        bitmaps.push({ settle: () => resolve(bitmap) });
      }),
  );
  const memory = new TextureMemory();
  /** Lets message tasks, timers and microtasks of the preparation run. */
  const settled = async () => {
    for (let i = 0; i < 50; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const owner = (
    texturePrefix: string,
    sources: readonly ArtSource[],
    options: Partial<ArtAtlasOptions> = {},
  ) =>
    // Test boundary implements only the texture API consumed by ArtAtlas/atlasGpu.
    new ArtAtlas(scene as unknown as Phaser.Scene, sources, {
      maxPxPerU: 2,
      texturePrefix,
      decodeOnDemand: true,
      gpuOnly: renderer === 'webgl',
      memory,
      ...options,
    });
  return { textures, memory, bitmaps, created, settled, owner };
}
