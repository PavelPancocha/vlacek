import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import { FarmForestView } from './FarmForestView.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';

vi.mock('./frameTexture.ts', () => ({
  frameTexture: (frame: string) => `page:${frame}`,
}));

class Drawing {
  x = 0;
  y = 0;
  scaleX = 1;
  scaleY = 1;
  rotation = 0;
  visible = true;
  frame = { width: 64, height: 64 };
  texture = '';
  key = '';
  setName() {
    return this;
  }
  setOrigin() {
    return this;
  }
  setScale(x: number, y = x) {
    this.scaleX = x;
    this.scaleY = y;
    return this;
  }
  setRotation(value: number) {
    this.rotation = value;
    return this;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setVisible(value: boolean) {
    this.visible = value;
    return this;
  }
  setTexture(texture: string, key: string) {
    this.texture = texture;
    this.key = key;
    return this;
  }
  add() {
    return this;
  }
  addAt() {
    return this;
  }
}

it.each(['back.tractor-work', 'back.farmer-work', 'back.harvester'])(
  'resolves every compound child and changed frame through the world page accessor: %s',
  (kind) => {
    const images: Drawing[] = [];
    // Platform drawing double: production receives a real Phaser scene.
    const scene = {
      add: {
        container: () => new Drawing(),
        image: (_x: number, _y: number, texture: string, key: string) => {
          const image = new Drawing().setTexture(texture, key);
          images.push(image);
          return image;
        },
      },
    } as unknown as Phaser.Scene;
    const prop: SceneryProp = {
      id: 'compound',
      kind,
      xU: 100,
      depth: 0.5,
      scale: 1,
      flip: false,
      layer: 'near',
      phase: 0.95,
      work:
        kind === 'back.tractor-work'
          ? 'snow-clear'
          : kind === 'back.farmer-work'
            ? 'farmer'
            : 'harvester',
    };
    const view = new FarmForestView(scene, prop, 'fallback', 1, 'winter');
    for (const time of [0, 1, 12, 24]) {
      view.update(time);
      for (const image of images)
        expect(image.texture, image.key).toBe(`page:${image.key}`);
    }
    if (kind === 'back.tractor-work')
      expect(images.some((image) => image.key === 'back.snow-blade')).toBe(
        true,
      );
  },
);
