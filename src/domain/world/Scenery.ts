import { gameConfig } from '../../config/gameConfig.ts';
import { biomeAt, type Biome } from './Biomes.ts';
import { chunkObjects } from './ChunkObjects.ts';
import {
  CROSSING_RESERVE_U,
  crossingSite,
  type CrossingSite,
} from './Crossings.ts';
import { hash32, unitRandom } from './Hash.ts';
import {
  SECONDARY_CLEAR_DEPTH,
  secondaryClearRanges,
} from './SecondaryTrack.ts';
import {
  BRIDGE_RESERVE_U,
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
  type LocalityTemplate,
  type NearGround,
  type PatrolMotion,
  type PropRule,
} from './sceneryTemplates.ts';
import {
  TRACK_GENERATOR_VERSION,
  generateTrackProfile,
  profileGrade,
} from './TrackProfile.ts';

/**
 * Near props never reach up to the train (doc 14 §5): a prop standing at
 * near depth d may be at most `NEAR_PROP_MAX_HEIGHT_U + d ×
 * NEAR_DEPTH_RANGE_U` tall as drawn, `nearDepthScale` included. The
 * renderer stands near props at least this far below the rail (track bed
 * and foot offset), so the cap holds.
 */
export const NEAR_PROP_MAX_HEIGHT_U = 26;
/** Near depth 0 … 1 spans this many u of meadow towards the viewer. */
export const NEAR_DEPTH_RANGE_U = 440;

/** Nearer meadow props are drawn larger (perspective). */
export function nearDepthScale(depth: number): number {
  return 1 + 0.5 * depth;
}

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
}

/** A level water basin behind the track, chunk-local (see WaterBody). */
export interface WaterBasin {
  fromX: number;
  toX: number;
  nearDepth: number;
  farDepth: number;
}

/**
 * The shore of a basin curves in over this many u at each end; between
 * them the water spans the basin's whole depth range.
 */
export const WATER_END_U = 72;
/** Water moved behind a second track keeps at least this much depth. */
const SHALLOWEST_WATER = 0.12;

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
  animal: { kind: AnimalKind; depth: number };
}

const { chunkWidthU, chunksPerBiomeBlock, maxPlacementAttempts } =
  gameConfig.world;
/** Props keep this far from the chunk edges. */
const EDGE_U = 16;
/** Near props keep this far from the interactive animal (doc 05 §2). */
const ANIMAL_CLEARANCE_U = 60;
/** Shortest flat that takes a station: platform and its ends. */
const STATION_FLAT_U = 448;
/** Where the transition chunk switches to the next biome's look. */
const TRANSITION_X_U = 512;
/** Sample step when looking for a flat; transitions are 192 u long. */
const FLAT_STEP_U = 16;

type Roll = (...parts: (string | number)[]) => number;
type Placement = Omit<SceneryProp, 'id'>;

const byId = new Map(LOCALITIES.map((locality) => [locality.id, locality]));

function locality(id: string): LocalityTemplate {
  const found = byId.get(id);
  if (!found) throw new RangeError(`unknown locality ${id}`);
  return found;
}

function calmOf(biome: Biome): LocalityTemplate {
  const calm = LOCALITIES.find((t) => t.biome === biome && t.calm);
  if (!calm) throw new RangeError(`no calm locality for ${biome}`);
  return calm;
}

const lerp = (range: readonly [number, number], t: number) =>
  range[0] + (range[1] - range[0]) * t;

