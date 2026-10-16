import { frameTexture } from './frameTexture.ts';
import type { EffectiveClimate } from '../domain/world/Seasons.ts';
import { effectiveClimateAt } from '../domain/world/Seasons.ts';
import type { TextureMemory } from './TextureMemory.ts';
import Phaser from 'phaser';
import { RockTunnelView } from './RockTunnelView.ts';
import { gameConfig } from '../config/gameConfig.ts';
import { tunnelParts, worldParts } from '../content/worldArt.ts';
import { TUNNEL_MAST_CLEARANCE_U } from '../domain/world/Catenary.ts';
import type { TunnelSite } from '../domain/world/Structures.ts';
import { regionAt } from '../domain/world/Regions.ts';
import { BACK_PALETTE, mixColour } from './groundPalette.ts';
import { frameOrigin } from './atlasPacking.ts';
import { setWorldPivot } from './worldImage.ts';
import {
  portalMasonryPoint,
  vehicleInCover,
  type TrainInTunnel,
} from './tunnelCover.ts';

const { chunkWidthU, catenaryContactHeightU } = gameConfig.world;

export interface TunnelArt {
  texture: string;
  pxPerU: number;
}

/** Where the tunnel stands: rail head and bank foot (render y, chunk-local x). */
export interface TunnelGround {
  railY(x: number): number;
  meadowY(x: number): number;
}

/** Paints with Graphics once into a texture (ChunkView's baking). */
export type Bake = (
  paint: (g: Phaser.GameObjects.Graphics) => void,
  bounds: { left: number; top: number; right: number; bottom: number },
  compose?: (
    canvas: HTMLCanvasElement,
    memory: TextureMemory,
    owner: string,
  ) => void,
) => Phaser.GameObjects.Container;

/**
 * Layers of a tunnel: the hill's flanks and the inside behind the train,
 * a darkening band over it, the cover (hill and portals) in front.
 */
export interface TunnelDepths {
  flanks: number;
  interior: number;
  shade: number;
  cover: number;
}

/** The tunnel is tall enough for the pantograph and the wire (160 u). */
const CEILING_U = 186;
const HILL_TOP_U = 290;
const FLANK_U = 170;
const FLOWER_STEP_U = 23;
const SHRUB_STEP_U = 53;
/**
 * Over the portals the cover starts this high above the rail: behind the
 * portal's face (222 u) and above the masts (204 u) and any train.
 */
const CAP_BOTTOM_U = 214;
/** The cover slopes from the portal's foot down to the meadow over this. */
const FOOT_SLOPE_U = 40;
/** The cover starts behind each portal's arch (half its opening). */
const COVER_INSET_U = 52;
// Keep 4 u of masonry beyond the ceiling hangers at each portal.
const INSIDE_OUTSET_U = TUNNEL_MAST_CLEARANCE_U + 4;
const SHADE_FADE_U = 40;
const SHADE_ALPHA = 0.42;
/** Samples of baked outlines along x, u. */
const STEP_U = 16;

function shortTunnelHostAt(seed: number, portalXU: number) {
  return {
    ...regionAt(seed, portalXU),
    season: effectiveClimateAt(seed, portalXU).season,
  };
}

/**
 * A short tunnel of the main track (doc 03 §8, doc 14 §2): stone portals
 * at both ends, the hill over the track in front of the train and its
 * flanks behind it, the dark inside with lamps. While the train is in or
 * at the tunnel the opaque cover hides each vehicle progressively by its
 * own position (TRN-06). Chunk-local, owned by its ChunkView.
 */
export class TunnelView {
  readonly id: string;
  readonly containers: Phaser.GameObjects.Container[];
  readonly #worldFrom: number;
  readonly #worldTo: number;
  readonly #coveredPoint: (point: { x: number; y: number }) => boolean;
  #train: TrainInTunnel = 'outside';

