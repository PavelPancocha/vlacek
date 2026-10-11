import Phaser from 'phaser';
import type { RendererPreference } from '../platform/CapabilityProbe.ts';

export type RendererName = 'webgl' | 'canvas';

export interface GameHostOptions {
  parent: HTMLElement;
  renderer: RendererPreference;
  /** Upper bound for the render buffer density (doc 13 `quality.*.maxDpr`). */
  maxDpr: number;
  /** Frame rate cap of the quality profile, 0 for none (doc 13). */
  fpsLimit: number;
  scenes: Phaser.Types.Scenes.SceneType[];
  onReady: (renderer: RendererName) => void;
}

export interface GameHost {
  readonly canvas: HTMLCanvasElement;
  destroy(): void;
}

/**
 * Owns the Phaser game instance. Phaser input, focus handling, audio and the
 * banner are disabled: the single DOM InputRouter and the AudioManager own
 * those concerns. The canvas buffer is sized in device pixels (capped DPR)
 * and zoomed back so its CSS size always matches the parent element.
 */
export function createGameHost(options: GameHostOptions): GameHost {
  const { parent } = options;
  const density = () => Math.min(window.devicePixelRatio || 1, options.maxDpr);
  const cssSize = () => {
    const rect = parent.getBoundingClientRect();
    return {
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    };
  };

  const initial = cssSize();
  const initialDensity = density();
  const game = new Phaser.Game({
    type: options.renderer === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    backgroundColor: '#bfe3f2',
    scale: {
      mode: Phaser.Scale.NONE,
      width: initial.width * initialDensity,
      height: initial.height * initialDensity,
      zoom: 1 / initialDensity,
    },
    input: {
      keyboard: false,
      mouse: false,
      touch: false,
      gamepad: false,
      windowEvents: false,
    },
    // One texture per batch: Phaser 4.2.1's WebGL multi-texture batching
    // drew rotated quads of interleaved textures as sheared wedges (D-010).
    // No MSAA: every edge comes from texture filtering (atlas frame margins,
    // baked ground), and MSAA halved the frame rate on software GL (D-013).
    render: { maxTextures: 1, antialiasGL: false },
    autoFocus: false,
    banner: false,
    audio: { noAudio: true },
    fps: { smoothStep: false, limit: options.fpsLimit },
    scene: options.scenes,
    callbacks: {
      postBoot: (booted) =>
        options.onReady(
          booted.renderer.type === Phaser.WEBGL ? 'webgl' : 'canvas',
        ),
    },
  });

  const observer = new ResizeObserver(() => {
    const size = cssSize();
    const d = density();
    // Resize first: Phaser 4.2.1 `resize` leaves the canvas CSS size alone
    // at zoom 1 (density 1), and `setZoom` writes it from the game size, so
    // only this order stretches nothing at every density.
    game.scale.resize(size.width * d, size.height * d);
    game.scale.setZoom(1 / d);
  });
  observer.observe(parent);

  return {
    // Phaser creates the canvas during boot; read it lazily.
    get canvas() {
      return game.canvas;
    },
    destroy() {
      observer.disconnect();
      game.destroy(true);
    },
  };
}
