import { gameConfig } from '../../../src/config/gameConfig.ts';
import { journeyArtKeys } from '../../../src/render/atlasPacking.ts';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';

// Contract vehicles.md B.1/B.2, frozen 2026-10-11; remove when every catalog vehicle has art.
// Full transparent body/overlay frames count separately, shared wheels/extras only once.
const pendingFrames: readonly (readonly [
  string,
  string,
  number,
  number,
  string,
])[] = [
  ['steam_express', 'steam', 216, 108, 'wheel.diesel'],
  ['diesel_shunter', 'diesel', 148, 82, 'wheel.diesel'],
  ['electric_modern', 'electric', 204, 90, 'wheel.diesel'],
  ['electric_mountain', 'electric', 160, 96, 'wheel.diesel'],
  ['magic_bubbles', 'fantasy', 164, 96, 'wheel.diesel'],
  ['magic_rainbow', 'fantasy', 176, 100, 'wheel.wagon-spoked'],
  ['passenger_double', 'passenger', 192, 100, 'wheel.wagon-disc'],
  ['passenger_sleeper', 'passenger', 184, 82, 'wheel.wagon-spoked'],
  ['passenger_dining', 'passenger', 184, 82, 'wheel.wagon-spoked'],
  ['passenger_panorama', 'passenger', 192, 92, 'wheel.wagon-disc'],
  ['cargo_logs', 'cargo', 176, 76, 'wheel.wagon-disc'],
  ['cargo_sand', 'cargo', 152, 66, 'wheel.wagon-disc'],
  ['cargo_gravel', 'cargo', 152, 68, 'wheel.wagon-disc'],
  ['cargo_tank', 'cargo', 176, 82, 'wheel.wagon-disc'],
  ['cargo_milk', 'cargo', 168, 76, 'wheel.wagon-disc'],
  ['cargo_grain', 'cargo', 172, 84, 'wheel.wagon-disc'],
  ['cargo_hay', 'cargo', 164, 82, 'wheel.wagon-disc'],
  ['cargo_apples', 'cargo', 156, 72, 'wheel.wagon-disc'],
  ['cargo_cars', 'cargo', 204, 96, 'wheel.wagon-disc'],
  ['cargo_tractor', 'cargo', 184, 90, 'wheel.wagon-disc'],
  ['cargo_excavator', 'cargo', 192, 96, 'wheel.wagon-disc'],
  ['cargo_mail', 'cargo', 164, 78, 'wheel.wagon-disc'],
  ['cargo_refrigerated', 'cargo', 176, 80, 'wheel.wagon-disc'],
  ['service_tools', 'service', 164, 80, 'wheel.wagon-disc'],
  ['service_snowplow', 'service', 156, 80, 'wheel.wagon-disc'],
  ['fun_stars', 'fun', 164, 88, 'wheel.wagon-spoked'],
  ['fun_garden', 'fun', 172, 88, 'wheel.wagon-spoked'],
  ['fun_aquarium', 'fun', 176, 88, 'wheel.wagon-disc'],
  ['fun_windmill', 'fun', 160, 100, 'wheel.wagon-spoked'],
  ['fun_lights', 'fun', 168, 96, 'wheel.wagon-spoked'],
  ['fun_toyblocks', 'fun', 164, 84, 'wheel.wagon-spoked'],
];
export const budgetParts: Record<string, { widthU: number; heightU: number }> =
  {
    ...artParts,
    'wheel.steam-driver-large': { widthU: 38, heightU: 38 },
    'steam_express.coupling-rod': { widthU: 90, heightU: 7 },
    'steam_express.connecting-rod': { widthU: 64, heightU: 8 },
    'steam_express.crosshead': { widthU: 30, heightU: 8 },
  };
interface BudgetVehicle {
  id: string;
  lengthU: number;
  kind: string;
  keys: string[];
}
export const budgetVehicles: BudgetVehicle[] = [
  ...locomotives,
  ...wagons,
].flatMap((v) => {
  const art = vehicleArt[v.id];
  return art
    ? [
        {
          id: v.id,
          lengthU: v.lengthU,
          kind: v.kind === 'locomotive' ? v.power : v.group,
          keys: journeyArtKeys([v], { locomotives: [], wagons: [] }),
        },
      ]
    : [];
});
for (const [id, kind, lengthU, heightU, wheel] of pendingFrames) {
  if (vehicleArt[id]) continue;
  const keys = [`${id}.body`, `${id}.overlay`, wheel];
  if (id === 'steam_express')
    keys.splice(
      2,
      1,
      'wheel.steam-driver-large',
      'wheel.steam-pony',
      'steam_express.coupling-rod',
      'steam_express.connecting-rod',
      'steam_express.crosshead',
    );
  if (kind === 'electric')
    keys.push('electric_retro.pantograph', 'electric_retro.pantograph-head');
  budgetParts[`${id}.body`] = { widthU: lengthU, heightU };
  budgetParts[`${id}.overlay`] = { widthU: lengthU, heightU };
  budgetVehicles.push({ id, kind, lengthU, keys });
}
// Prefer the real manifest as art arrives, including new extra parts and frame dimensions.
Object.assign(budgetParts, artParts);
const area = (v: (typeof budgetVehicles)[number]) =>
  v.keys.reduce((sum, key) => {
    const part = budgetParts[key];
    if (!part) throw new Error(`Missing budget part ${key}`);
    return sum + part.widthU * part.heightU;
  }, 0);
const ranked = [...budgetVehicles].sort(
  (a, b) => area(b) - area(a) || a.id.localeCompare(b.id),
);
const isLocomotive = (v: (typeof budgetVehicles)[number]) =>
  ['steam', 'diesel', 'electric', 'fantasy'].includes(v.kind);
const roadmap = ranked.slice(0, 8);
const legal = ranked.filter(isLocomotive).slice(0, 1);
let lengthU = legal.reduce((sum, v) => sum + v.lengthU, 0);
for (const v of ranked.filter((v) => !isLocomotive(v))) {
  const nextU = lengthU + gameConfig.train.couplerGapU + v.lengthU;
  if (nextU > gameConfig.train.maxConsistLengthU) break;
  legal.push(v);
  lengthU = nextU;
}
export const worstJourneyFixtures = [
  { name: 'roadmap eight largest distinct vehicles', vehicles: roadmap },
  { name: 'legal playable consist (contract C.3)', vehicles: legal },
].map(({ name, vehicles }) => {
  const available = ranked.filter(
    (v) => !vehicles.some((chosen) => chosen.id === v.id),
  );
  const fleet = [
    ...available
      .filter((v) => v.kind === 'steam' || v.kind === 'diesel')
      .slice(0, 2),
    ...available.filter((v) => !isLocomotive(v)).slice(0, 6),
  ];
  const keys = [...new Set([...vehicles, ...fleet].flatMap((v) => v.keys))];
  return {
    name,
    vehicles,
    fleet,
    parts: Object.fromEntries(
      keys.map((key) => {
        const part = budgetParts[key];
        if (!part) throw new Error(`Missing budget part ${key}`);
        return [key, part];
      }),
    ),
  };
});
