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
 * Largest raster scale of vehicle art, px per u: above the camera zoom of
 * common screens (≈ 1.7 on a 2560 CSS px wide window at the capped DPR,
 * D-008). The atlas must fit at this scale.
 */
export const ART_MAX_PX_PER_U = 2.5;
const ART_MIN_PX_PER_U = 0.5;
/** Raster scale steps; a resize within one step keeps the atlas. */
const ART_SCALE_STEP = 0.25;

/**
 * Raster scale for a camera zoom (game px per u): the next step at or
 * above it, so the browser's vector rasteriser anti-aliases the art at
 * nearly the drawn size instead of the GPU shrinking a large bitmap.
 */
export function artScaleFor(zoom: number): number {
  const step = Math.ceil(zoom / ART_SCALE_STEP - 1e-9) * ART_SCALE_STEP;
  return Math.min(ART_MAX_PX_PER_U, Math.max(ART_MIN_PX_PER_U, step));
}
/** Doc 13 `assetBudgets.preferredMaxAtlasEdgePx`. */
export const MAX_ATLAS_EDGE_PX = 2048;
export const ATLAS_PADDING_PX = 2;

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
