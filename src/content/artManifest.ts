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
  'diesel_mainline.body': {
    file: 'diesel_mainline.body.svg',
    widthU: 196,
    heightU: 86,
    pivotU: { x: 98, y: 86 },
  },
  'diesel_mainline.overlay': {
    file: 'diesel_mainline.overlay.svg',
    widthU: 196,
    heightU: 86,
    pivotU: { x: 98, y: 86 },
  },
  'magic_stars.body': {
    file: 'magic_stars.body.svg',
    widthU: 164,
    heightU: 100,
    pivotU: { x: 82, y: 100 },
  },
  'magic_stars.overlay': {
    file: 'magic_stars.overlay.svg',
    widthU: 164,
    heightU: 100,
    pivotU: { x: 82, y: 100 },
  },
  'magic_stars.coupling-rod': {
    file: 'magic_stars.coupling-rod.svg',
    widthU: 42,
    heightU: 6,
    pivotU: { x: 38, y: 3 },
  },
  'magic_stars.connecting-rod': {
    file: 'magic_stars.connecting-rod.svg',
    widthU: 44,
    heightU: 7,
    pivotU: { x: 3, y: 3.5 },
    endU: { x: 41, y: 3.5 },
  },
  'magic_stars.crosshead': {
    file: 'magic_stars.crosshead.svg',
    widthU: 22,
    heightU: 7,
    pivotU: { x: 3.5, y: 3.5 },
  },
  'passenger_classic.body': {
    file: 'passenger_classic.body.svg',
    widthU: 176,
    heightU: 82,
    pivotU: { x: 88, y: 82 },
  },
  'passenger_classic.overlay': {
    file: 'passenger_classic.overlay.svg',
    widthU: 176,
    heightU: 82,
    pivotU: { x: 88, y: 82 },
  },
  'passenger_open.body': {
    file: 'passenger_open.body.svg',
    widthU: 144,
    heightU: 76,
    pivotU: { x: 72, y: 76 },
  },
  'passenger_open.overlay': {
    file: 'passenger_open.overlay.svg',
    widthU: 144,
    heightU: 76,
    pivotU: { x: 72, y: 76 },
  },
  'cargo_box.body': {
    file: 'cargo_box.body.svg',
    widthU: 164,
    heightU: 76,
    pivotU: { x: 82, y: 76 },
  },
  'cargo_box.overlay': {
    file: 'cargo_box.overlay.svg',
    widthU: 164,
    heightU: 76,
    pivotU: { x: 82, y: 76 },
  },
  'cargo_coal.body': {
    file: 'cargo_coal.body.svg',
    widthU: 152,
    heightU: 68,
    pivotU: { x: 76, y: 68 },
  },
  'cargo_coal.overlay': {
    file: 'cargo_coal.overlay.svg',
    widthU: 152,
    heightU: 68,
    pivotU: { x: 76, y: 68 },
  },
  'cargo_container.body': {
    file: 'cargo_container.body.svg',
    widthU: 188,
    heightU: 74,
    pivotU: { x: 94, y: 74 },
  },
  'cargo_container.overlay': {
    file: 'cargo_container.overlay.svg',
    widthU: 188,
    heightU: 74,
    pivotU: { x: 94, y: 74 },
  },
  'service_crane.body': {
    file: 'service_crane.body.svg',
    widthU: 188,
    heightU: 84,
    pivotU: { x: 94, y: 84 },
  },
  'service_crane.overlay': {
    file: 'service_crane.overlay.svg',
    widthU: 188,
    heightU: 84,
    pivotU: { x: 94, y: 84 },
  },
  'fun_balloons.body': {
    file: 'fun_balloons.body.svg',
    widthU: 164,
    heightU: 104,
    pivotU: { x: 82, y: 104 },
  },
  'fun_balloons.overlay': {
    file: 'fun_balloons.overlay.svg',
    widthU: 164,
    heightU: 104,
    pivotU: { x: 82, y: 104 },
  },
  'wheel.diesel': {
    file: 'wheel-diesel.svg',
    widthU: 26,
    heightU: 26,
    pivotU: { x: 13, y: 13 },
  },
  'wheel.star-driver': {
    file: 'wheel-star-driver.svg',
    widthU: 30,
    heightU: 30,
    pivotU: { x: 15, y: 15 },
  },
  'wheel.star-pony': {
    file: 'wheel-star-pony.svg',
    widthU: 20,
    heightU: 20,
    pivotU: { x: 10, y: 10 },
  },
  'wheel.wagon-spoked': {
    file: 'wheel-wagon-spoked.svg',
    widthU: 24,
    heightU: 24,
    pivotU: { x: 12, y: 12 },
  },
  'wheel.wagon-disc': {
    file: 'wheel-wagon-disc.svg',
    widthU: 24,
    heightU: 24,
    pivotU: { x: 12, y: 12 },
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
  magic_stars: {
    heightU: 100,
    body: 'magic_stars.body',
    overlay: 'magic_stars.overlay',
    wheels: [
      { part: 'wheel.star-driver', xU: 50 },
      { part: 'wheel.star-driver', xU: 84 },
      { part: 'wheel.star-pony', xU: 132 },
    ],
    steamGear: {
      mainWheel: 1,
      crankU: 6,
      guideYU: 77,
      couplingRod: 'magic_stars.coupling-rod',
      connectingRod: 'magic_stars.connecting-rod',
      crosshead: 'magic_stars.crosshead',
    },
  },
  diesel_mainline: {
    heightU: 86,
    body: 'diesel_mainline.body',
    overlay: 'diesel_mainline.overlay',
    // Two two-axle bogies at the vehicle middle ± 62 (bogieOffsetU).
    wheels: [
      { part: 'wheel.diesel', xU: 21 },
      { part: 'wheel.diesel', xU: 51 },
      { part: 'wheel.diesel', xU: 145 },
      { part: 'wheel.diesel', xU: 175 },
    ],
  },
  passenger_classic: {
    heightU: 82,
    body: 'passenger_classic.body',
    overlay: 'passenger_classic.overlay',
    // Two bogies at the vehicle middle ± 55 (bogieOffsetU), axles ± 13.
    wheels: [
      { part: 'wheel.wagon-spoked', xU: 20 },
      { part: 'wheel.wagon-spoked', xU: 46 },
      { part: 'wheel.wagon-spoked', xU: 130 },
      { part: 'wheel.wagon-spoked', xU: 156 },
    ],
  },
  passenger_open: {
    heightU: 76,
    body: 'passenger_open.body',
    overlay: 'passenger_open.overlay',
    // Two axles at the vehicle middle ± 45 (bogieOffsetU).
    wheels: [
      { part: 'wheel.wagon-spoked', xU: 27 },
      { part: 'wheel.wagon-spoked', xU: 117 },
    ],
  },
  cargo_box: {
    heightU: 76,
    body: 'cargo_box.body',
    overlay: 'cargo_box.overlay',
    // Two axles at the vehicle middle ± 51 (bogieOffsetU).
    wheels: [
      { part: 'wheel.wagon-disc', xU: 31 },
      { part: 'wheel.wagon-disc', xU: 133 },
    ],
  },
  cargo_coal: {
    heightU: 68,
    body: 'cargo_coal.body',
    overlay: 'cargo_coal.overlay',
    // Two axles at the vehicle middle ± 47 (bogieOffsetU).
    wheels: [
      { part: 'wheel.wagon-disc', xU: 29 },
      { part: 'wheel.wagon-disc', xU: 123 },
    ],
  },
  cargo_container: {
    heightU: 74,
    body: 'cargo_container.body',
    overlay: 'cargo_container.overlay',
    // Two bogies at the vehicle middle ± 58 (bogieOffsetU), axles ± 13.
    wheels: [
      { part: 'wheel.wagon-disc', xU: 23 },
      { part: 'wheel.wagon-disc', xU: 49 },
      { part: 'wheel.wagon-disc', xU: 139 },
      { part: 'wheel.wagon-disc', xU: 165 },
    ],
  },
  service_crane: {
    heightU: 84,
    body: 'service_crane.body',
    overlay: 'service_crane.overlay',
    // Two bogies at the vehicle middle ± 58 (bogieOffsetU), axles ± 13.
    wheels: [
      { part: 'wheel.wagon-disc', xU: 23 },
      { part: 'wheel.wagon-disc', xU: 49 },
      { part: 'wheel.wagon-disc', xU: 139 },
      { part: 'wheel.wagon-disc', xU: 165 },
    ],
  },
  fun_balloons: {
    heightU: 104,
    body: 'fun_balloons.body',
    overlay: 'fun_balloons.overlay',
    // Two axles at the vehicle middle ± 51 (bogieOffsetU).
    wheels: [
      { part: 'wheel.wagon-spoked', xU: 31 },
      { part: 'wheel.wagon-spoked', xU: 133 },
    ],
  },
};
