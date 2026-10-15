import { settlementScene } from './SettlementPlan.ts';
import { hash32, unitRandom } from './Hash.ts';
import { regionAt, transitionAt, type RegionPlan } from './Regions.ts';
import {
  LOCALITIES,
  type LocalityTemplate,
  type NearGround,
  type BackGround,
} from './sceneryTemplates.ts';

export interface ScenePlan {
  id: string;
  regionId: string;
  index: number;
  fromXU: number;
  toXU: number;
  templateId: string;
  subzone: string;
}
export function templateById(id: string): LocalityTemplate {
  const t = LOCALITIES.find((t) => t.id === id);
  if (!t) throw new Error(`unknown scene ${id}`);
  return t;
}
const sceneCache = new Map<string, ScenePlan>();
/** Ordered two-chunk spans; dominant motifs have an eligible slot before weighting. */
export function sceneAt(seed: number, worldXU: number): ScenePlan {
  const r = regionAt(seed, worldXU);
  const index = Math.floor((worldXU - r.fromXU) / 2048);
  const key = `${seed}/${r.index}/${index}`;
  const cached = sceneCache.get(key);
  if (cached) return cached;
  const count = (r.toXU - r.fromXU) / 2048;
  const millSlot =
    4 +
    4 *
      (hash32(seed, 'scenes-v2:mill', r.index) %
        Math.max(1, Math.floor((count - 8) / 4)));
  const lightSlot =
    1 +
    (hash32(seed, 'scenes-v2:lighthouse', r.index) % Math.max(1, count - 2));
  const choices = LOCALITIES.filter(
    (t) => t.biome === r.landscape && !t.station && t.weight > 0,
  )
    .filter((t) => t.id !== 'mill' || index === millSlot)
    .filter((t) => t.id !== 'harbour' || index === lightSlot)
    .filter((t) => t.id !== 'pond' || index % 2 === 0)
    .filter((t) => r.season === 'winter' || t.near !== 'snow')
    .filter(
      (t) =>
        r.landscape !== 'mountains' ||
        r.season !== 'winter' ||
        t.near === 'snow',
    );
  const pool =
    index === 0 || index === count - 1
      ? choices.filter((t) => t.calm)
      : choices;
  const selected = pool.length ? pool : choices;
  let pick =
    unitRandom(seed, 'scenes-v2:choice', r.index, index) *
    selected.reduce((sum, t) => sum + t.weight, 0);
  let chosen = selected.at(-1);
  for (const t of selected) {
    pick -= t.weight;
    if (pick < 0) {
      chosen = t;
      break;
    }
  }
  if (r.landscape === 'countryside' && index === 2)
    chosen = templateById('near-field');
  if (r.landscape === 'forest' && index === 2)
    chosen = templateById('forest-work');
  if (r.landscape === 'countryside' && index === 7)
    chosen = templateById('orchard');
  if (r.landscape === 'countryside' && index === 8)
    chosen = templateById('farm');
  if (r.landscape === 'forest' && index === 0) chosen = templateById('forest');
  if (r.landscape === 'forest' && index === 6)
    chosen = templateById('clearing');
  if (r.landscape === 'forest' && index === 4)
    chosen = templateById('farm-forest-dense');
  if (r.landscape === 'lakes' && index === millSlot)
    chosen = templateById('mill');
  const settlement = settlementScene(r, index);
  if (settlement) chosen = templateById(`settlements-${settlement}`);
  if (!chosen) throw new Error(`no scene for ${r.landscape}/${r.season}`);
  const result: ScenePlan = Object.freeze({
    id: `${r.id}:scene:${index}`,
    regionId: r.id,
    index,
    fromXU: r.fromXU + index * 2048,
    toXU: Math.min(r.toXU, r.fromXU + (index + 1) * 2048),
    templateId: chosen.id,
    subzone: chosen.id,
  });
  if (sceneCache.size === 256) {
    const first = sceneCache.keys().next().value;
    if (first !== undefined) sceneCache.delete(first);
  }
  sceneCache.set(key, result);
  return result;
}
export interface PlaceContext {
  region: RegionPlan;
  scene: ScenePlan;
  subzone: string;
  surface: NearGround | BackGround;
  season: RegionPlan['season'];
  weather: RegionPlan['weather'];
  transitionProgress: number;
}
/** Point admissibility; full envelopes query each crossed scene/region boundary. */
export function contextAt(
  seed: number,
  worldXU: number,
  layer: 'back' | 'near' = 'near',
): PlaceContext {
  const region = regionAt(seed, worldXU),
    scene = sceneAt(seed, worldXU);
  const template = templateById(scene.templateId);
  const transition = transitionAt(seed, worldXU);
  const appearance = transition.progress >= 0.5 ? transition.to : region;
  const surface =
    appearance.season === 'winter'
      ? 'snow'
      : ['coast', 'dunes'].includes(appearance.landscape)
        ? 'sand'
        : layer === 'near'
          ? template.near
          : (template.backSpans?.findLast((span) => {
              const local = worldXU - Math.floor(worldXU / 1024) * 1024;
              return span.fromX <= local && local < span.toX;
            })?.style ?? template.back);
  return {
    region,
    scene,
    subzone:
      transition.progress >= 0.5 && appearance.id !== region.id
        ? `${appearance.landscape}-edge`
        : scene.subzone,
    surface,
    season: appearance.season,
    weather: appearance.weather,
    transitionProgress: transitionAt(seed, worldXU).progress,
  };
}
