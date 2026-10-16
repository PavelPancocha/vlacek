import Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import { buildArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { generateTrackProfile } from '../domain/world/TrackProfile.ts';
import { chunkScenery } from '../domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { ChunkView } from './ChunkView.ts';

// Only Phaser's drawing/texture boundary is replaced; generate and bake real scenery.
vi.mock('phaser', () => {
  class Object {
    setOrigin() {
      return this;
    }
    setScale() {
      return this;
    }
    setDepth() {
      return this;
    }
    add() {
      return this;
    }
    destroy() {}
  }
  class Graphics extends Object {
    translateCanvas() {}
    fillStyle() {}
    fillPoints() {}
    strokePoints() {}
    lineStyle() {}
    lineBetween() {}
    fillRect() {}
    fillEllipse() {}
    fillCircle() {}
    generateTexture() {}
  }
  return {
    default: {
      Scene: class {},
      Math: {
        Vector2: class {
          constructor(
            public x: number,
            public y: number,
          ) {}
        },
      },
      GameObjects: { Graphics, Container: Object, Image: Object },
    },
  };
});

it('TB-2: generates and bakes the actual fractional mill channel, seed 2 chunk 288', () => {
  const scenery = chunkScenery(2, 288, worldPlacementCatalog);
  expect(scenery.water.some((w) => w.fromX === 508.2504011598732)).toBe(true);
  const scene = new Phaser.Scene();
  const baked = vi.fn(),
    removed = vi.fn();
  class Canvas {
    width = 1;
    height = 1;
  }
  vi.stubGlobal('HTMLCanvasElement', Canvas);
  Object.assign(scene, {
    game: { renderer: {} },
    make: {
      graphics: () => {
        const g = new Phaser.GameObjects.Graphics(scene);
        g.generateTexture = baked;
        return g;
      },
    },
    add: {
      image: () => new Phaser.GameObjects.Image(scene, 0, 0, ''),
      rectangle: () => new Phaser.GameObjects.Image(scene, 0, 0, ''),
      container: () => new Phaser.GameObjects.Container(scene),
    },
    textures: {
      remove: removed,
      create: () => ({ add() {} }),
      get: () => ({ getSourceImage: () => new Canvas() }),
    },
  });
  vi.stubGlobal('document', { createElement: () => new Canvas() });
  const table = buildArcLengthTable(generateTrackProfile(2, 288), 288, 1024, 8);
  const view = new ChunkView(scene, table, 2, scenery, undefined, {
    backGround: 0,
    backProps: 1,
    ground: 2,
    track: 3,
    train: 4,
    wires: 5,
    nearProps: 6,
  });
  expect(baked.mock.calls.length).toBeGreaterThanOrEqual(3);
  view.destroy();
  expect(removed.mock.calls.length).toBe(baked.mock.calls.length);
  vi.unstubAllGlobals();
});
