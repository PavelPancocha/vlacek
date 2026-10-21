import { gameConfig } from '../../config/gameConfig.ts';
import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import { worldParts } from '../../content/worldArt.ts';
import { EffectsView } from './EffectsView.ts';
import { ParticleField } from './ParticleField.ts';
import { PARTICLE_KINDS, kindIndex } from './particleKinds.ts';
import { TrainEffects, type TrainEffectsInput } from './TrainEffects.ts';

class ImageDouble {
  texture = { key: 'test' };
  setData(): this {
    return this;
  }
  setTexture(texture: string): this {
    this.texture.key = texture;
    return this;
  }

  frame = { width: 26, height: 26 };
  scale = 0;
  destroyed = false;
  x = 0;
  y = 0;
  setDepth(): this {
    return this;
  }
  setVisible(): this {
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
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

it('camera-1: the rendered bubble circle is at least 12 CSS px; smoke keeps its world size and images are pooled', () => {
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

it.each([
  { fps: 30, rateScale: 1 },
  { fps: 60, rateScale: 1 },
  { fps: 30, rateScale: 0.5 },
  { fps: 60, rateScale: 0.5 },
])(
  'sparks-3: emit → advance → draw anchors the whole glow lifetime at $fps FPS, rate $rateScale',
  ({ fps, rateScale }) => {
    const images: ImageDouble[] = [];
    // Only the Image API used by EffectsView is needed; no browser or Phaser runtime.
    const scene = {
      add: {
        image: () => {
          const image = new ImageDouble();
          images.push(image);
          return image;
        },
      },
    } as unknown as Phaser.Scene;
    const view = new EffectsView(scene, 7.55);
    view.setAtlas('test', 1);
    const field = new ParticleField(PARTICLE_KINDS, 96, () => 0.5);
    const effects = new TrainEffects(field, () => 0.5);
    const input: TrainEffectsInput = {
      dtSec: 1 / fps,
      speedUPerSec: 0,
      maxSpeedUPerSec: gameConfig.train.maxSpeedUPerSec,
      travelDirection: 1,
      intent: 'THROTTLE',
      emitters: [],
      driverRadiusU: undefined,
      wheels: [],
      front: { x: 0, y: 0, ground: undefined },
      rateScale,
      pantograph: { x: 100, y: -128 },
    };
    effects.step(input); // Standing, then the first movement produces a burst.
    let drawnFrames = 0;
    let glowId: number | undefined;
    for (let frame = 1; frame <= Math.ceil(0.16 * fps); frame++) {
      // A fresh contact value each render, including a changing slope and speed.
      const contact = {
        x: 100 + (frame * gameConfig.train.maxSpeedUPerSec) / fps,
        y: -128 - (frame * frame) / 4,
      };
      effects.step({
        ...input,
        pantograph: contact,
        speedUPerSec: gameConfig.train.maxSpeedUPerSec - frame * 2,
      });
      field.step(input.dtSec); // RideScene advances newborn particles before drawing.
      const glowIndex = field
        .particles()
        .findIndex((p) => p.kind === kindIndex('contact-glow'));
      if (glowIndex < 0) break;
      const glow = field.particles()[glowIndex];
      if (!glow) throw new Error('missing glow');
      glowId ??= glow.id;
      expect(glow.id).toBe(glowId); // Track the same emission through its lifetime.
      for (const cssPerU of [0.342, 0.1704]) {
        view.draw(field, 80, 1 / cssPerU);
        expect(images[glowIndex]?.x).toBeCloseTo(contact.x - 80, 9);
        expect(images[glowIndex]?.y).toBeCloseTo(contact.y, 9);
      }
      const spark = field
        .particles()
        .find((p) => p.kind === kindIndex('contact-spark'));
      expect(spark?.x).toBeLessThan(contact.x); // Loose streaks still fly independently.
      // Interpolation-only render moves the contact without ageing the particles.
      const interpolated = { x: contact.x + 2, y: contact.y - 1 };
      const age = glow.age;
      effects.step({
        ...input,
        dtSec: 0,
        speedUPerSec: gameConfig.train.maxSpeedUPerSec,
        pantograph: interpolated,
      });
      field.step(0);
      view.draw(field, 80);
      expect(images[glowIndex]?.x).toBeCloseTo(interpolated.x - 80, 9);
      expect(images[glowIndex]?.y).toBeCloseTo(interpolated.y, 9);
      expect(glow.age).toBe(age);
      drawnFrames++;
    }
    expect(drawnFrames).toBe(Math.ceil(0.15 * fps) - 1);
    expect(
      field.particles().some((p) => p.kind === kindIndex('contact-glow')),
    ).toBe(false);
    view.destroy();
  },
);

it('sparks-2: contact glow and streaks retain readable CSS sizes at both camera scales, including low glow', () => {
  const images: ImageDouble[] = [];
  const scene = {
    add: {
      image: () => {
        const image = new ImageDouble();
        images.push(image);
        return image;
      },
    },
  } as unknown as Phaser.Scene;
  const view = new EffectsView(scene, 7.55);
  view.setAtlas('test', 1);
  const field = new ParticleField(PARTICLE_KINDS, 3, () => 0.5);
  field.emit(kindIndex('contact-glow'), 100, -128, 1);
  field.emit(kindIndex('contact-spark'), 100, -128, 1);
  field.emit(kindIndex('contact-glow'), 100, -128, 1, { sizeScale: 0.5 });
  field.step(0.05);
  for (const cssPerU of [0.342, 0.1704]) {
    view.draw(field, 0, 1 / cssPerU);
    const glow = images[0],
      spark = images[1],
      lowGlow = images[2];
    if (!glow || !spark || !lowGlow) throw new Error('contact images missing');
    const glowCss = glow.scale * worldParts['fx.contact-glow'].widthU * cssPerU;
    const sparkCss =
      spark.scale * worldParts['fx.contact-spark'].widthU * cssPerU;
    const lowCss =
      lowGlow.scale * worldParts['fx.contact-glow'].widthU * cssPerU;
    expect(glowCss).toBeGreaterThanOrEqual(10);
    expect(glowCss).toBeLessThanOrEqual(16);
    expect(sparkCss).toBeGreaterThanOrEqual(3);
    expect(sparkCss).toBeLessThanOrEqual(6);
    expect(lowCss).toBeGreaterThanOrEqual(6);
    expect(lowCss).toBeLessThanOrEqual(8);
    expect(images).toHaveLength(3);
  }
  view.destroy();
});

it('retargets a pooled particle when its next frame belongs to a different page', () => {
  const image = {
    frame: { width: 50, height: 50 },
    texture: { key: 'page-smoke' },
    setDepth: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    setRotation: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setScale: vi.fn().mockReturnThis(),
    setFlipX: vi.fn().mockReturnThis(),
    setData: vi.fn().mockReturnThis(),
    setFrame: vi.fn().mockReturnThis(),
    setTexture: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  // Boundary fixture supplies only the image API used by EffectsView.
  const scene = { add: { image: () => image } } as unknown as Phaser.Scene;
  const view = new EffectsView(scene, 10);
  view.setAtlas('page-smoke', 1, (frame) =>
    frame === 'fx.smoke' ? 'page-smoke' : 'page-spark',
  );
  const field = new ParticleField(PARTICLE_KINDS, 1, () => 0.5);
  field.emit(kindIndex('smoke'), 0, 0, 1);
  view.draw(field, 0);
  field.clear();
  field.emit(kindIndex('spark'), 0, 0, 1);
  view.draw(field, 0);
  expect(image.setTexture).toHaveBeenCalledWith('page-spark', 'fx.spark');
});
