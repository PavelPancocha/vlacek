import type { EffectId, VehicleBase } from '../domain/types.ts';
import type { ArtPart, VehicleArt } from './artManifest.ts';

export interface ArtValidationInput {
  /** Locomotives carry their `effect` and catenary need; wagons neither. */
  vehicles: readonly (VehicleBase & {
    placeholder?: unknown;
    effect?: EffectId;
    requiresCatenary?: boolean;
  })[];
  parts: Readonly<Record<string, ArtPart>>;
  art: Readonly<Partial<Record<string, VehicleArt>>>;
  /** SVG text by file name: every file in `assets/vehicles/`. */
  files: ReadonlyMap<string, string>;
}

/** Size attributes of the root `<svg>` element. */
function svgFrame(text: string) {
  const root = /<svg\b[^>]*>/.exec(text)?.[0] ?? '';
  const attribute = (name: string) =>
    new RegExp(`\\s${name}="([^"]*)"`).exec(root)?.[1];
  return {
    width: Number(attribute('width')),
    height: Number(attribute('height')),
    viewBox: attribute('viewBox'),
  };
}

function partErrors(key: string, part: ArtPart, text: string): string[] {
  const errors: string[] = [];
  const { widthU: w, heightU: h, pivotU: pivot } = part;
  const frame = svgFrame(text);
  if (
    frame.viewBox !== `0 0 ${w} ${h}` ||
    frame.width !== w ||
    frame.height !== h
  )
    errors.push(`${key}: ${part.file} is not ${w} × ${h} u`);
  if (pivot.x < 0 || pivot.x > w || pivot.y < 0 || pivot.y > h)
    errors.push(`${key}: pivot outside the part`);
  return errors;
}

function vehicleErrors(
  vehicle: VehicleBase & { effect?: EffectId; requiresCatenary?: boolean },
  art: VehicleArt,
  parts: Readonly<Record<string, ArtPart>>,
): string[] {
  const errors: string[] = [];
  const error = (message: string) => errors.push(`${vehicle.id}: ${message}`);
  const length = vehicle.lengthU;
  // The effect leaves the model at its emitters (doc 14 §4).
  const emitters = art.emitters ?? [];
  const effect = vehicle.effect ?? 'none';
  if (effect !== 'none' && emitters.length === 0)
    error(`effect ${effect} has no emitter on the model`);
  if (effect === 'none' && emitters.length > 0)
    error('emitters on a vehicle without an effect');
  for (const emitter of emitters)
    if (
      emitter.xU < 0 ||
      emitter.xU > length ||
      emitter.yU < 0 ||
      emitter.yU > art.heightU
    )
      error(
        `emitter at ${emitter.xU}, ${emitter.yU} is outside the ${length} × ${art.heightU} u frame`,
      );
  // An electric locomotive reaches the wire with its pantograph.
  const pantograph = art.pantograph;
  if (vehicle.requiresCatenary === true && !pantograph)
    error('needs catenary but has no pantograph');
  if (vehicle.requiresCatenary !== true && pantograph)
    error('pantograph without catenary');
  if (
    pantograph &&
    (pantograph.xU < 0 ||
      pantograph.xU > length ||
      pantograph.yU < 0 ||
      pantograph.yU > art.heightU)
  )
    error(
      `pantograph at ${pantograph.xU}, ${pantograph.yU} is outside the ${length} × ${art.heightU} u frame`,
    );
  for (const key of [art.body, art.overlay]) {
    if (key === undefined) continue;
    const frame = parts[key];
    if (
      frame?.widthU !== length ||
      frame.heightU !== art.heightU ||
      frame.pivotU.x !== length / 2 ||
      frame.pivotU.y !== art.heightU
    )
      error(
        `${key} frame is not ${length} × ${art.heightU} u, pivot on the rail`,
      );
  }

  const wheels: { x: number; r: number }[] = [];
  for (const wheel of art.wheels) {
    const shape = parts[wheel.part];
    const r = (shape?.heightU ?? 0) / 2;
    if (
      shape?.widthU !== shape?.heightU ||
      shape?.pivotU.x !== r ||
      shape.pivotU.y !== r
    )
      error(`wheel ${wheel.part} is not round with its pivot in the middle`);
    if (wheel.xU - r < 0 || wheel.xU + r > length)
      error(`wheel at ${wheel.xU} outside the vehicle`);
    wheels.push({ x: wheel.xU, r });
  }
  for (const [i, a] of wheels.entries()) {
    for (const b of wheels.slice(i + 1)) {
      if (Math.abs(a.x - b.x) < a.r + b.r)
        error(`wheels at ${a.x} and ${b.x} overlap`);
    }
  }
  if (wheels.length < 2) error('fewer than two wheels');
  const largest = Math.max(0, ...wheels.map((wheel) => wheel.r));
  if (largest !== vehicle.wheelRadiusU)
    error(
      `largest wheel radius ${largest} is not wheelRadiusU ${vehicle.wheelRadiusU}`,
    );

  const gear = art.steamGear;
  if (!gear) return errors;
  const main = art.wheels[gear.mainWheel];
  if (!main) {
    error('no main wheel');
    return errors;
  }
  const radius = (parts[main.part]?.heightU ?? 0) / 2;
  if (gear.crankU <= 0 || gear.crankU >= radius)
    error('crank outside the main wheel');
  const rod = parts[gear.connectingRod];
  if (!rod?.endU) {
    error('connecting rod has no small end');
  } else {
    const rodU = Math.hypot(
      rod.endU.x - rod.pivotU.x,
      rod.endU.y - rod.pivotU.y,
    );
    const wheelY = art.heightU - radius;
    // The crosshead stays reachable in every crank position.
    if (Math.abs(gear.guideYU - wheelY) + gear.crankU >= rodU)
      error('cylinder out of the connecting rod reach');
  }
  // Wheels under the coupling rod turn with the main wheel: same size.
  const couplingRod = parts[gear.couplingRod];
  for (const wheel of art.wheels) {
    const pinX = (couplingRod?.pivotU.x ?? 0) + wheel.xU - main.xU;
    if (pinX < 0 || pinX > (couplingRod?.widthU ?? 0)) continue;
    if ((parts[wheel.part]?.heightU ?? 0) / 2 !== radius)
      error(`coupled wheel at ${wheel.xU} is not the size of the main wheel`);
  }
  return errors;
}

