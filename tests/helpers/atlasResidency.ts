import { TUNNEL_MAST_CLEARANCE_U } from '../../src/domain/world/Catenary.ts';
import { gameConfig } from '../../src/config/gameConfig.ts';
import { artParts } from '../../src/content/artManifest.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { npcFleetFor } from '../../src/domain/interaction/npcFleet.ts';
import {
  VALLEY_DEPTH_U,
  LARGE_VALLEY_DEPTH_U,
  VALLEY_EASE_U,
  EDGE_U,
} from '../../src/domain/world/Structures.ts';
import {
  BACK_PLANE_U,
  NEAR_DEPTH_RANGE_U,
  NEAR_FOOT_OFFSET_U,
  TRACK_BED_DEPTH_U,
} from '../../src/domain/world/SceneryGeometry.ts';
import {
  artAtlasItems,
  packAtlas,
  journeyArtKeys,
} from '../../src/render/atlasPacking.ts';

export const resizeVehicleIds = [
  'steam_express',
  'passenger_double',
  'cargo_excavator',
  'passenger_panorama',
  'fun_balloons',
  'cargo_tractor',
  'fun_windmill',
  'service_crane',
];
export function journeyPixels(
  ids: readonly string[],
  seed: number,
  scale: number,
) {
  const vehicles = ids.map((id) => {
    const vehicle = [...locomotives, ...wagons].find((v) => v.id === id);
    if (!vehicle) throw new Error(`unknown vehicle ${id}`);
    return vehicle;
  });
  const keys = journeyArtKeys(
    vehicles,
    npcFleetFor(seed, { locomotives, wagons }),
  );
  const items = artAtlasItems(
    Object.fromEntries(keys.map((k) => [k, artParts[k]])),
    scale,
  );
  const plan = packAtlas(items, { maxSize: 2048, paddingPx: 2 });
  return {
    ...plan,
    bytes: plan.width * plan.height * 4,
    decodeBytes: items
      .map((p) => p.width * p.height * 4)
      .sort((a, b) => b - a)
      .slice(0, 4)
      .reduce((a, b) => a + b, 0),
  };
}

/** D-026 valley envelope over every allowed bridge deck in the block's slot 4. */
function structureBankEnvelope(from: number, to: number) {
  let bank = Math.max(gameConfig.world.terrain.maxEmbankmentU, VALLEY_DEPTH_U);
  for (
    let block = Math.floor(from / 8192) - 1;
    block <= Math.floor(to / 8192) + 1;
    block++
  ) {
    const x = block * 8192 + 4 * 1024;
    const gap = Math.max(
      x + EDGE_U - 8 - to,
      from - (x + 1024 - EDGE_U + 8),
      0,
    );
    const t = Math.max(0, 1 - gap / VALLEY_EASE_U);
    bank = Math.max(bank, LARGE_VALLEY_DEPTH_U * t * t * (3 - 2 * t));
  }
  return bank;
}

