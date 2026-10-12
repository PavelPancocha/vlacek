import type {
  LocomotiveDefinition,
  VehicleBase,
  WagonDefinition,
} from '../types.ts';
import { hash32 } from '../world/Hash.ts';
import type { NpcFleet } from './OncomingTrain.ts';

/** Deterministic journey fleet with art; smaller catalogs return every eligible type (D-019). */
export function npcFleetFor(
  seed: number,
  catalog: {
    locomotives: readonly LocomotiveDefinition[];
    wagons: readonly WagonDefinition[];
  },
): NpcFleet {
  const pick = (
    vehicles: readonly VehicleBase[],
    kind: string,
    count: number,
  ) =>
    vehicles
      .filter((vehicle) => !vehicle.placeholder)
      .sort(
        (a, b) =>
          hash32(seed, 'npc-fleet', kind, a.id) -
            hash32(seed, 'npc-fleet', kind, b.id) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )
      .slice(0, count);
  return {
    locomotives: pick(
      catalog.locomotives.filter(
        (vehicle) => vehicle.power === 'steam' || vehicle.power === 'diesel',
      ),
      'locomotive',
      2,
    ),
    wagons: pick(catalog.wagons, 'wagon', 6),
  };
}