/**
 * Every part file exists with its size in u as the viewBox, and every file
 * in the folder belongs to a part (shared by vehicle and world art).
 */
export function partFileErrors(
  parts: Readonly<Record<string, ArtPart>>,
  files: ReadonlyMap<string, string>,
): string[] {
  const errors: string[] = [];
  const used = new Set<string>();
  for (const [key, part] of Object.entries(parts)) {
    used.add(part.file);
    const text = files.get(part.file);
    if (text === undefined) errors.push(`${key}: ${part.file} missing`);
    else errors.push(...partErrors(key, part, text));
  }
  for (const file of files.keys()) {
    if (!used.has(file)) errors.push(`${file}: not in the manifest`);
  }
  return errors;
}

/**
 * Vehicle art contract (CNT-02, doc 06 §8, doc 07 §4): every catalog
 * vehicle has exactly one look, every part file exists at its size in u,
 * drawings are exactly as long as the vehicle, wheels stand on the rail and
 * rods fit their wheels. Returns error messages; empty means valid.
 */
export function validateVehicleArt(input: ArtValidationInput): string[] {
  const errors: string[] = [];
  const ids = new Set(input.vehicles.map((vehicle) => vehicle.id));
  for (const vehicle of input.vehicles) {
    const hasArt = input.art[vehicle.id] !== undefined;
    const hasPlaceholder = vehicle.placeholder !== undefined;
    if (hasArt && hasPlaceholder)
      errors.push(`${vehicle.id}: art and a placeholder`);
    if (!hasArt && !hasPlaceholder)
      errors.push(`${vehicle.id}: no art and no placeholder`);
  }
  for (const id of Object.keys(input.art)) {
    if (!ids.has(id))
      errors.push(`${id}: art for a vehicle not in the catalog`);
  }

  errors.push(...partFileErrors(input.parts, input.files));

  // Every type has its own drawing (doc 10 §5: not a recoloured copy).
  const bodies = new Map<string, string>();
  const usedParts = new Set<string>();
  for (const vehicle of input.vehicles) {
    const art = input.art[vehicle.id];
    if (!art) continue;
    errors.push(...vehicleErrors(vehicle, art, input.parts));
    const owner = bodies.get(art.body);
    if (owner !== undefined)
      errors.push(`${vehicle.id}: shares its body drawing with ${owner}`);
    else bodies.set(art.body, vehicle.id);
    for (const key of [
      art.body,
      art.overlay,
      ...art.wheels.map((wheel) => wheel.part),
      art.steamGear?.couplingRod,
      art.steamGear?.connectingRod,
      art.steamGear?.crosshead,
      art.pantograph?.arms,
      art.pantograph?.head,
    ])
      if (key !== undefined) usedParts.add(key);
  }
  for (const key of Object.keys(input.parts)) {
    if (!usedParts.has(key)) errors.push(`${key}: not used by any vehicle`);
  }
  return errors;
}

/** A release ships no placeholder (doc 06 §8, CNT-02). */
export function releaseErrors(
  vehicles: readonly (VehicleBase & { placeholder?: unknown })[],
): string[] {
  return vehicles
    .filter((vehicle) => vehicle.placeholder !== undefined)
    .map((vehicle) => `${vehicle.id}: placeholder`);
}