/** Includes every long fragment across the seven-chunk window, not just one short portal. */
function groundGeometryEnvelope() {
  const width = gameConfig.world.chunkWidthU;
  const grade = Math.min(
    gameConfig.world.maxTrackGrade,
    gameConfig.world.pantographMaxTrackGrade,
    Math.max(
      ...Object.values(gameConfig.world.landscapeProfiles).map(
        (p) => p.gradeRangeMax,
      ),
    ),
  );
  const chunks =
    Math.ceil(
      (Math.max(2000, gameConfig.train.maxConsistLengthU) /
        gameConfig.camera.trainWidthFraction +
        128) /
        width,
    ) + 3;
  const railRange = width * grade;
  const bank = Math.max(
    gameConfig.world.terrain.maxEmbankmentU,
    VALLEY_DEPTH_U,
  );
  const back = {
    width: width + 2 * (40 + 4 + 8),
    height: Math.ceil(railRange + BACK_PLANE_U + 16),
  };
  const bytes = (p: { width: number; height: number }) =>
    p.width * p.height * 4;
  const tunnelWidth = 448 + 340 + 4;
  const tunnelRange = tunnelWidth * grade;
  const short = [
    { width: tunnelWidth, height: Math.ceil(tunnelRange + 290 + 16 + 8) },
    {
      width: tunnelWidth,
      height: Math.ceil(
        tunnelRange + 290 + 16 + 8 + TRACK_BED_DEPTH_U + bank + 8,
      ),
    },
    {
      width: 448 + 2 * (TUNNEL_MAST_CLEARANCE_U + 4) + 4,
      height: Math.ceil(
        (448 + 2 * (TUNNEL_MAST_CLEARANCE_U + 4) + 4) * grade + 186 + 12,
      ),
    },
    {
      width: 448 + 80 + 8,
      height: Math.ceil((448 + 80 + 8) * grade + 186 + 18),
    },
  ];
  let materialLargest = 0;
  const long = (owner: number, length: number, start: number) => {
    const from = owner * width - 896,
      to = from + length;
    const pages: { width: number; height: number }[] = [];
    for (let k = start; k < start + chunks; k++) {
      const left = Math.max(k * width - 2, from);
      const right = Math.min((k + 1) * width + 2, to);
      if (right <= left) continue;
      const span = right - left;
      const height = Math.ceil(span * grade + 294);
      const page = { width: Math.ceil(span), height: Math.max(1, height) };
      materialLargest = Math.max(materialLargest, bytes(page));
      pages.push(page);
    }
    return pages;
  };
  let pages: { width: number; height: number }[] = [],
    largest = 0;
  // Each owner independently maximises its contribution; all eight window phases are covered.
  for (let start = 0; start < 8; start++) {
    const candidate = Array.from({ length: chunks }, (_, i) => {
      const k = start + i;
      return [
        back,
        {
          width: width + 12,
          height: Math.ceil(
            railRange +
              structureBankEnvelope(k * width, (k + 1) * width) +
              NEAR_FOOT_OFFSET_U +
              NEAR_DEPTH_RANGE_U +
              8 +
              6,
          ),
        },
      ];
    }).flat();
    for (const owner of [-2, 6, 14]) {
      const variants = [
        owner >= start && owner < start + chunks ? short : [],
        long(owner, 3072, start),
        long(owner, 3328, start),
      ];
      candidate.push(
        ...variants.reduce((a, b) =>
          a.reduce((n, p) => n + bytes(p), 0) >=
          b.reduce((n, p) => n + bytes(p), 0)
            ? a
            : b,
        ),
      );
    }
    largest = Math.max(largest, ...candidate.map(bytes));
    if (
      candidate.reduce((n, p) => n + bytes(p), 0) >
      pages.reduce((n, p) => n + bytes(p), 0)
    )
      pages = candidate;
  }
  return {
    chunks,
    materialLargest,
    pages,
    bytes: pages.reduce((n, p) => n + bytes(p), 0),
    largest,
  };
}
const groundGeometry = groundGeometryEnvelope();
export function groundPixelEnvelope(worldScale = 2) {
  const part = worldParts['tunnel.rock-cover'];
  // One GPU frame at a time: readPixels array + upright canvas; released before upload.
  const readback =
    (Math.ceil(part.widthU * worldScale) + 2) *
    (Math.ceil(part.heightU * worldScale) + 2) *
    4 *
    2;
  return { ...groundGeometry, readback };
}

/** Healthy ride auxiliary textures: Phaser 32px defaults, sky, wheel and animal fallback. */
export function auxiliaryPixelEnvelope(gpu: boolean) {
  return (3 * 32 * 32 + 2 * 256 + 36 * 36 + 64 * 48) * 4 * (gpu ? 3 : 2);
}

// The same region/season subset occurs in both orientations and several allowed climates.
// Cache only the pure pack plan; assertions still run for each case.
import {
  packWorldPages,
  type AtlasItem,
} from '../../src/render/atlasPacking.ts';
const plans = new Map<string, ReturnType<typeof packWorldPages>>();
export function cataloguePages(items: readonly AtlasItem[]) {
  const key = JSON.stringify(items);
  let plan = plans.get(key);
  if (!plan) {
    plan = packWorldPages(items);
    plans.set(key, plan);
  }
  return plan;
}

import { LOCALITIES } from '../../src/domain/world/sceneryTemplates.ts';
import { worldParts } from '../../src/content/worldArt.ts';
import { propScale } from '../../src/domain/world/SceneryGeometry.ts';

