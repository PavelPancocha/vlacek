import type Phaser from 'phaser';
import { afterEach, expect, it, vi } from 'vitest';
import { bakeStaticComposition } from './StaticComposition.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';

vi.mock('./frameTexture.ts', () => ({
  frameTexture: (frame: string) => `page:${frame}`,
}));
afterEach(() => vi.unstubAllGlobals());

it.each([
  'near.crop-rows-summer',
  'near.forest-edge-autumn',
  'backdrop.forest-dense-mid-winter',
])('bakes a clipped seasonal frame from its resident page: %s', (kind) => {
  const context = {
    clearRect() {},
    save() {},
    restore() {},
    scale() {},
    translate() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clip() {},
    drawImage() {},
  };
  class Canvas {
    width = 1;
    height = 1;
    getContext() {
      return context;
    }
  }
  vi.stubGlobal('HTMLCanvasElement', Canvas);
  vi.stubGlobal('document', { createElement: () => new Canvas() });
  const pages: string[] = [];
  const scene = {
    textures: {
      get: (texture: string) => {
        pages.push(texture);
        return {
          get: () => ({
            source: { image: new Canvas() },
            cutX: 0,
            cutY: 0,
            cutWidth: 64,
            cutHeight: 64,
          }),
        };
      },
      addCanvas: () => true,
    },
    add: {
      image: () => ({
        setOrigin() {
          return this;
        },
        setScale() {
          return this;
        },
      }),
    },
  } as unknown as Phaser.Scene; // Platform double for one-time canvas baking.
  const prop: SceneryProp = {
    id: 'clipped',
    kind,
    xU: 100,
    layer: kind.startsWith('backdrop.') ? 'back' : 'near',
    depth: 0.5,
    scale: 1,
    flip: false,
    phase: 0,
    clip: [
      { xU: 0, yU: 0 },
      { xU: 200, yU: 0 },
      { xU: 200, yU: 200 },
    ],
  };
  bakeStaticComposition(
    scene,
    1,
    0,
    [prop],
    { texture: 'fallback', pxPerU: 1 },
    { texture: 'forest-fallback', pxPerU: 1 },
    1,
  );
  expect(pages).toEqual([`page:${kind}`]);
});