/** Longest flat of a chunk's track, chunk-local, if long enough. */
function stationFlat(
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
function stationSlot(seed: number, block: number): number | undefined {
  const preferred =
    1 + (hash32(seed, TRACK_GENERATOR_VERSION, 'station-slot', block) % 2);
  for (const slot of [preferred, 3 - preferred]) {
    if (stationFlat(seed, block * chunksPerBiomeBlock + slot)) return slot;
  }
  return undefined;
}

/** Template of a free (non-calm, non-station) slot, weighted by seed. */
function freeLocality(biome: Biome, roll: Roll): LocalityTemplate {
  const choices = LOCALITIES.filter((t) => t.biome === biome && t.weight > 0);
  const total = choices.reduce((sum, t) => sum + t.weight, 0);
  let pick = roll('locality') * total;
  for (const choice of choices) {
    pick -= choice.weight;
    if (pick < 0) return choice;
  }
  return calmOf(biome);
}

/** Contiguous ground spans over the chunk: a base and overlays. */
function groundSpans<G>(
  base: G,
  overlays: readonly GroundSpan<G>[],
): GroundSpan<G>[] {
  const cuts = new Set([0, chunkWidthU]);
  for (const span of overlays) {
    cuts.add(Math.max(0, Math.min(chunkWidthU, span.fromX)));
    cuts.add(Math.max(0, Math.min(chunkWidthU, span.toX)));
  }
  const xs = [...cuts].sort((a, b) => a - b);
  const spans: GroundSpan<G>[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const fromX = xs[i] ?? 0;
    const toX = xs[i + 1] ?? chunkWidthU;
    const mid = (fromX + toX) / 2;
    const overlay = overlays.findLast(
      (span) => span.fromX <= mid && mid < span.toX,
    );
    const style = overlay ? overlay.style : base;
    const last = spans.at(-1);
    if (last && last.style === style) last.toX = toX;
    else spans.push({ style, fromX, toX });
  }
  return spans;
}

interface RuleContext {
  roll: Roll;
  animalX: number;
  /** Only place inside this x window (transition halves). */
  window: readonly [number, number];
  key: string;
}

/** Props of one rule, with bounded tries and spacing (doc 04 §6). */
function placeRule(rule: PropRule, context: RuleContext): Placement[] {
  const { roll, animalX, window, key } = context;
  const range = rule.x ?? [EDGE_U, chunkWidthU - EDGE_U];
  const from = Math.max(range[0], window[0], EDGE_U);
  const to = Math.min(range[1], window[1], chunkWidthU - EDGE_U);
  if (to < from) return [];
  if (
    rule.aroundAnimalU !== undefined &&
    (animalX < window[0] || animalX >= window[1])
  )
    return [];
  // A window narrower than the rule's range gets its share of the props.
  const share = (to - from) / Math.max(1, range[1] - range[0]);
  const span = rule.count[1] - rule.count[0] + 1;
  const count = Math.round(
    (rule.count[0] + Math.floor(roll(key, 'count') * span)) *
      Math.min(1, share),
  );
  const placed: Placement[] = [];
  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < maxPlacementAttempts; attempt++) {
      const r = (field: string) => roll(key, i, attempt, field);
      const x =
        rule.aroundAnimalU === undefined
          ? lerp([from, to], r('x'))
          : Math.min(
              to,
              Math.max(from, animalX + (2 * r('x') - 1) * rule.aroundAnimalU),
            );
      if (
        rule.spacingU !== undefined &&
        placed.some((p) => Math.abs(p.xU - x) < (rule.spacingU ?? 0))
      )
        continue;
      if (
        rule.layer === 'near' &&
        rule.aroundAnimalU === undefined &&
        Math.abs(x - animalX) < ANIMAL_CLEARANCE_U
      )
        continue;
      const kind = rule.kinds[Math.floor(r('kind') * rule.kinds.length)];
      if (kind === undefined) break;
      placed.push({
        kind,
        layer: rule.layer,
        xU: x,
        depth: lerp(rule.depth, r('depth')),
        scale: lerp(rule.scale ?? [0.92, 1.08], r('scale')),
        flip: rule.flip === true && r('flip') < 0.5,
        ...(rule.motion ? { motion: rule.motion } : {}),
        phase: r('phase'),
      });
      break;
    }
  }
  return placed;
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

/** A small country station on the flat (doc 05 §3, doc 14 §5). */
function stationPlacements(
  flat: readonly [number, number],
  roll: Roll,
): Placement[] {
  const c = Math.round((flat[0] + flat[1]) / 2);
  const at = (kind: string, xU: number, depth: number): Placement => ({
    kind,
    layer: 'back',
    xU,
    depth,
    scale: 1,
    flip: false,
    phase: 0,
  });
  const people = ['back.person-a', 'back.person-b', 'back.person-c'];
  const waiting = 2 + Math.floor(roll('passengers') * 2);
  return [
    at('back.station', c, 0.16),
    at('back.platform', c, 0.02),
    at('back.lamp', c - 150, 0.03),
    at('back.lamp', c + 150, 0.03),
    at('back.bench', c + 92, 0.05),
    at('back.dispatcher', c - 64, 0.045),
    ...people
      .slice(0, waiting)
      .map((kind, i) => at(kind, c - 120 + i * 110 + roll('p', i) * 30, 0.04)),
    ...[c - 260, c + 260]
      .filter((x) => x > EDGE_U && x < chunkWidthU - EDGE_U)
      .map((x) => ({ ...at('tree.linden', x, 0.5), flip: x > c })),
  ];
}

