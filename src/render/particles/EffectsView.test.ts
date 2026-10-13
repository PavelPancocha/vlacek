import type Phaser from 'phaser';
import { expect, it } from 'vitest';
import { worldParts } from '../../content/worldArt.ts';
import { EffectsView } from './EffectsView.ts';
import { ParticleField } from './ParticleField.ts';
import { PARTICLE_KINDS, kindIndex } from './particleKinds.ts';

class ImageDouble {
  frame = { width: 26, height: 26 };
  scale = 0;
  destroyed = false;
  setDepth(): this {
    return this;
  }
  setVisible(): this {
    return this;
  }
  setPosition(): this {
    return this;
  }
  setScale(scale: number): this {
    this.scale = scale;
    return this;
  }
  setAlpha(): this {
    return this;
  }
  setRotation(): this {
    return this;
  }
  setFlipX(): this {
    return this;
  }
  setOrigin(): this {
    return this;
  }
  setFrame(): this {
    return this;
  }
  destroy(): void {
    this.destroyed = true;
  }
}

it('camera-1: the rendered bubble circle is at least 12 CSS px; other particles keep their world size and pooled images', () => {
  const images: ImageDouble[] = [];
  // The DOM-free renderer double implements only the Image API exercised here.
  const scene = {
    add: {
      image: () => {
        const image = new ImageDouble();
        images.push(image);
        return image;
      },
    },
  } as unknown as Phaser.Scene;
  const view = new EffectsView(scene, 1);
  view.setAtlas('test', 1);
  const field = new ParticleField(PARTICLE_KINDS, 2, () => 0.5);
  field.emit(kindIndex('bubble'), 100, 50, 1);
  field.emit(kindIndex('smoke'), 200, 50, 1);
  field.step(0.5);
  const smoke = field.particles().find((p) => p.kind === kindIndex('smoke'));
  if (!smoke) throw new Error('smoke fixture missing');
  for (const width of [1280, 1140, 844, 568]) {
    const unitsPerCss = 2000 / (0.6 * width);
    view.draw(field, 0, unitsPerCss);
    const bubbleImage = images[0];
    const smokeImage = images[1];
    if (!bubbleImage || !smokeImage)
      throw new Error('particle drawing missing');
    expect((bubbleImage.scale * 21) / unitsPerCss).toBeCloseTo(12, 9);
    expect(smokeImage.scale * worldParts['fx.smoke'].widthU).toBeCloseTo(
      field.sizeOf(smoke),
      9,
    );
    expect(images).toHaveLength(2);
  }
  view.destroy();
  expect(images.every((image) => image.destroyed)).toBe(true);
});