/** Bound every clipped composition from its authored rules, including the lattice's preceding tile. */
function computeCompositionPixelEnvelope() {
  let perChunk = 0,
    largest = 0,
    readback = 0;
  for (const scene of LOCALITIES)
    for (const season of ['spring', 'summer', 'autumn', 'winter'] as const) {
      const layers = new Map<
        string,
        { top: number; bottom: number; reach: number }
      >();
      for (const rule of scene.rules) {
        if (
          !rule.layout ||
          rule.layout === 'forest-trees' ||
          (rule.seasons && !rule.seasons.includes(season))
        )
          continue;
        const layerKey = `${rule.layer}/${rule.depth[0]}`;
        const layer = layers.get(layerKey) ?? { top: 0, bottom: 0, reach: 0 };
        for (const key of rule.kinds) {
          const part = worldParts[key as keyof typeof worldParts];
          if (!part) throw new Error(`missing composition part ${key}`);
          const scale = propScale({
            kind: key,
            layer: rule.layer,
            xU: 0,
            depth: rule.depth[0],
            scale: rule.scale?.[0] ?? 1,
            flip: false,
          });
          layer.top = Math.min(layer.top, -part.pivotU.y * scale);
          layer.bottom = Math.max(
            layer.bottom,
            (part.heightU - part.pivotU.y) * scale,
          );
          layer.reach = Math.max(layer.reach, part.widthU * scale);
          const raster = key.startsWith('backdrop.') ? 1 : 2;
          readback = Math.max(
            readback,
            (Math.ceil(part.widthU * raster) + 2) *
              (Math.ceil(part.heightU * raster) + 2) *
              4,
          );
        }
        layers.set(layerKey, layer);
      }
      let bytes = 0;
      for (const [key, layer] of layers) {
        const height = Math.ceil(
          layer.bottom -
            layer.top +
            (1024 + layer.reach) * gameConfig.world.maxTrackGrade +
            (key.startsWith('near/')
              ? Math.max(
                  gameConfig.world.terrain.maxEmbankmentU,
                  ['mountains', 'foothills', 'lakes'].includes(scene.biome)
                    ? LARGE_VALLEY_DEPTH_U
                    : VALLEY_DEPTH_U,
                )
              : 0) +
            2,
        );
        const allocation = 1024 * height * 4;
        bytes += allocation;
        largest = Math.max(largest, allocation);
      }
      perChunk = Math.max(perChunk, bytes);
    }
  // Only intersecting chunk intervals retain compositions; ground keeps the two guard chunks.
  const visibleChunks =
    Math.ceil((2000 / gameConfig.camera.trainWidthFraction + 128) / 1024) + 1;
  return {
    perChunk,
    visibleChunks,
    bytes: perChunk * visibleChunks,
    largest,
    readback,
    gpuWorkBytes: largest + 2 * readback,
    canvasWorkBytes: largest,
  };
}

const compositions = computeCompositionPixelEnvelope();
export function compositionPixelEnvelope() {
  return compositions;
}

/** Next-fit decreasing-height shelves: each closed row uses > binWidth - maxItemWidth.
 * Its pixels cover that width times the NEXT row height. Sum all padded catalogue
 * rectangles to bound every possible journey/NPC subset, without assuming subset packing is monotone.
 */
function computeVehiclePixelEnvelope(scale: number) {
  const items = artAtlasItems(artParts, scale);
  const paddedArea = items.reduce(
    (sum, p) => sum + (p.width + 2) * (p.height + 2),
    0,
  );
  const maxWidth = Math.max(...items.map((p) => p.width + 2));
  const maxHeight = Math.max(...items.map((p) => p.height + 2));
  const height = Math.min(
    2048,
    Math.ceil(2 + maxHeight + paddedArea / (2046 - maxWidth)),
  );
  return {
    width: 2048,
    height,
    bytes: 2048 * height * 4,
    decodeBytes: items
      .map((p) => p.width * p.height * 4)
      .sort((a, b) => b - a)
      .slice(0, 4)
      .reduce((a, b) => a + b, 0),
  };
}

const vehicles = new Map<
  number,
  ReturnType<typeof computeVehiclePixelEnvelope>
>();
export function vehiclePixelEnvelope(scale: number) {
  let envelope = vehicles.get(scale);
  if (!envelope) {
    envelope = computeVehiclePixelEnvelope(scale);
    vehicles.set(scale, envelope);
  }
  return envelope;
}

