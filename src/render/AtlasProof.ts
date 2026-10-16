import Phaser from 'phaser';
import { ArtAtlas, type ArtSource } from './ArtAtlas.ts';
import type { AtlasMetrics } from './AtlasMetrics.ts';
import type { TextureMemory } from './TextureMemory.ts';

import type { AtlasProofSources } from '../app/debugSnapshot.ts';
/** Debug-only controlled four-page fixture; uses the game's actual renderer and atlas owner. */
export async function atlasProof(
  parent: Phaser.Scene,
  memory: TextureMemory,
  metrics: AtlasMetrics,
  catalogue?: AtlasProofSources,
) {
  const scene = await new Promise<Phaser.Scene>((resolve) => {
    parent.scene.add(
      'atlas-proof',
      {
        create(this: Phaser.Scene) {
          resolve(this);
        },
      },
      true,
    );
  });
  parent.sys.setVisible(false);
  parent.sys.setActive(false);
  const sources = (prefix: string): ArtSource[] =>
    [0, 1].flatMap((variant) =>
      ['wide', 'tall'].map((shape) => {
        const widthU = shape === 'wide' ? 2040 : 170,
          heightU = shape === 'wide' ? 170 : 2040;
        const color =
          prefix === 'proof-world@'
            ? shape === 'wide'
              ? '#db9754'
              : '#dd5959'
            : shape === 'wide'
              ? '#458fd9'
              : '#469b65';
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthU}" height="${heightU}" viewBox="0 0 ${widthU} ${heightU}"><rect width="100%" height="100%" fill="${color}"/><path d="M0 0 L${widthU} ${heightU}" stroke="white" stroke-width="8"/></svg>`;
        return {
          key: `${prefix}${shape}-${variant}`,
          widthU,
          heightU,
          url: `data:image/svg+xml,${encodeURIComponent(svg)}`,
        };
      }),
    );
  const options = {
    maxPxPerU: 1,
    decodeOnDemand: true,
    gpuOnly: parent.game.renderer.type === Phaser.WEBGL,
    memory,
    metrics,
    yieldToFrame: !catalogue,
  };
  const world = new ArtAtlas(
    scene,
    catalogue?.world ?? sources('proof-world@'),
    {
      ...options,
      maxPxPerU: catalogue ? 2 : 1,
      texturePrefix: 'proof-world@',
    },
  );
  const backdrop = new ArtAtlas(
    scene,
    catalogue?.backdrop ?? sources('proof-backdrop@'),
    {
      ...options,
      texturePrefix: 'proof-backdrop@',
    },
  );
  // Memory fixture keeps the 4096px canvas and resident ride textures; bound only probe fill rate.
  const proofWidth = catalogue ? 1280 : parent.scale.width;
  const proofHeight = catalogue ? 720 : parent.scale.height;
  if (catalogue) scene.cameras.main.setViewport(0, 0, proofWidth, proofHeight);
  const images: Phaser.GameObjects.Image[] = [];
  let stopped = false;
  const waiters = new Set<() => void>();
  const close = () => {
    if (stopped) return;
    stopped = true;
    for (const done of waiters) done();
    parent.events.off('destroy', close);
    images.forEach((image) => image.destroy());
    world.destroy();
    backdrop.destroy();
    parent.scene.remove('atlas-proof');
    parent.sys.setVisible(true);
    parent.sys.setActive(true);
  };
  scene.events.once('destroy', close);
  parent.events.once('destroy', close);
  const frame = async () => {
    await new Promise<void>((resolve) => {
      const done = () => {
        parent.game.renderer.off(Phaser.Renderer.Events.POST_RENDER, done);
        waiters.delete(done);
        resolve();
      };
      waiters.add(done);
      parent.game.renderer.once(Phaser.Renderer.Events.POST_RENDER, done);
      if (stopped) done();
    });
    if (stopped) throw new Error('atlas proof closed');
  };
  const live = () =>
    parent.textures
      .getTextureKeys()
      .filter(
        (key) =>
          key.startsWith('proof-world@') || key.startsWith('proof-backdrop@'),
      ).length;
  const cycles = [];
  metrics.reset();
  try {
    for (let cycle = 0; cycle < (catalogue ? 2 : 10); cycle++) {
      for (let i = 0; i < (catalogue ? 0 : 8); i++) await frame();
      const overlaps = [];
      for (const [atlas, prefix, offset, stage] of [
        [world, 'proof-world@', 0, 'worldActivate'],
        [backdrop, 'proof-backdrop@', 2, 'backdropActivate'],
      ] as const) {
        const entries = offset === 0 ? catalogue?.world : catalogue?.backdrop;
        const keys = entries
          ? entries.map((part) => part.key)
          : ['wide', 'tall'].map((shape) => `${prefix}${shape}-${cycle % 2}`);
        await atlas.prepare(
          keys,
          catalogue && offset === 0
            ? (catalogue.pxPerU?.world ?? 2)
            : (catalogue?.pxPerU?.backdrop ?? 1),
        );
        overlaps.push(live());
        metrics.measure(stage, () => {
          const old = atlas.commitPrepared();
          const shown = catalogue
            ? atlas.pages
                .map((page) => page.frames[0])
                .filter((key): key is string => key !== undefined)
            : keys;
          shown.forEach((key, i) => {
            const texture = atlas.textureFor(key);
            if (!texture) throw new Error(`missing proof ${key}`);
            let image = images[offset + i];
            if (!image) {
              image = scene.add.image(0, 0, texture, key);
              images[offset + i] = image;
            }
            image
              .setTexture(texture, key)
              .setData('world-part', key)
              .setOrigin(0.5)
              .setPosition(
                (proofWidth * (offset + i + 0.5)) / 4,
                proofHeight * 0.5,
              )
              .setDisplaySize(proofWidth * 0.19, proofHeight * 0.4)
              .setRotation(0.03 * (offset + i - 1));
          });
          old.forEach((key) => atlas.release(key));
        });
      }
      for (let i = 0; i < (catalogue ? 1 : 3); i++) await frame();
      cycles.push({
        pages: [world.pages.length, backdrop.pages.length],
        liveTextures: live(),
        overlaps,
        memory: memory.snapshot,
        frames: images.map((image) => ({
          expected: image.getData('world-part') as unknown,
          drawn: image.frame.name,
          texture: image.texture.key,
        })),
      });
    }
    return { cycles, performance: metrics.snapshot, close };
  } catch (error) {
    close();
    throw error;
  }
}
