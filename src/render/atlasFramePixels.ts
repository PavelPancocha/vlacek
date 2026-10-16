import type Phaser from 'phaser';
import type { TextureMemory } from './TextureMemory.ts';

/** Borrow CPU pixels, or own a temporary upright, straight-alpha GPU-frame readback. */
export function atlasFramePixels(
  scene: Phaser.Scene,
  texture: string,
  key: string,
  memory: TextureMemory,
  owner: string,
) {
  const frame = scene.textures.getFrame(texture, key);
  if (!frame || frame.name !== key)
    throw new Error(`missing composition frame ${key}`);
  const image = frame.source.image;
  if (image instanceof HTMLCanvasElement || image instanceof HTMLImageElement)
    return {
      image,
      x: frame.cutX,
      y: frame.cutY,
      width: frame.cutWidth,
      height: frame.cutHeight,
      release() {},
    };
  const renderer = scene.game.renderer;
  const source = frame.source.glTexture;
  if (!('gl' in renderer) || !source)
    throw new Error(`missing composition pixels ${key}`);
  const gl = renderer.gl;
  const binding = (parameter: number) => {
    const value: unknown = gl.getParameter(parameter);
    if (value !== null && !(value instanceof WebGLFramebuffer))
      throw new Error('invalid framebuffer');
    return value;
  };
  const gl2 =
    typeof WebGL2RenderingContext !== 'undefined' &&
    gl instanceof WebGL2RenderingContext
      ? gl
      : undefined;
  const previous = binding(gl.FRAMEBUFFER_BINDING);
  const previousRead = gl2 ? binding(gl2.READ_FRAMEBUFFER_BINDING) : null;
  const framebuffer = gl.createFramebuffer();
  if (!framebuffer) throw new Error('composition framebuffer not created');
  const width = frame.cutWidth,
    height = frame.cutHeight,
    bytes = width * height * 4;
  const pixels = new Uint8Array(bytes);
  memory.set(owner, { imageData: bytes });
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      source.webGLTexture,
      0,
    );
    gl.readPixels(
      frame.cutX,
      frame.source.height - frame.cutY - height,
      width,
      height,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
  } catch (error) {
    memory.remove(owner);
    throw error;
  } finally {
    if (gl2) {
      gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, previous);
      gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, previousRead);
    } else gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
    gl.deleteFramebuffer(framebuffer);
  }
  const rowBytes = width * 4;
  for (let y = 0; y < Math.floor(height / 2); y++)
    for (let x = 0; x < rowBytes; x++) {
      const a = y * rowBytes + x,
        b = (height - 1 - y) * rowBytes + x;
      const value = pixels[a] ?? 0;
      pixels[a] = pixels[b] ?? 0;
      pixels[b] = value;
    }
  for (let i = 0; i < bytes; i += 4) {
    const alpha = pixels[i + 3] ?? 0;
    if (alpha > 0 && alpha < 255)
      for (let c = 0; c < 3; c++)
        pixels[i + c] = Math.min(
          255,
          Math.round(((pixels[i + c] ?? 0) * 255) / alpha),
        );
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    memory.set(owner, { canvas: bytes, imageData: bytes });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no composition readback context');
    context.putImageData(
      new ImageData(new Uint8ClampedArray(pixels.buffer), width, height),
      0,
      0,
    );
    memory.set(owner, { canvas: bytes });
  } catch (error) {
    canvas.width = canvas.height = 1;
    memory.remove(owner);
    throw error;
  }
  return {
    image: canvas,
    x: 0,
    y: 0,
    width,
    height,
    release() {
      canvas.width = canvas.height = 1;
      memory.remove(owner);
    },
  };
}