import {
  CATALOGUE_SOURCES,
  catalogueSnapshot,
  type CataloguePartSnapshot,
} from '../fixtures/world-catalogue-snapshot.ts';
import {
  worldAtlasGroup,
  type GroupedWorldPart,
} from '../../src/content/worldAtlasGroups.ts';
import { isBackdropPart } from '../../src/content/worldArt.ts';
import { BIOMES, type Biome } from '../../src/domain/world/Biomes.ts';
import {
  ALLOWED_PRESETS,
  REGION_NEIGHBOURS,
  type Season,
} from '../../src/domain/world/Regions.ts';
import {
  profileArtScale,
  profileBackdropScale,
} from '../../src/render/atlasPacking.ts';
import { atlasLifetimePeak } from '../../src/render/TextureMemory.ts';

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
type Sized = Pick<GroupedWorldPart, 'widthU' | 'heightU'>;

/**
 * Snapshot problems: a pending module that has meanwhile been registered here
 * (its metadata must now come from the registry), or a registered part the
 * snapshot knows with another size or no longer finds.
 */
export function catalogueGaps(
  modules: Readonly<Record<string, Readonly<Record<string, GroupedWorldPart>>>>,
  snapshot: Readonly<Record<string, CataloguePartSnapshot>> = catalogueSnapshot,
  sources: readonly { module: string }[] = CATALOGUE_SOURCES,
): string[] {
  const gaps: string[] = [];
  for (const { module } of sources)
    if (modules[module])
      gaps.push(`${module} has landed: refresh the snapshot from the registry`);
  for (const [key, known] of Object.entries(snapshot)) {
    const registered = modules[known.module];
    if (!registered || sources.some((s) => s.module === known.module)) continue;
    const live = registered[key];
    if (!live) gaps.push(`${known.module}: ${key} is no longer registered`);
    else if (live.widthU !== known.widthU || live.heightU !== known.heightU)
      gaps.push(
        `${known.module}: ${key} is ${live.widthU}×${live.heightU} u, snapshot ${known.widthU}×${known.heightU} u`,
      );
  }
  return gaps;
}

export interface CataloguePart extends Sized {
  atlasGroup: { landscapes: readonly Biome[]; seasons: readonly Season[] };
}
/** Integrated catalogue: snapshot ∪ registered parts, groups explicit and merged. */
export function integratedCatalogue(
  registered: Readonly<Record<string, GroupedWorldPart>>,
  snapshot: Readonly<Record<string, CataloguePartSnapshot>> = catalogueSnapshot,
): Record<string, CataloguePart> {
  const parts: Record<string, CataloguePart> = {};
  for (const key of new Set([
    ...Object.keys(snapshot),
    ...Object.keys(registered),
  ])) {
    const live = registered[key],
      known = snapshot[key];
    const groups = [
      ...(live ? [worldAtlasGroup(key, live)] : []),
      ...(known ? [known.group] : []),
    ];
    parts[key] = {
      widthU: Math.max(live?.widthU ?? 0, known?.widthU ?? 0),
      heightU: Math.max(live?.heightU ?? 0, known?.heightU ?? 0),
      atlasGroup: {
        landscapes: groups.some((g) => !g.landscapes)
          ? BIOMES
          : BIOMES.filter((b) => groups.some((g) => g.landscapes?.includes(b))),
        seasons: groups.some((g) => !g.seasons)
          ? SEASONS
          : SEASONS.filter((s) => groups.some((g) => g.seasons?.includes(s))),
      },
    };
  }
  return parts;
}

export type Quality = 'low' | 'standard';
export const BUDGET_BYTES: Readonly<Record<Quality, number>> = {
  low: 96 * 1048576,
  standard: 192 * 1048576,
};
/** Distinct world/backdrop raster pairs a profile selects over every camera zoom. */
export function profileScales(quality: Quality) {
  const scales = new Map<string, { world: number; backdrop: number }>();
  for (let zoom = 0.25; zoom <= 4; zoom += 0.25) {
    const world = profileArtScale(zoom, quality),
      backdrop = profileBackdropScale(zoom, quality);
    scales.set(`${world}/${backdrop}`, { world, backdrop });
  }
  return [...scales.values()];
}

