import { vi } from 'vitest';
import type Phaser from 'phaser';
import { ChunkView, type ChunkArt } from './ChunkView.ts';
import { rebindWorldImage } from './worldImage.ts';
import { FRAME_MARGIN_PX } from './atlasPacking.ts';
import { worldParts } from '../content/worldArt.ts';
import type { ArtPart } from '../content/artManifest.ts';
import type { ChunkScenery } from '../domain/world/Scenery.ts';
import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';

type ChunkScene = {
  seed: number;
  table: ArcLengthTable;
  scenery: ChunkScenery;
};
interface Drawn {
  frame: unknown;
  tag: unknown;
  target: Record<string, unknown>;
  proxy?: unknown;
}

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;
/** Pages of the drawing double that hold every world frame. */
const PAGES = new Set(['world', 'backdrop']);

/**
 * A real ChunkView over a Phaser drawing double. Only the drawing surface is
 * a double: a frame exists only on a page that holds it (otherwise the
 * page's base frame, as in Phaser), and it records `add.image`,
 * `setTexture`, `setFrame`, `setOrigin`, the image data and the frames
 * read from pages (composition bakes).
 */
function drawChunk(scene: ChunkScene, world: ChunkArt, backdrop: ChunkArt) {
  const keys = new Set<string>();
  const reads = new Set<string>();
  const record = (key: unknown) => {
    if (typeof key === 'string' && key !== '') keys.add(key);
  };
  const frameOf = (texture: unknown, key: unknown) => {
    const part = typeof key === 'string' ? parts[key] : undefined;
    return typeof key === 'string' &&
      part &&
      typeof texture === 'string' &&
      PAGES.has(texture)
      ? {
          name: key,
          width: Math.ceil(part.widthU * world.pxPerU) + 2 * FRAME_MARGIN_PX,
          height: Math.ceil(part.heightU * world.pxPerU) + 2 * FRAME_MARGIN_PX,
        }
      : { name: '__BASE', width: 2048, height: 1024 };
  };
  /** Current frame, `world-part` tag and state of every image drawn. */
  const images: Drawn[] = [];
  class Canvas {
    width = 1;
    height = 1;
    getContext() {
      return object();
    }
  }
  vi.stubGlobal('HTMLCanvasElement', Canvas);
  vi.stubGlobal('document', { createElement: () => new Canvas() });
  const object = (texture?: unknown, frame?: unknown): unknown => {
    const data = new Map<string, unknown>();
    const target: Record<string, unknown> = {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      depth: 0,
      alpha: 1,
      visible: true,
      list: [],
      originX: 0.5,
      originY: 0.5,
      frame: frameOf(texture, frame),
    };
    const image: Drawn = { frame, tag: undefined, target };
    images.push(image);
    const proxy: unknown = new Proxy(target, {
      get(target, property) {
        if (property in target) return target[property as string];
        if (property === 'setTexture')
          return (texture: string, key: unknown) => {
            record(key);
            image.frame = key;
            target['frame'] = frameOf(texture, key);
            return proxy;
          };
        if (property === 'setFrame')
          return (key: unknown) => {
            record(key);
            image.frame = key;
            return proxy;
          };
        if (property === 'setOrigin')
          return (x: number, y = x) => {
            target['originX'] = x;
            target['originY'] = y;
            return proxy;
          };
        if (property === 'setData')
          return (name: string, value: unknown) => {
            data.set(name, value);
            if (name === 'world-part') {
              record(value);
              image.tag = value;
            }
            return proxy;
          };
        if (property === 'getData') return (name: string) => data.get(name);
        if (property === 'createLinearGradient')
          return () => ({ addColorStop() {} });
        return () => proxy;
      },
    });
    image.proxy = proxy;
    return proxy;
  };
  const texturesDouble = {
    exists: () => true,
    create: () => ({ add() {} }),
    get: () => ({ getSourceImage: () => new Canvas() }),
    remove: () => true,
    getFrame: (_texture: string, key: string) => {
      reads.add(key);
      record(key);
      return {
        // Pixel compositions stay resident; the late-publication probe varies image frames.
        ...frameOf('world', key),
        source: { image: new Canvas() },
        cutX: 0,
        cutY: 0,
        cutWidth: 1,
        cutHeight: 1,
      };
    },
  };
  const phaser = {
    game: { renderer: {} },
    add: {
      image: (_x: number, _y: number, texture: string, key?: string) => {
        record(key);
        return object(texture, key);
      },
      container: () => object(),
      rectangle: () => object(),
      graphics: () => object(),
    },
    make: { graphics: () => object() },
    textures: texturesDouble,
  };
  // Drawing double only; ChunkView, its child views and generators are real.
  const view = new ChunkView(
    phaser as unknown as Phaser.Scene,
    scene.table,
    scene.seed,
    scene.scenery,
    world,
    {
      backGround: 0,
      backProps: 1,
      ground: 2,
      track: 3,
      train: 4,
      wires: 5,
      nearProps: 6,
    },
    true,
    backdrop,
  );
  return { view, images, keys, reads };
}

