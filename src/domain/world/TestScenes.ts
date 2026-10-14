import { regionAt } from './Regions.ts';
import { contextAt } from './WorldPlan.ts';
import { tunnelSite } from './Structures.ts';
import { crossingSite } from './Crossings.ts';
import type { PlacementCatalog } from './SceneryGeometry.ts';
import { stationFlat, stationSlot, chunkScenery } from './Scenery.ts';
import { generateTrackProfile } from './TrackProfile.ts';
import { buildArcLengthTable, arcAtX } from './ArcLengthTable.ts';
import type { TrackCursor } from './TrackWindow.ts';
export const TEST_SCENES = [
  'tunnel',
  'crossing',
  'station',
  'town',
  'autumn',
  'winter',
  'coast',
  'fishponds',
  'dunes',
  'mountains',
  'forest-work',
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
  for (let k = 0; k < maxChunks; k++) {
    let x = k * 1024 + 512;
    if (kind === 'tunnel') {
      const t = tunnelSite(seed, k);
      if (!t) continue;
      x = k * 1024 + t.fromX;
    } else if (kind === 'crossing') {
      const c = crossingSite(seed, k);
      if (!c) continue;
      x = k * 1024 + c.localXU;
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
            ? context.scene.templateId === 'pond'
            : kind === 'forest-work'
              ? context.region.landscape === 'forest' &&
                context.scene.templateId === 'forest-work' &&
                context.season !== 'winter'
              : context.region.landscape === kind;
      if (!matches) continue;
      if (kind === 'fishponds') {
        if (k % 8 === stationSlot(seed, Math.floor(k / 8)) || k % 2 !== 0)
          continue;
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
          (p) => p.layer === 'near' && p.kind === 'back.logs',
        )
      )
        continue;
    }
    const start = x - 640,
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
