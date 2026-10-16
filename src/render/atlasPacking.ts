import type { NpcFleet } from '../domain/interaction/OncomingTrain.ts';
import { vehicleArt, type ArtPartKey } from '../content/artManifest.ts';
import { vehicleArtLayers } from '../content/artLayers.ts';
/**
 * Shelf packing of rasterised art parts into one atlas texture, so all
 * vehicle parts share a texture (doc 07 §4/§10, D-010). Pure: sizes in,
 * positions out; drawing happens in ArtAtlas.
 */
export interface AtlasItem {
  key: string;
  width: number;
  height: number;
}

export interface PackedAtlas {
  width: number;
  height: number;
  frames: Map<string, { x: number; y: number }>;
}

/**
 * Tallest items first, left to right in rows ("shelves"). Every frame keeps
 * `paddingPx` empty pixels on all sides so filtering never bleeds between
 * neighbours. Throws rather than clipping when the art does not fit.
 */
export function packAtlas(
  items: readonly AtlasItem[],
  options: { maxSize: number; paddingPx: number },
): PackedAtlas {
  const { maxSize, paddingPx: pad } = options;
  const ordered = [...items].sort(
    (a, b) =>
      b.height - a.height || b.width - a.width || (a.key < b.key ? -1 : 1),
  );
  const frames = new Map<string, { x: number; y: number }>();
  let x = pad;
  let y = pad;
  let shelfHeight = 0;
  let width = 0;
  for (const item of ordered) {
    if (item.width + 2 * pad > maxSize || item.height + 2 * pad > maxSize)
      throw new RangeError(`${item.key} is larger than the atlas`);
    if (x + item.width + pad > maxSize) {
      x = pad;
      y += shelfHeight + pad;
      shelfHeight = 0;
    }
    if (y + item.height + pad > maxSize)
      throw new RangeError(`art does not fit a ${maxSize} × ${maxSize} atlas`);
    frames.set(item.key, { x, y });
    x += item.width + pad;
    width = Math.max(width, x);
    shelfHeight = Math.max(shelfHeight, item.height);
  }
  return { width, height: y + shelfHeight + pad, frames };
}

/**
 * Largest raster scale of vehicle and world art, px per u: above the
 * camera zoom of common screens (≈ 1.7 on a 2560 CSS px wide window at the
 * capped DPR, D-008). The journey vehicle atlas and the world atlas each fit at it (D-019).
 */
export const ART_MAX_PX_PER_U = 2;
/** Backdrops are distant and soft: their own atlas stops at 1 px/u (D-013). */
export const BACKDROP_MAX_PX_PER_U = 1;
/** Low-profile backdrop ceiling; only viewports wider than 2500 CSS px reach it (D-030). */
export const LOW_BACKDROP_MAX_PX_PER_U = 0.75;
const ART_MIN_PX_PER_U = 0.5;
/** Raster scale steps; a resize within one step keeps the atlas. */
const ART_SCALE_STEP = 0.25;

/**
 * Raster scale for a camera zoom (game px per u): the next step at or
 * above it, so the browser's vector rasteriser anti-aliases the art at
 * nearly the drawn size instead of the GPU shrinking a large bitmap.
 */
export function artScaleFor(
  zoom: number,
  maxPxPerU: number = ART_MAX_PX_PER_U,
): number {
  const step = Math.ceil(zoom / ART_SCALE_STEP - 1e-9) * ART_SCALE_STEP;
  return Math.min(maxPxPerU, Math.max(ART_MIN_PX_PER_U, step));
}

/** Atlas residency ceiling for the effective quality profile (D-030). */
export function profileArtScale(
  zoom: number,
  quality: 'low' | 'standard',
): number {
  return artScaleFor(zoom, quality === 'low' ? 1.25 : ART_MAX_PX_PER_U);
}
/** Backdrop raster ceiling for the effective quality profile (D-030). */
export function profileBackdropScale(
  zoom: number,
  quality: 'low' | 'standard',
): number {
  return artScaleFor(
    zoom,
    quality === 'low' ? LOW_BACKDROP_MAX_PX_PER_U : BACKDROP_MAX_PX_PER_U,
  );
}
/** Doc 13 `assetBudgets.preferredMaxAtlasEdgePx`. */
export const MAX_ATLAS_EDGE_PX = 2048;
export const ATLAS_PADDING_PX = 2;
/**
 * Transparent pixels each atlas frame includes around its part (D-013):
 * the game draws without MSAA, so the edge of a rotated quad must fall on
 * transparent texels for texture filtering to smooth it. At most half the
 * padding, so a margin never reaches a neighbour's pixels.
 */
export const FRAME_MARGIN_PX = 1;

