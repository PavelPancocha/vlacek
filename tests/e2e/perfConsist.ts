import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import {
  addWagon,
  createDraft,
  type ConsistLengthRules,
} from '../../src/domain/consist/ConsistEditor.ts';

const WAGON_TYPES = [
  'passenger_classic',
  'passenger_open',
  'cargo_box',
  'cargo_apples',
  'cargo_container',
  'service_crane',
  'fun_balloons',
];

/** Mixed types, or PERF_WAGON repeated, up to the configured D-028 length limit. */
export function longestMixedConsist(locomotiveId: string, wagonType?: string) {
  if (
    wagonType !== undefined &&
    !wagons.some((wagon) => wagon.id === wagonType)
  )
    throw new Error(`Unknown PERF_WAGON: "${wagonType}"`);
  const vehicles = new Map(
    [...locomotives, ...wagons].map((vehicle) => [vehicle.id, vehicle]),
  );
  const rules: ConsistLengthRules = {
    maxLengthU: gameConfig.train.maxConsistLengthU,
    couplerGapU: gameConfig.train.couplerGapU,
    geometryOf: (id) => vehicles.get(id),
  };
  let draft = createDraft(locomotiveId);
  for (let i = 0; ; i++) {
    const next = addWagon(
      draft,
      wagonType ?? WAGON_TYPES[i] ?? 'passenger_open',
      rules,
    );
    if (!next.added) return draft.consist;
    draft = next.draft;
  }
}
