import { VisibleComposition } from './VisibleComposition.ts';
import { cablewaySupportHeights } from './waterMountainMotion.ts';
import {
  WaterMountainView,
  waterMountainCompound,
} from './WaterMountainView.ts';
import { bakeStaticComposition } from './StaticComposition.ts';
import {
  streamBendU,
  streamHalfWidthU,
} from '../domain/world/StreamGeometry.ts';
import { farmPatrolOffsetU } from './farmForestMotion.ts';
import { FarmForestView } from './FarmForestView.ts';
import { contextAt } from '../domain/world/WorldPlan.ts';
import { StationReaction } from '../domain/interaction/StationReaction.ts';
import { settlementAttachmentAngle } from './settlementMotion.ts';
import { parts as settlementArt } from '../content/world-modules/settlements.art.ts';
import { frameTexture } from './frameTexture.ts';
import { effectiveClimateAt, windAt } from '../domain/world/Seasons.ts';
import { SeasonalSceneryView } from './SeasonalSceneryView.ts';
import type { RoadVehicleSnapshot } from './roadVehicleSnapshot.ts';
import {
  vehicleHeading,
  type VehicleHeading,
} from '../domain/interaction/VehicleHeading.ts';
import { roadVehicleArt } from '../content/roadVehicleArt.ts';
import { RoadVehicleMotion } from './RoadVehicleMotion.ts';
import { roadPositionAt } from '../domain/world/SceneryGeometry.ts';
import { transitionAt } from '../domain/world/Regions.ts';
import { ROAD_BRIDGE_EDGE_U } from '../domain/world/SettlementScenery.ts';
import { nearGroundRuns, nearGroundTailStrips } from './groundLayout.ts';
import { immutableTexture } from './immutableTexture.ts';
import { TextureMemory } from './TextureMemory.ts';
import {
  clipPolygonX,
  propFootU,
  propScale,
  roadSide,
  roadPolygon,
  pointInside,
  waterSectionU,
  waterLevelU,
  type PointU,
  type RoadPath,
} from '../domain/world/SceneryGeometry.ts';
import {
  FENCE_PARTS,
  fenceChildId,
  type FenceFeature,
} from '../domain/world/Fences.ts';
import Phaser from 'phaser';
import { sceneryDecorationHash } from './sceneryDecorationHash.ts';
import { largeBridgeView } from './BridgeView.ts';
import { regionAt } from '../domain/world/Regions.ts';
import { railYUpU } from '../domain/world/SceneryGeometry.ts';
import { gameConfig } from '../config/gameConfig.ts';
import type { ArtPart } from '../content/artManifest.ts';
import {
  TRACK_BED_DEPTH_U,
  TRACK_TILE_STEP_U,
  bridgeParts,
  crossingParts,
  trackTileSets,
  worldParts,
} from '../content/worldArt.ts';
import {
  FAR_STOP_LINE_U,
  NEAR_STOP_LINE_U,
  ROAD_CONFLICT_U,
  ROAD_FAR_END_U,
} from '../domain/interaction/LevelCrossing.ts';
import type { ArcLengthTable } from '../domain/world/ArcLengthTable.ts';
import { hash32 } from '../domain/world/Hash.ts';
import {
  WATER_END_U,
  propDrawOrder,
  type ChunkScenery,
  type SceneryProp,
  type WaterBasin,
} from '../domain/world/Scenery.ts';
import type {
  BackGround,
  GroundSpan,
  NearGround,
} from '../domain/world/sceneryTemplates.ts';
import { bankHeightU } from '../domain/world/Terrain.ts';
import { secondarySiteOfChunk } from '../domain/world/SecondaryTrack.ts';
import {
  BRIDGE_HALF_U,
  RIVER_HALF_U,
  VALLEY_DEPTH_U,
  type TunnelSite,
} from '../domain/world/Structures.ts';
import {
  NEAR_PALETTE,
  BACK_PALETTE,
  WATER_PALETTE,
  blendNearPalette,
  spatialNearPalette,
  spatialBackPalette,
  mixColour,
  type NearPalette,
  type WaterPalette,
} from './groundPalette.ts';
import { glintAlpha, swayAmplitudeRad, swayAngle } from './ambientMotion.ts';
import { setWorldPivot } from './worldImage.ts';
import { chunkCatenary, chunkCatenaryFallback } from './CatenaryView.ts';
import {
  TUNNEL_MAST_CLEARANCE_U,
  catenaryPoleXs,
  catenarySupport,
} from '../domain/world/Catenary.ts';
import { chunkSecondaryTrack } from './SecondaryView.ts';
import { CrossingView, type CrossingState } from './CrossingView.ts';
import { CrossingFallbackView } from './CrossingFallbackView.ts';
import { TunnelView, type Bake } from './TunnelView.ts';
import {
  crossingRoadRange,
  roadHalfWidthU,
  roadPointY,
  type RoadFrame,
} from './crossingLayout.ts';
import { BACK_PLANE_U, NEAR_FOOT_OFFSET_U } from './groundLayout.ts';
import { trackTilePlacements } from './trackTiles.ts';

const CHUNK_WIDTH_U = gameConfig.world.chunkWidthU;
/** How far below the rail the ground reaches; below any screen. */
const GROUND_DEPTH_U = 1200;
/**
 * Each chunk's ground reaches this far into the next one: abutting
 * anti-aliased polygon edges leave a light seam column on Canvas.
 */
const GROUND_OVERLAP_U = 4;
/** Field edges lean up to this far over the depth of the back ground. */
const FIELD_EDGE_LEAN_U = 40;
/** Water keeps this far from its basin's ends (its shore lies there). */
const WATER_SIDE_U = 10;
/** Road surface and gravel shoulder of crossing roads. */
const ROAD_ASPHALT = 0x7d7b77;
const ROAD_SHOULDER = 0xb8a682;
const ROAD_LINE = 0xe9e6dc;
/** Stream under a bridge: muddy bank, water, the lighter current. */
const STREAM_BANK = 0x8a7a55;
const STREAM_WATER = 0x5b9cc9;
const STREAM_CURRENT = 0x86c0e2;
/** How far the stream meanders to either side away from the bridge. */

/** The bridge's far railing stands this much behind the rail head. */
const BRIDGE_RAILING_BEHIND_U = 6;
const ROAD_DASH = 0xf4f1e6;
/** Middle line: a dash every 20 u; the near road starts on the bank. */
const ROAD_DASH_EVERY_U = 20;
const ROAD_NEAR_FROM_U = ROAD_CONFLICT_U - 8;
/** Below the painted meadow the road's lines go on this far. */
const ROAD_TAIL_DASHES_U = 600;

/** Cut markings at exact polygon intersections, leaving junction mouths open. */
function strokeOutside(
  g: Phaser.GameObjects.Graphics,
  points: readonly { x: number; y: number }[],
  mouths: readonly (readonly PointU[])[],
): void {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (!a || !b) continue;
    const dx = b.x - a.x,
      dy = b.y - a.y;
    const cuts = [0, 1];
    for (const polygon of mouths)
      for (let j = 0; j < polygon.length; j++) {
        const c = polygon[j],
          d = polygon[(j + 1) % polygon.length];
        if (!c || !d) continue;
        const ex = d.xU - c.xU,
          ey = d.yU - c.yU,
          det = dx * ey - dy * ex;
        if (Math.abs(det) < 1e-9) continue;
        const cx = c.xU - a.x,
          cy = c.yU - a.y,
          t = (cx * ey - cy * ex) / det,
          u = (cx * dy - cy * dx) / det;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const from = cuts[j - 1],
        to = cuts[j];
      if (from === undefined || to === undefined || to - from < 1e-9) continue;
      const middle = (from + to) / 2;
      if (
        mouths.some((p) =>
          pointInside({ xU: a.x + middle * dx, yU: a.y + middle * dy }, p),
        )
      )
        continue;
      g.lineBetween(
        a.x + from * dx,
        a.y + from * dy,
        a.x + to * dx,
        a.y + to * dy,
      );
    }
  }
}
/** Flashing glints on each water basin. */
const GLINTS_PER_BASIN = 6;
/** A road bends away to the horizon over this many u at each end. */

/** Road width at the track (narrower with distance). */

/**
 * Every how many track samples the ground outlines take a vertex (32 u at
 * 8 u samples); the track tiles overlap the bank top by more than the
 * chord error.
 */
const GROUND_SAMPLE_STRIDE = 4;
/**
 * The ground is painted once per chunk into a texture (D-013): Phaser
 * re-triangulates Graphics paths every frame. Soft colour fields keep
 * their look at up to 1 px/u, which bounds texture memory per chunk.
 */
const GROUND_MAX_PX_PER_U = 1;
/** Meadow below the last band is a plain rectangle, not texture. */
const NEAR_TAIL_U = 24;

/**
 * Second-track layers above the back props: tiles, tunnel mouths, the
 * oncoming train and the portal hills over it (doc 04 §7).
 */
export const SECONDARY_DEPTH = {
  track: 0.2,
  mouth: 0.25,
  train: 0.3,
  hill: 0.35,
} as const;

let bakedSerial = 0;

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

/** Atlas the chunk's art is drawn from. */
export interface ChunkArt {
  textureFor?: (frame: string) => string | undefined;
  texture: string;
  pxPerU: number;
}

export interface ChunkDepths {
  backGround: number;
  backProps: number;
  ground: number;
  track: number;
  train: number;
  /** Catenary wires: above the train, below the near meadow. */
  wires: number;
  nearProps: number;
}

interface MovingProp {
  image: Phaser.GameObjects.Image;
  prop: SceneryProp;
  heading: VehicleHeading;
  visual: RoadVehicleMotion | undefined;
  velocityXUPerSec: number;
  velocityYUPerSec: number;
}

/** Half the width of the fade where the near ground changes style, u. */
const NEAR_BLEND_HALF_U = 96;
const NEAR_BLEND_STEP_U = 4;

/** Places where the near ground changes style, with both styles. */
function nearEdges(
  spans: readonly GroundSpan<NearGround>[],
): { x: number; left: NearGround; right: NearGround }[] {
  const edges: { x: number; left: NearGround; right: NearGround }[] = [];
  for (let i = 1; i < spans.length; i++) {
    const left = spans[i - 1];
    const right = spans[i];
    if (left && right && left.style !== right.style)
      edges.push({ x: right.fromX, left: left.style, right: right.style });
  }
  return edges;
}

/** Strips across a style edge at x, each with its share of the right style. */
function blendStrips(x: number): { fromX: number; toX: number; t: number }[] {
  const strips: { fromX: number; toX: number; t: number }[] = [];
  const start = x - NEAR_BLEND_HALF_U;
  for (
    let from = Math.max(0, start);
    from < Math.min(CHUNK_WIDTH_U, x + NEAR_BLEND_HALF_U);
    from += NEAR_BLEND_STEP_U
  )
    strips.push({
      fromX: from,
      toX: Math.min(CHUNK_WIDTH_U, from + NEAR_BLEND_STEP_U),
      t: (from + NEAR_BLEND_STEP_U / 2 - start) / (2 * NEAR_BLEND_HALF_U),
    });
  return strips;
}

/**
 * Everything of one chunk except the train (doc 07 §3 layers 4–6 and 8):
 * the ground behind the track and its props, the embankment and meadow,
 * the track tiles and the low props of the near meadow. Owns its game
 * objects; `destroy` releases all of them. Coordinates are chunk-local;
 * `setX` places the chunk on screen and `update` moves its tractors, cars
 * and boats by simulation time (so a paused ride stands still).
 */