  constructor(
    scene: Phaser.Scene,
    /** Without art (PWA-10) the portals are left out; the rest stays. */
    art: TunnelArt | undefined,
    site: TunnelSite,
    ground: TunnelGround,
    bake: Bake,
    depths: TunnelDepths,
    /** Chunk-local x of the ceiling hangers of an electric journey's wire. */
    hangerXs: readonly number[],
    seed: number,
    appearance?: {
      climateAt(xU: number): EffectiveClimate;
      sandAt(xU: number): boolean;
    },
  ) {
    this.id = site.id;
    const { fromX, toX } = site;
    this.#worldFrom = site.chunkIndex * chunkWidthU + fromX;
    this.#worldTo = site.chunkIndex * chunkWidthU + toX;
    if (site.rock) {
      const fragment = new RockTunnelView(
        scene,
        art,
        site,
        ground,
        bake,
        depths,
        hangerXs,
        site.season === 'winter',
      );
      this.containers = fragment.containers;
      this.#coveredPoint = fragment.coversPoint;
      return;
    }
    const host = shortTunnelHostAt(seed, this.#worldFrom);
    const snow = host.season === 'winter';
    const dunes = host.landscape === 'dunes';
    const coast = host.landscape === 'coast';
    const mountain = ['mountains', 'foothills'].includes(host.landscape);
    const meadowSurface = !snow && !dunes && !coast && !mountain;
    const tone = snow
      ? BACK_PALETTE.snow.base
      : dunes
        ? 0xe4c58b
        : meadowSurface
          ? 0x6eae43
          : 0x96958b;
    const edge = snow
      ? BACK_PALETTE.snow.edge
      : dunes
        ? 0xb99a67
        : meadowSurface
          ? 0x3f7326
          : 0x737a79;
    const middle = (fromX + toX) / 2;
    const halfSpan = (toX - fromX) / 2 + FLANK_U;
    /**
     * Hill top: a broad mound over the tunnel, above its portals, falling
     * to the ground beyond them, with a few soft bumps.
     */
    const top = (x: number) => {
      const ratio = Math.min(1, Math.abs(x - middle) / halfSpan);
      const height = HILL_TOP_U * Math.sqrt(1 - ratio * ratio * ratio);
      const bump =
        (10 * Math.sin((x - fromX) / 47) + 6 * Math.sin(x / 23)) * (1 - ratio);
      return ground.railY(x) - height - bump;
    };
    const xs = (from: number, to: number) => {
      const list: number[] = [];
      for (let x = from; x < to; x += STEP_U) list.push(x);
      list.push(to);
      return list;
    };
    const point = (x: number, y: number) => new Phaser.Math.Vector2(x, y);
    /**
     * Paints the hill between its top and `bottom` (the lower outline,
     * right to left). Stripes and flowers follow the whole hill down to
     * the rail and a shared grid, so the flanks and the cover join
     * without a seam.
     */
    const toneAt = (x: number) => {
      const c = appearance?.climateAt(x);
      const autumn = c?.autumn ?? 0;
      const winter = c?.winter ?? 0;
      return {
        base: mixColour(
          mixColour(tone, 0xb39355, autumn * 0.7),
          0xf1f6fa,
          winter,
        ),
        shade: mixColour(edge, 0xbfd0de, winter),
        winter,
        flowers: 1 - Math.max(autumn, winter),
      };
    };
    const paintHill = (
      g: Phaser.GameObjects.Graphics,
      from: number,
      to: number,
      lower: Phaser.Math.Vector2[],
      bottom: (x: number) => number,
    ) => {
      const upper = xs(from, to).map((x) => point(x, top(x)));
      const surface = toneAt(fromX);
      g.fillStyle(surface.base, 1);
      g.fillPoints([...upper, ...lower], true);
      // Broad, soft bands give bare sand/rock/snow a lit ridge and a shaded foot.
      const bands = meadowSurface ? 7 : 16;
      for (let i = 1; i < bands; i++) {
        const stripe = (x: number) =>
          top(x) + (ground.railY(x) - top(x)) * (i / bands);
        const line = meadowSurface ? xs(from + 8, to - 8) : xs(from, to);
        for (let j = 1; j < line.length; j++) {
          const a = line[j - 1] ?? from;
          const b = line[j] ?? to;
          const width = meadowSurface
            ? 5
            : Math.min(ground.railY(a) - top(a), ground.railY(b) - top(b)) /
                bands +
              1;
          const margin = width / 2 + 0.5;
          g.lineStyle(
            width,
            !meadowSurface && i < 4 ? 0xffffff : surface.shade,
            meadowSurface
              ? 0.18
              : i < 4
                ? 0.12 * (1 - i / 4)
                : (0.4 * i) / bands,
          );
          if (
            (meadowSurface ||
              (stripe(a) > top(a) + margin && stripe(b) > top(b) + margin)) &&
            stripe(a) < bottom(a) - margin &&
            stripe(b) < bottom(b) - margin
          )
            g.lineBetween(a, stripe(a), b, stripe(b));
        }
      }
      g.lineStyle(1.4, surface.shade, 1);
      for (let i = 1; i < upper.length; i++) {
        const a = upper[i - 1],
          b = upper[i];
        if (a && b && bottom(a.x) > a.y + 1 && bottom(b.x) > b.y + 1)
          g.lineBetween(a.x, a.y, b.x, b.y);
      }
      if (!meadowSurface) return;
      for (
        let x = Math.ceil((from + 12) / FLOWER_STEP_U) * FLOWER_STEP_U;
        x < to - 12;
        x += FLOWER_STEP_U
      ) {
        const y = top(x) + 10 + ((x * 7) % 31);
        if (y > bottom(x) - 6 || toneAt(x).flowers < 0.4) continue;
        g.fillStyle(
          [0xf4d03f, 0xffffff, 0xe74c3c][Math.round(x) % 3] ?? 0xffffff,
          1,
        );
        g.fillCircle(x, y, 1.6);
      }
      // Shrubs and a few stones over the slope, on a shared grid too.
      for (
        let x = Math.ceil((from + 20) / SHRUB_STEP_U) * SHRUB_STEP_U;
        x < to - 20;
        x += SHRUB_STEP_U
      ) {
        for (let row = 0; row < 3; row++) {
          const n = Math.round(x) * 3 + row;
          const sx = x + ((n * 17) % 23) - 11;
          const fraction = 0.08 + 0.27 * row + ((n * 13) % 47) / 200;
          const y = top(sx) + (ground.railY(sx) - top(sx)) * fraction;
          if (y < top(sx) + 12 || y > bottom(sx) - 14) continue;
          if (n % 4 === 0) {
            g.fillStyle(0x9a9486, 1);
            g.fillEllipse(sx, y, 11, 6);
            g.fillStyle(0xc4bfb2, 1);
            g.fillEllipse(sx - 1.5, y - 1.2, 6, 2.6);
            continue;
          }
          const size = 0.8 + ((n * 7) % 5) / 10;
          g.fillStyle(surface.shade, 0.35);
          g.fillEllipse(sx + 1, y + 4 * size, 20 * size, 5 * size);
          for (const [dx, dy, r, tone] of [
            [-5, 0, 5.5, 0x3d7a28],
            [4, -1, 6.5, 0x4a8a2f],
            [0, -5, 5.5, 0x55963a],
            [-2, -7, 2.4, 0x7bbd52],
            [5, -5, 2, 0x86c65c],
          ] as const) {
            g.fillStyle(mixColour(tone, 0xf1f6fa, toneAt(sx).winter), 1);
            g.fillCircle(sx + dx * size, y + dy * size, r * size);
          }
        }
      }
    };
    const bounds = (from: number, to: number, below: (x: number) => number) => {
      let high = Infinity;
      let low = -Infinity;
      for (const x of xs(from, to)) {
        high = Math.min(high, top(x));
        low = Math.max(low, below(x));
      }
      return { left: from - 2, top: high - 4, right: to + 2, bottom: low + 4 };
    };

    // Flanks: the hill behind the track, wider than the tunnel.
    const flankFrom = fromX - FLANK_U;
    const flankTo = toX + FLANK_U;
    const rail = (x: number) => ground.railY(x);
    const flanks = bake(
      (g) =>
        paintHill(
          g,
          flankFrom,
          flankTo,
          xs(flankFrom, flankTo)
            .reverse()
            .map((x) => point(x, rail(x))),
          rail,
        ),
      bounds(flankFrom, flankTo, rail),
    ).setDepth(depths.flanks);

    // Inside: dark masonry with warm lamps, from rail to ceiling.
    const inFrom = fromX - INSIDE_OUTSET_U;
    const inTo = toX + INSIDE_OUTSET_U;
    const ceiling = (x: number) => ground.railY(x) - CEILING_U;
    const interior = bake(
      (g) => {
        const upper = xs(inFrom, inTo).map((x) => point(x, ceiling(x)));
        const lower = xs(inFrom, inTo)
          .reverse()
          .map((x) => point(x, ground.railY(x) + 4));
        g.fillStyle(0x2a2622, 1);
        g.fillPoints([...upper, ...lower], true);
        g.lineStyle(1, 0x3d3631, 1);
        for (let h = 14; h < CEILING_U; h += 14)
          g.strokePoints(
            xs(inFrom, inTo).map((x) => point(x, ground.railY(x) - h)),
            false,
            false,
          );
        for (let x = inFrom + 40; x < inTo - 20; x += 64) {
          const y = ground.railY(x) - 120;
          g.fillStyle(0xf5d97a, 0.18);
          g.fillCircle(x, y, 9);
          g.fillStyle(0xfff3c4, 1);
          g.fillCircle(x, y, 2.4);
        }
        // Hangers: a bracket from the ceiling, an insulator and the clamp
        // holding the wire at contact height (doc 03 §9).
        for (const x of hangerXs) {
          if (
            x <= fromX - TUNNEL_MAST_CLEARANCE_U ||
            x >= toX + TUNNEL_MAST_CLEARANCE_U
          )
            continue;
          const wire = ground.railY(x) - catenaryContactHeightU;
          const roof = ceiling(x);
          g.fillStyle(0x4d535b, 1);
          g.fillRect(x - 9, roof, 18, 3);
          g.fillRect(x - 1.2, roof, 2.4, wire - roof - 2);
          g.fillStyle(0x9a6b45, 1);
          for (let i = 0; i < 3; i++)
            g.fillEllipse(x, roof + 8 + i * 3.4, 6.4, 2.6);
          g.fillStyle(0x7d848c, 1);
          g.fillRect(x - 3, wire - 3, 6, 3);
        }
      },
      {
        left: inFrom - 2,
        top: Math.min(ceiling(inFrom), ceiling(inTo), ceiling(middle)) - 4,
        right: inTo + 2,
        bottom:
          Math.max(
            ground.railY(inFrom),
            ground.railY(inTo),
            ground.railY(middle),
          ) + 8,
      },
    ).setDepth(depths.interior);

    // Darkening over whatever is inside, soft at the portals.
    const shade = bake(
      (g) => {
        for (let x = fromX - SHADE_FADE_U; x < toX + SHADE_FADE_U; x += 4) {
          const inside = Math.min(
            x - (fromX - SHADE_FADE_U),
            toX + SHADE_FADE_U - x,
          );
          const alpha = SHADE_ALPHA * Math.min(1, inside / SHADE_FADE_U);
          g.fillStyle(0x0d0c10, alpha);
          g.fillRect(x, ceiling(x), 4.5, CEILING_U + 6);
        }
      },
      {
        left: fromX - SHADE_FADE_U - 2,
        top: Math.min(ceiling(fromX), ceiling(toX), ceiling(middle)) - 8,
        right: toX + SHADE_FADE_U + 6,
        bottom:
          Math.max(
            ground.railY(fromX),
            ground.railY(toX),
            ground.railY(middle),
          ) + 10,
      },
    ).setDepth(depths.shade);

    // Cover: the hill over the track between the portals, down to the
    // meadow, and over the portals only above them (clear of the train and
    // the masts), so its edges hide behind the portals; then the portals.
    const coverFrom = fromX + COVER_INSET_U;
    const coverTo = toX - COVER_INSET_U;
    // From each portal's foot the hill slopes down over the bank.
    const meadow = (x: number) => {
      const foot = rail(x) + 4;
      const low = ground.meadowY(x) + 4;
      const t = Math.min(
        1,
        Math.min(x - coverFrom, coverTo - x) / FOOT_SLOPE_U,
      );
      return foot + (low - foot) * Math.max(0, t);
    };
    const cap = (x: number) => Math.max(top(x), rail(x) - CAP_BOTTOM_U);
    const coverBottom = (x: number) =>
      x >= coverFrom && x <= coverTo ? meadow(x) : cap(x);
    const cover = bake(
      (g) =>
        paintHill(
          g,
          flankFrom,
          flankTo,
          [
            ...xs(coverTo, flankTo)
              .reverse()
              .map((x) => point(x, cap(x))),
            ...xs(coverFrom, coverTo)
              .reverse()
              .map((x) => point(x, meadow(x))),
            ...xs(flankFrom, coverFrom)
              .reverse()
              .map((x) => point(x, cap(x))),
          ],
          coverBottom,
        ),
      bounds(flankFrom, flankTo, coverBottom),
    );
    // All new plants fit inside the existing opaque silhouette and its bounds.
    if (art && !meadowSurface) {
      for (
        let x = Math.ceil((flankFrom + 40) / 80) * 80;
        x < flankTo - 40;
        x += 80
      ) {
        const pine = dunes && Math.round(x / 80) % 3 === 0;
        const key = pine
          ? snow
            ? 'tree.pine-snow'
            : 'tree.pine'
          : mountain
            ? snow
              ? 'tree.spruce-snow'
              : 'tree.spruce'
            : snow
              ? 'near.snow-bush'
              : coast
                ? 'near.dune-grass'
                : 'near.bush';
        const part = worldParts[key];
        const scale = pine || mountain ? 0.7 : 0.65;
        const half = (part.widthU * scale) / 2 + 2;
        const roof = Math.max(top(x - half), top(x), top(x + half));
        const foot = roof + part.heightU * scale + 6;
        if (
          foot + 4 >
          Math.min(coverBottom(x - half), coverBottom(x), coverBottom(x + half))
        )
          continue;
        const plant = scene.add
          .image(x, foot, frameTexture(key, art.texture), key)
          .setData('world-part', key);
        const origin = frameOrigin(part.pivotU, art.pxPerU, plant.frame);
        cover.add(
          plant.setOrigin(origin.x, origin.y).setScale(scale / art.pxPerU),
        );
        if (dunes && !snow && !pine) {
          const flowers = scene.add.image(
            x,
            foot - 6,
            frameTexture('near.flowers-b', art.texture),
            'near.flowers-b',
          );
          flowers.setData('world-part', 'near.flowers-b');
          const pivot = frameOrigin(
            worldParts['near.flowers-b'].pivotU,
            art.pxPerU,
            flowers.frame,
          );
          cover.add(
            flowers.setOrigin(pivot.x, pivot.y).setScale(0.8 / art.pxPerU),
          );
        }
      }
    }
    const portal = worldParts[tunnelParts.portal];
    for (const [x, mirrored] of [
      [fromX, false],
      [toX, true],
    ] as const) {
      if (!art) break;
      const image = scene.add.image(
        x,
        ground.railY(x),
        frameTexture(tunnelParts.portal, art.texture),
        tunnelParts.portal,
      );
      image.setData('world-part', tunnelParts.portal);
      const pivot = mirrored
        ? { x: portal.widthU - portal.pivotU.x, y: portal.pivotU.y }
        : portal.pivotU;
      cover.add(
        setWorldPivot(image, pivot, art.pxPerU)
          .setFlipX(mirrored)
          .setScale(1 / art.pxPerU),
      );
    }
    if (art)
      for (const x of [fromX, toX]) {
        const winter = appearance?.climateAt(x).winter ?? 0;
        if (winter <= 0) continue;
        const snow = worldParts['snow.roof-64'];
        const cap = scene.add
          .image(
            x - 78,
            ground.railY(x) - 228,
            frameTexture('snow.roof-64', art.texture),
            'snow.roof-64',
          )
          .setData('world-part', 'snow.roof-64');
        const origin = frameOrigin(snow.pivotU, art.pxPerU, cap.frame);
        cover.add(
          cap
            .setOrigin(origin.x, origin.y)
            .setScale(156 / 64 / art.pxPerU, 0.45 / art.pxPerU)
            .setAlpha(winter),
        );
      }
    cover.setDepth(depths.cover);
    this.#coveredPoint = (point) => {
      const x = point.x - site.chunkIndex * chunkWidthU;
      if (
        art &&
        [fromX, toX].some((portalX) =>
          portalMasonryPoint(
            x - portalX,
            point.y - ground.railY(portalX),
            74,
            222,
            58,
            128,
          ),
        )
      )
        return true;
      return (
        x >= flankFrom &&
        x <= flankTo &&
        point.y >= top(x) &&
        point.y <= coverBottom(x)
      );
    };
    this.containers = [flanks, interior, shade, cover];
  }

  /** Rock stays opaque, including the first restored or paused frame. */
  get alpha(): number {
    return 1;
  }

  /** Fully covered core; the open portal mouths stay visible at its ends. */
  get coverRange(): { fromX: number; toX: number } {
    return {
      fromX: this.#worldFrom + COVER_INSET_U,
      toX: this.#worldTo - COVER_INSET_U,
    };
  }

  /** True behind the hill silhouette or portal masonry, with the arches open. */
  coversPoint(point: { x: number; y: number }): boolean {
    return this.#coveredPoint(point);
  }

  get train(): TrainInTunnel {
    return this.#train;
  }

  update(train: { minX: number; maxX: number } | undefined): void {
    this.#train = train ? vehicleInCover(train, [this.coverRange]) : 'outside';
  }
}
