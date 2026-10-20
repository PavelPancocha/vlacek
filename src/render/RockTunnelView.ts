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
import { TunnelCoverFade, portalMasonryPoint } from './tunnelCover.ts';
import { composeCoverImages } from './TunnelView.ts';
import { setWorldPivot } from './worldImage.ts';
import type {
  Bake,
  TunnelArt,
  TunnelDepths,
  TunnelGround,
} from './TunnelView.ts';

/** One bounded render fragment of a single, reconstructible long structure. */
export class RockTunnelView {
  readonly fade: TunnelCoverFade;
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
    const left = Math.max(0, fromX - 170),
      right = Math.min(1024, toX + 170);
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
      opaqueOutset = 0,
    ) => {
      from = Math.max(left - opaqueOutset, from);
      to = Math.min(right + opaqueOutset, to);
      if (to <= from) return [];
      const samples = [from, ...xs.filter((x) => x > from && x < to), to];
      return [
        ...samples.map((x) => new Phaser.Math.Vector2(x, top(x))),
        ...samples.reverse().map((x) => new Phaser.Math.Vector2(x, low(x))),
      ];
    };
    // Keep the owned pixel band bounded: the mountain above and foot below
    // have disjoint vector silhouettes, so cover children never double-blend.
    // 90*cos(atan(.12)) + 236*sin(atan(.12)) < 118u; retain 2u beyond
    // every rotated front-portal corner, without allocating empty 170u shoulders.
    const bodyLeft = Math.max(left, fromX - 120),
      bodyRight = Math.min(right, toX + 120);
    const bodyXs = [
      bodyLeft,
      ...xs.filter((x) => x > bodyLeft && x < bodyRight),
      bodyRight,
    ];
    const bounds = {
      left: bodyLeft,
      right: bodyRight,
      top: Math.min(...bodyXs.map(rail)) - 292,
      bottom: Math.max(...bodyXs.map(rail)) + 6,
    };
    // Flat interior and hangers need no pixel surface; retain their exact vector edges.
    const g = scene.add.graphics();

    g.fillStyle(0x292b27, 1);
    const polygon = points(
      (x) => Math.max(roof(x), rail(x) - 186),
      (x) => rail(x) + 4,
      fromX - TUNNEL_MAST_CLEARANCE_U,
      toX + TUNNEL_MAST_CLEARANCE_U,
      2,
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
    const mouths = scene.add.container(0, 0).setDepth(depths.interior + 0.01);
    const mouthGraphics = scene.add.graphics();
    mouths.add(mouthGraphics);
    const bodyPoints = (
      top: (x: number) => number,
      low: (x: number) => number,
      from = left,
      to = right,
    ) => {
      const clippedTop = (x: number) => Math.max(top(x), rail(x) - 292);
      return points(
        clippedTop,
        (x) => Math.max(clippedTop(x), Math.min(low(x), rail(x) + 6)),
        from,
        to,
      );
    };
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
        const polygon = bodyPoints(
          roof,
          cap ? (x) => Math.max(roof(x), rail(x) - 214) : bottom,
          from,
          to,
        );
        if (polygon.length) g.fillPoints(polygon, true);
      }
      // A meadow mantle and rooted conifers complete the host above exposed rock.
      g.fillStyle(winter ? 0xf1f6fa : 0x6eae43, 1);
      const mantle = bodyPoints(roof, (x) => Math.max(roof(x), rail(x) - 264));
      if (mantle.length) g.fillPoints(mantle, true);
      g.fillStyle(winter ? 0xd4e3e9 : 0x85b95d, 1);
      const ridge = bodyPoints(roof, (x) =>
        Math.min(roof(x) + 16, Math.max(roof(x), rail(x) - 264)),
      );
      if (ridge.length) g.fillPoints(ridge, true);
      if (!art)
        for (const [portal, mirrored] of [
          [fromX, false],
          [toX, true],
        ] as const) {
          if (portal < left - 90 || portal > right + 90) continue;
          const angle = Math.atan(grade(portal)),
            c = Math.cos(angle),
            s = Math.sin(angle);
          const polygon = (vertices: readonly (readonly [number, number])[]) =>
            vertices.map(
              ([x, y]) =>
                new Phaser.Math.Vector2(
                  portal + (mirrored ? -x : x) * c - y * s,
                  rail(portal) + (mirrored ? -x : x) * s + y * c,
                ),
            );
          g.fillStyle(0xadae9d, 1);
          mouthGraphics.fillStyle(0xadae9d, 1);
          mouthGraphics.fillPoints(
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
          // The arch shoulders on the open side belong behind the train too.
          const rightArch: [number, number][] = [[58, -128]];
          for (let x = 58; x >= 0; x -= 2)
            rightArch.push([x, -128 - Math.sqrt(58 * 58 - x * x)]);
          g.fillPoints(
            polygon([
              [0, -236],
              [90, -236],
              [90, -128],
              ...rightArch,
              [0, -236],
            ]),
            true,
          );
          g.fillPoints(
            polygon([
              [-90, -236],
              [0, -236],
              [0, -186],
              [-90, -186],
            ]),
            true,
          );
          const leftArch: [number, number][] = [[0, -186]];
          for (let x = 0; x >= -58; x -= 2)
            leftArch.push([x, -128 - Math.sqrt(58 * 58 - x * x)]);
          mouthGraphics.fillPoints(
            polygon([[-90, -186], ...leftArch, [-58, -128], [-90, -128]]),
            true,
          );
        }
    };
    const cover = scene.add.container(0, 0);
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
      for (const [x, mirrored] of [
        [fromX, false],
        [toX, true],
      ] as const)
        if (x >= left - 90 && x < right + 90) {
          const suffix = winter ? '-snow' : '';
          for (const [key, layer] of [
            [`tunnel.rock-portal-mouth${suffix}`, mouths],
            [`tunnel.rock-portal-front${suffix}`, cover],
          ] as const) {
            const im = image(key, x, rail(x))
              .setRotation(Math.atan(grade(x)))
              .setFlipX(mirrored);
            if (mirrored) {
              const part = worldParts[key];
              setWorldPivot(
                im,
                { x: part.widthU - part.pivotU.x, y: part.pivotU.y },
                art.pxPerU,
              );
            }
            layer.add(im);
          }
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
    const hill = scene.add.graphics();
    // Only opaque silhouettes overlap: cover adjacent antialiased vector edges
    // without reintroducing the translucent face's former 0.75 seam.
    const hillPoints = (
      top: (x: number) => number,
      low: (x: number) => number,
    ) => points(top, low, left - 2, right + 2, 2);
    const upperBottom = (x: number) => Math.max(roof(x), rail(x) - 292);
    const ridgeBottom = (x: number) => Math.min(roof(x) + 16, upperBottom(x));
    hill.fillStyle(winter ? 0xf1f6fa : 0x6eae43, 1);
    const mantleTop = hillPoints(ridgeBottom, upperBottom);
    if (mantleTop.length) hill.fillPoints(mantleTop, true);
    hill.fillStyle(winter ? 0xd4e3e9 : 0x85b95d, 1);
    const ridgeTop = hillPoints(roof, ridgeBottom);
    if (ridgeTop.length) hill.fillPoints(ridgeTop, true);
    hill.fillStyle(winter ? 0xdde6e5 : 0x6b7868, 1);
    const foot = hillPoints((x) => Math.min(bottom(x), rail(x) + 6), bottom);
    if (foot.length) hill.fillPoints(foot, true);
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
      hill.fillStyle(0x5c6141, 1);
      hill.fillRect(x - 1.5, foot - 14, 3, 14);
      hill.fillStyle(winter ? 0x5d827b : 0x416f43, 1);
      hill.fillPoints(
        [
          new Phaser.Math.Vector2(x, foot - height),
          new Phaser.Math.Vector2(x + 16, foot - 6),
          new Phaser.Math.Vector2(x - 16, foot - 6),
        ],
        true,
      );
      hill.fillStyle(winter ? 0xf1f6fa : 0x5c8d4a, 1);
      hill.fillPoints(
        [
          new Phaser.Math.Vector2(x, foot - height),
          new Phaser.Math.Vector2(x + 11, foot - 17),
          new Phaser.Math.Vector2(x - 11, foot - 17),
        ],
        true,
      );
    }
    const flat =
      bounds.right > bounds.left
        ? bake(
            paintCover,
            bounds,
            art
              ? (canvas, memory, owner) => {
                  composeRockMaterial(
                    scene,
                    art,
                    canvas,
                    winter,
                    site,
                    bounds,
                    rail,
                    memory,
                    owner,
                  );
                  composeCoverImages(
                    scene,
                    art,
                    canvas,
                    bounds,
                    cover,
                    memory,
                    owner,
                  );
                  cover.removeAll(true);
                }
              : undefined,
          )
        : undefined;
    // The crest, vegetation and foot are solid. Reuse the baked face behind
    // the dark interior as well: above the ceiling it backs its own pixels,
    // while the interior replaces it with darkness behind the visible train.
    // Both images share one immutable texture; there is no second pixel surface.
    const flanks = scene.add.container(0, 0).setDepth(depths.flanks);
    flanks.add(hill);
    if (flat) {
      for (const child of flat.list)
        if (child instanceof Phaser.GameObjects.Image)
          flanks.add(
            scene.add
              .image(child.x, child.y, child.texture.key, child.frame.name)
              .setOrigin(child.originX, child.originY)
              .setScale(child.scaleX, child.scaleY),
          );
      cover.add(flat);
    }
    this.fade = new TunnelCoverFade(cover, {
      fromX: x0 + fromX,
      toX: x0 + toX,
    });
    this.containers = [flanks, interior, mouths, cover];
    const portalPlanes = [fromX, toX].map((x, i) => {
      const angle = Math.atan(grade(x));
      return {
        x,
        y: rail(x),
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        sign: i === 0 ? 1 : -1,
      };
    });
    this.coversPoint = (point) => {
      const x = point.x - x0;
      if (x < left || x > right) return false;
      for (const portal of portalPlanes) {
        const dx = x - portal.x;
        if (Math.abs(dx) > 120) continue;
        const dy = point.y - portal.y;
        const localX = (dx * portal.cos + dy * portal.sin) * portal.sign;
        const localY = -dx * portal.sin + dy * portal.cos;
        if (
          (localX >= 0 || localY < -186) &&
          portalMasonryPoint(localX, localY, 90, 236, 58, 128)
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
  get alpha(): number {
    return this.fade.alpha;
  }
  update(train: { minX: number; maxX: number } | undefined, timeSec = 0): void {
    this.fade.update(train, timeSec);
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