export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Atlas frame of each packed item, grown by FRAME_MARGIN_PX. */
export function framesWithMargin(
  plan: PackedAtlas,
  items: readonly AtlasItem[],
): Map<string, FrameRect> {
  const frames = new Map<string, FrameRect>();
  for (const item of items) {
    const at = plan.frames.get(item.key);
    if (!at) continue;
    frames.set(item.key, {
      x: at.x - FRAME_MARGIN_PX,
      y: at.y - FRAME_MARGIN_PX,
      width: item.width + 2 * FRAME_MARGIN_PX,
      height: item.height + 2 * FRAME_MARGIN_PX,
    });
  }
  return frames;
}

/** Origin (0 … 1) of a part's pivot (u) in its margin-grown frame (px). */
export function frameOrigin(
  pivotU: { x: number; y: number },
  pxPerU: number,
  frame: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: (pivotU.x * pxPerU + FRAME_MARGIN_PX) / frame.width,
    y: (pivotU.y * pxPerU + FRAME_MARGIN_PX) / frame.height,
  };
}

/** Atlas frames for art parts sized in u, rasterised at `pxPerU`. */
export function artAtlasItems(
  parts: Readonly<Record<string, { widthU: number; heightU: number }>>,
  pxPerU: number,
): AtlasItem[] {
  return Object.entries(parts).map(([key, part]) => ({
    key,
    width: Math.ceil(part.widthU * pxPerU),
    height: Math.ceil(part.heightU * pxPerU),
  }));
}

/** All unique vehicle parts needed by one journey and its NPC fleet (D-019). */
export function journeyArtKeys(
  vehicles: readonly { id: string; lengthU: number }[],
  fleet: NpcFleet,
): ArtPartKey[] {
  return [
    ...new Set(
      [...vehicles, ...fleet.locomotives, ...fleet.wagons].flatMap(
        (vehicle) => {
          const art = vehicleArt[vehicle.id];
          return art
            ? vehicleArtLayers(art, vehicle.lengthU, 0).map(
                (layer) => layer.part,
              )
            : [];
        },
      ),
    ),
  ];
}

