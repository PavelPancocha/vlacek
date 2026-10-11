import type Phaser from 'phaser';
import type { ArtPart } from '../../content/artManifest.ts';
import { worldParts } from '../../content/worldArt.ts';
import { frameOrigin } from '../atlasPacking.ts';
import type { ParticleField } from './ParticleField.ts';

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

/**
 * Draws a particle field from the art atlas with a pool of images that is
 * reused frame to frame (doc 14 §4: bounded, reused). Particles live in
 * world x; the view subtracts the render origin when drawing. Owns its
 * images until `destroy`.
 */
export class EffectsView {
  readonly #scene: Phaser.Scene;
  readonly #depth: number;
  readonly #images: Phaser.GameObjects.Image[] = [];
  readonly #frames: string[] = [];
  #texture: string | undefined;
  #pxPerU = 1;

  constructor(scene: Phaser.Scene, depth: number) {
    this.#scene = scene;
    this.#depth = depth;
  }

  /** Uses a (re-rasterised) atlas; the pooled images move over to it. */
  setAtlas(texture: string, pxPerU: number): void {
    this.#texture = texture;
    this.#pxPerU = pxPerU;
    for (const image of this.#images) image.destroy();
    this.#images.length = 0;
    this.#frames.length = 0;
  }

  draw(field: ParticleField, originX: number): void {
    const texture = this.#texture;
    const particles = field.particles();
    let used = 0;
    if (texture !== undefined) {
      for (const particle of particles) {
        const frame = field.frameOf(particle);
        const part = frame === undefined ? undefined : parts[frame];
        if (frame === undefined || !part) continue;
        const image = this.#image(used, texture, frame, part);
        used += 1;
        const at = field.positionOf(particle);
        const size = field.sizeOf(particle);
        const kind = field.kindOf(particle);
        image
          .setVisible(true)
          .setPosition(at.x - originX, at.y)
          .setScale(size / part.widthU / this.#pxPerU)
          .setAlpha(field.alphaOf(particle))
          .setRotation(
            kind?.alignToMotion === true
              ? Math.atan2(particle.vy, particle.vx)
              : kind?.frameHz !== undefined
                ? 0
                : particle.rotation,
          )
          // Winged sprites face right; they turn round when flying left.
          .setFlipX(kind?.frameHz !== undefined && particle.vx < 0);
      }
    }
    for (let i = used; i < this.#images.length; i++)
      this.#images[i]?.setVisible(false);
  }

  destroy(): void {
    for (const image of this.#images) image.destroy();
    this.#images.length = 0;
    this.#frames.length = 0;
  }

  #image(
    index: number,
    texture: string,
    frame: string,
    part: ArtPart,
  ): Phaser.GameObjects.Image {
    let image = this.#images[index];
    if (!image) {
      image = this.#scene.add.image(0, 0, texture, frame).setDepth(this.#depth);
      this.#images[index] = image;
    } else if (this.#frames[index] !== frame) {
      image.setFrame(frame);
    }
    if (this.#frames[index] !== frame) {
      const origin = frameOrigin(part.pivotU, this.#pxPerU, image.frame);
      image.setOrigin(origin.x, origin.y);
      this.#frames[index] = frame;
    }
    return image;
  }
}
