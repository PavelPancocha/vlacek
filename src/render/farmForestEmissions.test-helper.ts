import type Phaser from 'phaser';
import { FarmForestView } from './FarmForestView.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';
import type { Season } from '../domain/world/Regions.ts';

/** Exercise the renderer's real attachment and animation choices; only Phaser objects are doubles. */
export function farmForestEmissions(prop: SceneryProp, season: Season) {
  const frames: { key: string; texture: string }[] = [];
  class ObjectDouble {
    x = 0;
    y = 0;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    frame = { width: 512, height: 512 };
    setName() {
      return this;
    }
    setData() {
      return this;
    }
    setOrigin() {
      return this;
    }
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
    setScale(x: number, y = x) {
      this.scaleX = x;
      this.scaleY = y;
      return this;
    }
    setRotation(r: number) {
      this.rotation = r;
      return this;
    }
    setVisible() {
      return this;
    }
    add() {
      return this;
    }
    addAt() {
      return this;
    }
    setTexture(texture: string, key: string) {
      frames.push({ key, texture });
      return this;
    }
  }
  const scene = {
    add: {
      image: (_x: number, _y: number, texture: string, key: string) =>
        new ObjectDouble().setTexture(texture, key),
      container: (x = 0, y = 0) => new ObjectDouble().setPosition(x, y),
    },
  } as unknown as Phaser.Scene;
  const view = new FarmForestView(
    scene,
    prop,
    'first-page',
    1,
    season,
    (key) => `page:${key}`,
  );
  for (let time = 0; time <= 48; time++) view.update(time);
  return frames;
}
