import { frameTexture } from '../frameTexture.ts';
import type Phaser from 'phaser';
import type { ArtPart } from '../../content/artManifest.ts';
import { worldParts } from '../../content/worldArt.ts';
import { frameOrigin } from '../atlasPacking.ts';
import type { Particle } from './ParticleField.ts';
import type { ParticleField } from './ParticleField.ts';
import { bubbleSizeU } from './bubbleInteraction.ts';

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
  #textureFor: ((frame: string) => string | undefined) | undefined;

  constructor(scene: Phaser.Scene, depth: number) {
    this.#scene = scene;
    this.#depth = depth;
  }

  /** Uses a (re-rasterised) atlas; the pooled images move over to it. */
  setAtlas(
    texture: string,
    pxPerU: number,
    textureFor?: (frame: string) => string | undefined,
  ): void {
    this.#textureFor = textureFor;
    this.#texture = texture;
    this.#pxPerU = pxPerU;
    this.#images.forEach((image, i) => {
      const key = this.#frames[i];
      if (!key) return;
      const resolved = textureFor ? textureFor(key) : texture;
      if (!resolved) {
        image.setTexture('object-sheep').setVisible(false);
        return;
      }
      image.setTexture(resolved, key);
      const part = parts[key];
      if (part) {
        const origin = frameOrigin(part.pivotU, pxPerU, image.frame);
        image.setOrigin(origin.x, origin.y);
      }
    });
  }

  draw(
    field: ParticleField,
    originX: number,
    unitsPerCss = 0,
    opacity?: (particle: Particle, point: { x: number; y: number }) => number,
  ): void {
    const texture = this.#texture;
    const particles = field.particles();
    let used = 0;
    if (texture !== undefined) {
      for (const particle of particles) {
        const frame = field.frameOf(particle);
        const part = frame === undefined ? undefined : parts[frame];
        if (
          frame === undefined ||
          !part ||
          (this.#textureFor && !this.#textureFor(frame))
        )
          continue;
        const image = this.#image(
          used,
          this.#textureFor?.(frame) ?? frameTexture(frame, texture),
          frame,
          part,
        );
        used += 1;
        const at = field.positionOf(particle);
        const alpha = field.alphaOf(particle) * (opacity?.(particle, at) ?? 1);
        let size =
          frame === 'fx.bubble'
            ? bubbleSizeU(field, particle, unitsPerCss)
            : field.sizeOf(particle);
        const kind = field.kindOf(particle);
        if (kind?.sizeCssPx && unitsPerCss > 0) {
          const [fromCss, toCss] = kind.sizeCssPx;
          const ageShare = Math.min(1, particle.age / particle.life);
          const burstScale = particle.sizeStart / kind.sizeU[0];
          size =
            (fromCss + (toCss - fromCss) * ageShare) * burstScale * unitsPerCss;
        }
        const depth = particle.depth ?? this.#depth;
        // Phaser queues a scene-wide sort even when the depth has not changed.
        if (image.depth !== depth) image.setDepth(depth);
        image
          .setVisible(true)
          .setPosition(at.x - originX, at.y)
          .setScale(size / part.widthU / this.#pxPerU)
          .setAlpha(alpha)
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
    const changed =
      this.#frames[index] !== frame || image?.texture.key !== texture;
    if (!image) {
      image = this.#scene.add.image(0, 0, texture, frame).setDepth(this.#depth);
      this.#images[index] = image;
    } else if (changed) {
      image.setTexture(texture, frame);
    }
    if (changed) {
      const origin = frameOrigin(part.pivotU, this.#pxPerU, image.frame);
      image.setOrigin(origin.x, origin.y);
      image.setData('world-part', frame);
      this.#frames[index] = frame;
    }
    return image;
  }
}
