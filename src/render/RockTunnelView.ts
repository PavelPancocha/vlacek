import Phaser from 'phaser';
import { frameTexture } from './frameTexture.ts';
import { atlasFramePixels } from './atlasFramePixels.ts';
import type { TextureMemory } from './TextureMemory.ts';
import { hash32 } from '../domain/world/Hash.ts';
import { rockMountainHeightU } from '../domain/world/scenes/tunnels-bridges.scenes.ts';
import { gameConfig } from '../config/gameConfig.ts';
import { TUNNEL_MAST_CLEARANCE_U } from '../domain/world/Catenary.ts';
import { worldParts } from '../content/worldArt.ts';
import type { TunnelSite } from '../domain/world/Structures.ts';
import { FRAME_MARGIN_PX, frameOrigin } from './atlasPacking.ts';
import { portalMasonryPoint } from './tunnelCover.ts';
import type {
  Bake,
  TunnelArt,
  TunnelDepths,
  TunnelGround,
} from './TunnelView.ts';

/** One bounded render fragment of a single, reconstructible long structure. */
export class RockTunnelView {
  readonly containers: Phaser.GameObjects.Container[];
  readonly coversPoint: (point: { x: number; y: number }) => boolean;

  constructor(
    scene: Phaser.Scene,
    art: TunnelArt | undefined,
    site: TunnelSite,
    ground: TunnelGround,
    bake: Bake,
    depths: TunnelDepths,
    hangerXs: readonly number[],
    winter: boolean,
  ) {
    const x0 = site.chunkIndex * 1024;
    const { fromX, toX } = site;
    const left = Math.max(-2, fromX - 170),
      right = Math.min(1026, toX + 170);
    const coverFrom = fromX + 52,
      coverTo = toX - 52;
    const rail = (x: number) => ground.railY(x);
    const grade = (x: number) => (rail(x + 4) - rail(x - 4)) / 8;
    const roof = (x: number) => rail(x) - rockMountainHeightU(fromX, toX, x);
    const bottom = (x: number) => {
      if (x < coverFrom || x > coverTo) return Math.max(roof(x), rail(x) - 214);
      const t = Math.max(
        0,
        Math.min(1, (x - coverFrom) / 40, (coverTo - x) / 40),
      );
      return rail(x) + 4 + (ground.meadowY(x) - rail(x)) * t;
    };
    const xs = [left];
    for (let x = Math.ceil(left / 16) * 16; x < right; x += 16)
      if (x > left) xs.push(x);
    // Include the exact open-mouth boundaries; never interpolate across a mouth.
    for (const x of [coverFrom, coverTo]) if (x > left && x < right) xs.push(x);
    xs.push(right);
    xs.sort((a, b) => a - b);
    const points = (
      top: (x: number) => number,
      low: (x: number) => number,
      from = left,
      to = right,
    ) => {
      from = Math.max(left, from);
      to = Math.min(right, to);
      if (to <= from) return [];
      const samples = [from, ...xs.filter((x) => x > from && x < to), to];
      return [
        ...samples.map((x) => new Phaser.Math.Vector2(x, top(x))),
        ...samples.reverse().map((x) => new Phaser.Math.Vector2(x, low(x))),
      ];
    };
    const bounds = {
      left,
      right,
      top: Math.min(...xs.map(roof)) - 64,
      bottom: Math.max(...xs.map((x) => ground.meadowY(x))) + 8,
    };
    // Flat interior and hangers need no pixel surface; retain their exact vector edges.
    const g = scene.add.graphics();

    g.fillStyle(0x292b27, 1);
    const polygon = points(
      (x) => Math.max(roof(x), rail(x) - 186),
      (x) => rail(x) + 4,
      fromX - TUNNEL_MAST_CLEARANCE_U,
      toX + TUNNEL_MAST_CLEARANCE_U,
    );
    if (polygon.length) g.fillPoints(polygon, true);
    for (const x of hangerXs) {
      if (x < left || x >= right) continue;
      const wire = rail(x) - gameConfig.world.catenaryContactHeightU,
        ceiling = rail(x) - 186;
      g.fillStyle(0x4d535b, 1);
      g.fillRect(x - 9, ceiling, 18, 3);
      g.fillRect(x - 1.2, ceiling, 2.4, wire - ceiling - 2);
      g.fillStyle(0x7d848c, 1);
      g.fillRect(x - 3, wire - 3, 6, 3);
    }
    const interior = scene.add.container(0, 0, [g]).setDepth(depths.interior);
    const paintCover = (g: Phaser.GameObjects.Graphics) => {
      // Opaque foundation fits the true terrain, including between material tiles.
      g.fillStyle(winter ? 0xdde6e5 : 0x6b7868, 1);
      // Separate polygons preserve the exact 52u mouth boundary rather than
      // interpolating a dark wedge across the last sample before the portal.
      for (const [from, to, cap] of [
        [left, coverFrom, true],
        [coverFrom, coverTo, false],
        [coverTo, right, true],
      ] as const) {
        const polygon = points(
          roof,
          cap ? (x) => Math.max(roof(x), rail(x) - 214) : bottom,
          from,
          to,
        );
        if (polygon.length) g.fillPoints(polygon, true);
      }
      // A meadow mantle and rooted conifers complete the host above exposed rock.
      g.fillStyle(winter ? 0xf1f6fa : 0x6eae43, 1);
      const mantle = points(roof, (x) => Math.max(roof(x), rail(x) - 264));
      if (mantle.length) g.fillPoints(mantle, true);
      g.fillStyle(winter ? 0xd4e3e9 : 0x85b95d, 1);
      const ridge = points(roof, (x) =>
        Math.min(roof(x) + 16, Math.max(roof(x), rail(x) - 264)),
      );
      if (ridge.length) g.fillPoints(ridge, true);
      for (
        let i = Math.floor((x0 + left - 24) / 128);
        i <= Math.ceil((x0 + right + 24) / 128);
        i++
      ) {
        const h = hash32(site.id, 'hill-tree', i),
          x = i * 128 + (h % 45) - x0;
        if (rockMountainHeightU(fromX, toX, x) < 315) continue;
        const foot = roof(x) + 8,
          height = 32 + ((h >>> 8) % 17);
        g.fillStyle(0x5c6141, 1);
        g.fillRect(x - 1.5, foot - 14, 3, 14);
        g.fillStyle(winter ? 0x5d827b : 0x416f43, 1);
        g.fillPoints(
          [
            new Phaser.Math.Vector2(x, foot - height),
            new Phaser.Math.Vector2(x + 16, foot - 6),
            new Phaser.Math.Vector2(x - 16, foot - 6),
          ],
          true,
        );
        g.fillStyle(winter ? 0xf1f6fa : 0x5c8d4a, 1);
        g.fillPoints(
          [
            new Phaser.Math.Vector2(x, foot - height),
            new Phaser.Math.Vector2(x + 11, foot - 17),
            new Phaser.Math.Vector2(x - 11, foot - 17),
          ],
          true,
        );
      }
      if (!art)
        for (const portal of [fromX, toX]) {
          if (portal < left - 90 || portal > right + 90) continue;
          const angle = Math.atan(grade(portal)),
            c = Math.cos(angle),
            s = Math.sin(angle);
          const polygon = (vertices: readonly (readonly [number, number])[]) =>
            vertices.map(
              ([x, y]) =>
                new Phaser.Math.Vector2(
                  portal + x * c - y * s,
                  rail(portal) + x * s + y * c,
                ),
            );
          g.fillStyle(0xadae9d, 1);
          g.fillPoints(
            polygon([
              [-90, -128],
              [-58, -128],
              [-58, 4],
              [-90, 4],
            ]),
            true,
          );
          g.fillPoints(
            polygon([
              [58, -128],
              [90, -128],
              [90, 4],
              [58, 4],
            ]),
            true,
          );
          const arch: [number, number][] = [[58, -128]];
          for (let x = 58; x > -58; x -= 4)
            arch.push([x, -128 - Math.sqrt(58 * 58 - x * x)]);
          arch.push([-58, -128]);
          g.fillPoints(
            polygon([
              [-90, -236],
              [90, -236],
              [90, -128],
              ...arch,
              [-90, -128],
            ]),
            true,
          );
        }
    };
    const cover = art ? scene.add.container(0, 0) : bake(paintCover, bounds);
    if (art) {
      const hill = scene.add.graphics();
      paintCover(hill);
      cover.add(hill);
      const materialFrom = Math.max(left, fromX),
        materialTo = Math.min(right, toX);
      const materialXs = [
        materialFrom,
        ...xs.filter((x) => x > materialFrom && x < materialTo),
        materialTo,
      ];
      const materialBounds = {
        left: materialFrom,
        right: materialTo,
        top: Math.min(...materialXs.map(rail)) - 292,
        bottom: Math.max(...materialXs.map(rail)) + 2,
      };
      if (materialBounds.right > materialBounds.left)
        cover.add(
          bake(
            () => {},
            materialBounds,
            (canvas, memory, owner) =>
              composeRockMaterial(
                scene,
                art,
                canvas,
                winter,
                site,
                materialBounds,
                rail,
                memory,
                owner,
              ),
          ),
        );
    }
    cover.setDepth(depths.cover);
    if (art) {
      const image = (key: keyof typeof worldParts, x: number, y: number) => {
        const p = worldParts[key];
        const im = scene.add
          .image(x, y, frameTexture(key, art.texture), key)
          .setData('world-part', key);
        const origin = frameOrigin(p.pivotU, art.pxPerU, im.frame);
        return im.setOrigin(origin.x, origin.y).setScale(1 / art.pxPerU);
      };
      cover.setName(`${site.id}:rock-fragment:${site.chunkIndex}`);
      const portalKey = winter
        ? 'tunnel.rock-portal-snow'
        : 'tunnel.rock-portal';
      for (const x of [fromX, toX])
        if (x >= left - 90 && x < right + 90) {
          cover.add(
            image(portalKey, x, rail(x)).setRotation(Math.atan(grade(x))),
          );
        }
      for (const x of hangerXs)
        if (x >= left && x < right)
          interior.add(
            image(
              'tunnel.contact',
              x,
              rail(x) - gameConfig.world.catenaryContactHeightU,
            ),
          );
    }
    this.containers = [interior, cover];
    const portalPlanes = [fromX, toX].map((x) => {
      const angle = Math.atan(grade(x));
      return { x, y: rail(x), cos: Math.cos(angle), sin: Math.sin(angle) };
    });
    this.coversPoint = (point) => {
      const x = point.x - x0;
      if (x < left || x > right) return false;
      for (const portal of portalPlanes) {
        const dx = x - portal.x;
        if (Math.abs(dx) > 120) continue;
        const dy = point.y - portal.y;
        if (
          portalMasonryPoint(
            dx * portal.cos + dy * portal.sin,
            -dx * portal.sin + dy * portal.cos,
            90,
            236,
            58,
            128,
          )
        )
          return true;
      }
      // Keep hidden interactive particles out of the material's scalloped rim too.
      const top = roof(x),
        low = bottom(x);
      const material = art !== undefined && x >= fromX && x < toX;
      const silhouette = material ? Math.min(top, rail(x) - 290) : top;
      return low > top && point.y >= silhouette && point.y <= low;
    };
  }
}