const resident = (texture: string): ChunkArt => ({
  texture,
  pxPerU: 1,
  textureFor: () => texture,
});

/**
 * Every world frame a real ChunkView draws for one chunk: parents,
 * attachments, seasonal variants, farm/forest machines, crossings, tunnels,
 * catenary, road vehicles, the frames its animations switch to over time
 * and the frames its visible static compositions bake from.
 */
export function chunkEmissions(
  scene: ChunkScene,
  times: readonly number[] = [0, 0.7, 3.1, 11.3, 23.9],
): { keys: string[]; untagged: string[]; compositionFrames: string[] } {
  const { view, images, keys, reads } = drawChunk(
    scene,
    resident('world'),
    resident('backdrop'),
  );
  const untagged = new Set<string>();
  const audit = () => {
    for (const image of images)
      if (
        typeof image.frame === 'string' &&
        image.frame in worldParts &&
        image.tag !== image.frame
      )
        untagged.add(image.frame);
  };
  audit();
  // The chunk is in view: clipped compositions bake from the pages.
  reads.clear();
  view.setVisibleRange(-Infinity, Infinity);
  const compositionFrames = [...reads].sort();
  compositionFrames.forEach((key) => keys.add(key));
  const crossing = {
    barrier: 0,
    warning: true,
    actors: (['car', 'bike'] as const).flatMap((kind) =>
      ([-1, 1] as const).map((direction) => ({
        id: `${kind}:${direction}`,
        kind,
        direction,
        roadU: 0,
        waiting: true,
      })),
    ),
  };
  for (const time of times) {
    view.update(time, crossing, 1, Infinity, Infinity, undefined, 'all', 0, 60);
    audit();
  }
  view.destroy();
  vi.unstubAllGlobals();
  return {
    keys: [...keys].sort(),
    untagged: [...untagged].sort(),
    compositionFrames,
  };
}

/**
 * Builds the chunk once with every frame resident and once while the
 * displayed pages lack all of them, publishes the late pages to the second
 * (RideScene's rebinding) and lists every tagged image whose origin then
 * differs from normal initialisation.
 */
export function chunkPivotDrift(scene: ChunkScene): string[] {
  const origins = (images: readonly Drawn[]) =>
    images.flatMap((image) =>
      typeof image.tag === 'string'
        ? [
            {
              key: image.tag,
              x: image.target['originX'] as number,
              y: image.target['originY'] as number,
            },
          ]
        : [],
    );
  const normal = drawChunk(scene, resident('world'), resident('backdrop'));
  const expected = origins(normal.images);
  normal.view.destroy();
  vi.unstubAllGlobals();
  const missing = (texture: string): ChunkArt => ({
    texture,
    pxPerU: 1,
    textureFor: () => undefined,
  });
  const late = drawChunk(scene, missing('old'), missing('old-backdrop'));
  for (const image of late.images)
    rebindWorldImage(image.proxy as Phaser.GameObjects.Image, () => 'world', 1);
  const actual = origins(late.images);
  late.view.destroy();
  vi.unstubAllGlobals();
  if (actual.length !== expected.length)
    return [`${actual.length} tagged images, expected ${expected.length}`];
  return actual.flatMap((origin, i) => {
    const normalOrigin = expected[i];
    return normalOrigin &&
      origin.key === normalOrigin.key &&
      Math.abs(origin.x - normalOrigin.x) < 1e-9 &&
      Math.abs(origin.y - normalOrigin.y) < 1e-9
      ? []
      : [
          `${origin.key}: origin ${origin.x.toFixed(3)},${origin.y.toFixed(3)} ` +
            `instead of ${normalOrigin?.key} ${normalOrigin?.x.toFixed(3)},${normalOrigin?.y.toFixed(3)}`,
        ];
  });
}