/**
 * Scenery of one chunk (doc 04 §5–6, doc 14 §5): the biome block chooses
 * the locality by slot (slot 0 calm, a station on a flat in slot 1 or 2,
 * the last slot blending into the next biome) and the locality's rules
 * place its props with stable ids. Pure: seed and chunk index only; the
 * interactive animal keeps its generator position and gets a species and
 * surroundings that fit.
 */
export function chunkScenery(seed: number, chunkIndex: number): ChunkScenery {
  const place = biomeAt(seed, chunkIndex);
  const roll: Roll = (...parts) =>
    unitRandom(seed, TRACK_GENERATOR_VERSION, 'scenery', chunkIndex, ...parts);
  const animalX = chunkObjects(seed, chunkIndex)[0]?.localXU ?? chunkWidthU / 2;
  const lastSlot = chunksPerBiomeBlock - 1;
  const station =
    place.slot === stationSlot(seed, place.block)
      ? stationFlat(seed, chunkIndex)
      : undefined;
  const own = station
    ? locality('station')
    : place.slot === 0 || place.slot === lastSlot
      ? calmOf(place.biome)
      : freeLocality(place.biome, roll);
  const ground = station ? calmOf(place.biome) : own;

  const placements: Placement[] = [];
  const addRules = (
    template: LocalityTemplate,
    window: readonly [number, number],
    tag: string,
    only: (rule: PropRule) => boolean = () => true,
  ) =>
    template.rules.forEach((rule, i) => {
      if (!only(rule)) return;
      placements.push(
        ...placeRule(rule, { roll, animalX, window, key: `${tag}${i}` }),
      );
    });
  let near: GroundSpan<NearGround>[];
  let back: GroundSpan<BackGround>[];
  const water: WaterBasin[] = [];
  const addWater = (
    template: LocalityTemplate,
    window: readonly [number, number],
  ) => {
    if (!template.water) return;
    const [fromX, toX] = template.water.x ?? [0, chunkWidthU];
    const basin = {
      fromX: Math.max(fromX, window[0]),
      toX: Math.min(toX, window[1]),
      nearDepth: template.water.depth[0],
      farDepth: template.water.depth[1],
    };
    if (basin.toX - basin.fromX > 2 * WATER_END_U) water.push(basin);
  };
  if (place.slot === lastSlot) {
    const next = calmOf(place.next);
    // Tractors, cars and boats need a whole chunk to drive or sail in.
    const still = (rule: PropRule) => rule.motion === undefined;
    addRules(own, [0, TRANSITION_X_U], 'r', still);
    addRules(next, [TRANSITION_X_U, chunkWidthU], 'n', still);
    const half = (style: unknown) => [
      { style, fromX: TRANSITION_X_U, toX: chunkWidthU },
    ];
    near = groundSpans(own.near, half(next.near) as GroundSpan<NearGround>[]);
    back = groundSpans(own.back, half(next.back) as GroundSpan<BackGround>[]);
    addWater(own, [0, TRANSITION_X_U]);
    addWater(next, [TRANSITION_X_U, chunkWidthU]);
  } else {
    if (station) placements.push(...stationPlacements(station, roll));
    else addRules(own, [0, chunkWidthU], 'r');
    // The station borrows only the low meadow plants of its biome.
    if (station)
      addRules(
        calmOf(place.biome),
        [0, chunkWidthU],
        's',
        (rule) => rule.layer === 'near' && rule.aroundAnimalU === undefined,
      );
    near = groundSpans(ground.near, []);
    back = groundSpans(ground.back, ground.backSpans ?? []);
    // A station stands on dry land.
    if (!station) addWater(ground, [0, chunkWidthU]);
  }
  // A crossing reserves its road strip (doc 04 §6: reservations first):
  // water splits around it and nothing stands or drives on it.
  const crossing = crossingSite(seed, chunkIndex);
  let kept = placements;
  if (crossing) {
    const road = crossing.localXU;
    const wet = water.length > 0;
    const pieces = water.flatMap((basin) =>
      [
        { ...basin, toX: Math.min(basin.toX, road - CROSSING_RESERVE_U) },
        { ...basin, fromX: Math.max(basin.fromX, road + CROSSING_RESERVE_U) },
      ].filter((piece) => piece.toX - piece.fromX > 2 * WATER_END_U),
    );
    water.length = 0;
    water.push(...pieces);
    kept = placements.filter((placement) => {
      const reach = (placement.motion?.rangeU ?? 0) / 2;
      if (Math.abs(placement.xU - road) < CROSSING_RESERVE_U + reach)
        return false;
      // A boat keeps to one piece of the split water.
      if (!placement.motion || !wet) return true;
      return pieces.some(
        (piece) =>
          placement.xU - reach >= piece.fromX + WATER_END_U &&
          placement.xU + reach <= piece.toX - WATER_END_U,
      );
    });
  }
  // The stream under a bridge runs from the horizon to the viewer: water
  // splits around it and nothing stands in it, wider towards the viewer.
  const bridge = bridgeSite(seed, chunkIndex);
  if (bridge) {
    const c = bridge.localXU;
    const pieces = water.flatMap((basin) =>
      [
        { ...basin, toX: Math.min(basin.toX, c - BRIDGE_RESERVE_U) },
        { ...basin, fromX: Math.max(basin.fromX, c + BRIDGE_RESERVE_U) },
      ].filter((piece) => piece.toX - piece.fromX > 2 * WATER_END_U),
    );
    water.length = 0;
    water.push(...pieces);
    kept = kept.filter((placement) => {
      const reach = (placement.motion?.rangeU ?? 0) / 2;
      const keep =
        placement.layer === 'near'
          ? BRIDGE_RESERVE_U * nearDepthScale(placement.depth)
          : BRIDGE_RESERVE_U;
      return Math.abs(placement.xU - c) >= keep + reach;
    });
  }
  // A second track and its portal hills keep the near back ground clear
  // (doc 04 §7): nearer props leave, water lies behind its band.
  const clear = secondaryClearRanges(seed, chunkIndex);
  if (clear.length > 0) {
    const inside = (from: number, to: number) =>
      clear.some((range) => from < range.toX && to > range.fromX);
    const shifted = water.map((basin) => {
      if (!inside(basin.fromX, basin.toX)) return basin;
      const nearDepth = Math.max(basin.nearDepth, SECONDARY_CLEAR_DEPTH);
      return {
        ...basin,
        nearDepth,
        farDepth: Math.max(basin.farDepth, nearDepth + SHALLOWEST_WATER),
      };
    });
    water.length = 0;
    water.push(...shifted);
    kept = kept.filter((placement) => {
      if (
        placement.layer !== 'back' ||
        placement.depth >= SECONDARY_CLEAR_DEPTH
      )
        return true;
      const reach = (placement.motion?.rangeU ?? 0) / 2;
      return !inside(placement.xU - reach, placement.xU + reach);
    });
  }
  // In the transition chunk the animal belongs to the half it stands in.
  const host =
    place.slot === lastSlot && animalX >= TRANSITION_X_U
      ? calmOf(place.next)
      : own;
  return {
    chunkIndex,
    biome: place.biome,
    slot: place.slot,
    locality: own.id,
    near,
    back,
    water,
    crossing,
    bridge,
    tunnel: tunnelSite(seed, chunkIndex),
    props: kept.map((placement, n) => ({
      id: `g${TRACK_GENERATOR_VERSION}:chunk:${chunkIndex}:prop:${n}`,
      ...placement,
    })),
    animal: {
      kind:
        host.animals[Math.floor(roll('animal') * host.animals.length)] ??
        'sheep',
      depth: lerp(
        host.animalDepth ?? DEFAULT_ANIMAL_DEPTH,
        roll('animal-depth'),
      ),
    },
  };
}