/** Paint into the owned ground canvas before its immutable upload (D-030). */
function composeRockMaterial(
  scene: Phaser.Scene,
  art: TunnelArt,
  canvas: HTMLCanvasElement,
  winter: boolean,
  site: TunnelSite,
  bounds: { left: number; right: number; top: number },
  rail: (x: number) => number,
  memory: TextureMemory,
  owner: string,
): void {
  const { fromX, toX } = site,
    { left, right } = bounds,
    x0 = site.chunkIndex * 1024,
    coverFrom = fromX + 52,
    coverTo = toX - 52;
  const coverKey = winter ? 'tunnel.rock-cover-snow' : 'tunnel.rock-cover';
  const capKey = winter ? 'tunnel.rock-cap-snow' : 'tunnel.rock-cap';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no rock material canvas context');
  const scale = Math.min(1, art.pxPerU),
    step = 1 / scale;
  const strip = (
    from: number,
    to: number,
    key: typeof coverKey | typeof capKey,
  ) => {
    from = Math.max(left, from);
    to = Math.min(right, to);
    if (to <= from) return;
    const frame = atlasFramePixels(
      scene,
      frameTexture(key, art.texture),
      key,
      memory,
      `readback:${owner}`,
    );
    try {
      const height = worldParts[key].heightU;
      for (let x = from; x < to;) {
        const phase = (((x0 + x) % 256) + 256) % 256,
          width = Math.min(step, to - x, 256 - phase);
        ctx.drawImage(
          frame.image,
          frame.x + FRAME_MARGIN_PX + phase * art.pxPerU,
          frame.y + FRAME_MARGIN_PX,
          width * art.pxPerU,
          height * art.pxPerU,
          x,
          rail(x + width / 2) - 290,
          width,
          height,
        );
        x += width;
      }
    } finally {
      frame.release();
    }
  };
  ctx.save();
  try {
    ctx.scale(scale, scale);
    ctx.translate(-bounds.left, -bounds.top);
    strip(coverFrom, coverTo, coverKey);
    strip(fromX, coverFrom, capKey);
    strip(coverTo, toX, capKey);
  } finally {
    ctx.restore();
  }
}
