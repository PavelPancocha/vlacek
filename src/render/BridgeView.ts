import Phaser from 'phaser';
import { frameTexture } from './frameTexture.ts';
import { worldParts } from '../content/worldArt.ts';
import type { BridgeSite } from '../domain/world/Structures.ts';
import { frameOrigin } from './atlasPacking.ts';
import type { TunnelArt, TunnelGround, Bake } from './TunnelView.ts';

/** Rigid fields on a validated constant grade; only piers stretch to the valley. */
export function largeBridgeView(
  scene: Phaser.Scene,
  art: TunnelArt | undefined,
  site: BridgeSite,
  ground: TunnelGround,
  bake: Bake,
  trackDepth: number,
  winter: boolean,
): Phaser.GameObjects.Container[] {
  if (site.fromX === undefined || site.toX === undefined) return [];
  const from = site.fromX,
    to = site.toX;
  const steel = site.variant === 'steel',
    step = steel ? 256 : 160;
  const angle = Math.atan2(ground.railY(to) - ground.railY(from), to - from);
  const add = (
    key: keyof typeof worldParts,
    x: number,
    y: number,
    scaleY = 1,
  ) => {
    if (!art) return;
    const part = worldParts[key];
    const im = scene.add
      .image(x, y, frameTexture(key, art.texture), key)
      .setData('world-part', key);
    const o = frameOrigin(part.pivotU, art.pxPerU, im.frame);
    im.setOrigin(o.x, o.y).setScale(1 / art.pxPerU, scaleY / art.pxPerU);
    im.setName(`${site.id}:${key}:${x}`);
    return im;
  };
  // Every support is outside the water corridor; the central steel fields span it.
  const supports = steel
    ? [from, to]
    : Array.from(
        { length: Math.round((to - from) / step) + 1 },
        (_, i) => from + i * step,
      );
  if (!art) {
    return [
      bake(
        (g) => {
          g.fillStyle(steel ? 0x657b78 : 0xb9ae94, 1);
          g.fillPoints(
            [
              new Phaser.Math.Vector2(from, ground.railY(from)),
              new Phaser.Math.Vector2(to, ground.railY(to)),
              new Phaser.Math.Vector2(to, ground.railY(to) + 12),
              new Phaser.Math.Vector2(from, ground.railY(from) + 12),
            ],
            true,
          );
          for (const x of supports)
            g.fillRect(
              x - 12,
              ground.railY(x),
              24,
              ground.meadowY(x) - ground.railY(x),
            );
        },
        {
          left: from - 25,
          right: to + 25,
          top: Math.min(ground.railY(from), ground.railY(to)) - 20,
          bottom: Math.max(...supports.map((x) => ground.meadowY(x))) + 2,
        },
      ).setDepth(trackDepth - 0.2),
    ];
  }
  const structure = scene.add.container(0, 0).setDepth(trackDepth - 0.2);
  const railing = scene.add.container(0, 0).setDepth(trackDepth + 0.1);
  for (const x of supports) {
    const top = ground.railY(x) + (steel ? 0 : 72);
    const pier = add(
      steel ? 'bridge.abutment' : 'bridge.viaduct-pier',
      x,
      top,
      (ground.meadowY(x) - top + 2) / (steel ? 98 : 160),
    );
    if (pier) structure.add(pier);
  }
  for (let x = from; x < to; x += step) {
    const middle = x + step / 2;
    const field = add(
      steel ? 'bridge.steel-span' : 'bridge.viaduct-arch',
      middle,
      ground.railY(middle),
    );
    if (field) structure.add(field.setRotation(angle));
    const rail = add('bridge.railing-long', middle, ground.railY(middle) + 2);
    if (rail)
      railing.add(
        rail
          .setScale(step / 256 / art.pxPerU, 1 / art.pxPerU)
          .setRotation(angle),
      );
    if (winter) {
      const snow = add('bridge.snow-cap', middle, ground.railY(middle));
      if (snow)
        structure.add(
          snow
            .setScale(step / 256 / art.pxPerU, 1 / art.pxPerU)
            .setRotation(angle),
        );
    }
  }
  return [structure, railing];
}
