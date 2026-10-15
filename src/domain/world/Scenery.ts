import { farmForestComposition } from './FarmForestComposition.ts';
import { workRoadSupports } from './WorkGeometry.ts';
import { streamBendU } from './StreamGeometry.ts';
import { settlementScenery } from './SettlementScenery.ts';
import { longStation, type StationExtent } from './SettlementPlan.ts';
import { stationScenery } from './StationScenery.ts';
import type { PlacementTraceEntry } from './PlacementTrace.ts';
import { secondarySite } from './SecondaryTrack.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import { biomeAt, type Biome } from './Biomes.ts';
import { chunkObjects } from './ChunkObjects.ts';
import { crossingSite, type CrossingSite } from './Crossings.ts';
import { hash32, unitRandom } from './Hash.ts';
import {
  bridgeSite,
  tunnelSite,
  type BridgeSite,
  type TunnelSite,
} from './Structures.ts';
import {
  LOCALITIES,
  type AnimalKind,
  type BackGround,
  type GroundSpan,
  type NearGround,
  type PatrolMotion,
  type PropRule,
} from './sceneryTemplates.ts';
import { generateTrackProfile, profileGrade } from './TrackProfile.ts';
import {
  regionAt,
  transitionAt,
  REGION_CYCLE_BLOCKS,
  type RegionPlan,
} from './Regions.ts';
import {
  contextAt,
  sceneAt,
  templateById,
  type ScenePlan,
} from './WorldPlan.ts';
import {
  admissibleKind,
  footprintAdmissible,
  placementConflict,
} from './Placement.ts';
import {
  infrastructureReservations,
  roadReservation,
  waterReservation,
  type Reservation,
  type PlacementRelation,
  type FeatureExtent,
} from './Reservations.ts';
import {
  pointInside,
  propFootU,
  railYUpU,
  polygonsHit,
  projectedBounds,
  boundsHitPolygon,
  propScale,
  waterSectionU,
  waterPolygon,
  waterLevelU,
  villageRoad,
  type BoundsU,
  type PlacementCatalog,
  type WaterGeometry,
  type RoadPath,
} from './SceneryGeometry.ts';
import { fencesInChunk, type FenceFeature } from './Fences.ts';
import { bankHeightU } from './Terrain.ts';
import { snowField } from './scenes/rules.ts';
export {
  NEAR_DEPTH_RANGE_U,
  WATER_END_U,
  nearDepthScale,
} from './SceneryGeometry.ts';
/**
 * Near props never reach up to the train (doc 14 §5): a prop standing at
 * near depth d may be at most `NEAR_PROP_MAX_HEIGHT_U + d ×
 * NEAR_DEPTH_RANGE_U` tall as drawn, `nearDepthScale` included. The
 * renderer stands near props at least this far below the rail (track bed
 * and foot offset), so the cap holds.
 */
export const NEAR_PROP_MAX_HEIGHT_U = 26;
/** Near depth 0 … 1 spans this many u of meadow towards the viewer. */

/** Nearer meadow props are drawn larger (perspective). */

/**
 * The interactive animal is drawn this much larger than the scenery, so a
 * child spots it (doc 05 §2); with its reaction hop it still stays below
 * the train under the same cap as the near props.
 */
export const ANIMAL_SCALE = 2;
/** Height of the reaction hop (u). */
export const ANIMAL_HOP_U = 24;
/** Where an animal stands in the near meadow unless its locality says. */
export const DEFAULT_ANIMAL_DEPTH: readonly [number, number] = [0.26, 0.6];

export interface SceneryProp {
  /** Stable id `g<version>:chunk:<k>:prop:<n>` (doc 04 §3). */
  id: string;
  /** Art key, resolved by the world art manifest. */
  kind: string;
  layer: 'back' | 'near';
  /** Chunk-local x of the prop's foot. */
  xU: number;
  /** Back: 0 at the track … 1 at the horizon. Near: 0 at the bank foot … 1 nearest. */
  depth: number;
  scale: number;
  flip: boolean;
  motion?: PatrolMotion;
  /** Phase of the motion, 0 … 1. */
  phase: number;
  work?: PropRule['work'];
  offsetYU?: number;
  clip?: readonly import('./SceneryGeometry.ts').PointU[];
  /** Real composition ends in world u; chunk cuts never introduce a fade. */
  fadeX?: { fromU: number; toU: number; widthU: number };
  dependencies?: readonly string[];
  relations?: readonly PlacementRelation[];
}

/** A level water basin behind the track, chunk-local (see WaterBody). */
export type WaterBasin = WaterGeometry;

/**
 * The shore of a basin curves in over this many u at each end; between
 * them the water spans the basin's whole depth range.
 */

/** Water moved behind a second track keeps at least this much depth. */

