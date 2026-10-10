import type {
  LocomotiveDefinition,
  VehicleBase,
  WagonDefinition,
} from '../domain/types.ts';

export interface CatalogLimits {
  maxVehicleLengthU: number;
}

function vehicleErrors(vehicle: VehicleBase, limits: CatalogLimits): string[] {
  const errors: string[] = [];
  const check = (valid: boolean, field: string) => {
    if (!valid) errors.push(`${vehicle.id}: ${field}`);
  };
  check(
    Number.isFinite(vehicle.lengthU) &&
      vehicle.lengthU > 0 &&
      vehicle.lengthU <= limits.maxVehicleLengthU,
    'lengthU',
  );
  check(
    vehicle.bogieOffsetU > 0 && vehicle.bogieOffsetU < vehicle.lengthU / 2,
    'bogieOffsetU',
  );
  check(
    Number.isFinite(vehicle.wheelRadiusU) && vehicle.wheelRadiusU > 0,
    'wheelRadiusU',
  );
  check(vehicle.labelCs.trim() !== '', 'labelCs');
  check(vehicle.bodyAsset.trim() !== '', 'bodyAsset');
  check(vehicle.previewAsset.trim() !== '', 'previewAsset');
  return errors;
}

/**
 * Contract checks for vehicle definitions (doc 06, doc 08 §4). Returns
 * human-readable errors; an empty list means the catalog is valid.
 */
export function validateCatalog(
  locomotives: readonly LocomotiveDefinition[],
  wagons: readonly WagonDefinition[],
  limits: CatalogLimits,
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const vehicle of [...locomotives, ...wagons]) {
    if (seen.has(vehicle.id)) errors.push(`duplicate id ${vehicle.id}`);
    seen.add(vehicle.id);
    errors.push(...vehicleErrors(vehicle, limits));
    if (vehicle.kind === 'locomotive') {
      if (vehicle.requiresCatenary !== (vehicle.power === 'electric')) {
        errors.push(`${vehicle.id}: requiresCatenary`);
      }
      if (vehicle.hornAudio.trim() === '')
        errors.push(`${vehicle.id}: hornAudio`);
    }
  }
  return errors;
}