export class ChunkView {
  readonly #table: ArcLengthTable;
  readonly #scenery: ChunkScenery;
  readonly #seed: number;
  readonly fragmentIds: readonly string[];
  readonly #pxPerU: number;
  readonly #scene: Phaser.Scene;
  readonly #objects: (
    Phaser.GameObjects.Container | Phaser.GameObjects.Graphics
  )[] = [];
  readonly #compositions: VisibleComposition[] = [];
  readonly #decorativeGroups: {
    object: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
    leftU: number;
    rightU: number;
  }[] = [];
  /** Baked ground textures, removed with the chunk. */
  readonly #textures: string[] = [];
  readonly #moving: MovingProp[] = [];
  readonly #waterMountains: {
    timeSec?: number;
    view: WaterMountainView;
    prop: SceneryProp;
    foot: { xU: number; yU: number };
  }[] = [];
  readonly #farm: {
    view: FarmForestView;
    prop: SceneryProp;
    foot: { xU: number; yU: number };
    timeSec?: number;
  }[] = [];
  readonly #settlementMotion: {
    image: Phaser.GameObjects.Image;
    kind: string;
    phase: number;
    winter: boolean;
    reaction: StationReaction | undefined;
  }[] = [];
  #seasonal: SeasonalSceneryView | undefined;
  #lastDecorationSec: number | undefined;
  readonly #animationTimes = new WeakMap<Phaser.GameObjects.Image, number>();
  #animatedLastFrame = 0;
  readonly #roadSample = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 };
  readonly #roadBefore = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 };
  readonly #roadAfter = { xU: 0, yU: 0, tangentX: 0, tangentY: 0 };
  readonly #near: Phaser.GameObjects.Image[] = [];
  /** Plants and trees that sway in the wind, with their phase. */
  readonly #swaying: {
    image: Phaser.GameObjects.Image;
    kind: string;
    phase: number;
  }[] = [];
  /** Water glints: spots found while painting the basins, then images. */
  readonly #glintSpots: {
    x: number;
    y: number;
    sizeU: number;
    phase: number;
  }[] = [];
  readonly #glints: { image: Phaser.GameObjects.Image; phase: number }[] = [];
  /** Barriers, lamps and traffic of the chunk's level crossing. */
  #crossing: CrossingView | CrossingFallbackView | undefined;
  /** Main-track tunnel fragment; its cover fades near the player's train. */
  #tunnel: TunnelView | undefined;
  /** Catenary masts of an electric journey (doc 03 §9). */
  #poles = 0;
  /** Drawn second-track layers, retained for fallback diagnostics. */
  #secondaryTrack: Phaser.GameObjects.Container | undefined;
  #secondaryPortals = 0;

  constructor(
    scene: Phaser.Scene,
    table: ArcLengthTable,
    seed: number,
    scenery: ChunkScenery,
    art: ChunkArt | undefined,
    depths: ChunkDepths,
    electrified = false,
    forestArt?: ChunkArt,
    readonly memory = new TextureMemory(),
  ) {
    this.#scene = scene;
    this.#table = table;
    this.#scenery = scenery;
    this.#seed = seed;
    this.fragmentIds = scenery.features.map(
      (feature) => `${feature.id}:fragment:${table.chunkIndex}`,
    );
    this.#pxPerU = art?.pxPerU ?? 1;
    const groundScale = Math.min(this.#pxPerU, GROUND_MAX_PX_PER_U);
    let lowRail = Infinity;
    let highRail = -Infinity;
    for (const y of table.ys) {
      lowRail = Math.min(lowRail, y);
      highRail = Math.max(highRail, y);
    }
    const reach = FIELD_EDGE_LEAN_U + GROUND_OVERLAP_U + 8;
    const back = this.#bake(
      (g) => {
        for (const span of scenery.back) this.#paintBack(g, span);
        for (const basin of scenery.water) {
          const middle = (basin.fromX + basin.toX) / 2;
          const coast =
            basin.kind === 'sea' ||
            scenery.near.some(
              (span) =>
                span.style === 'sand' &&
                middle >= span.fromX &&
                middle < span.toX,
            );
          this.#paintWater(g, basin, WATER_PALETTE[coast ? 'sea' : 'lake']);
        }
        for (const area of scenery.reservations.filter(
          (r) =>
            r.purpose === 'village-green' ||
            r.purpose === 'forecourt' ||
            r.purpose === 'working-yard',
        )) {
          const climate = effectiveClimateAt(
            seed,
            (area.polygon[0]?.xU ?? table.chunkIndex * CHUNK_WIDTH_U) + 256,
          );
          g.fillStyle(
            mixColour(
              area.purpose === 'village-green' ? 0x91a96a : 0xb2ad9b,
              BACK_PALETTE.snow.base,
              climate.winter,
            ),
            1,
          );
          g.fillPoints(
            area.polygon.map(
              (p) =>
                new Phaser.Math.Vector2(
                  p.xU - table.chunkIndex * CHUNK_WIDTH_U,
                  p.yU,
                ),
            ),
            true,
          );
        }
        // Cars drive on a road (doc 04 §6: a car gets a road).
        for (const road of scenery.roads.filter((r) => r.layer !== 'near'))
          this.#paintRoad(g, road, true);
        if (scenery.crossing)
          this.#paintCrossingRoad(g, scenery.crossing.localXU, 'back', 0);
        // Local asphalt covers the crossing's shoulder inside the junction mouths.
        for (const road of scenery.roads.filter((r) => r.layer !== 'near'))
          this.#paintRoad(g, road, false);
        if (scenery.bridge)
          this.#paintStream(g, scenery.bridge.localXU, 'back', 0);
        // A street keeps its asphalt over the stream on a small road bridge.
        for (const bridge of scenery.features) {
          if (bridge.kind !== 'road-bridge') continue;
          const road = scenery.roads.find(
              (r) => r.id === bridge.dependencies[0],
            ),
            deck = scenery.reservations.find((r) => r.ownerId === bridge.id);
          if (road && deck)
            this.#paintRoadBridge(
              g,
              road,
              deck.polygon,
              bridge.fromXU,
              bridge.toXU,
            );
        }
      },
      {
        left: -reach,
        right: CHUNK_WIDTH_U + reach,
        top: -highRail - BACK_PLANE_U - 8,
        bottom: -lowRail + 8,
      },
      groundScale,
    ).setDepth(depths.backGround);
    // The meadow's bands end on one level line; plain colour below it.
    let meadowBottom = -Infinity;
    for (let x = 0; x <= CHUNK_WIDTH_U; x += 16)
      meadowBottom = Math.max(meadowBottom, this.#meadowTop(x));
    const surfaces = scenery.reservations.filter(
      (r) => r.purpose === 'field' || r.purpose === 'forest-floor',
    );
    const bandsEnd = Math.max(
      meadowBottom +
        Math.max(
          ...scenery.near.map(
            (span) => NEAR_PALETTE[span.style].bands.at(-1)?.fromU ?? 0,
          ),
        ) +
        NEAR_TAIL_U,
      ...surfaces.flatMap((r) => r.polygon.map((p) => p.yU + 8)),
      ...scenery.roads
        .filter((r) => r.layer === 'near')
        .flatMap((r) => r.points.map((p) => p.yU + 10)),
    );
    const ground = this.#bake(
      (g) => {
        for (const span of scenery.near) this.#paintNear(g, span, bandsEnd);
        // Where the ground changes style it fades over, without a seam.
        for (const edge of nearEdges(scenery.near))
          for (const strip of blendStrips(edge.x))
            this.#paintNearBands(
              g,
              blendNearPalette(
                NEAR_PALETTE[edge.left],
                NEAR_PALETTE[edge.right],
                strip.t,
              ),
              strip.fromX,
              strip.toX,
              bandsEnd,
            );
        for (const surface of surfaces)
          this.#paintNearSurface(
            g,
            surface,
            art !== undefined,
            scenery.features.find((f) => f.id === surface.ownerId),
          );
        for (const road of scenery.roads.filter((r) => r.layer === 'near'))
          this.#paintRoad(g, road, true);
        for (const road of scenery.roads.filter((r) => r.layer === 'near'))
          this.#paintRoad(g, road, false);
        for (const span of scenery.near) this.#paintNearShade(g, span);
        if (scenery.crossing)
          this.#paintCrossingRoad(
            g,
            scenery.crossing.localXU,
            'near',
            bandsEnd,
          );
        if (scenery.bridge)
          this.#paintStream(g, scenery.bridge.localXU, 'near', bandsEnd);
      },
      {
        left: -4,
        right: CHUNK_WIDTH_U + GROUND_OVERLAP_U + 4,
        top: -highRail + TRACK_BED_DEPTH_U - 6,
        bottom: bandsEnd,
      },
      groundScale,
    ).setDepth(depths.ground);
    for (const span of scenery.near)
      for (const strip of nearGroundTailStrips(
        this.#seed,
        (table.xs[0] ?? 0) + span.fromX,
        (table.xs[0] ?? 0) + span.toX,
        span.style,
      ))
        ground.add(
          scene.add
            .rectangle(
              strip.fromXU - (table.xs[0] ?? 0),
              bandsEnd - 1,
              strip.toXU - strip.fromXU + GROUND_OVERLAP_U,
              GROUND_DEPTH_U,
              strip.color,
            )
            .setOrigin(0, 0),
        );
    for (const edge of nearEdges(scenery.near))
      for (const strip of blendStrips(edge.x))
        ground.add(
          scene.add
            .rectangle(
              strip.fromX,
              bandsEnd - 1,
              strip.toX - strip.fromX + GROUND_OVERLAP_U,
              GROUND_DEPTH_U,
              blendNearPalette(
                NEAR_PALETTE[edge.left],
                NEAR_PALETTE[edge.right],
                strip.t,
              ).bands.at(-1)?.color ?? 0x74b448,
            )
            .setOrigin(0, 0),
        );
    if (scenery.crossing) {
      // The road runs on below the painted meadow.
      const x = scenery.crossing.localXU;
      const bottomU = this.#roadUAt(x, bandsEnd);
      const half = roadHalfWidthU(bottomU);
      ground.add([
        scene.add
          .rectangle(
            x - half - 4,
            bandsEnd - 1,
            2 * half + 8,
            GROUND_DEPTH_U,
            ROAD_SHOULDER,
          )
          .setOrigin(0, 0),
        scene.add
          .rectangle(
            x - half,
            bandsEnd - 1,
            2 * half,
            GROUND_DEPTH_U,
            ROAD_ASPHALT,
          )
          .setOrigin(0, 0),
        ...[-1, 1].map((side) =>
          scene.add
            .rectangle(
              x + side * (half - 2),
              bandsEnd - 1,
              1.2,
              GROUND_DEPTH_U,
              ROAD_LINE,
              0.9,
            )
            .setOrigin(0.5, 0),
        ),
      ]);
      // The dashed middle line goes on in the painted line's rhythm.
      const frame = { railY: -this.#railAt(x), meadowY: this.#meadowTop(x) };
      const first =
        ROAD_NEAR_FROM_U +
        ROAD_DASH_EVERY_U *
          Math.ceil((bottomU - ROAD_NEAR_FROM_U) / ROAD_DASH_EVERY_U);
      for (
        let r = first;
        r < bottomU + ROAD_TAIL_DASHES_U;
        r += ROAD_DASH_EVERY_U
      )
        ground.add(
          scene.add
            .rectangle(x, roadPointY(frame, r), 1.4, 8, ROAD_DASH, 0.95)
            .setOrigin(0.5, 0),
        );
    }
    if (scenery.bridge) {
      // The stream runs on below the painted meadow.
      const bottomU = this.#roadUAt(scenery.bridge.localXU, bandsEnd);
      const x = scenery.bridge.localXU + this.#streamBend(bottomU);
      const half = roadHalfWidthU(bottomU, RIVER_HALF_U);
      for (const [grow, color] of [
        [5, STREAM_BANK],
        [0, STREAM_WATER],
        [-0.65 * half, STREAM_CURRENT],
      ] as const)
        ground.add(
          scene.add
            .rectangle(
              x - half - grow,
              bandsEnd - 1,
              2 * (half + grow),
              GROUND_DEPTH_U,
              color,
            )
            .setOrigin(0, 0),
        );
    }
    this.#objects.push(back, ground);
    if (scenery.bridge?.variant && scenery.bridge.variant !== 'stone')
      this.#objects.push(
        ...largeBridgeView(
          scene,
          art,
          scenery.bridge,
          {
            railY: (x) => -this.#railAt(x),
            meadowY: (x) => this.#meadowTop(x),
          },
          (paint, bounds) => this.#bake(paint, bounds, groundScale),
          depths.track,
          regionAt(seed, table.chunkIndex * 1024 + scenery.bridge.localXU)
            .season === 'winter',
        ),
      );
    if (!art) {
      // Baked too: without MSAA a live line would alias (D-013). A bridge
      // still carries the track over its valley.
      const bridge = scenery.bridge;
      this.#objects.push(
        this.#bake(
          (g) => {
            if (bridge && !bridge.variant)
              this.#paintPlainBridge(g, bridge.localXU);
            paintPlainTrack(g, table);
          },
          {
            left: -4,
            right: CHUNK_WIDTH_U + 4,
            top: -highRail - 8,
            bottom: -lowRail + 12 + VALLEY_DEPTH_U + TRACK_BED_DEPTH_U,
          },
          groundScale,
        ).setDepth(depths.track),
      );
      // The functional infrastructure works without its art (PWA-10).
      this.#addPlainInfrastructure(
        scene,
        table,
        seed,
        scenery,
        depths,
        electrified,
        groundScale,
      );
      return;
    }
    const nearAt = (x: number): NearGround =>
      scenery.near.find((span) => x >= span.fromX && x < span.toX)?.style ??
      'meadow';
    const track = scene.add.container(0, 0).setDepth(depths.track);
    for (const tile of trackTilePlacements(
      table,
      (x) => trackTileSets[nearAt(x)],
      TRACK_TILE_STEP_U,
    )) {
      const image = this.#image(scene, art, tile.part, false);
      image
        .setPosition(tile.x, tile.y)
        .setScale(1 / art.pxPerU)
        .setRotation(tile.rotation);
      track.add(image);
    }
    if (scenery.crossing) {
      // Crossing panels over the ballast, level with the rail head.
      const x = scenery.crossing.localXU;
      const deck = this.#image(scene, art, crossingParts.deck, false);
      deck
        .setPosition(x, -this.#railAt(x))
        .setScale(1 / art.pxPerU)
        .setRotation(
          Math.atan2(-(this.#railAt(x + 8) - this.#railAt(x - 8)), 16),
        );
      track.add(deck);
      this.#crossing = new CrossingView(
        scene,
        art,
        x,
        this.#crossingRoadFrame(x),
        {
          back: depths.backProps + 0.5,
          deck: depths.track + 0.5,
          near: depths.nearProps + 0.5,
        },
      );
    }
    if (scenery.bridge && !scenery.bridge.variant) {
      // The stone bridge over the stream, rail head on its deck; its far
      // railing behind the train.
      const x = scenery.bridge.localXU;
      const rotation = Math.atan2(
        -(this.#railAt(x + 16) - this.#railAt(x - 16)),
        32,
      );
      track.add(
        this.#image(scene, art, bridgeParts.bridge, false)
          .setPosition(x, -this.#railAt(x))
          .setScale(1 / art.pxPerU)
          .setRotation(rotation),
      );
      const railing = scene.add
        .container(0, 0)
        .setDepth(depths.track - 0.05)
        .add(
          this.#image(scene, art, bridgeParts.railing, false)
            .setPosition(x, -this.#railAt(x) - BRIDGE_RAILING_BEHIND_U)
            .setScale(1 / art.pxPerU)
            .setRotation(rotation),
        );
      this.#objects.push(railing);
    }
    if (scenery.tunnel)
      this.#addTunnel(
        scene,
        art,
        table,
        seed,
        scenery.tunnel,
        depths,
        electrified,
        (paint, bounds, compose) =>
          this.#bake(paint, bounds, groundScale, compose),
      );
    // The second track behind the main one, its tunnel mouths and portal
    // hills; the oncoming train is drawn between them (doc 04 §7).
    const secondary = chunkSecondaryTrack(scene, art, table, seed, {
      track: depths.backProps + SECONDARY_DEPTH.track,
      mouth: depths.backProps + SECONDARY_DEPTH.mouth,
      hill: depths.backProps + SECONDARY_DEPTH.hill,
    });
    this.#secondaryTrack = secondary[0];
    this.#secondaryPortals = secondary[2]?.length ?? 0;
    this.#objects.push(...secondary);
    if (electrified) {
      const catenary = chunkCatenary(scene, art, table, seed, {
        poles: depths.backProps + 0.6,
        wires: depths.wires,
      });
      this.#objects.push(...catenary.containers);
      this.#poles = catenary.poles;
    }
    this.#seasonal = new SeasonalSceneryView(
      scene,
      seed,
      table.chunkIndex * CHUNK_WIDTH_U,
      art.texture,
      art.pxPerU,
      parts,
    );
    const backProps = scene.add.container(0, 0).setDepth(depths.backProps);
    const nearProps = scene.add.container(0, 0).setDepth(depths.nearProps);
    const station = scenery.features.find((f) => f.kind === 'station');
    const stationReaction = station
      ? new StationReaction(
          station.fromXU,
          station.toXU,
          gameConfig.simulation.fixedHz,
          gameConfig.station.stopSpeedThresholdUPerSec,
          gameConfig.station.stopDetectionSeconds,
          gameConfig.station.sceneCooldownSeconds,
        )
      : undefined;
    // Each layer far to near; a nearer prop covers a farther one. Every child
    // (image, machine, bed, baked layer) carries this order as its depth, so
    // the deferred baked layers sort into place among the individual props.
    const paintOrder = (prop: SceneryProp) =>
      prop.layer === 'back' ? -prop.depth : prop.depth;
    const staticLayers = new Map<string, SceneryProp[]>();
    for (const prop of propDrawOrder(scenery.props)) {
      if (parts[prop.kind] === undefined) continue;
      if (waterMountainCompound(prop.kind)) {
        const scale = propScale(prop);
        const supports = cablewaySupportHeights(prop.xU, scale, (x) =>
          this.#railAt(x),
        );
        const view = new WaterMountainView(
          scene,
          prop,
          art.texture,
          art.pxPerU,
          effectiveClimateAt(seed, table.chunkIndex * 1024 + prop.xU).season,
          supports,
        );
        const foot = propFootU(
          prop,
          prop.xU,
          this.#railAt(prop.xU),
          prop.layer === 'near'
            ? bankHeightU(seed, table.chunkIndex * 1024 + prop.xU)
            : 0,
        );
        view.root
          .setPosition(foot.xU, foot.yU)
          .setScale(scale)
          .setDepth(paintOrder(prop));
        (prop.layer === 'back' ? backProps : nearProps).add(view.root);
        if (prop.layer === 'near') this.#near.push(...view.images);
        this.#waterMountains.push({ view, prop, foot });
        continue;
      }
      if (prop.work) {
        const view = new FarmForestView(
          scene,
          prop,
          art.texture,
          art.pxPerU,
          contextAt(seed, table.chunkIndex * 1024 + prop.xU).season,
          art.textureFor,
        );
        const root = view.root;
        const foot = propFootU(
          prop,
          prop.xU,
          this.#railAt(prop.xU),
          prop.layer === 'near'
            ? bankHeightU(seed, table.chunkIndex * 1024 + prop.xU)
            : 0,
        );
        root
          .setPosition(foot.xU, foot.yU)
          .setScale(propScale(prop))
          .setDepth(paintOrder(prop));
        (prop.layer === 'back' ? backProps : nearProps).add(root);
        if (prop.layer === 'near') this.#near.push(...view.images);
        for (const bed of view.beds) {
          const at = prop.xU + bed.offsetXU;
          const point = propFootU(
            prop,
            at,
            this.#railAt(at),
            prop.layer === 'near'
              ? bankHeightU(seed, table.chunkIndex * 1024 + at)
              : 0,
          );
          bed.root
            .setPosition(point.xU, point.yU)
            .setScale(propScale(prop))
            .setDepth(paintOrder(prop));
          (prop.layer === 'back' ? backProps : nearProps).add(bed.root);
        }
        this.#farm.push({ view, prop, foot });
        continue;
      }
      if (prop.clip) {
        if (prop.kind.startsWith('backdrop.') && !forestArt) continue;
        const key = `${prop.layer}:${prop.depth}`;
        const layer = staticLayers.get(key);
        if (layer) layer.push(prop);
        else staticLayers.set(key, [prop]);
        continue;
      }
      const source = prop.kind.startsWith('backdrop.') ? forestArt : art;
      if (!source) continue;
      const image = this.#image(
        scene,
        source,
        this.#seasonal.frame(prop.kind, prop.xU),
        prop.flip,
      ).setName(prop.id);
      image.setDepth(paintOrder(prop));
      this.#placeProp(image, prop, prop.xU, source.pxPerU);
      const parent = prop.layer === 'back' ? backProps : nearProps;
      parent.add(image);
      const authored: Readonly<
        Record<
          string,
          {
            widthU: number;
            attachmentsU?: readonly {
              part: string;
              atU: { x: number; y: number };
            }[];
          }
        >
      > = settlementArt;
      const attachments = authored[prop.kind]?.attachmentsU;
      const parentPart = parts[prop.kind];
      if (parentPart && attachments)
        for (const attachment of attachments) {
          const child = this.#image(scene, art, attachment.part, false);
          const scale = propScale(prop);
          child
            .setPosition(
              image.x + (attachment.atU.x - parentPart.pivotU.x) * scale,
              image.y + (attachment.atU.y - parentPart.pivotU.y) * scale,
            )
            .setScale(scale / art.pxPerU)
            .setDepth(image.depth + 0.00001);
          (prop.layer === 'back' ? backProps : nearProps).add(child);
          this.#seasonal.add(
            { ...prop, kind: attachment.part, flip: false },
            child,
            parent,
            prop.layer === 'back' ? depths.backProps : depths.nearProps,
          );
          if (
            attachment.part === 'back.playground-swing' ||
            attachment.part.includes('-arm')
          )
            this.#settlementMotion.push({
              image: child,
              kind: attachment.part,
              phase: prop.phase,
              winter: scenery.region.season === 'winter',
              reaction:
                prop.kind === 'back.dispatcher-wave' ||
                (prop.kind === 'back.passenger-a' &&
                  scenery.features.some(
                    (f) => f.kind === 'station' && f.toXU - f.fromXU === 480,
                  ))
                  ? stationReaction
                  : undefined,
            });
        }
      this.#seasonal.add(
        prop,
        image,
        parent,
        prop.layer === 'back' ? depths.backProps : depths.nearProps,
        scenery.water.some(
          (w) => w.kind === 'channel' && prop.dependencies?.includes(w.id),
        ),
      );
      if (prop.layer === 'near') this.#near.push(image);
      if (prop.motion) {
        const visual = roadVehicleArt[prop.kind]
          ? new RoadVehicleMotion(scene)
          : undefined;
        if (visual) {
          visual.graphics.setDepth(image.depth + 0.001);
          (prop.layer === 'back' ? backProps : nearProps).add(visual.graphics);
        }
        this.#moving.push({
          image,
          prop,
          visual,
          heading: { rotationRad: 0, flipX: prop.flip },
          velocityXUPerSec: 0,
          velocityYUPerSec: 0,
        });
      } else if (swayAmplitudeRad(prop.kind) > 0)
        this.#swaying.push({
          image,
          kind: prop.kind,
          phase: (hash32('sway', prop.id) % 1000) / 1000,
        });
    }
    for (const [layer, props] of staticLayers) {
      const first = props[0];
      if (!first) continue;
      this.#compositions.push(
        new VisibleComposition(
          () => {
            const { image, key } = bakeStaticComposition(
              scene,
              seed,
              table.chunkIndex,
              props,
              art,
              forestArt,
              groundScale,
              this.memory,
            );
            image.setName(`composition:${table.chunkIndex}:${layer}`);
            image.setDepth(paintOrder(first));
            const parent = first.layer === 'back' ? backProps : nearProps;
            parent.add(image);
            parent.sort('depth');
            return () => {
              image.destroy();
              const source = scene.textures.get(key).getSourceImage();
              scene.textures.remove(key);
              if (source instanceof HTMLCanvasElement)
                source.width = source.height = 1;
              this.memory.remove(`texture:${key}`);
            };
          },
          () =>
            props.flatMap((prop) => {
              const source = prop.kind.startsWith('backdrop.')
                ? forestArt
                : art;
              const texture =
                source?.textureFor?.(prop.kind) ?? source?.texture;
              return texture &&
                scene.textures.getFrame(texture, prop.kind)?.name === prop.kind
                ? []
                : [prop.kind];
            }),
        ),
      );
    }
    if (art)
      for (const fence of scenery.fences)
        this.#addFence(
          fence.layer === 'near' ? nearProps : backProps,
          fence,
          art,
        );
    // Stable sorts: equal depths keep propDrawOrder.
    backProps.sort('depth');
    nearProps.sort('depth');
    // Glints flash on the water, under the boats and reeds.
    for (const spot of this.#glintSpots) {
      const image = this.#image(scene, art, 'fx.glint', false);
      image
        .setPosition(spot.x, spot.y)
        .setScale(spot.sizeU / (parts['fx.glint']?.widthU ?? 10) / art.pxPerU)
        .setAlpha(0);
      backProps.addAt(image, 0);
      this.#glints.push({ image, phase: spot.phase });
      if (
        scenery.water.some(
          (w) => w.kind !== 'sea' && spot.x >= w.fromX && spot.x < w.toX,
        )
      )
        this.#seasonal.addWaterSource(
          `water:${table.chunkIndex}:${spot.x}`,
          spot.x,
          spot.y,
          depths.backProps,
        );
    }
    for (const parent of [backProps, nearProps]) {
      const bounds = parent.getBounds();
      // Reserve full moving-machine/arm reach; decorative culling never touches infrastructure.
      this.#decorativeGroups.push({
        object: parent,
        leftU: bounds.left - 320,
        rightU: bounds.right + 320,
      });
    }
    this.#objects.push(track, backProps, nearProps);
  }

  /** Near-meadow props, for the "never covers the train" check. */
  get nearProps(): readonly Phaser.GameObjects.Image[] {
    return [...this.#near, ...(this.#crossing?.nearImages ?? [])];
  }

  /** The chunk's tunnel, if any. */
  get tunnel(): TunnelView | undefined {
    return this.#tunnel;
  }

  /** Whether a level crossing is drawn here (with art or plain). */
  get hasCrossingView(): boolean {
    return this.#crossing !== undefined;
  }

  /** Whether a second track is actually drawn in this chunk. */
  get hasSecondaryTrackView(): boolean {
    return this.#secondaryTrack !== undefined;
  }

  /** Drawn portal hills of the second track (art or plain). */
  get secondaryPortalViews(): number {
    return this.#secondaryPortals;
  }

  /**
   * Crossing, tunnel, catenary and second track drawn plain if art failed
   * (PWA-10): the barriers still warn, the hill still clears over the
   * train and an electric journey keeps its wire (AGENTS.md).
   */
  #addPlainInfrastructure(
    scene: Phaser.Scene,
    table: ArcLengthTable,
    seed: number,
    scenery: ChunkScenery,
    depths: ChunkDepths,
    electrified: boolean,
    groundScale: number,
  ): void {
    const bake: Bake = (paint, bounds, compose) =>
      this.#bake(paint, bounds, groundScale, compose);
    if (scenery.crossing) {
      const x = scenery.crossing.localXU;
      this.#crossing = new CrossingFallbackView(
        scene,
        x,
        this.#crossingRoadFrame(x),
        {
          back: depths.backProps + 0.5,
          deck: depths.track + 0.5,
          near: depths.nearProps + 0.5,
        },
      );
    }
    if (scenery.tunnel)
      this.#addTunnel(
        scene,
        undefined,
        table,
        seed,
        scenery.tunnel,
        depths,
        electrified,
        bake,
      );
    const secondary = secondarySiteOfChunk(seed, table.chunkIndex);
    if (secondary) {
      const offsetU = gameConfig.world.secondaryTrackOffsetU;
      this.#secondaryTrack = bake(
        (g) => {
          // Chunk positioning resets containers; bake the offset inside.
          g.translateCanvas(0, -offsetU);
          paintPlainTrack(g, table);
        },
        {
          left: -4,
          right: CHUNK_WIDTH_U + 4,
          top: -Math.max(...table.ys) - offsetU - 4,
          bottom: -Math.min(...table.ys) - offsetU + 12,
        },
      ).setDepth(depths.backProps + SECONDARY_DEPTH.track);
      this.#objects.push(this.#secondaryTrack);
      const x0 = table.chunkIndex * CHUNK_WIDTH_U;
      for (const [worldX, mirrored] of [
        [secondary.fromX, false],
        [secondary.toX, true],
      ] as const) {
        if (
          mirrored
            ? worldX <= x0 || worldX > x0 + CHUNK_WIDTH_U
            : worldX < x0 || worldX >= x0 + CHUNK_WIDTH_U
        )
          continue;
        const x = worldX - x0;
        const y = -this.#railAt(x) - offsetU;
        const point = (dx: number, dy: number) =>
          new Phaser.Math.Vector2(x + (mirrored ? -dx : dx), y + dy);
        // Same pivot and open arch as the SVG portal; the hill covers
        // vehicles behind it while the dark mouth stays below the train.
        const arch: Phaser.Math.Vector2[] = [];
        for (let step = 0; step <= 12; step++) {
          const angle = (-Math.PI * step) / 12;
          arch.push(point(36 * Math.cos(angle), -68 + 36 * Math.sin(angle)));
        }
        this.#objects.push(
          bake(
            (g) => {
              g.fillStyle(0x24211e, 1);
              g.fillCircle(x, y - 68, 36);
              g.fillRect(x - 36, y - 68, 72, 74);
            },
            { left: x - 38, right: x + 38, top: y - 106, bottom: y + 8 },
          ).setDepth(depths.backProps + SECONDARY_DEPTH.mouth),
          bake(
            (g) => {
              g.fillStyle(0x6eae43, 1);
              g.fillPoints(
                [
                  point(-380, 6),
                  point(-350, -60),
                  point(-300, -130),
                  point(-230, -168),
                  point(-140, -174),
                  point(-60, -140),
                  point(58, -136),
                  point(60, 6),
                  point(36, 6),
                  ...arch,
                  point(-36, 6),
                ],
                true,
              );
              g.lineStyle(10, 0xb9ae94, 1);
              g.strokePoints([point(36, 6), ...arch, point(-36, 6)]);
            },
            {
              left: x - (mirrored ? 62 : 382),
              right: x + (mirrored ? 382 : 62),
              top: y - 176,
              bottom: y + 12,
            },
          ).setDepth(depths.backProps + SECONDARY_DEPTH.hill),
        );
        this.#secondaryPortals += 1;
      }
    }
    if (electrified) {
      const catenary = chunkCatenaryFallback(
        table,
        seed,
        { poles: depths.backProps + 0.6, wires: depths.wires },
        bake,
      );
      this.#objects.push(...catenary.containers);
      this.#poles = catenary.poles;
    }
  }

  /** A simple deck and abutments under the rails over the stream. */
  #paintPlainBridge(g: Phaser.GameObjects.Graphics, x: number): void {
    const top = -this.#railAt(x) + 3;
    const floor = this.#meadowTop(x);
    g.fillStyle(0xb9ae94, 1);
    g.fillRect(x - BRIDGE_HALF_U, top, 2 * BRIDGE_HALF_U, 10);
    g.fillRect(x - BRIDGE_HALF_U, top, 14, floor - top);
    g.fillRect(x + BRIDGE_HALF_U - 14, top, 14, floor - top);
  }

  #addTunnel(
    scene: Phaser.Scene,
    art: ChunkArt | undefined,
    table: ArcLengthTable,
    seed: number,
    site: TunnelSite,
    depths: ChunkDepths,
    electrified: boolean,
    bake: Bake,
  ): void {
    // An electric journey's wire hangs from the tunnel's ceiling there.
    const x0 = table.chunkIndex * CHUNK_WIDTH_U;
    const hangerXs = electrified
      ? catenaryPoleXs(
          seed,
          x0 + Math.max(-2, site.fromX - TUNNEL_MAST_CLEARANCE_U),
          x0 + Math.min(1026, site.toX + TUNNEL_MAST_CLEARANCE_U),
        )
          .filter((x) => catenarySupport(seed, x) === 'hanger')
          .map((x) => x - x0)
      : [];
    this.#tunnel = new TunnelView(
      scene,
      art,
      site,
      {
        railY: (x) => (site.rock ? -railYUpU(seed, x0 + x) : -this.#railAt(x)),
        meadowY: (x) =>
          site.rock
            ? -railYUpU(seed, x0 + x) +
              TRACK_BED_DEPTH_U +
              bankHeightU(seed, x0 + x)
            : this.#meadowTop(x),
      },
      bake,
      {
        // In front of the second track's hills, behind the masts.
        flanks: depths.backProps + 0.5,
        interior: depths.backProps + 0.55,
        shade: depths.train + 0.05,
        cover: depths.train + 0.6,
      },
      hangerXs,
      seed,
      {
        climateAt: (x) =>
          effectiveClimateAt(seed, table.chunkIndex * CHUNK_WIDTH_U + x),
        sandAt: (x) =>
          ['coast', 'dunes'].includes(
            transitionAt(seed, table.chunkIndex * CHUNK_WIDTH_U + x).from
              .landscape,
          ),
      },
    );
    this.#objects.push(...this.#tunnel.containers);
  }

  get waterMountainDiagnostics() {
    return [
      ...(this.#seasonal?.watermillDiagnostics ?? []),
      ...this.#waterMountains.map(({ view }) => ({
        ...view.diagnostic,
        xU: view.root.x + this.#table.chunkIndex * 1024,
      })),
    ];
  }
  get farmDiagnostics() {
    return this.#farm.map(({ view, prop }) => ({
      ...view.diagnostic,
      xU: view.root.x + this.#table.chunkIndex * 1024,
      layer: prop.layer,
    }));
  }
  /** Actual animated decorative view objects; no simulation or RNG work. */
  get animatedObjectCount(): number {
    return this.#animatedLastFrame;
  }

  /** Catenary masts of this chunk (0 unless the journey is electric). */
  get catenaryPoles(): number {
    return this.#poles;
  }

  setX(x: number): void {
    for (const object of this.#objects) object.setPosition(x, 0);
    this.#crossing?.setX(x);
  }

  /** Chunk-local viewport; composed art is clipped to this chunk and owns pixels only while visible. */
  get missingCompositionFrames(): readonly string[] {
    return this.#compositions.flatMap(
      (composition) => composition.missingFrames,
    );
  }

  setVisibleRange(leftU: number, rightU: number): void {
    for (const composition of this.#compositions)
      composition.setVisible(rightU >= 0 && leftU <= CHUNK_WIDTH_U);
    for (const group of this.#decorativeGroups)
      group.object.setVisible(group.rightU >= leftU && group.leftU <= rightU);
  }

  /**
   * Moves patrolling props (tractor, car, boats) to simulation time and
   * shows the chunk's crossing as the simulation holds it.
   */
  /** `motion` scales the decorative sway and glints (doc 07 §9). */
  get seasonalSources() {
    return this.#seasonal?.sources ?? [];
  }
  update(
    timeSec: number,
    crossing?: CrossingState,
    motion = 1,
    frontXU = Infinity,
    animationBudget = Infinity,
    view = { left: -Infinity, right: Infinity },
    stage: 'all' | 'life' | 'decoration' = 'all',
    headXU = frontXU,
    speedUPerSec = 0,
    arrows = false,
  ): number {
    let remaining = Math.max(0, animationBudget);
    const before = stage === 'decoration' ? this.#animatedLastFrame : 0;
    if (stage !== 'decoration') {
      this.#tunnel?.advanceCover(timeSec);
      this.#animatedLastFrame = 0;
      if (this.#crossing instanceof CrossingView)
        this.#crossing.update(crossing, timeSec, motion, arrows);
      else this.#crossing?.update(crossing, timeSec);
      const life =
        this.#seasonal?.update(timeSec, motion, frontXU, remaining, view) ?? 0;
      this.#animatedLastFrame += life;
      remaining -= life;
    }
    if (stage === 'life') return this.#animatedLastFrame;
    const dt =
      this.#lastDecorationSec === undefined
        ? 0
        : Math.min(0.1, Math.max(0, timeSec - this.#lastDecorationSec));
    this.#lastDecorationSec = timeSec;
    const visible = (image: Phaser.GameObjects.Image) =>
      image.x >= view.left - 60 && image.x <= view.right + 60;
    const clock = (image: Phaser.GameObjects.Image) => {
      const t = (this.#animationTimes.get(image) ?? 0) + dt;
      this.#animationTimes.set(image, t);
      return t;
    };
    for (const moving of this.#moving) {
      const { image, prop, visual, heading } = moving;
      if (!prop.roadPath && (!visible(image) || remaining <= 0)) continue;
      const patrolTimeSec = prop.roadPath ? timeSec : clock(image);
      const patrol = prop.motion;
      if (!patrol) continue;
      // Triangle wave over the patrol range, one leg per range length.
      const legs =
        (patrolTimeSec * patrol.speedUPerSec) / patrol.rangeU + 2 * prop.phase;
      const t = legs - 2 * Math.floor(legs / 2);
      const forward = t < 1;
      const offset = (forward ? t : 2 - t) * patrol.rangeU - patrol.rangeU / 2;
      const x = Math.max(0, Math.min(CHUNK_WIDTH_U, prop.xU + offset));
      this.#placeProp(image, prop, x);
      if ((prop.roadPath && !visible(image)) || remaining-- <= 0) {
        visual?.graphics.clear();
        continue;
      }
      this.#animatedLastFrame++;
      const speed = (forward ? 1 : -1) * patrol.speedUPerSec;
      const asset = roadVehicleArt[prop.kind];
      if (!asset) {
        image.setFlipX(!forward);
        continue;
      }
      let tangentX = 1;
      let tangentY: number;
      if (prop.roadPath) {
        const wx = this.#table.chunkIndex * CHUNK_WIDTH_U + x;
        roadPositionAt(
          prop.roadPath,
          wx - 1,
          prop.laneDirection ?? 1,
          this.#roadBefore,
        );
        roadPositionAt(
          prop.roadPath,
          wx + 1,
          prop.laneDirection ?? 1,
          this.#roadAfter,
        );
        tangentX = (this.#roadAfter.xU - this.#roadBefore.xU) / 2;
        tangentY = (this.#roadAfter.yU - this.#roadBefore.yU) / 2;
      } else {
        const wx = this.#table.chunkIndex * CHUNK_WIDTH_U;
        tangentY = (this.#railAt(x - 1) - this.#railAt(x + 1)) / 2;
        if (prop.layer === 'near')
          tangentY +=
            (bankHeightU(this.#seed, wx + x + 1) -
              bankHeightU(this.#seed, wx + x - 1)) /
            2;
      }
      moving.velocityXUPerSec = speed * tangentX;
      moving.velocityYUPerSec = speed * tangentY;
      vehicleHeading(
        asset.front,
        moving.velocityXUPerSec,
        moving.velocityYUPerSec,
        heading,
      );
      image.setFlipX(heading.flipX).setRotation(heading.rotationRad);
      const part = parts[prop.kind];
      if (visual && part)
        visual.update(
          image,
          part,
          asset,
          moving.velocityXUPerSec,
          moving.velocityYUPerSec,
          timeSec,
          motion,
          arrows,
          this.#pxPerU,
        );
    }
    for (const actor of this.#waterMountains) {
      const { view: compound, prop, foot } = actor;
      if (
        compound.root.parentContainer?.visible === false ||
        compound.root.x < view.left - 320 ||
        compound.root.x > view.right + 320
      )
        continue;
      if (remaining-- <= 0) continue;
      this.#animatedLastFrame++;
      const localTime = (actor.timeSec ?? timeSec - dt) + dt;
      actor.timeSec = localTime;
      compound.update(localTime);
      if (prop.motion) {
        const x = prop.xU + (compound.pose.ratio - 0.5) * prop.motion.rangeU;
        propFootU(prop, x, this.#railAt(x), 0, foot);
        compound.root.setPosition(foot.xU, foot.yU);
      }
    }
    for (const farm of this.#farm) {
      const { view: machine, prop, foot: target } = farm;
      if (
        machine.root.parentContainer?.visible === false ||
        machine.root.x < view.left - 320 ||
        machine.root.x > view.right + 320
      )
        continue;
      if (remaining-- <= 0) continue;
      this.#animatedLastFrame++;
      const localTime = (farm.timeSec ?? timeSec - dt) + dt;
      farm.timeSec = localTime;
      machine.update(localTime);
      const x =
        prop.xU + farmPatrolOffsetU(prop, localTime, machine.patrolRatio);
      const foot = propFootU(
        prop,
        x,
        this.#railAt(x),
        prop.layer === 'near'
          ? bankHeightU(this.#seed, this.#table.chunkIndex * 1024 + x)
          : 0,
        target,
      );
      machine.root.setPosition(foot.xU, foot.yU);
    }
    for (const view of this.#settlementMotion) {
      const age = view.reaction?.step(
        Math.round(timeSec * gameConfig.simulation.fixedHz),
        headXU,
        speedUPerSec,
      );
      if (!visible(view.image) || remaining-- <= 0) continue;
      this.#animatedLastFrame++;
      view.image.setRotation(
        settlementAttachmentAngle(
          view.kind,
          age ?? clock(view.image),
          age === undefined ? view.phase : 0,
          view.winter,
          age !== undefined,
          motion,
        ),
      );
    }
    // Grass, flowers and branches in the wind; glints on the water.
    for (const { image, kind, phase } of this.#swaying) {
      if (!visible(image)) continue;
      if (remaining-- <= 0) break;
      this.#animatedLastFrame++;
      const localTime = clock(image);
      image.setRotation(
        swayAngle(kind, localTime, phase, motion) *
          (windAt(this.#seed, timeSec) / 12),
      );
    }
    for (const { image, phase } of this.#glints) {
      if (!visible(image)) continue;
      if (remaining-- <= 0) {
        image.setAlpha(0);
        continue;
      }
      this.#animatedLastFrame++;
      image.setAlpha(glintAlpha(clock(image), phase, motion));
    }
    return this.#animatedLastFrame - before;
  }

  get roadVehicles(): RoadVehicleSnapshot[] {
    const x0 = this.#table.chunkIndex * CHUNK_WIDTH_U;
    const result = this.#moving.flatMap(
      ({ image, prop, visual, velocityXUPerSec, velocityYUPerSec }) =>
        visual
          ? [
              {
                id: prop.id,
                kind: prop.kind,
                roadKind: prop.roadPath?.id.includes(':highway')
                  ? 'highway'
                  : prop.roadPath
                    ? 'parallel-road'
                    : prop.kind === 'back.car'
                      ? 'village-road'
                      : 'scenery',
                worldXU: x0 + image.x,
                worldYU: image.y,
                velocityXUPerSec,
                velocityYUPerSec,
                frontX: visual.frontX,
                frontY: visual.frontY,
                parentScaleX: image.parentContainer?.scaleX ?? 1,
                wheelAngleRad: visual.wheelAngleRad,
                exhaust: visual.exhaust,
                arrows: visual.arrows,
              },
            ]
          : [],
    );
    if (this.#crossing instanceof CrossingView)
      result.push(...this.#crossing.roadVehicles(x0));
    return result;
  }

  destroy(): void {
    this.#crossing?.destroy();
    this.#crossing = undefined;
    this.#tunnel = undefined;
    this.#compositions.forEach((composition) => composition.destroy());
    this.#compositions.length = 0;
    this.#decorativeGroups.length = 0;
    this.#seasonal = undefined;
    for (const object of this.#objects) object.destroy();
    this.#objects.length = 0;
    for (const key of this.#textures) {
      const source = this.#scene.textures.get(key).getSourceImage();
      this.#scene.textures.remove(key);
      if (source instanceof HTMLCanvasElement) {
        source.width = 1;
        source.height = 1;
      }
      this.memory.remove(`texture:${key}`);
    }
    this.#textures.length = 0;
    this.#moving.length = 0;
    this.#farm.length = 0;
    this.#settlementMotion.length = 0;
    this.#waterMountains.length = 0;
    this.#near.length = 0;
    this.#swaying.length = 0;
    this.#glints.length = 0;
    this.#glintSpots.length = 0;
  }

  /**
   * Paints with Graphics once into a canvas texture covering `bounds`
   * (chunk-local u) at `scale` px per u; returns a container holding it.
   */
  #bake(
    paint: (g: Phaser.GameObjects.Graphics) => void,
    bounds: { left: number; top: number; right: number; bottom: number },
    scale: number,
    compose?: Parameters<Bake>[2],
  ): Phaser.GameObjects.Container {
    const scene = this.#scene;
    const g = scene.make.graphics({}, false);
    g.translateCanvas(-bounds.left, -bounds.top);
    paint(g);
    g.setScale(scale);
    bakedSerial += 1;
    const key = `ground:${this.#table.chunkIndex}:${bakedSerial}`;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil((bounds.right - bounds.left) * scale));
    canvas.height = Math.max(
      1,
      Math.ceil((bounds.bottom - bounds.top) * scale),
    );
    this.memory.set(`canvas:${key}`, {
      canvas: canvas.width * canvas.height * 4,
    });
    try {
      g.generateTexture(canvas, canvas.width, canvas.height);
      compose?.(canvas, this.memory, key);
      immutableTexture(scene, key, canvas, this.memory);
    } catch (error) {
      canvas.width = canvas.height = 1;
      throw error;
    } finally {
      g.destroy();
      this.memory.remove(`canvas:${key}`);
    }
    this.#textures.push(key);
    const image = scene.add
      .image(bounds.left, bounds.top, key)
      .setOrigin(0, 0)
      .setScale(1 / scale);
    return scene.add.container(0, 0, [image]);
  }

  #image(
    scene: Phaser.Scene,
    art: ChunkArt,
    key: string,
    flip: boolean,
  ): Phaser.GameObjects.Image {
    const part = parts[key];
    const image = scene.add
      .image(0, 0, frameTexture(key, art.texture), key)
      .setData('world-part', key)
      .setFlipX(flip);
    if (part) {
      setWorldPivot(
        image,
        flip
          ? { x: part.widthU - part.pivotU.x, y: part.pivotU.y }
          : part.pivotU,
        art.pxPerU,
      );
    }
    return image;
  }

  #addFence(
    container: Phaser.GameObjects.Container,
    fence: FenceFeature,
    art: ChunkArt,
  ): void {
    const x0 = this.#table.chunkIndex * CHUNK_WIDTH_U,
      to = x0 + CHUNK_WIDTH_U,
      parts = FENCE_PARTS[fence.style];
    for (const [i, p] of fence.posts.entries()) {
      const end = !fence.closed && i === fence.posts.length - 1;
      const owner = Math.floor((p.xU - (end ? 1e-7 : 0)) / CHUNK_WIDTH_U);
      if (owner === this.#table.chunkIndex) {
        const image = this.#image(this.#scene, art, parts.post, false).setDepth(
          -fence.depth,
        );
        image
          .setName(
            `${fenceChildId(fence, 'post', i)}:fragment:${this.#table.chunkIndex}`,
          )
          .setPosition(p.xU - x0, p.yU)
          .setScale(1 / art.pxPerU);
        container.add(image);
      }
      const next =
        fence.posts[i + 1] ?? (fence.closed ? fence.posts[0] : undefined);
      if (!next || p.xU < x0 || p.xU >= to) continue;
      const key = i === fence.gatePanel ? parts.gate : parts.panel;
      const image = this.#image(this.#scene, art, key, false).setDepth(
          -fence.depth,
        ),
        part = worldParts[key];
      const length = Math.hypot(next.xU - p.xU, next.yU - p.yU);
      image
        .setName(
          `${fenceChildId(fence, i === fence.gatePanel ? 'gate' : 'panel', i)}:fragment:${this.#table.chunkIndex}`,
        )
        .setPosition((p.xU + next.xU) / 2 - x0, (p.yU + next.yU) / 2)
        // Both sides of a closed plot keep the pickets upright.
        .setRotation(
          Math.atan2(
            (next.yU - p.yU) * (next.xU < p.xU ? -1 : 1),
            Math.abs(next.xU - p.xU),
          ),
        )
        .setScale(length / part.widthU / art.pxPerU, 1 / art.pxPerU);
      container.add(image);
    }
  }

  #placeProp(
    image: Phaser.GameObjects.Image,
    prop: SceneryProp,
    x: number,
    pxPerU = this.#pxPerU,
  ): void {
    if (prop.roadPath) {
      const x0 = this.#table.chunkIndex * CHUNK_WIDTH_U;
      roadPositionAt(
        prop.roadPath,
        x0 + x,
        prop.laneDirection ?? 1,
        this.#roadSample,
      );
      image
        .setPosition(this.#roadSample.xU - x0, this.#roadSample.yU)
        .setScale(propScale(prop) / this.#pxPerU);
      return;
    }
    const foot = propFootU(
      prop,
      x,
      this.#railAt(x),
      prop.layer === 'near'
        ? bankHeightU(this.#seed, (this.#table.xs[0] ?? 0) + x)
        : 0,
    );
    image
      .setPosition(foot.xU, foot.yU)
      .setScale(propScale(prop) / pxPerU)
      .setRotation(prop.rotationRad ?? 0);
  }

  /** Rail height (world, up) at a chunk-local x. */
  #railAt(x: number): number {
    const xs = this.#table.xs;
    const x0 = xs[0] ?? 0;
    const spacing = (xs[1] ?? x0 + 1) - x0;
    const i = Math.max(0, Math.min(xs.length - 2, Math.floor(x / spacing)));
    const t = (x - i * spacing) / spacing;
    const a = this.#table.ys[i] ?? 0;
    return a + ((this.#table.ys[i + 1] ?? a) - a) * t;
  }

  /** Render y of the meadow below the embankment at a chunk-local x. */
  #meadowTop(x: number): number {
    const x0 = this.#table.xs[0] ?? 0;
    return (
      -this.#railAt(x) + TRACK_BED_DEPTH_U + bankHeightU(this.#seed, x0 + x)
    );
  }

  /** Coarse sample positions inside [fromX, toX], ends included. */
  #samples(fromX: number, toX: number): number[] {
    const spacing = GROUND_SAMPLE_STRIDE * gameConfig.world.arcSampleSpacingU;
    const xs = [fromX];
    for (let x = Math.ceil(fromX / spacing) * spacing; x < toX; x += spacing)
      if (x > fromX) xs.push(x);
    xs.push(toX);
    return xs;
  }

  /** Polygon between two lines over a span, reaching into its neighbour. */
  #band(
    fromX: number,
    toX: number,
    top: (x: number) => number,
    bottom: (x: number) => number,
  ): Phaser.Math.Vector2[] {
    // Spans reach into their right neighbour, so no seam column opens.
    const end = toX + GROUND_OVERLAP_U;
    const xs = this.#samples(fromX, toX);
    const line = (y: (x: number) => number) => [
      ...xs.map((x) => new Phaser.Math.Vector2(x, y(x))),
      new Phaser.Math.Vector2(end, y(toX)),
    ];
    return [...line(top), ...line(bottom).reverse()];
  }

  #paintNear(
    g: Phaser.GameObjects.Graphics,
    span: GroundSpan<NearGround>,
    bandsEnd: number,
  ): void {
    const x0 = this.#table.xs[0] ?? 0;
    for (const strip of nearGroundRuns(
      this.#seed,
      x0 + span.fromX,
      x0 + span.toX,
      span.style,
    ))
      this.#paintNearBands(
        g,
        strip.palette,
        strip.fromXU - x0,
        strip.toXU - x0,
        bandsEnd,
      );
  }

  /** Embankment face and meadow bands of a palette over [fromX, toX]. */
  #paintNearBands(
    g: Phaser.GameObjects.Graphics,
    palette: NearPalette,
    fromX: number,
    toX: number,
    bandsEnd: number,
  ): void {
    const rail = (x: number) => -this.#railAt(x);
    const meadow = (x: number) => this.#meadowTop(x);
    // Embankment face from under the track tiles down to the meadow.
    g.fillStyle(palette.bank, 1);
    g.fillPoints(
      this.#band(
        fromX,
        toX,
        (x) => rail(x) + TRACK_BED_DEPTH_U - 2,
        (x) => meadow(x) + 1,
      ),
      true,
    );
    // Meadow in bands that darken towards the viewer.
    palette.bands.forEach((stripe, n) => {
      const next = palette.bands[n + 1];
      g.fillStyle(stripe.color, 1);
      g.fillPoints(
        this.#band(
          fromX,
          toX,
          (x) => meadow(x) + stripe.fromU,
          (x) => (next ? meadow(x) + next.fromU + 1 : bandsEnd + 2),
        ),
        true,
      );
    });
  }

  /** Soft shadow where the bank meets the meadow. */
  #paintNearSurface(
    g: Phaser.GameObjects.Graphics,
    surface: import('../domain/world/Reservations.ts').Reservation,
    drawnEdge: boolean,
    extent?: import('../domain/world/Reservations.ts').FeatureExtent,
  ): void {
    if (surface.purpose === 'forest-floor' && drawnEdge) return;
    const x0 = this.#table.xs[0] ?? 0;
    const points = surface.polygon.map(
      (p) => new Phaser.Math.Vector2(p.xU - x0, p.yU),
    );
    const winter =
      contextAt(this.#seed, (surface.polygon[0]?.xU ?? 0) + 256).season ===
      'winter';
    g.fillStyle(
      winter ? 0xe3edf2 : surface.purpose === 'field' ? 0x83b94f : 0x6c8043,
      1,
    );
    if (winter || surface.purpose !== 'field') g.fillPoints(points, true);
    const half = points.length / 2;
    const upper = points.slice(0, half),
      lower = points.slice(half).reverse();
    if (!drawnEdge && !winter) {
      // Preserve world-core's rounded fallback when the art atlas is unavailable.
      g.lineStyle(12, 0x75954f, 0.45);
      g.strokePoints(upper, false, false);
      g.strokePoints(lower, false, false);
      for (const t of surface.purpose === 'field'
        ? [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]
        : [0.1, 0.45, 0.8]) {
        g.lineStyle(
          surface.purpose === 'field' ? 1.4 : 3,
          surface.purpose === 'field' ? 0x928248 : 0x527239,
          0.65,
        );
        const row = upper
          .map(
            (p, i) =>
              new Phaser.Math.Vector2(
                p.x,
                p.y + ((lower[i]?.y ?? p.y) - p.y) * t,
              ),
          )
          .filter(
            (p) =>
              extent !== undefined &&
              p.x + x0 >= extent.fromXU + 160 &&
              p.x + x0 <= extent.toXU - 160,
          );
        if (row.length >= 2) g.strokePoints(row, false, false);
      }
    }
    if (surface.purpose === 'field' && !winter) {
      const row = (t: number) =>
        upper.map(
          (p, i) =>
            new Phaser.Math.Vector2(
              p.x,
              p.y + ((lower[i]?.y ?? p.y) - p.y) * t,
            ),
        );
      // A worked strip follows the shared support; crop rows leave its headland free.
      const leftEnd =
        extent && Math.abs((upper[0]?.x ?? 0) + x0 - extent.fromXU) < 1;
      const rightEnd =
        extent && Math.abs((upper.at(-1)?.x ?? 0) + x0 - extent.toXU) < 1;
      const from = leftEnd ? 10 : 0,
        to = rightEnd ? upper.length - 10 : upper.length;
      g.fillStyle(0xb6a563, 0.55).fillPoints(
        [...row(0.26).slice(from, to), ...row(0.44).slice(from, to).reverse()],
        true,
      );
      for (let i = 12; i < upper.length - 12; i += 3) {
        const a = upper[i],
          b = lower[i];
        if (!a || !b) continue;
        g.lineStyle(1, 0x9b9158, 0.35).lineBetween(
          a.x,
          a.y + (b.y - a.y) * 0.45,
          b.x,
          a.y + (b.y - a.y) * 0.94,
        );
      }
      const headland = (from: number, to: number) => {
        g.fillStyle(0xb6a563, 0.22).fillPoints(
          [
            ...row(0.16).slice(from, to),
            ...row(0.93).slice(from, to).reverse(),
          ],
          true,
        );
      };
      if (leftEnd) headland(10, 16);
      if (rightEnd)
        headland(Math.max(16, upper.length - 16), upper.length - 10);
      // Stroke longitudinal edges only; chunk cuts are not field boundaries.
      g.lineStyle(10, 0x83b94f, 0.3);
      g.strokePoints(upper, false, false);
      g.strokePoints(lower, false, false);
    }
    if (surface.purpose === 'forest-floor' && !drawnEdge) {
      // A low irregular edge below the train; adult crowns stay behind it.
      const edge = upper.map(
        (p, i) =>
          new Phaser.Math.Vector2(
            p.x,
            Math.max(
              -this.#railAt(p.x) + 26,
              p.y -
                Math.min(1, Math.max(0, (lower[i]?.y ?? p.y) - p.y) / 48) *
                  (24 +
                    ((hash32('forest-edge', this.#seed, Math.round(x0 + p.x)) %
                      100) /
                      100) *
                      16),
            ),
          ),
      );
      g.fillStyle(
        mixColour(
          0x4b7436,
          0xb39355,
          effectiveClimateAt(this.#seed, x0 + (upper[0]?.x ?? 0)).autumn * 0.7,
        ),
        0.9,
      );
      g.fillPoints([...edge, ...upper.slice().reverse()], true);
    }
  }

  #paintNearShade(
    g: Phaser.GameObjects.Graphics,
    span: GroundSpan<NearGround>,
  ): void {
    g.lineStyle(
      1.6,
      spatialNearPalette(
        this.#seed,
        (this.#table.xs[0] ?? 0) + (span.fromX + span.toX) / 2,
        span.style,
      ).bankShade,
      0.7,
    );
    g.strokePoints(
      this.#samples(span.fromX, span.toX).map(
        (x) => new Phaser.Math.Vector2(x, this.#meadowTop(x)),
      ),
      false,
      false,
    );
  }

  /**
   * Field edges recede towards the horizon instead of standing upright:
   * a boundary at world x leans by a seeded amount, the same for both
   * chunks that share it (chunk edges included).
   */
  #lean(localX: number): number {
    const worldX = Math.round((this.#table.xs[0] ?? 0) + localX);
    return (
      ((hash32('field-edge', this.#seed, worldX) % 1000) / 1000 - 0.5) *
      2 *
      FIELD_EDGE_LEAN_U
    );
  }

  #paintBack(
    g: Phaser.GameObjects.Graphics,
    span: GroundSpan<BackGround>,
  ): void {
    const palette = spatialBackPalette(
      this.#seed,
      (this.#table.xs[0] ?? 0) + (span.fromX + span.toX) / 2,
      span.style,
    );
    const rail = (x: number) => -this.#railAt(x);
    const depthY = (x: number, depth: number) => rail(x) - depth * BACK_PLANE_U;
    const leanLeft = this.#lean(span.fromX);
    const leanRight = this.#lean(span.toX);
    /** Edge x at a depth: leaning back from the near end. */
    const leftAt = (depth: number) => span.fromX + leanLeft * (2 * depth - 1);
    const rightAt = (depth: number) =>
      span.toX + leanRight * (2 * depth - 1) + GROUND_OVERLAP_U;
    const bandPolygon = (near: number, far: number, below = 0) => {
      const line = (depth: number, dy: number) =>
        this.#samples(leftAt(depth), rightAt(depth)).map((x) => ({
          xU: x,
          yU: depthY(x, depth) + dy,
        }));
      return [...line(far, 0), ...line(near, below).reverse()];
    };
    const fullBase = bandPolygon(0, 1, 4),
      fullEdge = bandPolygon(0.968, 1);
    // Equal colours share a path; technical edges still sample the same world field.
    const strips: { from: number; to: number; base: number; edge: number }[] =
      [];
    for (
      let from = span.fromX - FIELD_EDGE_LEAN_U;
      from < span.toX + FIELD_EDGE_LEAN_U + GROUND_OVERLAP_U;
      from += 16
    ) {
      const to = Math.min(
        span.toX + FIELD_EDGE_LEAN_U + GROUND_OVERLAP_U,
        from + 16,
      );
      const at = spatialBackPalette(
        this.#seed,
        (this.#table.xs[0] ?? 0) + (from + to) / 2,
        span.style,
        this.#table.xs[0] ?? 0,
      );
      const previous = strips.at(-1);
      if (previous && previous.base === at.base && previous.edge === at.edge)
        previous.to = to;
      else strips.push({ from, to, base: at.base, edge: at.edge });
    }
    for (const { from, to, base, edge } of strips) {
      const basePolygon = clipPolygonX(fullBase, from, to + 1).map(
        (p) => new Phaser.Math.Vector2(p.xU, p.yU),
      );
      const edgePolygon = clipPolygonX(fullEdge, from, to + 1).map(
        (p) => new Phaser.Math.Vector2(p.xU, p.yU),
      );
      g.fillStyle(base, 1);
      if (basePolygon.length >= 3) g.fillPoints(basePolygon, true);
      g.fillStyle(edge, 1);
      if (edgePolygon.length >= 3) g.fillPoints(edgePolygon, true);
    }
    // Soft patches, flatter towards the horizon (fewer on fields).
    const chunk = this.#table.chunkIndex;
    const patches = palette.rows === undefined ? 7 : 3;
    for (let i = 0; i < patches; i++) {
      const h = sceneryDecorationHash('ground-patch', chunk, span.fromX, i);
      const depth = 0.1 + ((h % 1000) / 1000) * 0.8;
      const x =
        leftAt(depth) +
        (((h >>> 10) % 1000) / 1000) * (rightAt(depth) - leftAt(depth));
      const width = (50 + ((h >>> 20) % 90)) * (1 - 0.5 * depth);
      if (x - width < leftAt(depth) || x + width > rightAt(depth)) continue;
      g.fillStyle(
        palette.patches[i % palette.patches.length] ?? palette.base,
        0.7,
      );
      g.fillEllipse(
        x,
        depthY(x, depth),
        width * 2,
        width * 0.22 * (1 - 0.5 * depth),
      );
    }
    if (palette.rows !== undefined) {
      // Crop rows, closer together and thinner towards the horizon.
      for (const depth of [0.12, 0.27, 0.42, 0.56, 0.69, 0.8, 0.9]) {
        const end = rightAt(depth) - GROUND_OVERLAP_U;
        const x0 = this.#table.xs[0] ?? 0;
        const startTransition = transitionAt(this.#seed, x0 + leftAt(depth)),
          endTransition = transitionAt(this.#seed, x0 + end);
        if (
          startTransition.progress === 0 &&
          endTransition.progress === 0 &&
          startTransition.from.id === endTransition.from.id
        ) {
          g.lineStyle(3.2 - 2.4 * depth, palette.rows, 1);
          g.strokePoints(
            this.#samples(leftAt(depth), end).map(
              (x) => new Phaser.Math.Vector2(x, depthY(x, depth)),
            ),
            false,
            false,
          );
          continue;
        }
        for (let from = leftAt(depth); from < end; from += 16) {
          const to = Math.min(end, from + 16),
            worldX = (this.#table.xs[0] ?? 0) + (from + to) / 2;
          const color = spatialBackPalette(this.#seed, worldX, span.style).rows;
          if (color === undefined) continue;
          g.lineStyle(
            3.2 - 2.4 * depth,
            color,
            1 - transitionAt(this.#seed, worldX).progress,
          );
          g.strokePoints(
            [
              new Phaser.Math.Vector2(from, depthY(from, depth)),
              new Phaser.Math.Vector2(to, depthY(to, depth)),
            ],
            false,
            false,
          );
        }
      }
    }
  }

  /**
   * A village road under a patrolling car: level along its patrol at the
   * car's depth, curving away to the horizon at both ends and narrower
   * with distance; asphalt with a dashed middle line.
   */
  #paintRoad(
    g: Phaser.GameObjects.Graphics,
    road: RoadPath,
    shoulderOnly: boolean,
  ): void {
    if (road.drawingPoints) road = { ...road, points: road.drawingPoints };
    const x0 = this.#table.chunkIndex * CHUNK_WIDTH_U;
    const from = road.fromXU - x0,
      to = road.toXU - x0;
    const points = road.points.map((p) => ({ x: p.xU - x0, y: p.yU }));
    const mouths: PointU[][] = [];
    const crossing = this.#scenery.crossing;
    if (crossing) {
      const x = crossing.localXU,
        frame = this.#crossingRoadFrame(x);
      const edge = (sign: number) =>
        [ROAD_FAR_END_U, -ROAD_CONFLICT_U, 0].map((r) => ({
          xU: x + sign * roadHalfWidthU(r),
          yU: roadPointY(frame, r, sign * roadHalfWidthU(r)),
        }));
      mouths.push([...edge(-1), ...edge(1).reverse()]);
    }
    const side = (sign: number, grow = 0) =>
      roadSide(road, sign, grow).map(
        (p) => new Phaser.Math.Vector2(p.xU - x0, p.yU),
      );
    const groundDistanceU = (p: { x: number; y: number }) =>
      p.y + this.#railAt(p.x) + BACK_PLANE_U;
    // Clip to the local terrain horizon, not the baked texture's rectangular top.
    const clip = (polygon: Phaser.Math.Vector2[]) => {
      const visible: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length];
        if (!a || !b) continue;
        const da = groundDistanceU(a),
          db = groundDistanceU(b);
        if (da >= 0) visible.push(a);
        if (da >= 0 !== db >= 0) {
          const t = da / (da - db),
            x = a.x + t * (b.x - a.x);
          visible.push(
            new Phaser.Math.Vector2(x, -this.#railAt(x) - BACK_PLANE_U),
          );
        }
      }
      return visible;
    };
    const strip = (grow: number) =>
      clip([...side(-1, grow), ...side(1, grow).reverse()]);
    if (shoulderOnly) {
      const shoulder = strip(road.medianHalfWidthU ? 5 : 1.6);
      g.fillStyle(0x6f8f52, 0.45);
      if (shoulder.length >= 3) g.fillPoints(shoulder, true);
      return;
    }
    const asphalt = strip(0);
    const median = road.medianHalfWidthU;
    if (median) {
      const innerGrow = median - (road.points[0]?.halfWidthU ?? 28);
      g.fillStyle(0x6f8f52, 1);
      const center = strip(innerGrow);
      if (center.length >= 3) g.fillPoints(center, true);
      g.fillStyle(0x777a7b, 1);
      for (const sign of [-1, 1]) {
        const carriageway = clip([
          ...side(sign),
          ...side(sign, innerGrow).reverse(),
        ]);
        if (carriageway.length >= 3) g.fillPoints(carriageway, true);
      }
    } else {
      g.fillStyle(
        road.surface === 'dirt' ? 0xa69770 : crossing ? ROAD_ASPHALT : 0x8e8d88,
        1,
      );
      if (asphalt.length >= 3) g.fillPoints(asphalt, true);
    }
    const near = side(1).filter((p) => groundDistanceU(p) >= 0),
      far = side(-1).filter((p) => groundDistanceU(p) >= 0);
    g.lineStyle(1, 0x6c6b66, 1);
    if (near.length >= 2) strokeOutside(g, near, mouths);
    g.lineStyle(0.8, 0xb5b3ad, 1);
    if (far.length >= 2) strokeOutside(g, far, mouths);
    if (median) {
      g.lineStyle(1, ROAD_LINE, 0.9);
      for (const sign of [-1, 1]) {
        const inner = side(
          sign,
          median - (road.points[0]?.halfWidthU ?? 28),
        ).filter((p) => groundDistanceU(p) >= 0);
        if (inner.length >= 2) g.strokePoints(inner, false, false);
      }
    }
    if (road.surface === 'dirt' || road.style) return;
    // Dashed middle line along the straight part.
    g.lineStyle(1.2, 0xf4f1e6, 0.9);
    const lanes = median
      ? [-1, 1].map((sign) =>
          side(sign, -(road.points[0]?.halfWidthU ?? 28) / 2 + median / 2),
        )
      : [points];
    for (const lane of lanes) {
      const straight = lane.filter(
        (point) =>
          point.x >= from && point.x <= to && groundDistanceU(point) >= 0,
      );
      for (let i = 0; i + 1 < straight.length; i++) {
        const a = straight[i];
        const b = straight[i + 1];
        if (!a || !b) continue;
        strokeOutside(
          g,
          [
            { x: a.x + 6, y: a.y + ((b.y - a.y) * 6) / 32 },
            { x: a.x + 18, y: a.y + ((b.y - a.y) * 18) / 32 },
          ],
          mouths,
        );
      }
    }
  }

  /**
   * A street's small road bridge over the stream, painted over the water
   * exactly on its reserved deck polygon: a stone deck with a darker fascia
   * on the near side, the street's asphalt and centre dashes continuing
   * across, and low railings with posts along both edges.
   */
  #paintRoadBridge(
    g: Phaser.GameObjects.Graphics,
    road: RoadPath,
    deck: readonly PointU[],
    fromXU: number,
    toXU: number,
  ): void {
    const x0 = this.#table.chunkIndex * CHUNK_WIDTH_U;
    const xs: number[] = [];
    for (let x = fromXU; x < toXU; x += 8) xs.push(x);
    xs.push(toXU);
    const yAt = (line: readonly PointU[], x: number) => {
      for (let i = 0; i + 1 < line.length; i++) {
        const a = line[i],
          b = line[i + 1];
        if (a && b && x >= a.xU && x <= b.xU)
          return a.yU + ((b.yU - a.yU) * (x - a.xU)) / (b.xU - a.xU || 1);
      }
      return line.at(-1)?.yU ?? 0;
    };
    // An edge line of the street across the deck: -1 far, +1 near, 0 middle.
    const edge = (sign: number, grow: number) => {
      const line = roadSide(road, sign, grow);
      return xs.map((x) => new Phaser.Math.Vector2(x - x0, yAt(line, x)));
    };
    const band = (a: Phaser.Math.Vector2[], b: Phaser.Math.Vector2[]) => [
      ...a,
      ...[...b].reverse(),
    ];
    g.fillStyle(0xb9b0a0, 1);
    g.fillPoints(
      deck.map((p) => new Phaser.Math.Vector2(p.xU - x0, p.yU)),
      true,
    );
    g.fillStyle(0x8b8273, 1);
    g.fillPoints(band(edge(1, 1.5), edge(1, ROAD_BRIDGE_EDGE_U)), true);
    g.fillStyle(0x8e8d88, 1);
    g.fillPoints(band(edge(-1, 0), edge(1, 0)), true);
    g.lineStyle(1, 0x6c6b66, 1);
    g.strokePoints(edge(1, 0), false, false);
    g.lineStyle(0.8, 0xb5b3ad, 1);
    g.strokePoints(edge(-1, 0), false, false);
    const middle = roadSide(road, 0);
    g.lineStyle(1.2, 0xf4f1e6, 0.9);
    for (let s = Math.ceil(fromXU / 32) * 32; s + 18 <= toXU; s += 32)
      g.lineBetween(
        s + 6 - x0,
        yAt(middle, s + 6),
        s + 18 - x0,
        yAt(middle, s + 18),
      );
    // Low railings: posts every 16 u, a rail along their tops, end posts heavier.
    for (const sign of [-1, 1]) {
      const foot = edge(sign, 1);
      g.lineStyle(1.2, 0x5f5a52, 1);
      g.strokePoints(
        foot.map((p) => new Phaser.Math.Vector2(p.x, p.y - 5)),
        false,
        false,
      );
      foot.forEach((p, i) => {
        const end = i === 0 || i === foot.length - 1;
        if (!end && i % 2 !== 0) return;
        g.lineStyle(end ? 2.2 : 1, 0x5f5a52, 1);
        g.lineBetween(p.x, p.y, p.x, p.y - 5);
      });
    }
  }

  /** Road position at a render y in front of the track (crossing x). */
  #roadUAt(x: number, y: number): number {
    return y - (this.#meadowTop(x) + NEAR_FOOT_OFFSET_U) + ROAD_CONFLICT_U;
  }

  /** Shared rail point and render grade for the road, traffic and post feet. */
  #crossingRoadFrame(x: number): RoadFrame {
    return {
      railY: -this.#railAt(x),
      meadowY: this.#meadowTop(x),
      railSlope: -(this.#railAt(x + 8) - this.#railAt(x - 8)) / 16,
    };
  }

  /**
   * The road of a level crossing (doc 05 §4), painted into the ground:
   * behind the track up to the horizon, in front of it down the meadow,
   * wider towards the viewer; asphalt on a gravel shoulder with side
   * lines, a dashed middle line and a stop line in each lane.
   */
  #paintCrossingRoad(
    g: Phaser.GameObjects.Graphics,
    x: number,
    part: 'back' | 'near',
    bottomY: number,
  ): void {
    const frame = this.#crossingRoadFrame(x);
    const bottomRoadU = this.#roadUAt(x, bottomY);
    const { fromRoadU: from, toRoadU: to } = crossingRoadRange(
      part,
      bottomRoadU +
        2 +
        Math.abs(frame.railSlope ?? 0) * (roadHalfWidthU(bottomRoadU) + 4),
    );
    const rs: number[] = [];
    for (let r = from; r < to; r += 8) rs.push(r);
    rs.push(to);
    const edge = (side: number, grow: number) =>
      rs.map(
        (r) =>
          new Phaser.Math.Vector2(
            x + side * (roadHalfWidthU(r) + grow),
            roadPointY(frame, r, side * (roadHalfWidthU(r) + grow)),
          ),
      );
    const strip = (grow: number) => [
      ...edge(-1, grow),
      ...edge(1, grow).reverse(),
    ];
    g.fillStyle(ROAD_SHOULDER, 1);
    g.fillPoints(strip(4), true);
    g.fillStyle(ROAD_ASPHALT, 1);
    g.fillPoints(strip(0), true);
    const x0 = this.#table.chunkIndex * CHUNK_WIDTH_U;
    const mouths =
      part === 'back'
        ? this.#scenery.roads.map((road) =>
            roadPolygon(road).map((p) => ({ xU: p.xU - x0, yU: p.yU })),
          )
        : [];
    g.lineStyle(1.2, ROAD_LINE, 0.9);
    strokeOutside(g, edge(-1, -2), mouths);
    strokeOutside(g, edge(1, -2), mouths);
    // Dashed middle line.
    g.lineStyle(1.4, ROAD_DASH, 0.95);
    for (let r = from; r + 8 < to; r += ROAD_DASH_EVERY_U)
      strokeOutside(
        g,
        [
          { x, y: roadPointY(frame, r) },
          { x, y: roadPointY(frame, r + 8) },
        ],
        mouths,
      );
    // Stop line across the lane that comes up to the track on this side.
    const stopU = part === 'back' ? -FAR_STOP_LINE_U : NEAR_STOP_LINE_U;
    const half = roadHalfWidthU(stopU);
    const lineFrom = part === 'back' ? -half + 2 : 1;
    const lineTo = part === 'back' ? -1 : half - 2;
    g.lineStyle(2.6, 0xffffff, 0.95);
    g.lineBetween(
      x + lineFrom,
      roadPointY(frame, stopU, lineFrom),
      x + lineTo,
      roadPointY(frame, stopU, lineTo),
    );
  }

  /**
   * Sideways meander of the stream at a road position: none under the
   * bridge, growing gently away from the track on both sides.
   */
  #streamBend(roadU: number): number {
    return streamBendU(this.#table.chunkIndex, roadU);
  }

  /**
   * The stream under a bridge (doc 03 §8), painted into the ground like a
   * crossing road: from the horizon behind the track, under the bridge's
   * arch and down the near meadow, wider towards the viewer. Muddy banks
   * with tufts, water with a lighter current and ripples; dark under the
   * bridge.
   */
  #paintStream(
    g: Phaser.GameObjects.Graphics,
    x: number,
    part: 'back' | 'near',
    bottomY: number,
  ): void {
    const frame = { railY: -this.#railAt(x), meadowY: this.#meadowTop(x) };
    const from = part === 'back' ? ROAD_FAR_END_U : -ROAD_CONFLICT_U;
    const to =
      part === 'back' ? -ROAD_CONFLICT_U + 10 : this.#roadUAt(x, bottomY) + 2;
    const rs: number[] = [];
    for (let r = from; r < to; r += 8) rs.push(r);
    rs.push(to);
    const half = (r: number) => streamHalfWidthU(r);
    const bend = (r: number) => this.#streamBend(r);
    const edge = (side: number, scale: number, grow: number) =>
      rs.map(
        (r) =>
          new Phaser.Math.Vector2(
            x + bend(r) + side * (half(r) * scale + grow),
            roadPointY(frame, r),
          ),
      );
    const strip = (scale: number, grow: number) => [
      ...edge(-1, scale, grow),
      ...edge(1, scale, grow).reverse(),
    ];
    g.fillStyle(STREAM_BANK, 1);
    g.fillPoints(strip(1, 5), true);
    g.fillStyle(STREAM_WATER, 1);
    g.fillPoints(strip(1, 0), true);
    g.fillStyle(STREAM_CURRENT, 0.8);
    g.fillPoints(strip(0.35, 0), true);
    // Shade under the bridge, across the track.
    if (part === 'near') {
      const top = roadPointY(frame, -ROAD_CONFLICT_U);
      const bottom = roadPointY(frame, 0);
      g.fillStyle(0x1f3f5a, 0.55);
      g.fillRect(x - RIVER_HALF_U - 2, top, 2 * RIVER_HALF_U + 4, bottom - top);
    }
    // Ripples drifting along the current, and tufts on the banks.
    g.lineStyle(1, 0xe8f4fb, 0.8);
    for (let i = 0; i + 1 < rs.length; i += 2) {
      const r = rs[i] ?? 0;
      const y = roadPointY(frame, r);
      const w = half(r);
      const shift = bend(r) + (((r * 37) % 11) / 11 - 0.5) * w;
      g.lineBetween(x + shift - w * 0.18, y, x + shift + w * 0.12, y);
    }
    for (let i = 0; i < rs.length; i += 3) {
      const r = rs[i] ?? 0;
      if (r > -ROAD_CONFLICT_U && r < ROAD_CONFLICT_U) continue;
      const y = roadPointY(frame, r);
      for (const side of [-1, 1]) {
        const bx = x + bend(r) + side * (half(r) + 4);
        g.fillStyle(0x4f8a2e, 1);
        g.fillTriangle(bx - 2, y, bx, y - 6, bx + 2, y);
        g.fillStyle(0x6aa63d, 1);
        g.fillTriangle(
          bx + side * 2,
          y,
          bx + side * 3,
          y - 4,
          bx + side * 4,
          y,
        );
      }
    }
  }

  /**
   * A level basin (WaterBasin): the far edge stays level at the height of
   * the basin's highest rail point, the near shore follows the bank behind
   * the track, and both ends curve in over WATER_END_U. Painted in bands
   * from the far edge to the near shore, with a shore ring and ripples.
   */
  #paintWater(
    g: Phaser.GameObjects.Graphics,
    basin: WaterBasin,
    palette: WaterPalette,
  ): void {
    const sea = basin.kind === 'sea';
    const continuous = sea || basin.flowSpan !== undefined;
    const from = continuous
      ? basin.fromX - FIELD_EDGE_LEAN_U - GROUND_OVERLAP_U
      : basin.fromX + WATER_SIDE_U;
    const to = continuous
      ? basin.toX + FIELD_EDGE_LEAN_U + GROUND_OVERLAP_U
      : basin.toX - WATER_SIDE_U;
    const level = waterLevelU(this.#seed, this.#table.chunkIndex, basin);
    const section = (x: number) =>
      waterSectionU(this.#seed, this.#table.chunkIndex, basin, x, level);
    const far = (x: number) => section(x).topU,
      near = (x: number) => section(x).bottomU;
    const xs: number[] = [];
    for (let x = from; x < to; x += 8) xs.push(x);
    xs.push(to);
    const open = (x: number) =>
      continuous
        ? 1
        : Math.max(0, Math.min(1, Math.min(x - from, to - x) / 62));
    /** Outline between two fractions of the water (0 far edge … 1 near). */
    const outline = (t0: number, t1: number): Phaser.Math.Vector2[] => {
      const point = (x: number, t: number) => {
        const y = far(x) + (near(x) - far(x)) * t;
        return new Phaser.Math.Vector2(x, y);
      };
      return [
        ...xs.map((x) => point(x, t0)),
        ...[...xs].reverse().map((x) => point(x, t1)),
      ];
    };
    const whole = outline(0, 1);
    g.lineStyle(9, palette.shore, 1);
    if (continuous) {
      if (!sea)
        g.strokePoints(
          xs.map((x) => new Phaser.Math.Vector2(x, far(x))),
          false,
          false,
        );
      g.strokePoints(
        xs.map((x) => new Phaser.Math.Vector2(x, near(x))),
        false,
        false,
      );
    } else g.strokePoints(whole, true, true);
    g.lineStyle(4, palette.wetShore, 1);
    if (continuous) {
      if (!sea)
        g.strokePoints(
          xs.map((x) => new Phaser.Math.Vector2(x, far(x))),
          false,
          false,
        );
      g.strokePoints(
        xs.map((x) => new Phaser.Math.Vector2(x, near(x))),
        false,
        false,
      );
    } else g.strokePoints(whole, true, true);
    g.fillStyle(palette.middle, 1);
    g.fillPoints(whole, true);
    g.fillStyle(palette.far, 1);
    g.fillPoints(outline(0, 0.34), true);
    g.fillStyle(palette.near, 1);
    g.fillPoints(outline(0.74, 1), true);
    g.fillStyle(palette.farEdge, 0.85);
    g.fillPoints(outline(0, 0.07), true);
    // Spots for the flashing glints (drawn as images over the texture).
    for (let i = 0; i < GLINTS_PER_BASIN; i++) {
      const h = sceneryDecorationHash(
        'glint',
        this.#table.chunkIndex,
        basin.fromX,
        i,
      );
      const x =
        from +
        WATER_END_U +
        ((h % 1000) / 1000) * (to - from - 2 * WATER_END_U);
      const t = 0.15 + (((h >>> 10) % 1000) / 1000) * 0.7;
      const top = far(x);
      this.#glintSpots.push({
        x,
        y: top + (near(x) - top) * t,
        sizeU: 6 + 6 * t,
        phase: ((h >>> 20) % 1000) / 1000,
      });
    }
    // Ripples: short level strokes, longer and brighter nearer the shore.
    const chunk = this.#table.chunkIndex;
    for (let i = 0; i < 34; i++) {
      const h = sceneryDecorationHash('ripple', chunk, basin.fromX, i);
      const x = from + ((h % 1000) / 1000) * (to - from);
      const t = 0.12 + (((h >>> 10) % 1000) / 1000) * 0.8;
      const k = open(x);
      if (k < 0.8) continue;
      const top = far(x);
      const y = top + (near(x) - top) * t;
      const length = 6 + t * 18 + ((h >>> 20) % 10);
      g.lineStyle(0.8 + t * 1.2, palette.ripple, 0.35 + t * 0.35);
      g.lineBetween(x, y, x + length, y);
    }
  }
}

/** Fallback without art: sleepers and a rail line. */
function paintPlainTrack(
  g: Phaser.GameObjects.Graphics,
  table: ArcLengthTable,
): void {
  const x0 = table.xs[0] ?? 0;
  g.fillStyle(0x7a5c3e, 1);
  for (let i = 0; i < table.xs.length; i += 2) {
    g.fillRect((table.xs[i] ?? 0) - x0 - 3, -(table.ys[i] ?? 0) + 4, 6, 4);
  }
  g.lineStyle(4, 0x5b4a3a, 1);
  g.strokePoints(
    table.xs.map(
      (x, i) => new Phaser.Math.Vector2(x - x0, -(table.ys[i] ?? 0) + 2),
    ),
    false,
    false,
  );
}