export interface ChunkScenery {
  chunkIndex: number;
  biome: Biome;
  slot: number;
  locality: string;
  near: GroundSpan<NearGround>[];
  back: GroundSpan<BackGround>[];
  water: WaterBasin[];
  /** The level crossing of this chunk (slot 3), if any. */
  crossing: CrossingSite | undefined;
  /** The stone bridge over a stream (slot 4), if any. */
  bridge: BridgeSite | undefined;
  /** The short tunnel (slot 6), if any. */
  tunnel: TunnelSite | undefined;
  props: SceneryProp[];
  region: RegionPlan;
  scene: ScenePlan;
  roads: RoadPath[];
  fences: FenceFeature[];
  reservations: Reservation[];
  features: FeatureExtent[];
  animal: { kind: AnimalKind; depth: number };
}

const { chunkWidthU, maxPlacementAttempts, chunksPerBiomeBlock } =
  gameConfig.world;
const EDGE_U = 16,
  ANIMAL_CLEARANCE_U = 60,
  STATION_FLAT_U = 480,
  FLAT_STEP_U = 16;
type Roll = (...parts: (string | number)[]) => number;
const lerp = (range: readonly [number, number], t: number) =>
  range[0] + (range[1] - range[0]) * t;
/** Longest flat of a chunk's track, chunk-local, if long enough. */
export function stationFlat(
  seed: number,
  chunkIndex: number,
): readonly [number, number] | undefined {
  const profile = generateTrackProfile(seed, chunkIndex);
  let best: [number, number] | undefined;
  let start: number | undefined;
  for (let x = 0; x <= chunkWidthU; x += FLAT_STEP_U) {
    const flat = Math.abs(profileGrade(profile, x)) < 1e-12;
    if (flat && start === undefined) start = x;
    const end = !flat ? x - FLAT_STEP_U : x === chunkWidthU ? x : undefined;
    if (
      start !== undefined &&
      end !== undefined &&
      (!flat || x === chunkWidthU)
    ) {
      if (!best || end - start > best[1] - best[0]) best = [start, end];
      start = undefined;
    }
  }
  return best && best[1] - best[0] >= STATION_FLAT_U ? best : undefined;
}

/** Slot of the block's station, if one of slots 1–2 has a long flat. */
export function stationSlot(seed: number, block: number): number | undefined {
  if (block === 0 || longStation(seed, block)) return 1;
  const preferred = 1 + (hash32(seed, 1, 'station-slot', block) % 2);
  for (const slot of [preferred, 3 - preferred]) {
    if (stationFlat(seed, block * chunksPerBiomeBlock + slot)) return slot;
  }
  return undefined;
}

/** Prop kinds of a station; the people wait on the platform. */
export const STATION_KINDS = [
  'back.station',
  'back.platform',
  'back.lamp',
  'back.bench',
  'back.dispatcher',
  'back.person-a',
  'back.person-b',
  'back.person-c',
  'tree.linden',
] as const;

/** Full station extent is available from any intersecting chunk. */
export function stationSite(
  seed: number,
  chunkIndex: number,
): StationExtent | undefined {
  const block = Math.floor(chunkIndex / 8);
  const long = longStation(seed, block);
  if (long)
    return long.fromXU < (chunkIndex + 1) * 1024 &&
      long.toXU > chunkIndex * 1024
      ? long
      : undefined;
  if (chunkIndex - block * 8 !== stationSlot(seed, block)) return undefined;
  const flat = stationFlat(seed, chunkIndex);
  if (!flat) return undefined;
  const fromXU = chunkIndex * 1024 + (flat[0] + flat[1] - 480) / 2;
  return {
    id: `g2:chunk:${chunkIndex}:station:0`,
    ownerChunk: chunkIndex,
    size: 'halt',
    fromXU,
    toXU: fromXU + 480,
  };
}

/**
 * The order to draw a chunk's props in: the back layer from the horizon
 * towards the track, then the near meadow from the track towards the
 * viewer, so a nearer prop always covers a farther one in its layer.
 */
export function propDrawOrder(props: readonly SceneryProp[]): SceneryProp[] {
  // One comparator for both layers is not consistent across them, so each
  // layer is sorted on its own.
  const back = props
    .filter((prop) => prop.layer === 'back')
    .sort((a, b) => b.depth - a.depth);
  const near = props
    .filter((prop) => prop.layer === 'near')
    .sort((a, b) => a.depth - b.depth);
  return [...back, ...near];
}

/** Contiguous authored ground spans; later overlays own their exact local interval. */
function groundSpans<G>(
  base: G,
  overlays: readonly GroundSpan<G>[],
): GroundSpan<G>[] {
  const cuts = [
    ...new Set([
      0,
      1024,
      ...overlays.flatMap((span) => [
        Math.max(0, span.fromX),
        Math.min(1024, span.toX),
      ]),
    ]),
  ].sort((a, b) => a - b);
  const spans: GroundSpan<G>[] = [];
  for (let i = 1; i < cuts.length; i++) {
    const fromX = cuts[i - 1],
      toX = cuts[i];
    if (fromX === undefined || toX === undefined) continue;
    const midpoint = (fromX + toX) / 2,
      overlay = overlays.findLast(
        (span) => span.fromX <= midpoint && midpoint < span.toX,
      );
    const style = overlay?.style ?? base,
      last = spans.at(-1);
    if (last && last.style === style) last.toX = toX;
    else spans.push({ style, fromX, toX });
  }
  return spans;
}

