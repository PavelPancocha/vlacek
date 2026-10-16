import type Phaser from 'phaser';
import type { AtlasMetrics } from './AtlasMetrics.ts';
import type { TextureMemory } from './TextureMemory.ts';

export function atlasUploadTiles(width: number, height: number) {
  const tiles: { x: number; y: number; width: number; height: number }[] = [];
  for (let y = 0; y < height; y += 256)
    for (let x = 0; x < width; x += 256)
      tiles.push({
        x,
        y,
        width: Math.min(256, width - x),
        height: Math.min(256, height - y),
      });
  return tiles;
}

/** Immutable GPU page, rebuilt from SVGs after context restoration (Phaser 4.2.1). */
export function gpuAtlasPage(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  memory: TextureMemory,
  metrics: AtlasMetrics | undefined,
) {
  const renderer = scene.game.renderer;
  if (!('gl' in renderer)) throw new Error('GPU atlas requires WebGL');
  const gl = renderer.gl;
  memory.set(`texture:${key}`, { gpu: width * height * 4 });
  const register = () => {
    let wrapper: ReturnType<typeof renderer.createTexture2D>;
    try {
      wrapper = renderer.createTexture2D(
        0,
        gl.LINEAR,
        gl.LINEAR,
        gl.CLAMP_TO_EDGE,
        gl.CLAMP_TO_EDGE,
        gl.RGBA,
        undefined,
        width,
        height,
        true,
        false,
        true,
      );
    } catch (error) {
      memory.remove(`texture:${key}`);
      throw error;
    }
    let texture: ReturnType<typeof scene.textures.addGLTexture>;
    try {
      texture = scene.textures.addGLTexture(key, wrapper);
    } catch (error) {
      renderer.deleteTexture(wrapper);
      memory.remove(`texture:${key}`);
      throw error;
    }
    if (!texture) {
      renderer.deleteTexture(wrapper);
      memory.remove(`texture:${key}`);
      throw new Error('GPU atlas texture not created');
    }
    return {
      texture,
      verify: () => {
        const error = gl.getError();
        if (error !== gl.NO_ERROR) throw new Error(`GPU atlas error ${error}`);
      },
      copy: (
        source: Phaser.Textures.Frame,
        x: number,
        y: number,
        copyWidth: number,
        copyHeight: number,
      ) => {
        const wrapperSource = source.source.glTexture;
        if (!wrapperSource) throw new Error('missing live GPU page');
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
        if (!framebuffer) throw new Error('atlas copy framebuffer not created');
        try {
          gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            wrapperSource.webGLTexture,
            0,
          );
          renderer.glTextureUnits.bind(wrapper, 0);
          gl.copyTexSubImage2D(
            gl.TEXTURE_2D,
            0,
            x,
            height - y - copyHeight,
            source.cutX + 1,
            source.source.height - source.cutY - 1 - copyHeight,
            copyWidth,
            copyHeight,
          );
        } finally {
          if (gl2) {
            gl2.bindFramebuffer(gl2.DRAW_FRAMEBUFFER, previous);
            gl2.bindFramebuffer(gl2.READ_FRAMEBUFFER, previousRead);
          } else gl.bindFramebuffer(gl.FRAMEBUFFER, previous);
          gl.deleteFramebuffer(framebuffer);
        }
      },
      upload: (canvas: HTMLCanvasElement, x: number, y: number) => {
        renderer.glTextureUnits.bind(wrapper, 0);
        renderer.glWrapper.updateTexturing({
          texturing: { flipY: true, premultiplyAlpha: true },
        });
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          x,
          height - y - canvas.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          canvas,
        );
      },
    };
  };
  return metrics ? metrics.measure('register', register) : register();
}
