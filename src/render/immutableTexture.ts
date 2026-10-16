import type Phaser from 'phaser';
import type { TextureMemory } from './TextureMemory.ts';
/** Immutable baked pixels: no CanvasTexture ImageData; GPU context restore re-bakes chunks. */
export function immutableTexture(
  scene: Phaser.Scene,
  key: string,
  canvas: HTMLCanvasElement,
  memory: TextureMemory,
) {
  const bytes = canvas.width * canvas.height * 4;
  const gpu = 'gl' in scene.game.renderer;
  // Transfer ownership before Phaser's addtexture observer sees the same pixels.
  memory.remove(`canvas:${key}`);
  memory.set(`texture:${key}`, { canvas: bytes, gpu: gpu ? bytes : 0 });
  let created = false;
  try {
    const texture = scene.textures.create(key, canvas);
    if (!texture) throw new Error(`texture ${key} not created`);
    created = true;
    texture.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
    if (gpu) {
      canvas.width = 1;
      canvas.height = 1;
    }
    memory.set(`texture:${key}`, {
      canvas: canvas.width * canvas.height * 4,
      gpu: gpu ? bytes : 0,
    });
    return texture;
  } catch (error) {
    memory.remove(`texture:${key}`);
    if (created) scene.textures.remove(key);
    canvas.width = 1;
    canvas.height = 1;
    throw error;
  }
}