const houseMemory = new WeakMap<
  PlacementCatalog,
  Map<string, readonly string[]>
>();

/** Pure composition: surfaces/roads are accepted before dependent children. */
export function chunkScenery(
  seed: number,
  chunkIndex: number,
  catalog: PlacementCatalog,
  trace?: PlacementTraceEntry[],
): ChunkScenery {
  const x0 = chunkIndex * chunkWidthU,
    place = biomeAt(seed, chunkIndex),
    region = regionAt(seed, x0),
    scene = sceneAt(seed, x0);
  const roll: Roll = (...parts) =>
    unitRandom(seed, 'placement-v2', chunkIndex, ...parts);
  const animalX = chunkObjects(seed, chunkIndex)[0]?.localXU ?? 512;
  const station =
    scene.templateId === 'farm-forest-dense'
      ? undefined
      : stationSite(seed, chunkIndex);
  const flat = station ? [station.fromXU - x0, station.toXU - x0] : undefined;
  const own = flat ? templateById('station') : templateById(scene.templateId);
  const ground = flat
    ? (LOCALITIES.find(
        (t) =>
          t.biome === region.landscape &&
          t.calm &&
          (region.season === 'winter' || t.near !== 'snow'),
      ) ?? own)
    : own;
  const near: GroundSpan<NearGround>[] = [
    {
      style: region.season === 'winter' ? 'snow' : ground.near,
      fromX: 0,
      toX: 1024,
    },
  ];
  const back = groundSpans<BackGround>(
    region.season === 'winter' ? 'snow' : ground.back,
    region.season === 'winter' ? [] : (ground.backSpans ?? []),
  );
  const crossing = crossingSite(seed, chunkIndex),
    bridge = bridgeSite(seed, chunkIndex),
    tunnel = tunnelSite(seed, chunkIndex);
  const reservations = infrastructureReservations(
    seed,
    chunkIndex,
    crossing,
    bridge,
    tunnel,
  );
  const water: WaterBasin[] = [],
    roads: RoadPath[] = [],
    props: SceneryProp[] = [];
  const features: FeatureExtent[] = [];
  const allowedSurfaceSeasons = own.nearSurface?.seasons;
  const surfaceClimateAllowed =
    !allowedSurfaceSeasons ||
    [scene.fromXU + 64, scene.toXU - 64 - 1e-6].every((x) =>
      allowedSurfaceSeasons.includes(contextAt(seed, x).season),
    );
  if (!flat && own.nearSurface && surfaceClimateAllowed) {
    const support = own.nearSurface,
      from = Math.max(x0, scene.fromXU + 64),
      to = Math.min(x0 + 1024, scene.toXU - 64);
    const xs: number[] = [];
    for (let x = from; x < to; x += 8) xs.push(x);
    xs.push(to);
    const point = (x: number, side: number) => {
      const endProgress = Math.max(
        0,
        Math.min(
          1,
          (x - (scene.fromXU + 64)) / 160,
          (scene.toXU - 64 - x) / 160,
        ),
      );
      // Elliptical headlands meet with a rounded tangent, not a linear wedge.
      const taper = Math.sqrt(1 - (1 - endProgress) ** 2);
      const middle = (support.depth[0] + support.depth[1]) / 2;
      const depth =
        middle +
        ((side * (support.depth[1] - support.depth[0])) / 2) * taper +
        0.025 * Math.sin(x / 80 + seed) * taper;
      return propFootU(
        { kind: 'surface', layer: 'near', xU: x, depth, scale: 1, flip: false },
        x,
        railYUpU(seed, x),
        bankHeightU(seed, x),
      );
    };
    const id = `${scene.id}:surface:${support.kind}`;
    reservations.push({
      id: `${id}:reserve`,
      ownerId: id,
      purpose: support.kind,
      layer: 'near',
      polygon: [
        ...xs.map((x) => point(x, -1)),
        ...xs.reverse().map((x) => point(x, 1)),
      ],
    });
    features.push({
      id,
      ownerId: scene.id,
      kind: support.kind,
      fromXU: scene.fromXU + 64,
      toXU: scene.toXU - 64,
      dependencies: [],
    });
  }
  const waterAdd = (w: WaterBasin) => {
    // Keep the bank and mast foot dry even on a sloping water shoreline.
    w.nearDepth = Math.max(0.12, w.nearDepth);
    water.push(w);
    reservations.push(waterReservation(seed, chunkIndex, w));
    features.push({
      id: w.id,
      ownerId: scene.id,
      kind: w.kind,
      fromXU: x0 + w.fromX,
      toXU: x0 + w.toX,
      dependencies: [],
    });
  };
  const transition = transitionAt(seed, x0 + 512);
  const seaRegion =
    region.landscape === 'coast'
      ? region
      : transition.to.landscape === 'coast' && transition.progress > 0
        ? transition.to
        : undefined;
  if (seaRegion) {
    // One region-owned sea; technical chunk ends never close its shoreline.
    const w: WaterBasin = {
      id: `${seaRegion.id}:sea:0`,
      kind: 'sea',
      fromX: 0,
      toX: 1024,
      nearDepth: 0.7,
      farDepth: 0.98,
      shore: {
        regionFromXU: seaRegion.fromXU,
        regionToXU: seaRegion.toXU,
        transitionU: 8192,
      },
    };
    water.push(w);
    reservations.push(waterReservation(seed, chunkIndex, w));
    features.push({
      id: w.id,
      ownerId: seaRegion.id,
      kind: 'sea',
      fromXU: seaRegion.fromXU - 8192,
      toXU: seaRegion.toXU,
      dependencies: [],
    });
  } else if (
    !flat &&
    !bridge &&
    ground.water &&
    x0 === scene.fromXU &&
    scene.index % 2 === 0
  ) {
    let pieces = [
      { fromX: ground.water.x?.[0] ?? 0, toX: ground.water.x?.[1] ?? 1024 },
    ];
    for (const site of [crossing, bridge])
      if (site) {
        const clearance = site === bridge ? 96 : 64;
        pieces = pieces
          .flatMap((p) => [
            { fromX: p.fromX, toX: Math.min(p.toX, site.localXU - clearance) },
            { fromX: Math.max(p.fromX, site.localXU + clearance), toX: p.toX },
          ])
          .filter((p) => p.toX - p.fromX > 144);
      }
    // The second railway is a corridor, independent of an owner's visible chunk.
    const secondary = reservations.some(
      (r) => r.purpose === 'secondary-track' || r.purpose === 'secondary-hill',
    );
    for (const [i, p] of pieces.entries())
      waterAdd({
        id: `${scene.id}:water:chunk:${chunkIndex}:piece:${i}`,
        kind: 'pond',
        ...p,
        nearDepth: secondary
          ? Math.max(0.5, ground.water.depth[0])
          : ground.water.depth[0],
        farDepth: Math.max(secondary ? 0.7 : 0, ground.water.depth[1]),
      });
  }
  if (!flat)
    for (const [i, path] of (own.paths ?? []).entries()) {
      const fromXU = Math.max(x0 + (path.x?.[0] ?? 0), scene.fromXU + 170),
        toXU = Math.min(x0 + (path.x?.[1] ?? 1024), scene.toXU - 170);
      const points = [];
      for (let x = fromXU; x <= toXU; x = Math.min(toXU, x + 16)) {
        const foot = propFootU(
          {
            kind: 'path',
            layer: path.layer,
            xU: x,
            depth: path.depth,
            scale: 1,
            flip: false,
          },
          x,
          railYUpU(seed, x),
          bankHeightU(seed, x),
        );
        points.push({
          ...foot,
          halfWidthU:
            (path.widthU / 2) *
            Math.min(
              1,
              (x - (path.x ? fromXU : scene.fromXU + 170)) / 48,
              ((path.x ? toXU : scene.toXU - 170) - x) / 48,
            ),
        });
        if (x === toXU) break;
      }
      const id = `${scene.id}:path:${i}${path.x ? `:chunk:${chunkIndex}` : ''}`;
      const road: RoadPath = {
        id,
        ownerId: id,
        fromXU,
        toXU,
        points,
        layer: path.layer,
        surface: 'dirt',
      };
      const reserve = roadReservation(road);
      if (
        reservations.some(
          (r) =>
            r.purpose !== 'field' &&
            r.purpose !== 'forest-floor' &&
            (r.layer === 'both' || r.layer === path.layer) &&
            polygonsHit(reserve.polygon, r.polygon),
        )
      )
        continue;
      roads.push(road);
      reservations.push(reserve);
      features.push({
        id,
        ownerId: scene.id,
        kind: 'work-road',
        fromXU: path.x ? fromXU : scene.fromXU + 170,
        toXU: path.x ? toXU : scene.toXU - 170,
        dependencies: [],
      });
    }
  const atId = (role: string, i: number) =>
    `g2:chunk:${chunkIndex}:prop:${role}:candidate:${i}`;
  const accept = (
    p: SceneryProp,
    event?: PlacementTraceEntry,
    body?: BoundsU,
  ): boolean => {
    if (!footprintAdmissible(seed, chunkIndex, p, catalog, body)) {
      if (event) event.rejectionCode = 'context';
      return false;
    }
    const conflict = placementConflict(
      seed,
      chunkIndex,
      p,
      catalog,
      reservations,
      p.relations,
      body,
    );
    if (conflict) {
      if (event) {
        event.rejectionCode = 'collision';
        event.conflictingReservation = conflict;
      }
      return false;
    }
    if (event) event.rejectionCode = 'accepted';
    return true;
  };
  const sourceRules = flat
    ? ground.rules.filter(
        (r) => r.layer === 'near' && r.aroundAnimalU === undefined,
      )
    : own.rules;
  const rules =
    region.season === 'winter'
      ? [
          ...sourceRules.filter(
            (r) => r.layer === 'back' || r.seasons?.includes('winter'),
          ),
          ...snowField,
        ]
      : sourceRules;
  const hasHouseRules =
    scene.templateId.startsWith('settlements-village-') ||
    scene.templateId === 'settlements-suburb' ||
    rules.some((rule) =>
      rule.kinds.some((kind) => kind.startsWith('back.house-')),
    );
  let memory = houseMemory.get(catalog);
  if (!memory) {
    memory = new Map();
    houseMemory.set(catalog, memory);
  }
  const memoryKey = `${seed}/${chunkIndex}`;
  let precedingHouses: readonly string[] = [];
  // A route cycle starts after lakes; reconstruct within a finite group, never from camera history.
  if (hasHouseRules && chunkIndex % (REGION_CYCLE_BLOCKS * 8) !== 0) {
    const previousKey = `${seed}/${chunkIndex - 1}`;
    if (!memory.has(previousKey)) chunkScenery(seed, chunkIndex - 1, catalog);
    precedingHouses = memory.get(previousKey) ?? [];
  }
  if (station) {
    const composition = stationScenery(
      seed,
      chunkIndex,
      station,
      catalog,
      reservations,
    );
    reservations.push(...composition.reservations);
    features.push(composition.feature);
    roads.push(...composition.roads);
    features.push(...composition.paths);
    // Access is owned by the station and never introduces a railway crossing.
    for (const prop of composition.props) {
      const event: PlacementTraceEntry | undefined = trace
        ? {
            candidate: {
              id: prop.id,
              kind: prop.kind,
              worldXU: x0 + prop.xU,
              layer: prop.layer,
              depth: prop.depth,
              attempt: 0,
            },
            admissible: [prop.kind],
            rejectionCode: 'context',
            conflictingReservation: undefined,
            missingDependency: undefined,
          }
        : undefined;
      if (event) trace?.push(event);
      if (
        prop.layer === 'near' &&
        Math.abs(prop.xU - animalX) < ANIMAL_CLEARANCE_U
      ) {
        if (event) event.rejectionCode = 'context';
        continue;
      }
      if (accept(prop, event)) props.push(prop);
    }
  }
  const settlement = scene.templateId.startsWith('settlements-')
    ? settlementScenery(
        seed,
        chunkIndex,
        scene,
        region,
        catalog,
        reservations,
        animalX,
        precedingHouses,
      )
    : undefined;
  if (settlement) {
    for (const prop of settlement.props)
      trace?.push({
        candidate: {
          id: prop.id,
          kind: prop.kind,
          worldXU: x0 + prop.xU,
          layer: prop.layer,
          depth: prop.depth,
          attempt: 0,
        },
        admissible: [prop.kind],
        rejectionCode: 'accepted',
        conflictingReservation: undefined,
        missingDependency: undefined,
      });
    props.push(...settlement.props);
    roads.push(...settlement.roads);
    features.push(...settlement.features);
    reservations.push(...settlement.reservations);
  }
  const ordered = rules
    .map((rule, index) => ({ rule, index }))
    .sort(
      (a, b) =>
        Number(b.rule.kinds.includes('back.car')) -
        Number(a.rule.kinds.includes('back.car')),
    );
  for (const { rule, index } of ordered) {
    if (rule.layout) continue;
    if (
      rule.seasons &&
      !rule.seasons.includes(contextAt(seed, x0 + 512).season)
    )
      continue;
    if (rule.kinds.some((kind) => kind.startsWith('fence.'))) continue;
    if (
      rule.kinds.some(
        (kind) => kind === 'back.watermill' || kind === 'near.pond',
      ) &&
      x0 !== scene.fromXU
    )
      continue;
    if (rule.kinds.includes('back.lighthouse') && x0 !== scene.fromXU) continue;
    const transition = transitionAt(seed, x0 + 512);
    const density = (landscape: Biome) =>
      landscape === 'forest' ? 1.3 : landscape === 'dunes' ? 0.7 : 1;
    const baseDensity = density(region.landscape);
    const factor =
      (baseDensity +
        (density(transition.to.landscape) - baseDensity) *
          transition.progress) /
      baseDensity;
    const decorative = rule.kinds.every(
      (kind) =>
        kind.startsWith('tree.') ||
        (kind.startsWith('near.') &&
          !kind.includes('pond') &&
          !kind.includes('fence')),
    );
    const count = Math.round(
      (rule.count[0] +
        Math.floor(
          roll(index, 'count') * (rule.count[1] - rule.count[0] + 1),
        )) *
        (decorative ? factor : 1),
    );
    const range = rule.x ?? [EDGE_U, 1024 - EDGE_U];
    const placed: SceneryProp[] = [];
    const houseRule = rule.kinds.some((kind) => kind.startsWith('back.house-'));
    for (let i = 0; i < count; i++)
      for (let attempt = 0; attempt < maxPlacementAttempts; attempt++) {
        const r = (field: string) => roll(index, i, attempt, field);
        const xU =
          rule.aroundAnimalU === undefined
            ? houseRule
              ? range[0] +
                ((range[1] - range[0]) * (i + 0.3 + 0.4 * r('x'))) / count
              : lerp(range, r('x'))
            : Math.max(
                EDGE_U,
                Math.min(
                  1024 - EDGE_U,
                  animalX + (2 * r('x') - 1) * rule.aroundAnimalU,
                ),
              );
        const early = (code: PlacementTraceEntry['rejectionCode']) => {
          if (!trace) return;
          const recent = houseRule
            ? [...precedingHouses, ...placed.map((p) => p.kind)].slice(-2)
            : [];
          trace.push({
            candidate: {
              id: atId(`rule:${index}`, i),
              kind: undefined,
              worldXU: x0 + xU,
              layer: rule.layer,
              depth: undefined,
              attempt,
            },
            admissible: rule.kinds.filter(
              (kind) =>
                admissibleKind(kind, seed, x0 + xU, rule.layer) &&
                !recent.includes(kind),
            ),
            rejectionCode: code,
            conflictingReservation: undefined,
            missingDependency: undefined,
          });
        };
        if (
          rule.spacingU !== undefined &&
          placed.some((p) => Math.abs(p.xU - xU) < (rule.spacingU ?? 0))
        ) {
          early('spacing');
          continue;
        }
        if (
          rule.layer === 'near' &&
          rule.aroundAnimalU === undefined &&
          Math.abs(xU - animalX) < ANIMAL_CLEARANCE_U
        ) {
          early('animal-clearance');
          continue;
        }
        const recent = houseRule
          ? [...precedingHouses, ...placed.map((p) => p.kind)].slice(-2)
          : [];
        const eligible = rule.kinds.filter(
          (kind) =>
            admissibleKind(kind, seed, x0 + xU, rule.layer) &&
            !recent.includes(kind),
        );
        const kind = eligible[Math.floor(r('kind') * eligible.length)];
        if (!kind) {
          early('no-admissible-kind');
          continue;
        }
        const p: SceneryProp = {
          id: atId(`rule:${index}`, i),
          kind,
          layer: rule.layer,
          xU,
          depth: lerp(rule.depth, r('depth')),
          scale: lerp(rule.scale ?? [0.92, 1.08], r('scale')),
          flip: rule.flip === true && r('flip') < 0.5,
          phase: r('phase'),
          ...(rule.motion ? { motion: rule.motion } : {}),
          ...(rule.work ? { work: rule.work } : {}),
        };
        const event: PlacementTraceEntry | undefined = trace
          ? {
              candidate: {
                id: p.id,
                kind,
                worldXU: x0 + p.xU,
                layer: p.layer,
                depth: p.depth,
                attempt,
              },
              admissible: [...eligible],
              rejectionCode: 'outside-chunk',
              conflictingReservation: undefined,
              missingDependency: undefined,
            }
          : undefined;
        if (event) trace?.push(event);
        const part = catalog[kind];
        if (!part) throw new Error(`missing footprint ${kind}`);
        // Coastal art follows the actual receding shoreline, including transitions.
        const sea = water.find((w) => w.kind === 'sea');
        if (sea && (kind.includes('boat') || kind === 'back.pier')) {
          const section = waterSectionU(seed, chunkIndex, sea, p.xU);
          const footY =
            kind === 'back.pier'
              ? section.bottomU - 3
              : section.topU +
                (section.bottomU - section.topU) * (0.25 + 0.5 * r('depth'));
          p.depth = (-railYUpU(seed, x0 + p.xU) - footY) / 220;
        }
        const bounds = projectedBounds(seed, chunkIndex, p, part);
        if (
          rule.seasons &&
          [bounds.leftU, bounds.rightU].some(
            (x) => !rule.seasons?.includes(contextAt(seed, x).season),
          )
        )
          continue;
        if (bounds.leftU < x0 || bounds.rightU > x0 + 1024) continue;
        if (event) event.rejectionCode = 'missing-dependency';
        if (rule.surface) {
          const supporting = reservations.find(
            (r) => r.purpose === rule.surface,
          );
          const foot = projectedBounds(seed, chunkIndex, p, part, true);
          if (event) {
            event.rejectionCode = 'surface';
            event.missingDependency = rule.surface;
          }
          if (
            !supporting ||
            ![foot.leftU, foot.rightU].every((x) =>
              [foot.topU, foot.bottomU].every((y) =>
                pointInside({ xU: x, yU: y }, supporting.polygon),
              ),
            )
          )
            continue;
          p.dependencies = [supporting.ownerId];
          p.relations = [
            {
              reservationId: supporting.id,
              relation:
                rule.surface === 'field'
                  ? 'object-on-field'
                  : 'object-on-forest-floor',
            },
          ];
        }
        if (kind.includes('boat')) {
          if (event) {
            event.rejectionCode = 'missing-dependency';
            event.missingDependency = 'water';
          }
          const supported = water.find((w) => {
            if (
              bounds.leftU < x0 + w.fromX + 72 ||
              bounds.rightU > x0 + w.toX - 72
            )
              return false;
            const level = waterLevelU(seed, chunkIndex, w);
            for (const x of [
              p.xU - (p.motion?.rangeU ?? 0) / 2,
              p.xU,
              p.xU + (p.motion?.rangeU ?? 0) / 2,
            ]) {
              const foot = projectedBounds(
                seed,
                chunkIndex,
                { ...p, xU: x, motion: { rangeU: 0 } },
                part,
                true,
              ).bottomU;
              const section = waterSectionU(seed, chunkIndex, w, x, level);
              if (foot < section.topU || foot > section.bottomU) return false;
            }
            return true;
          });
          if (!supported) continue;
          p.dependencies = [supported.id];
          p.relations = [
            {
              reservationId: `${supported.id}:reserve:water`,
              relation: 'boat-on-water',
            },
          ];
        }
        if (kind === 'back.reeds' || kind === 'back.pier') {
          if (event) event.missingDependency = 'water';
          const supporting = water.find(
            (w) =>
              p.xU >= w.fromX + 72 &&
              p.xU <= w.toX - 72 &&
              (kind !== 'back.pier' ||
                boundsHitPolygon(bounds, waterPolygon(seed, chunkIndex, w))),
          );
          if (!supporting) continue;
          p.dependencies = [supporting.id];
          p.relations = [
            {
              reservationId: `${supporting.id}:reserve:water`,
              relation:
                kind === 'back.pier' ? 'pier-at-water' : 'reeds-at-water',
            },
          ];
        }
        if (
          (kind.startsWith('back.house-') && own.id === 'village') ||
          (kind.startsWith('back.house-') && own.id === 'town-village')
        ) {
          if (event) event.missingDependency = 'village-road';
          if (roads.length === 0) continue;
          p.dependencies = roads.map((road) => road.id);
        }
        if (kind === 'near.reeds') {
          if (event) event.missingDependency = 'foreground-pond';
          const pond = props.find((p) => p.kind === 'near.pond');
          if (!pond) continue;
          p.dependencies = [pond.id];
        }
        if (event) event.missingDependency = undefined;
        if (p.work && p.work !== 'farmer') {
          const path = roads.find(
            (r) =>
              r.surface === 'dirt' &&
              (r.layer ?? 'back') === p.layer &&
              workRoadSupports(seed, chunkIndex, p, part, r),
          );
          if (!path) {
            if (event) event.missingDependency = 'work-road';
            continue;
          }
          p.dependencies = [...(p.dependencies ?? []), path.id];
          p.relations = [
            ...(p.relations ?? []),
            {
              reservationId: roadReservation(path).id,
              relation: 'vehicle-on-road',
            },
          ];
        }
        if (kind === 'back.car') {
          if (!accept(p, event, bounds)) continue;
          const road = villageRoad(seed, chunkIndex, p, p.id);
          const candidate = roadReservation(road);
          const roadConflict = reservations.find(
            (r) =>
              r.purpose === 'track' &&
              polygonsHit(candidate.polygon, r.polygon),
          );
          if (roadConflict) {
            if (event) {
              event.rejectionCode = 'collision';
              event.conflictingReservation = roadConflict.id;
            }
            continue;
          }
          const waterConflict = reservations.find(
            (r) =>
              r.purpose === 'water' &&
              candidate.polygon.some((point) =>
                r.polygon.some(
                  (other) =>
                    Math.hypot(point.xU - other.xU, point.yU - other.yU) < 10,
                ),
              ),
          );
          if (waterConflict) {
            if (event) {
              event.rejectionCode = 'collision';
              event.conflictingReservation = waterConflict.id;
            }
            continue;
          }
          roads.push(road);
          reservations.push(candidate);
          p.dependencies = [road.id];
          p.relations = [
            { reservationId: candidate.id, relation: 'vehicle-on-road' },
          ];
          features.push({
            id: road.id,
            ownerId: scene.id,
            kind: 'road',
            fromXU: road.points[0]?.xU ?? road.fromXU,
            toXU: road.points.at(-1)?.xU ?? road.toXU,
            dependencies: [],
          });
        }
        if (kind === 'back.watermill') {
          if (!accept(p, event, bounds)) continue;
          // Wheel at SVG x=98, lowest paddle y=92; flowing race meets its foot.
          const scale = propScale(p),
            wheel = p.xU + 33 * scale;
          const channel: WaterBasin = {
            id: `${p.id}:channel`,
            kind: 'channel',
            fromX: Math.max(0, p.xU + 19 * scale),
            toX: Math.min(1024, wheel + 240),
            nearDepth: p.depth - 0.025,
            farDepth: p.depth + 0.08,
          };
          const reservation = waterReservation(seed, chunkIndex, channel);
          const channelConflict = reservations.find(
            (r) =>
              (r.purpose === 'crossing-road' || r.purpose === 'river') &&
              reservation.polygon.some(
                (point) =>
                  point.xU >= Math.min(...r.polygon.map((p) => p.xU)) &&
                  point.xU <= Math.max(...r.polygon.map((p) => p.xU)),
              ),
          );
          if (channelConflict) {
            if (event) {
              event.rejectionCode = 'collision';
              event.conflictingReservation = channelConflict.id;
            }
            continue;
          }
          waterAdd(channel);
          p.dependencies = [channel.id];
          p.relations = [
            {
              reservationId: reservation.id,
              relation: 'mill-wheel-in-channel',
            },
          ];
        }
        if (!accept(p, event, bounds)) continue;
        if (event) event.missingDependency = undefined;
        props.push(p);
        placed.push(p);
        if (kind === 'near.pond')
          features.push({
            id: p.id,
            ownerId: scene.id,
            kind: 'foreground-pond',
            fromXU: bounds.leftU,
            toXU: bounds.rightU,
            dependencies: [],
          });
        break;
      }
  }
  const fences = [
    ...fencesInChunk(seed, chunkIndex),
    ...(settlement?.fences ?? []),
  ];
  for (const f of fences)
    features.push({
      id: f.id,
      ownerId: f.ownerId,
      kind: 'fence',
      fromXU: f.fromXU,
      toXU: f.toXU,
      dependencies: [],
    });
  const secondary = secondarySite(seed, place.block);
  if (
    secondary &&
    secondary.fromX - 380 < x0 + 1024 &&
    secondary.toX + 380 > x0
  )
    features.push({
      id: secondary.id,
      ownerId: `g2:block:${place.block}`,
      kind: 'secondary-track',
      fromXU: secondary.fromX - 380,
      toXU: secondary.toX + 380,
      dependencies: [],
    });
  for (const site of [crossing, bridge, tunnel])
    if (site) {
      const from = 'localXU' in site ? x0 + site.localXU - 96 : x0 + site.fromX,
        to = 'localXU' in site ? x0 + site.localXU + 96 : x0 + site.toX;
      features.push({
        id: site.id,
        ownerId: region.id,
        kind:
          site === crossing
            ? 'crossing'
            : site === bridge
              ? 'bridge'
              : 'tunnel',
        fromXU: from,
        toXU: to,
        dependencies: [],
      });
    }
  const acceptForestChild = (p: SceneryProp) => {
    const event: PlacementTraceEntry = {
      candidate: {
        id: p.id,
        kind: p.kind,
        worldXU: x0 + p.xU,
        layer: p.layer,
        depth: p.depth,
        attempt: 0,
      },
      admissible: [p.kind],
      rejectionCode: 'context',
      conflictingReservation: undefined,
      missingDependency: undefined,
    };
    trace?.push(event);
    if (accept(p, event)) props.push(p);
  };
  props.push(
    ...farmForestComposition(seed, chunkIndex, own, catalog, reservations),
  );
  if (region.landscape === 'forest') {
    const tree = props.find(
      (p) => p.kind.startsWith('tree.') && p.layer === 'back' && p.depth > 0.1,
    );
    if (tree)
      for (const [i, kind] of ['animal.woodpecker', 'animal.owl'].entries()) {
        const p: SceneryProp = {
          ...tree,
          id: atId('perch', i),
          kind,
          xU: tree.xU + (i === 0 ? 4 : -6),
          offsetYU: -(i === 0 ? 36 : 54) * propScale(tree),
          flip: false,
          dependencies: [tree.id],
        };
        acceptForestChild(p);
      }
    if (bridge) {
      const p: SceneryProp = {
        id: atId('footbridge', 0),
        kind: 'back.footbridge',
        layer: 'back',
        xU: bridge.localXU + streamBendU(chunkIndex, -0.62 * 220),
        depth: 0.62,
        scale: 1,
        flip: false,
        phase: roll('footbridge'),
        offsetYU:
          railYUpU(
            seed,
            x0 + bridge.localXU + streamBendU(chunkIndex, -0.62 * 220),
          ) - railYUpU(seed, x0 + bridge.localXU),
        dependencies: [bridge.id],
        relations: reservations
          .filter((r) => r.purpose === 'river')
          .map((r) => ({ reservationId: r.id, relation: 'bridge-over-river' })),
      };
      acceptForestChild(p);
    }
  }
  const species = own.animals.filter(
    (kind) => kind !== 'duck' || props.some((p) => p.kind === 'near.pond'),
  );
  const animal: ChunkScenery['animal'] = {
    kind: species[Math.floor(roll('animal') * species.length)] ?? 'frog',
    depth: lerp(own.animalDepth ?? DEFAULT_ANIMAL_DEPTH, roll('animal-depth')),
  };
  if (memory.size === 256 && !memory.has(memoryKey)) {
    const first = memory.keys().next().value;
    if (first !== undefined) memory.delete(first);
  }
  memory.set(
    memoryKey,
    Object.freeze(
      hasHouseRules
        ? [
            ...precedingHouses,
            ...props
              .filter((p) => p.kind.startsWith('back.house-'))
              .sort((a, b) => a.xU - b.xU)
              .map((p) => p.kind),
          ].slice(-2)
        : [],
    ),
  );
  return {
    chunkIndex,
    biome: region.landscape,
    slot: place.slot,
    locality: own.id,
    near,
    back,
    water,
    crossing,
    bridge,
    tunnel,
    props,
    animal,
    region,
    scene,
    roads,
    fences,
    reservations,
    features,
  };
}
