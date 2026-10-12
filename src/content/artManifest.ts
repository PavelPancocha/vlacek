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
  'electric_retro.body': {
    file: 'electric_retro.body.svg',
    widthU: 188,
    heightU: 92,
    pivotU: { x: 94, y: 92 },
  },
  'electric_retro.overlay': {
    file: 'electric_retro.overlay.svg',
    widthU: 188,
    heightU: 92,
    pivotU: { x: 94, y: 92 },
  },
  'electric_retro.pantograph': {
    file: 'electric_retro.pantograph.svg',
    widthU: 40,
    heightU: 60,
    pivotU: { x: 20, y: 60 },
  },
  'electric_retro.pantograph-head': {
    file: 'electric_retro.pantograph-head.svg',
    widthU: 48,
    heightU: 8,
    pivotU: { x: 24, y: 8 },
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
  'electric_modern.body': {
    file: 'electric_modern.body.svg',
    widthU: 204,
    heightU: 90,
    pivotU: { x: 102, y: 90 },
  },
  'electric_modern.overlay': {
    file: 'electric_modern.overlay.svg',
    widthU: 204,
    heightU: 90,
    pivotU: { x: 102, y: 90 },
  },
  'electric_mountain.body': {
    file: 'electric_mountain.body.svg',
    widthU: 160,
    heightU: 96,
    pivotU: { x: 80, y: 96 },
  },
  'electric_mountain.overlay': {
    file: 'electric_mountain.overlay.svg',
    widthU: 160,
    heightU: 96,
    pivotU: { x: 80, y: 96 },
  },
  'steam_express.body': {
    file: 'steam_express.body.svg',
    widthU: 216,
    heightU: 108,
    pivotU: { x: 108, y: 108 },
  },
  'steam_express.overlay': {
    file: 'steam_express.overlay.svg',
    widthU: 216,
    heightU: 108,
    pivotU: { x: 108, y: 108 },
  },
  'wheel.steam-driver-large': {
    file: 'wheel-steam-driver-large.svg',
    widthU: 38,
    heightU: 38,
    pivotU: { x: 19, y: 19 },
  },
  'steam_express.coupling-rod': {
    file: 'steam_express.coupling-rod.svg',
    widthU: 90,
    heightU: 7,
    pivotU: { x: 45, y: 3.5 },
  },
  'steam_express.connecting-rod': {
    file: 'steam_express.connecting-rod.svg',
    widthU: 64,
    heightU: 8,
    pivotU: { x: 4, y: 4 },
    endU: { x: 60, y: 4 },
  },
  'steam_express.crosshead': {
    file: 'steam_express.crosshead.svg',
    widthU: 30,
    heightU: 8,
    pivotU: { x: 4, y: 4 },
  },
  'diesel_shunter.body': {
    file: 'diesel_shunter.body.svg',
    widthU: 148,
    heightU: 82,
    pivotU: { x: 74, y: 82 },
  },
  'diesel_shunter.overlay': {
    file: 'diesel_shunter.overlay.svg',
    widthU: 148,
    heightU: 82,
    pivotU: { x: 74, y: 82 },
  },
  'passenger_double.body': {
    file: 'passenger_double.body.svg',
    widthU: 192,
    heightU: 100,
    pivotU: { x: 96, y: 100 },
  },
  'passenger_double.overlay': {
    file: 'passenger_double.overlay.svg',
    widthU: 192,
    heightU: 100,
    pivotU: { x: 96, y: 100 },
  },
  'passenger_sleeper.body': {
    file: 'passenger_sleeper.body.svg',
    widthU: 184,
    heightU: 82,
    pivotU: { x: 92, y: 82 },
  },
  'passenger_sleeper.overlay': {
    file: 'passenger_sleeper.overlay.svg',
    widthU: 184,
    heightU: 82,
    pivotU: { x: 92, y: 82 },
  },
  'passenger_dining.body': {
    file: 'passenger_dining.body.svg',
    widthU: 184,
    heightU: 82,
    pivotU: { x: 92, y: 82 },
  },
  'passenger_dining.overlay': {
    file: 'passenger_dining.overlay.svg',
    widthU: 184,
    heightU: 82,
    pivotU: { x: 92, y: 82 },
  },
  'passenger_panorama.body': {
    file: 'passenger_panorama.body.svg',
    widthU: 192,
    heightU: 92,
    pivotU: { x: 96, y: 92 },
  },
  'passenger_panorama.overlay': {
    file: 'passenger_panorama.overlay.svg',
    widthU: 192,
    heightU: 92,
    pivotU: { x: 96, y: 92 },
  },
  'magic_bubbles.body': {
    file: 'magic_bubbles.body.svg',
    widthU: 164,
    heightU: 96,
    pivotU: { x: 82, y: 96 },
  },
  'magic_bubbles.overlay': {
    file: 'magic_bubbles.overlay.svg',
    widthU: 164,
    heightU: 96,
    pivotU: { x: 82, y: 96 },
  },
  'magic_rainbow.body': {
    file: 'magic_rainbow.body.svg',
    widthU: 176,
    heightU: 100,
    pivotU: { x: 88, y: 100 },
  },
  'magic_rainbow.overlay': {
    file: 'magic_rainbow.overlay.svg',
    widthU: 176,
    heightU: 100,
    pivotU: { x: 88, y: 100 },
  },
  'service_tools.body': {
    file: 'service_tools.body.svg',
    widthU: 164,
    heightU: 80,
    pivotU: { x: 82, y: 80 },
  },
  'service_tools.overlay': {
    file: 'service_tools.overlay.svg',
    widthU: 164,
    heightU: 80,
    pivotU: { x: 82, y: 80 },
  },
  'service_snowplow.body': {
    file: 'service_snowplow.body.svg',
    widthU: 156,
    heightU: 80,
    pivotU: { x: 78, y: 80 },
  },
  'service_snowplow.overlay': {
    file: 'service_snowplow.overlay.svg',
    widthU: 156,
    heightU: 80,
    pivotU: { x: 78, y: 80 },
  },
  'cargo_logs.body': {
    file: 'cargo_logs.body.svg',
    widthU: 176,
    heightU: 76,
    pivotU: { x: 88, y: 76 },
  },
  'cargo_logs.overlay': {
    file: 'cargo_logs.overlay.svg',
    widthU: 176,
    heightU: 76,
    pivotU: { x: 88, y: 76 },
  },
  'cargo_sand.body': {
    file: 'cargo_sand.body.svg',
    widthU: 152,
    heightU: 66,
    pivotU: { x: 76, y: 66 },
  },
  'cargo_sand.overlay': {
    file: 'cargo_sand.overlay.svg',
    widthU: 152,
    heightU: 66,
    pivotU: { x: 76, y: 66 },
  },
  'cargo_gravel.body': {
    file: 'cargo_gravel.body.svg',
    widthU: 152,
    heightU: 68,
    pivotU: { x: 76, y: 68 },
  },
  'cargo_gravel.overlay': {
    file: 'cargo_gravel.overlay.svg',
    widthU: 152,
    heightU: 68,
    pivotU: { x: 76, y: 68 },
  },
  'cargo_hay.body': {
    file: 'cargo_hay.body.svg',
    widthU: 164,
    heightU: 82,
    pivotU: { x: 82, y: 82 },
  },
  'cargo_hay.overlay': {
    file: 'cargo_hay.overlay.svg',
    widthU: 164,
    heightU: 82,
    pivotU: { x: 82, y: 82 },
  },
  'cargo_apples.body': {
    file: 'cargo_apples.body.svg',
    widthU: 156,
    heightU: 72,
    pivotU: { x: 78, y: 72 },
  },
  'cargo_apples.overlay': {
    file: 'cargo_apples.overlay.svg',
    widthU: 156,
    heightU: 72,
    pivotU: { x: 78, y: 72 },
  },
  'cargo_tank.body': {
    file: 'cargo_tank.body.svg',
    widthU: 176,
    heightU: 82,
    pivotU: { x: 88, y: 82 },
  },
  'cargo_tank.overlay': {
    file: 'cargo_tank.overlay.svg',
    widthU: 176,
    heightU: 82,
    pivotU: { x: 88, y: 82 },
  },
  'cargo_milk.body': {
    file: 'cargo_milk.body.svg',
    widthU: 168,
    heightU: 76,
    pivotU: { x: 84, y: 76 },
  },
  'cargo_milk.overlay': {
    file: 'cargo_milk.overlay.svg',
    widthU: 168,
    heightU: 76,
    pivotU: { x: 84, y: 76 },
  },
  'cargo_grain.body': {
    file: 'cargo_grain.body.svg',
    widthU: 172,
    heightU: 84,
    pivotU: { x: 86, y: 84 },
  },
  'cargo_grain.overlay': {
    file: 'cargo_grain.overlay.svg',
    widthU: 172,
    heightU: 84,
    pivotU: { x: 86, y: 84 },
  },
  'cargo_mail.body': {
    file: 'cargo_mail.body.svg',
    widthU: 164,
    heightU: 78,
    pivotU: { x: 82, y: 78 },
  },
  'cargo_mail.overlay': {
    file: 'cargo_mail.overlay.svg',
    widthU: 164,
    heightU: 78,
    pivotU: { x: 82, y: 78 },
  },
  'cargo_refrigerated.body': {
    file: 'cargo_refrigerated.body.svg',
    widthU: 176,
    heightU: 80,
    pivotU: { x: 88, y: 80 },
  },
  'cargo_refrigerated.overlay': {
    file: 'cargo_refrigerated.overlay.svg',
    widthU: 176,
    heightU: 80,
    pivotU: { x: 88, y: 80 },
  },
  'cargo_cars.body': {
    file: 'cargo_cars.body.svg',
    widthU: 204,
    heightU: 96,
    pivotU: { x: 102, y: 96 },
  },
  'cargo_cars.overlay': {
    file: 'cargo_cars.overlay.svg',
    widthU: 204,
    heightU: 96,
    pivotU: { x: 102, y: 96 },
  },
  'cargo_tractor.body': {
    file: 'cargo_tractor.body.svg',
    widthU: 184,
    heightU: 90,
    pivotU: { x: 92, y: 90 },
  },
  'cargo_tractor.overlay': {
    file: 'cargo_tractor.overlay.svg',
    widthU: 184,
    heightU: 90,
    pivotU: { x: 92, y: 90 },
  },
  'cargo_excavator.body': {
    file: 'cargo_excavator.body.svg',
    widthU: 192,
    heightU: 96,
    pivotU: { x: 96, y: 96 },
  },
  'cargo_excavator.overlay': {
    file: 'cargo_excavator.overlay.svg',
    widthU: 192,
    heightU: 96,
    pivotU: { x: 96, y: 96 },
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
  /**
   * Where the locomotive's effect (smoke, exhaust, stars) leaves the model,
   * in the frame (x from the rear coupler, y down from the top), doc 14 §4.
   */
  emitters?: readonly { xU: number; yU: number }[];
  /** The raised pantograph of an electric locomotive (doc 03 §9). */
  pantograph?: PantographArt;
}

/**
 * A pantograph stretched up to the contact wire: its arms stand on the
 * roof at (xU, yU) in the frame and are scaled in height; the head sits
 * on top unscaled, touching the wire `headContactU` above its pivot.
 */
export interface PantographArt {
  xU: number;
  yU: number;
  arms: ArtPartKey;
  head: ArtPartKey;
  headContactU: number;
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
    // Top of the chimney cap.
    emitters: [{ xU: 130.5, yU: 6 }],
  },
  electric_retro: {
    heightU: 92,
    body: 'electric_retro.body',
    overlay: 'electric_retro.overlay',
    // Two two-axle bogies at the vehicle middle ± 58 (bogieOffsetU).
    wheels: [
      { part: 'wheel.diesel', xU: 21 },
      { part: 'wheel.diesel', xU: 51 },
      { part: 'wheel.diesel', xU: 137 },
      { part: 'wheel.diesel', xU: 167 },
    ],
    // The rear pantograph is raised, the front one lies folded.
    pantograph: {
      xU: 50,
      yU: 6,
      arms: 'electric_retro.pantograph',
      head: 'electric_retro.pantograph-head',
      headContactU: 7,
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
    // Crown of the tulip chimney.
    emitters: [{ xU: 129.5, yU: 9 }],
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
    // Exhaust stack on the roof.
    emitters: [{ xU: 99, yU: 5.6 }],
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
  electric_modern: {
    heightU: 90,
    body: 'electric_modern.body',
    overlay: 'electric_modern.overlay',
    wheels: [
      { part: 'wheel.diesel', xU: 21 },
      { part: 'wheel.diesel', xU: 51 },
      { part: 'wheel.diesel', xU: 153 },
      { part: 'wheel.diesel', xU: 183 },
    ],
    pantograph: {
      xU: 62,
      yU: 14,
      arms: 'electric_retro.pantograph',
      head: 'electric_retro.pantograph-head',
      headContactU: 7,
    },
  },
  electric_mountain: {
    heightU: 96,
    body: 'electric_mountain.body',
    overlay: 'electric_mountain.overlay',
    wheels: [
      { part: 'wheel.diesel', xU: 17 },
      { part: 'wheel.diesel', xU: 47 },
      { part: 'wheel.diesel', xU: 113 },
      { part: 'wheel.diesel', xU: 143 },
    ],
    pantograph: {
      xU: 46,
      yU: 14,
      arms: 'electric_retro.pantograph',
      head: 'electric_retro.pantograph-head',
      headContactU: 7,
    },
  },
  steam_express: {
    heightU: 108,
    body: 'steam_express.body',
    overlay: 'steam_express.overlay',
    wheels: [
      { part: 'wheel.steam-pony', xU: 24 },
      { part: 'wheel.steam-driver-large', xU: 66 },
      { part: 'wheel.steam-driver-large', xU: 108 },
      { part: 'wheel.steam-driver-large', xU: 150 },
      { part: 'wheel.steam-pony', xU: 194 },
    ],
    steamGear: {
      mainWheel: 2,
      crankU: 8,
      guideYU: 82,
      couplingRod: 'steam_express.coupling-rod',
      connectingRod: 'steam_express.connecting-rod',
      crosshead: 'steam_express.crosshead',
    },
    emitters: [{ xU: 186, yU: 8 }],
  },
  diesel_shunter: {
    heightU: 82,
    body: 'diesel_shunter.body',
    overlay: 'diesel_shunter.overlay',
    wheels: [
      { part: 'wheel.diesel', xU: 30 },
      { part: 'wheel.diesel', xU: 118 },
    ],
    emitters: [{ xU: 96, yU: 25 }],
  },
  passenger_double: {
    heightU: 100,
    body: 'passenger_double.body',
    overlay: 'passenger_double.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 23 },
      { part: 'wheel.wagon-disc', xU: 49 },
      { part: 'wheel.wagon-disc', xU: 143 },
      { part: 'wheel.wagon-disc', xU: 169 },
    ],
  },
  passenger_sleeper: {
    heightU: 82,
    body: 'passenger_sleeper.body',
    overlay: 'passenger_sleeper.overlay',
    wheels: [
      { part: 'wheel.wagon-spoked', xU: 22 },
      { part: 'wheel.wagon-spoked', xU: 48 },
      { part: 'wheel.wagon-spoked', xU: 136 },
      { part: 'wheel.wagon-spoked', xU: 162 },
    ],
  },
  passenger_dining: {
    heightU: 82,
    body: 'passenger_dining.body',
    overlay: 'passenger_dining.overlay',
    wheels: [
      { part: 'wheel.wagon-spoked', xU: 22 },
      { part: 'wheel.wagon-spoked', xU: 48 },
      { part: 'wheel.wagon-spoked', xU: 136 },
      { part: 'wheel.wagon-spoked', xU: 162 },
    ],
  },
  passenger_panorama: {
    heightU: 92,
    body: 'passenger_panorama.body',
    overlay: 'passenger_panorama.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 23 },
      { part: 'wheel.wagon-disc', xU: 49 },
      { part: 'wheel.wagon-disc', xU: 143 },
      { part: 'wheel.wagon-disc', xU: 169 },
    ],
  },
  magic_bubbles: {
    heightU: 96,
    body: 'magic_bubbles.body',
    overlay: 'magic_bubbles.overlay',
    wheels: [
      { part: 'wheel.diesel', xU: 36 },
      { part: 'wheel.diesel', xU: 128 },
    ],
    emitters: [{ xU: 127, yU: 12 }],
  },
  magic_rainbow: {
    heightU: 100,
    body: 'magic_rainbow.body',
    overlay: 'magic_rainbow.overlay',
    wheels: [
      { part: 'wheel.wagon-spoked', xU: 23 },
      { part: 'wheel.wagon-spoked', xU: 49 },
      { part: 'wheel.wagon-spoked', xU: 127 },
      { part: 'wheel.wagon-spoked', xU: 153 },
    ],
    emitters: [{ xU: 138, yU: 10 }],
  },
  service_tools: {
    heightU: 80,
    body: 'service_tools.body',
    overlay: 'service_tools.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 31 },
      { part: 'wheel.wagon-disc', xU: 133 },
    ],
  },
  service_snowplow: {
    heightU: 80,
    body: 'service_snowplow.body',
    overlay: 'service_snowplow.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 30 },
      { part: 'wheel.wagon-disc', xU: 126 },
    ],
  },
  cargo_logs: {
    heightU: 76,
    body: 'cargo_logs.body',
    overlay: 'cargo_logs.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 20 },
      { part: 'wheel.wagon-disc', xU: 46 },
      { part: 'wheel.wagon-disc', xU: 130 },
      { part: 'wheel.wagon-disc', xU: 156 },
    ],
  },
  cargo_sand: {
    heightU: 66,
    body: 'cargo_sand.body',
    overlay: 'cargo_sand.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 29 },
      { part: 'wheel.wagon-disc', xU: 123 },
    ],
  },
  cargo_gravel: {
    heightU: 68,
    body: 'cargo_gravel.body',
    overlay: 'cargo_gravel.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 29 },
      { part: 'wheel.wagon-disc', xU: 123 },
    ],
  },
  cargo_hay: {
    heightU: 82,
    body: 'cargo_hay.body',
    overlay: 'cargo_hay.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 31 },
      { part: 'wheel.wagon-disc', xU: 133 },
    ],
  },
  cargo_apples: {
    heightU: 72,
    body: 'cargo_apples.body',
    overlay: 'cargo_apples.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 30 },
      { part: 'wheel.wagon-disc', xU: 126 },
    ],
  },
  cargo_tank: {
    heightU: 82,
    body: 'cargo_tank.body',
    overlay: 'cargo_tank.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 20 },
      { part: 'wheel.wagon-disc', xU: 46 },
      { part: 'wheel.wagon-disc', xU: 130 },
      { part: 'wheel.wagon-disc', xU: 156 },
    ],
  },
  cargo_milk: {
    heightU: 76,
    body: 'cargo_milk.body',
    overlay: 'cargo_milk.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 32 },
      { part: 'wheel.wagon-disc', xU: 136 },
    ],
  },
  cargo_grain: {
    heightU: 84,
    body: 'cargo_grain.body',
    overlay: 'cargo_grain.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 20 },
      { part: 'wheel.wagon-disc', xU: 46 },
      { part: 'wheel.wagon-disc', xU: 126 },
      { part: 'wheel.wagon-disc', xU: 152 },
    ],
  },
  cargo_mail: {
    heightU: 78,
    body: 'cargo_mail.body',
    overlay: 'cargo_mail.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 31 },
      { part: 'wheel.wagon-disc', xU: 133 },
    ],
  },
  cargo_refrigerated: {
    heightU: 80,
    body: 'cargo_refrigerated.body',
    overlay: 'cargo_refrigerated.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 33 },
      { part: 'wheel.wagon-disc', xU: 143 },
    ],
  },
  cargo_cars: {
    heightU: 96,
    body: 'cargo_cars.body',
    overlay: 'cargo_cars.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 26 },
      { part: 'wheel.wagon-disc', xU: 52 },
      { part: 'wheel.wagon-disc', xU: 152 },
      { part: 'wheel.wagon-disc', xU: 178 },
    ],
  },
  cargo_tractor: {
    heightU: 90,
    body: 'cargo_tractor.body',
    overlay: 'cargo_tractor.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 22 },
      { part: 'wheel.wagon-disc', xU: 48 },
      { part: 'wheel.wagon-disc', xU: 136 },
      { part: 'wheel.wagon-disc', xU: 162 },
    ],
  },
  cargo_excavator: {
    heightU: 96,
    body: 'cargo_excavator.body',
    overlay: 'cargo_excavator.overlay',
    wheels: [
      { part: 'wheel.wagon-disc', xU: 23 },
      { part: 'wheel.wagon-disc', xU: 49 },
      { part: 'wheel.wagon-disc', xU: 143 },
      { part: 'wheel.wagon-disc', xU: 169 },
    ],
  },
};