/** Compact bounded pages for the window; no resolution reduction (D-030). */
export function packWorldPages(items: readonly AtlasItem[]) {
  const work = worldPagePlanning(items);
  let step = work.next();
  while (!step.done) step = work.next();
  return step.value;
}
/** Each resume does one candidate; the render owner yields between candidates. */
export function* worldPagePlanning(
  items: readonly AtlasItem[],
  singlePage = false,
): Generator<void, { items: AtlasItem[]; plan: PackedAtlas }[]> {
  if (singlePage)
    return [
      {
        items: [...items],
        plan: packAtlas(items, {
          maxSize: MAX_ATLAS_EDGE_PX,
          paddingPx: ATLAS_PADDING_PX,
        }),
      },
    ];
  const area = (pages: readonly { plan: PackedAtlas }[]) =>
    pages.reduce((sum, p) => sum + p.plan.width * p.plan.height, 0);
  let best = yield* packRectsInSteps(items, MAX_ATLAS_EDGE_PX, 'height');
  yield;
  const consider = (candidate: PagePlans) => {
    if (
      candidate.length <= 2 &&
      (best.length > 2 || area(candidate) < area(best))
    )
      best = candidate;
  };
  for (const order of ['height', 'area', 'width'] as const) {
    if (order !== 'height') {
      const candidate = yield* packRectsInSteps(
        items,
        MAX_ATLAS_EDGE_PX,
        order,
      );
      yield;
      consider(candidate);
    }
    // The best order at height 2048 need not be best for a compact page.
    // Refine every order: otherwise a thin track tile can spill to a second page.
    let low = Math.ceil(
        Math.max(
          1,
          ...items.map((item) => item.height + 2 * ATLAS_PADDING_PX),
        ) / 128,
      ),
      high = 16;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = yield* packRectsInSteps(items, middle * 128, order);
      yield;
      if (candidate.length > 2) low = middle + 1;
      else {
        consider(candidate);
        high = middle - 1;
      }
    }
  }
  if (best.length > 2)
    throw new RangeError('world window exceeds two atlas pages');
  // Two compact pages can undercut one page by a few hundred pixels, but each
  // page costs a texture bind per batch (D-010). When the two pages would fit
  // one page, search the lowest one-page height too and prefer it within one
  // 128-px full-width band (D-030).
  if (best.length === 2 && area(best) <= MAX_ATLAS_EDGE_PX ** 2) {
    let single: PagePlans | undefined;
    for (const order of ['height', 'area', 'width'] as const) {
      let low = Math.ceil(
          Math.max(
            1,
            ...items.map((item) => item.height + 2 * ATLAS_PADDING_PX),
          ) / 128,
        ),
        high = 16;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = yield* packRectsInSteps(items, middle * 128, order);
        yield;
        if (candidate.length > 1) low = middle + 1;
        else {
          if (!single || area(candidate) < area(single)) single = candidate;
          high = middle - 1;
        }
      }
    }
    if (single && area(single) <= area(best) + MAX_ATLAS_EDGE_PX * 128)
      best = single;
  }
  // Upload the larger page first: its canvas does not overlap the completed smaller GPU page.
  return best.sort(
    (a, b) => b.plan.width * b.plan.height - a.plan.width * a.plan.height,
  );
}
/** Parts placed per resumable packing step (D-032: no unsliced `plan` spike). */
const PACK_STEP_PARTS = 32;
type PagePlans = { items: AtlasItem[]; plan: PackedAtlas }[];
/** One maxrects candidate, resumable after every 32 placed parts (D-032). */
export function* packRectsInSteps(
  items: readonly AtlasItem[],
  height: number,
  order: 'height' | 'area' | 'width',
): Generator<void, { items: AtlasItem[]; plan: PackedAtlas }[]> {
  const pad = ATLAS_PADDING_PX,
    max = MAX_ATLAS_EDGE_PX;
  type Rect = { x: number; y: number; w: number; h: number };
  const pages: { items: AtlasItem[]; plan: PackedAtlas; free: Rect[] }[] = [];
  let placedParts = 0;
  for (const item of [...items].sort(
    (a, b) =>
      (order === 'area'
        ? b.width * b.height - a.width * a.height
        : order === 'width'
          ? b.width - a.width
          : b.height - a.height) ||
      b.width - a.width ||
      // Code-unit order: packing must not depend on the process locale.
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  )) {
    const w = item.width + 2 * pad,
      h = item.height + 2 * pad;
    if (w > max || h > max)
      throw new RangeError(`${item.key} is larger than the atlas`);
    let chosen:
      { page: (typeof pages)[number]; rect: Rect; score: number } | undefined;
    for (const page of pages)
      for (const rect of page.free) {
        if (w > rect.w || h > rect.h) continue;
        const score = Math.min(rect.w - w, rect.h - h);
        if (!chosen || score < chosen.score) chosen = { page, rect, score };
      }
    if (!chosen) {
      const rect = { x: 0, y: 0, w: max, h: height };
      const page = {
        items: [],
        plan: {
          width: 1,
          height: 1,
          frames: new Map<string, { x: number; y: number }>(),
        },
        free: [rect],
      };
      pages.push(page);
      chosen = { page, rect, score: 0 };
    }
    const { page, rect } = chosen,
      placed = { x: rect.x, y: rect.y, w, h };
    page.plan.frames.set(item.key, { x: rect.x + pad, y: rect.y + pad });
    page.plan.width = Math.max(page.plan.width, rect.x + w);
    page.plan.height = Math.max(page.plan.height, rect.y + h);
    page.items.push(item);
    const free: Rect[] = [];
    for (const r of page.free) {
      if (
        placed.x >= r.x + r.w ||
        placed.x + w <= r.x ||
        placed.y >= r.y + r.h ||
        placed.y + h <= r.y
      ) {
        free.push(r);
        continue;
      }
      if (placed.x > r.x) free.push({ ...r, w: placed.x - r.x });
      if (placed.x + w < r.x + r.w)
        free.push({ ...r, x: placed.x + w, w: r.x + r.w - placed.x - w });
      if (placed.y > r.y) free.push({ ...r, h: placed.y - r.y });
      if (placed.y + h < r.y + r.h)
        free.push({ ...r, y: placed.y + h, h: r.y + r.h - placed.y - h });
    }
    page.free = free.filter(
      (r, i) =>
        !free.some(
          (other, j) =>
            i !== j &&
            r.x >= other.x &&
            r.y >= other.y &&
            r.x + r.w <= other.x + other.w &&
            r.y + r.h <= other.y + other.h &&
            (j < i ||
              r.x !== other.x ||
              r.y !== other.y ||
              r.w !== other.w ||
              r.h !== other.h),
        ),
    );
    if (++placedParts % PACK_STEP_PARTS === 0 && placedParts < items.length)
      yield;
  }
  return pages;
}

/** A bounded number of decoded bitmaps, never exceeding the window's source-byte envelope. */
export function atlasDecodeBatch(
  items: readonly AtlasItem[],
  start: number,
  byteLimit: number,
  maxItems = 4,
): AtlasItem[] {
  const batch: AtlasItem[] = [];
  let bytes = 0;
  for (const item of items.slice(start, start + maxItems)) {
    const next = item.width * item.height * 4;
    if (bytes + next > byteLimit) break;
    batch.push(item);
    bytes += next;
  }
  return batch;
}
