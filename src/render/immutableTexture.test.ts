import { expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { immutableTexture } from './immutableTexture.ts';
import { TextureMemory } from './TextureMemory.ts';
it.each([false, true])(
  'keeps baked ground to one pixel copy with gpu=%s, counting upload overlap',
  (gpu) => {
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const add = vi.fn();
    const texture = { add: vi.fn() };
    const scene = {
      game: { renderer: gpu ? { gl: {} } : {} },
      textures: { addCanvas: add, create: () => texture },
    };
    const memory = new TextureMemory();
    // Boundary supplies the concrete renderer and immutable texture API only.
    immutableTexture(
      scene as unknown as Phaser.Scene,
      'ground',
      canvas,
      memory,
    );
    expect(add).not.toHaveBeenCalled();
    expect(memory.snapshot.imageData).toBe(0);
    expect(memory.snapshot.bytes).toBe(gpu ? 40004 : 40000);
    expect(memory.snapshot.highWaterBytes).toBe(gpu ? 80000 : 40000);
  },
);

it('removes a partially registered immutable texture if its base frame fails', () => {
  const memory = new TextureMemory();
  const remove = vi.fn();
  const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
  const scene = {
    game: { renderer: {} },
    textures: {
      create: () => ({
        add: () => {
          throw new Error('frame lost');
        },
      }),
      remove,
    },
  };
  // The failing texture supplies only the frame creation boundary.
  expect(() =>
    immutableTexture(
      scene as unknown as Phaser.Scene,
      'failed',
      canvas,
      memory,
    ),
  ).toThrow('frame lost');
  expect(remove).toHaveBeenCalledWith('failed');
  expect(memory.snapshot.bytes).toBe(0);
  expect(canvas.width * canvas.height).toBe(1);
});

it.each([false, true])(
  'counts the same pixels once when texture-added observers run, gpu=%s',
  (gpu) => {
    const memory = new TextureMemory();
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement;
    const scene = {
      game: { renderer: gpu ? { gl: {} } : {} },
      textures: {
        create: (key: string) => {
          // The real texture-added observer records these same source pixels.
          memory.set(`texture:${key}`, { canvas: 40000, gpu: gpu ? 40000 : 0 });
          return { add: vi.fn() };
        },
      },
    };
    // Native texture creation and its allocation event are the platform boundary.
    immutableTexture(
      scene as unknown as Phaser.Scene,
      'observed',
      canvas,
      memory,
    );
    expect(memory.snapshot.highWaterBytes).toBe(gpu ? 80000 : 40000);
    expect(memory.snapshot.bytes).toBe(gpu ? 40004 : 40000);
  },
);
