import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { FarmForestView } from './FarmForestView.ts';
import { rebindWorldImage } from './worldImage.ts';
import { FRAME_MARGIN_PX } from './atlasPacking.ts';
import { worldParts } from '../content/worldArt.ts';
import type { ArtPart } from '../content/artManifest.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

/**
 * Phaser image boundary: a frame exists only on a page that holds it; a
 * missing frame falls back to the page's base frame, as in Phaser.
 */
class Drawing {
  x = 0;
  y = 0;
  rotation = 0;
  visible = true;
  originX = 0.5;
  originY = 0.5;
  texture = '';
  frame: { name: string; width: number; height: number } = {
    name: '__BASE',
    width: 1,
    height: 1,
  };
  readonly data = new Map<string, unknown>();
  constructor(
    readonly pages: ReadonlySet<string>,
    readonly pxPerU: number,
  ) {}
  setTexture(texture: string, key?: string) {
    this.texture = texture;
    const part = key === undefined ? undefined : parts[key];
    this.frame =
      key !== undefined && part && this.pages.has(texture)
        ? {
            name: key,
            width: Math.ceil(part.widthU * this.pxPerU) + 2 * FRAME_MARGIN_PX,
            height: Math.ceil(part.heightU * this.pxPerU) + 2 * FRAME_MARGIN_PX,
          }
        : { name: '__BASE', width: 2048, height: 1024 };
    return this;
  }
  setOrigin(x: number, y = x) {
    this.originX = x;
    this.originY = y;
    return this;
  }
  setData(name: string, value: unknown) {
    this.data.set(name, value);
    return this;
  }
  getData(name: string) {
    return this.data.get(name);
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }
  setRotation(value: number) {
    this.rotation = value;
    return this;
  }
  setVisible(value: boolean) {
    this.visible = value;
    return this;
  }
  setName() {
    return this;
  }
  setScale() {
    return this;
  }
  add() {
    return this;
  }
  addAt() {
    return this;
  }
}

/** Builds a compound with `textureFor` and returns its images by key. */
function build(
  prop: SceneryProp,
  pxPerU: number,
  textureFor: (key: string) => string | undefined,
) {
  const pages = new Set(['page']);
  // Drawing double: FarmForestView and the rebinding are the real code.
  const scene = {
    add: {
      container: () => new Drawing(pages, pxPerU),
      image: (_x: number, _y: number, texture: string, key: string) =>
        new Drawing(pages, pxPerU).setTexture(texture, key),
    },
  } as unknown as Phaser.Scene;
  const view = new FarmForestView(
    scene,
    prop,
    'old',
    pxPerU,
    'summer',
    textureFor,
  );
  return view.images as unknown as Drawing[];
}

describe('deferred publication keeps authored pivots (D-030)', () => {
  it.each([
    ['back.harvester', 'harvester', 1],
    ['back.forwarder', 'forwarder', 1],
    ['back.harvester', 'harvester', 1.25],
    ['back.forwarder', 'forwarder', 1.25],
  ] as const)(
    '%s (%s) logs match normal initialisation after late publication at %s px/u',
    (kind, work, pxPerU) => {
      const prop: SceneryProp = {
        id: 'compound',
        kind,
        xU: 100,
        depth: 0.5,
        scale: 1,
        flip: false,
        layer: 'back',
        phase: 0.3,
        work,
      };
      const normal = build(prop, pxPerU, () => 'page');
      // The displayed window lacks the trunk while the machine is built.
      const deferred = build(prop, pxPerU, (key) =>
        key === 'back.work-trunk' ? undefined : 'page',
      );
      const logs = (images: Drawing[]) =>
        images.filter(
          (image) => image.getData('world-part') === 'back.work-trunk',
        );
      expect(
        logs(deferred).every((image) => image.frame.name === '__BASE'),
      ).toBe(true);
      for (const image of deferred)
        rebindWorldImage(
          image as unknown as Phaser.GameObjects.Image,
          () => 'page',
          pxPerU,
        );
      // Carried, pickup and stacked logs.
      expect(logs(normal)).toHaveLength(3);
      expect(
        logs(deferred).map((image) => [
          image.frame.name,
          image.originX,
          image.originY,
        ]),
      ).toEqual(
        logs(normal).map((image) => [
          image.frame.name,
          image.originX,
          image.originY,
        ]),
      );
      expect(deferred.map((image) => [image.originX, image.originY])).toEqual(
        normal.map((image) => [image.originX, image.originY]),
      );
    },
  );
});
