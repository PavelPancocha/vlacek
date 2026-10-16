import { roadStretchesInChunk } from './RoadStretches.ts';
import { regionAt } from './Regions.ts';
import { contextAt } from './WorldPlan.ts';
import { tunnelSite } from './Structures.ts';
import { crossingSite } from './Crossings.ts';
import type { PlacementCatalog } from './SceneryGeometry.ts';
import {
  stationFlat,
  stationSlot,
  stationSite,
  chunkScenery,
} from './Scenery.ts';
import { generateTrackProfile } from './TrackProfile.ts';
import { buildArcLengthTable, arcAtX } from './ArcLengthTable.ts';
import type { TrackCursor } from './TrackWindow.ts';
export const TEST_SCENES = [
  'tunnel',
  'crossing',
  'station',
  'halt',
  'large-station',
  'big-station',
  'village',
  'village-bus',
  'suburb',
  'town',
  'autumn',
  'winter',
  'coast',
  'fishponds',
  'dunes',
  'mountains',
  'forest-work',
  'fields',
  'forest-dense',
  'parallel-road',
  'highway',
  'road-ends',
] as const;
export type TestSceneKind = (typeof TEST_SCENES)[number];
export interface TestSceneLocation {
  kind: TestSceneKind;
  seed: number;
  worldXU: number;
  head: TrackCursor;
  regionId: string;
  sceneId: string;
}
/** At most four cycles; no earlier scene generation or camera-dependent memory. */
export function locateTestScene(
  seed: number,
  kind: TestSceneKind,
  catalog: PlacementCatalog,
  maxChunks = 1920,
): TestSceneLocation | undefined {
  if (!Number.isSafeInteger(maxChunks) || maxChunks <= 0 || maxChunks > 1920)
    return undefined;
  let tunnelChunk: number | undefined;
  if (kind === 'tunnel') {
    for (let k = 0; k < maxChunks; k++) {
      const t = tunnelSite(seed, k);
      if (!t) continue;
      tunnelChunk ??= k;
      if (t.rock) {
        tunnelChunk = k;
        break;
      }
    }
  }
  for (let k = 0; k < maxChunks; k++) {
    let x = k * 1024 + 512;
    if (
      kind === 'parallel-road' ||
      kind === 'highway' ||
      kind === 'road-ends'
    ) {
      const road = roadStretchesInChunk(seed, k).find(
        (r) => r.kind === (kind === 'highway' ? 'highway' : 'parallel-road'),
      );
      if (!road) continue;
      if (kind === 'parallel-road') {
        const c = crossingSite(seed, k);
        if (!c) continue;
        x = k * 1024 + c.localXU;
      } else x = kind === 'road-ends' ? road.startXU + 160 : k * 1024 + 512;
    } else if (kind === 'tunnel') {
      if (k !== tunnelChunk) continue;
      const t = tunnelSite(seed, k);
      if (!t) continue;
      x = k * 1024 + t.fromX;
    } else if (kind === 'crossing') {
      const c = crossingSite(seed, k);
      if (!c) continue;
      x = k * 1024 + c.localXU;
    } else if (
      kind === 'halt' ||
      kind === 'large-station' ||
      kind === 'big-station'
    ) {
      const site = stationSite(seed, k);
      const size =
        kind === 'halt' ? 'halt' : kind === 'large-station' ? 'station' : 'big';
      if (!site || site.size !== size) continue;
      x =
        site.toXU -
        (kind === 'big-station' ? 300 : kind === 'large-station' ? 180 : 120);
    } else if (
      kind === 'village' ||
      kind === 'village-bus' ||
      kind === 'suburb' ||
      kind === 'town'
    ) {
      const target =
        kind === 'village'
          ? 'settlements-village-green'
          : kind === 'village-bus'
            ? 'settlements-village-exit'
            : kind === 'suburb'
              ? 'settlements-suburb'
              : 'settlements-street';
      if (contextAt(seed, x).scene.templateId !== target) continue;
      const sc = chunkScenery(seed, k, catalog);
      const prop = sc.props.find((p) =>
        kind === 'village'
          ? p.kind === 'back.chapel'
          : kind === 'village-bus'
            ? p.kind === 'back.bus'
            : kind === 'suburb'
              ? p.kind === 'back.row-house'
              : p.kind === 'back.panel-house',
      );
      if (!prop) continue;
      x = k * 1024 + prop.xU;
    } else if (kind === 'station') {
      if (k % 8 !== stationSlot(seed, Math.floor(k / 8))) continue;
      const f = stationFlat(seed, k);
      if (!f) continue;
      x = k * 1024 + (f[0] + f[1]) / 2;
    } else {
      const context = contextAt(seed, x);
      if (context.transitionProgress > 0) continue;
      const matches =
        kind === 'autumn' || kind === 'winter'
          ? context.season === kind
          : kind === 'fishponds'
            ? context.scene.templateId === 'water-mountains-fishponds'
            : kind === 'fields'
              ? context.region.landscape === 'countryside' &&
                context.scene.templateId === 'near-field'
              : kind === 'forest-dense'
                ? context.scene.templateId === 'farm-forest-dense'
                : kind === 'forest-work'
                  ? context.region.landscape === 'forest' &&
                    context.scene.templateId === 'forest-work' &&
                    context.season !== 'winter'
                  : context.region.landscape === kind;
      if (!matches) continue;
      if (kind === 'fishponds') {
        if (k % 8 === stationSlot(seed, Math.floor(k / 8))) continue;
        {
          const sc = chunkScenery(seed, k, catalog);
          if (
            !sc.props.some((p) => p.kind === 'near.pond') &&
            !sc.water.some((w) => w.kind === 'pond')
          )
            continue;
        }
      }
      if (
        kind === 'forest-work' &&
        !chunkScenery(seed, k, catalog).props.some(
          (p) => p.layer === 'near' && p.kind === 'back.harvester',
        )
      )
        continue;
    }
    if (
      kind === 'fields' &&
      !chunkScenery(seed, k, catalog).props.some(
        (p) => p.kind === 'back.tractor-work' && p.layer === 'near',
      )
    )
      continue;
    if (
      kind === 'forest-dense' &&
      !chunkScenery(seed, k, catalog).props.some((p) =>
        p.kind.startsWith('near.forest-edge-'),
      )
    )
      continue;
    const start =
        kind === 'highway'
          ? x + 140
          : kind === 'halt' ||
              kind === 'large-station' ||
              kind === 'big-station'
            ? x
            : x - 640,
      chunkIndex = Math.floor(start / 1024);
    const table = buildArcLengthTable(
      generateTrackProfile(seed, chunkIndex),
      chunkIndex,
      1024,
      8,
    );
    const context = contextAt(seed, x);
    return {
      kind,
      seed,
      worldXU: x,
      head: { chunkIndex, arcOffsetU: arcAtX(table, start) },
      regionId: regionAt(seed, x).id,
      sceneId: context.scene.id,
    };
  }
  return undefined;
}
