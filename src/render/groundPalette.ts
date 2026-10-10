import type { Biome } from '../domain/world/Biomes.ts';
import type {
  BackGround,
  NearGround,
} from '../domain/world/sceneryTemplates.ts';

/** Colours of the near ground: embankment face and meadow bands. */
export interface NearPalette {
  /** Matches the bottom row of the track tiles of this ground. */
  bank: number;
  bankShade: number;
  /** From the bank foot towards the viewer, darker when nearer. */
  bands: readonly { fromU: number; color: number }[];
}

export const NEAR_PALETTE: Readonly<Record<NearGround, NearPalette>> = {
  meadow: {
    bank: 0x5f9a34,
    bankShade: 0x4c8228,
    bands: [
      { fromU: 0, color: 0x8ecd60 },
      { fromU: 24, color: 0x8ac95c },
      { fromU: 52, color: 0x85c457 },
      { fromU: 86, color: 0x80bf52 },
      { fromU: 126, color: 0x7aba4d },
      { fromU: 172, color: 0x74b448 },
      { fromU: 226, color: 0x6eae43 },
    ],
  },
  forest: {
    bank: 0x5f9a34,
    bankShade: 0x3f6b2a,
    bands: [
      { fromU: 0, color: 0x6f9e48 },
      { fromU: 30, color: 0x67963f },
      { fromU: 70, color: 0x5f8e3a },
      { fromU: 120, color: 0x588634 },
      { fromU: 180, color: 0x517e2f },
    ],
  },
  sand: {
    bank: 0xd9c48a,
    bankShade: 0xc2ab72,
    bands: [
      { fromU: 0, color: 0xf2e2b4 },
      { fromU: 40, color: 0xeedcaa },
      { fromU: 100, color: 0xe8d49e },
      { fromU: 180, color: 0xe2cc93 },
    ],
  },
  snow: {
    bank: 0xdfe9f2,
    bankShade: 0xbfd0de,
    bands: [
      { fromU: 0, color: 0xf8fbfd },
      { fromU: 40, color: 0xf1f6fa },
      { fromU: 100, color: 0xe9f1f7 },
      { fromU: 180, color: 0xe1ebf3 },
    ],
  },
};

/** Colours of the ground behind the track, up to the horizon. */
export interface BackPalette {
  base: number;
  /** Darker strip along the horizon edge. */
  edge: number;
  /** Furrows or crop rows. */
  rows?: number;
  /** Soft patches that break up the plain ground. */
  patches: readonly number[];
}

export const BACK_PALETTE: Readonly<Record<BackGround, BackPalette>> = {
  meadow: {
    base: 0x92cc66,
    edge: 0x6fae3e,
    patches: [0x9ed473, 0x86c25a, 0xa6d87c],
  },
  glade: {
    base: 0x82b257,
    edge: 0x4f7a32,
    patches: [0x8cbc60, 0x76a64c, 0x93c266],
  },
  wheat: {
    base: 0xe8cb66,
    edge: 0xb9a040,
    rows: 0xd2b24e,
    patches: [0xf0d677, 0xdcbf58],
  },
  crops: {
    base: 0x86c255,
    edge: 0x5f9a34,
    rows: 0x6aa53c,
    patches: [0x92ca62, 0x7ab84c],
  },
  forest: {
    base: 0x6c9a46,
    edge: 0x3f6b2a,
    patches: [0x5f8f3e, 0x78a650, 0x557f36],
  },
  sand: { base: 0xf0dcaa, edge: 0xd9c48a, patches: [0xf5e4b8, 0xe6d09a] },
  snow: { base: 0xf3f7fa, edge: 0xc9d9e6, patches: [0xe4edf4, 0xffffff] },
};

/** Fill under each biome's mid backdrop, its lowest ground colour. */
export const BACKDROP_FILL: Readonly<Record<Biome, number>> = {
  countryside: 0x6aa63c,
  forest: 0x2c5530,
  lakes: 0x62a03a,
  foothills: 0x5e8c40,
  mountains: 0xdae5ee,
  coast: 0xe2cb90,
};

/** Colours of a water basin, from its far edge to its near shore. */
export interface WaterPalette {
  shore: number;
  wetShore: number;
  /** Reflection of the far shore along the far edge. */
  farEdge: number;
  far: number;
  middle: number;
  near: number;
  ripple: number;
}

/** Ponds and lakes inland, bays on the coast (by the near ground). */
export const WATER_PALETTE: Readonly<Record<'lake' | 'sea', WaterPalette>> = {
  lake: {
    shore: 0xc9b47c,
    wetShore: 0x9c8c5c,
    farEdge: 0x4f8a58,
    far: 0x9fd1ea,
    middle: 0x79bce2,
    near: 0x5ba6d6,
    ripple: 0xffffff,
  },
  sea: {
    shore: 0xf7e9c2,
    wetShore: 0xd8c38c,
    farEdge: 0x4d93c4,
    far: 0x8ccdec,
    middle: 0x5cb3e0,
    near: 0x4aa4d8,
    ripple: 0xffffff,
  },
};

/**
 * A near-ground palette part way from `left` (t = 0) to `right` (t = 1),
 * for the soft edge where the ground changes style: the bands cut at
 * both palettes' offsets, each coloured between the two at its offset.
 */
export function blendNearPalette(
  left: NearPalette,
  right: NearPalette,
  t: number,
): NearPalette {
  const cuts = [
    ...new Set([...left.bands, ...right.bands].map((band) => band.fromU)),
  ].sort((a, b) => a - b);
  return {
    bank: mixColour(left.bank, right.bank, t),
    bankShade: mixColour(left.bankShade, right.bankShade, t),
    bands: cuts.map((fromU) => ({
      fromU,
      color: mixColour(bandColour(left, fromU), bandColour(right, fromU), t),
    })),
  };
}

/** Colour of the band a palette has at an offset below the bank foot. */
function bandColour(palette: NearPalette, u: number): number {
  let colour = palette.bands[0]?.color ?? 0;
  for (const band of palette.bands) if (band.fromU <= u) colour = band.color;
  return colour;
}

/** Each RGB channel from `a` (t = 0) to `b` (t = 1), rounded. */
function mixColour(a: number, b: number, t: number): number {
  let mixed = 0;
  for (const shift of [16, 8, 0]) {
    const from = (a >> shift) & 255;
    const to = (b >> shift) & 255;
    mixed |= Math.round(from + (to - from) * t) << shift;
  }
  return mixed;
}