export interface WindowPair {
  label: string;
  regions: { landscape: Biome; season: Season }[];
}
/** Current and incoming region for every allowed adjacent landscape/season. */
export function windowPairs(): WindowPair[] {
  const seasons = (landscape: Biome) => [
    ...new Set(ALLOWED_PRESETS[landscape].map((preset) => preset.season)),
  ];
  return BIOMES.flatMap((landscape) =>
    seasons(landscape).flatMap((season) =>
      REGION_NEIGHBOURS[landscape].flatMap((next) =>
        seasons(next).map((nextSeason) => ({
          label: `${landscape}/${season}->${next}/${nextSeason}`,
          regions: [
            { landscape, season },
            { landscape: next, season: nextSeason },
          ],
        })),
      ),
    ),
  );
}

/** Packed pages and the largest four-part decoder batch of one atlas group. */
export function windowResidency(
  parts: Readonly<Record<string, Sized>>,
  keys: readonly string[],
  backdrop: boolean,
  scale: number,
) {
  const subset = Object.fromEntries(
    keys
      .filter((key) => isBackdropPart(key) === backdrop)
      .map((key) => {
        const part = parts[key];
        if (!part) throw new Error(`missing ${key}`);
        return [key, part];
      }),
  );
  const items = artAtlasItems(subset, scale);
  const pages = cataloguePages(items);
  return {
    pages,
    bytes: pages.reduce((sum, p) => sum + p.plan.width * p.plan.height * 4, 0),
    decodeBytes: items
      .map((item) => item.width * item.height * 4)
      .sort((a, b) => b - a)
      .slice(0, 4)
      .reduce((a, b) => a + b, 0),
  };
}

/**
 * Largest displayed (old) window, and the allocation-lifetime peak, over every
 * adjacent window of the integrated catalogue at every raster pair of a
 * profile (D-030). Every case of `atlasBoundCases` proves its windows and
 * peaks stay within these; content changes must recompute them.
 */
/** WM4 adds no scratch/readback; corrected foothills hosts grow the packed world window. */
export const ATLAS_BOUND: Readonly<
  Record<
    Quality,
    { oldWorldBytes: number; oldBackdropBytes: number; peakBytes: number }
  >
> = {
  low: {
    oldWorldBytes: 10485760,
    oldBackdropBytes: 4696968,
    peakBytes: 97951432,
  },
  standard: {
    oldWorldBytes: 26017792,
    oldBackdropBytes: 9191424,
    peakBytes: 147406304,
  },
};

/** atlasLifetimePeak for one new window after the profile's largest (or a given) old window. */
export function lifetimeModel(
  quality: Quality,
  world: { bytes: number; decodeBytes: number },
  backdrop: { bytes: number; decodeBytes: number },
  gpu: boolean,
  old: { world: number; backdrop: number } = {
    world: ATLAS_BOUND[quality].oldWorldBytes,
    backdrop: ATLAS_BOUND[quality].oldBackdropBytes,
  },
) {
  const ground = groundPixelEnvelope(
    Math.max(...profileScales(quality).map((s) => s.world)),
  );
  const compositions = compositionPixelEnvelope();
  const vehicle = vehiclePixelEnvelope(
    Math.max(...profileScales(quality).map((scale) => scale.world)),
  );
  const retained =
    ground.bytes +
    compositions.bytes +
    4 * (ground.pages.length + compositions.visibleChunks * 4);
  return atlasLifetimePeak({
    sourcesBytes: 0,
    auxiliaryBytes: auxiliaryPixelEnvelope(gpu),
    vehicle: {
      oldBytes: vehicle.bytes,
      newBytes: vehicle.bytes,
      releaseOldFirst: false,
      decodeBytes: vehicle.decodeBytes,
    },
    ground: {
      oldBytes: retained,
      newBytes: retained,
      largestNewBytes: ground.largest,
      preparationBytes: Math.max(
        gpu
          ? Math.max(ground.largest, ground.materialLargest + ground.readback)
          : 0,
        gpu ? compositions.gpuWorkBytes : compositions.canvasWorkBytes,
      ),
    },
    world: {
      oldBytes: old.world,
      newBytes: world.bytes,
      decodeBytes: world.decodeBytes,
    },
    backdrop: {
      oldBytes: old.backdrop,
      newBytes: backdrop.bytes,
      decodeBytes: backdrop.decodeBytes,
    },
    gpu,
  });
}
