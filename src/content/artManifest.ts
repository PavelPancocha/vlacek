/**
 * Vehicle art manifest (doc 06 §8, doc 07 §4). Pure data: the renderer and
 * the depot previews read every position from here, never from magic
 * offsets in drawing code.
 *
 * Parts are hand-authored SVG files in `assets/vehicles/` whose viewBox is
 * the part size in world units (1 SVG unit = 1 u). Vehicle positions use the
 * art frame: x from the rear coupler end, y down from the top, rail top at
 * y = heightU. Provenance of the files is in `assets/SOURCES.md`.
 */
export interface ArtPoint {
  x: number;
  y: number;
}

export interface ArtPart {
  /** File name in `assets/vehicles/`. */
  file: string;
  widthU: number;
  heightU: number;
  /** Point the part is placed and rotated by, part units from top left. */
  pivotU: ArtPoint;
  /** Second joint of a rod (connecting rod small end), part units. */
  endU?: ArtPoint;
}

export const artParts = {
  'steam_local.body': {
    file: 'steam_local.body.svg',
    widthU: 156,
    heightU: 100,
    pivotU: { x: 78, y: 100 },
  },
  'steam_local.overlay': {
    file: 'steam_local.overlay.svg',
    widthU: 156,
    heightU: 100,
    pivotU: { x: 78, y: 100 },
  },
  'steam_local.coupling-rod': {
    file: 'steam_local.coupling-rod.svg',
    widthU: 70,
    heightU: 6,
    pivotU: { x: 35, y: 3 },
  },
  'steam_local.connecting-rod': {
    file: 'steam_local.connecting-rod.svg',
    widthU: 50,
    heightU: 7,
    pivotU: { x: 3, y: 3.5 },
    endU: { x: 47, y: 3.5 },
  },
  'steam_local.crosshead': {
    file: 'steam_local.crosshead.svg',
    widthU: 30,
    heightU: 7,
    pivotU: { x: 3.5, y: 3.5 },
  },
  'wheel.steam-driver': {
    file: 'wheel-steam-driver.svg',
    widthU: 30,
    heightU: 30,
    pivotU: { x: 15, y: 15 },
  },
  'wheel.steam-pony': {
    file: 'wheel-steam-pony.svg',
    widthU: 18,
    heightU: 18,
    pivotU: { x: 9, y: 9 },
  },
} satisfies Record<string, ArtPart>;

export type ArtPartKey = keyof typeof artParts;

export interface WheelArt {
  /** Round part; its radius is half its height and it touches the rail. */
  part: ArtPartKey;
  /** Wheel centre, art frame x. */
  xU: number;
}

/** Rods driven by the crank of one wheel (doc 06 §2 "viditelná táhla"). */
export interface SteamGearArt {
  /** Index into `wheels` of the wheel the connecting rod works on. */
  mainWheel: number;
  /** Crank pin distance from the wheel centre, forward at rest. */
  crankU: number;
  /** Cylinder axis (crosshead guide), art frame y. */
  guideYU: number;
  /** Pivot on the main crank pin; moves without turning. */
  couplingRod: ArtPartKey;
  /** Pivot on the crank pin, `endU` on the crosshead; sets the rod length. */
  connectingRod: ArtPartKey;
  /** Pivot on the gudgeon pin. */
  crosshead: ArtPartKey;
}

export interface VehicleArt {
  /** Frame height above the rail; the frame is `lengthU` long. */
  heightU: number;
  /** Everything behind the wheels; pivot at the frame's middle on the rail. */
  body: ArtPartKey;
  /** Everything in front of the wheels and rods, same frame as the body. */
  overlay?: ArtPartKey;
  wheels: readonly WheelArt[];
  steamGear?: SteamGearArt;
}

/** Art by catalog vehicle id; vehicles missing here keep their placeholder. */
export const vehicleArt: Readonly<Partial<Record<string, VehicleArt>>> = {
  steam_local: {
    heightU: 100,
    body: 'steam_local.body',
    overlay: 'steam_local.overlay',
    wheels: [
      { part: 'wheel.steam-driver', xU: 44 },
      { part: 'wheel.steam-driver', xU: 76 },
      { part: 'wheel.steam-driver', xU: 108 },
      { part: 'wheel.steam-pony', xU: 138 },
    ],
    steamGear: {
      mainWheel: 1,
      crankU: 7,
      guideYU: 77,
      couplingRod: 'steam_local.coupling-rod',
      connectingRod: 'steam_local.connecting-rod',
      crosshead: 'steam_local.crosshead',
    },
  },
};
