import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig.ts';
import { vehicleArtLayers } from '../content/artLayers.ts';
import { artFileUrl, worldFileUrl } from '../content/artFiles.ts';
import { artParts, vehicleArt } from '../content/artManifest.ts';
import {
  OBJECT_RADIUS_U,
  OBJECT_SHAPES,
  PLACEHOLDER_BODY_HEIGHT_U,
  vehicleShapes,
  type Shape,
  type ShapedVehicle,
} from '../content/placeholderShapes.ts';
import {
  TRACK_BED_DEPTH_U,
  animalParts,
  isBackdropPart,
  worldParts,
} from '../content/worldArt.ts';
import type { RideSimulation } from '../domain/ride/RideSimulation.ts';
import type { Biome } from '../domain/world/Biomes.ts';
import { heightAtX } from '../domain/world/ArcLengthTable.ts';
import { contactWireHeightU } from '../domain/world/Catenary.ts';
import { SECONDARY_SCALE } from '../domain/world/SecondaryTrack.ts';
import { chunkOfEntityId } from '../domain/world/ChunkObjects.ts';
import { hash32 } from '../domain/world/Hash.ts';
import {
  ANIMAL_HOP_U,
  ANIMAL_SCALE,
  NEAR_DEPTH_RANGE_U,
  chunkScenery,
  nearDepthScale,
  type ChunkScenery,
} from '../domain/world/Scenery.ts';
import { bankHeightU } from '../domain/world/Terrain.ts';
import {
  ArtAtlas,
  preloadArt,
  type ArtAtlasInfo,
  type ArtSource,
} from './ArtAtlas.ts';
import {
  ART_MAX_PX_PER_U,
  BACKDROP_MAX_PX_PER_U,
  frameOrigin,
} from './atlasPacking.ts';
import { placeAnimal } from './animalPlacement.ts';
import { AmbientLife } from './particles/AmbientLife.ts';
import { EffectsView } from './particles/EffectsView.ts';
import { emitterWorldPoint, passEffectAt } from './particles/emission.ts';
import { ParticleField } from './particles/ParticleField.ts';
import { PARTICLE_KINDS, kindName } from './particles/particleKinds.ts';
import {
  TrainEffects,
  type PlacedEmitter,
  type TrainEffectsInput,
} from './particles/TrainEffects.ts';
import { Backdrop } from './Backdrop.ts';
import { ChunkView, SECONDARY_DEPTH } from './ChunkView.ts';
import { BACK_PLANE_U, NEAR_FOOT_OFFSET_U } from './groundLayout.ts';
import { motionScale } from './ambientMotion.ts';
import { pantographReachU } from './pantograph.ts';
import type { TrainInTunnel } from './tunnelCover.ts';
import {
  frameLeftX,
  frameTopY,
  trainZoom,
  type FramingConfig,
} from './cameraFraming.ts';

/** What the scene needs from the application each frame. */
export interface RideSceneHost {
  /** Runs one application frame; returns the render interpolation alpha. */
  frame(deltaSec: number, nowMs: number): number;
  ride(): RideSimulation | undefined;
  /** Vehicle definitions of the current journey, locomotive first. */
  journeyVehicles(): readonly ShapedVehicle[];
  catalogVehicles(): readonly ShapedVehicle[];
  /** Effects density profile (doc 13 `quality`, reduced effects). */
  effectsQuality(): 'low' | 'standard';
}

export interface RenderStats {
  renderedVehicles: number;
  /** Rendered vehicles drawn from their art (the rest are placeholders). */
  artVehicles: number;
  renderedChunks: number;
  /** Biome of the backdrop (the landscape ahead of the train). */
  biome: Biome | undefined;
  /** Localities of the chunks in view, left to right. */
  localities: string[];
  /** Catenary masts in the rendered chunks (doc 03 §9). */
  catenaryPoles: number;
  /**
   * How far the drawn pantograph head misses the contact wire, u; undefined
   * without a raised pantograph in view.
   */
  pantographGapU: number | undefined;
  /** Vehicles of oncoming trains drawn out in the open (doc 05 §6). */
  oncomingVehicles: number;
  /** Tunnels in the rendered chunks, their hills' opacity and the train. */
  tunnels: { id: string; alpha: number; train: TrainInTunnel }[];
}

const NO_STATS: RenderStats = {
  renderedVehicles: 0,
  artVehicles: 0,
  renderedChunks: 0,
  biome: undefined,
  localities: [],
  catenaryPoles: 0,
  pantographGapU: undefined,
  oncomingVehicles: 0,
  tunnels: [],
};

/**
 * An oncoming train's vehicle is drawn while it reaches out of its tunnel
 * mouth (the arch is 72 u wide); further in, the portal hill covers it.
 */
const PORTAL_EDGE_U = 40;

/** Rail height samples along the train for vertical framing. */
const SPAN_STEP_U = 32;
/** Render origin step; keeps GPU coordinates small on endless rides. */
const ORIGIN_STEP_U = 4096;
/** Chunk width shared with the generator and TrackWindow (doc 13). */
const CHUNK_WIDTH_U = gameConfig.world.chunkWidthU;
const REACTION_TICKS = 40;
/** Depth of the animals' idle breathing (share of their height). */
const ANIMAL_BREATH = 0.03;
/** Animals keep this far above the controls' strip (u). */
const FREE_BAND_MARGIN_U = 6;
/** Transparent border of the generated placeholder textures (px = u). */
const PLACEHOLDER_MARGIN_PX = 2;
/** The backdrop shows the biome at this share of the view width. */
const BIOME_AHEAD_SHARE = 0.65;
/** Time constant of the backdrop following the rails up and down (s). */
const HORIZON_EASE_SEC = 0.8;

/** Drawing order (doc 07 §3): sky at the back, objects at the front. */
const DEPTH = {
  sky: 0,
  clouds: 0.5,
  far: 1,
  mid: 2,
  backGround: 3,
  backProps: 4,
  ground: 5,
  track: 6,
  train: 7,
  wires: 7.5,
  nearProps: 8,
  objects: 9,
  effects: 10,
} as const;

/** Vehicles, track, props and animals: the main art atlas. */
const ART_SOURCES: readonly ArtSource[] = [
  ...Object.entries(artParts).map(([key, part]) => ({
    key,
    url: artFileUrl(part.file),
    widthU: part.widthU,
    heightU: part.heightU,
  })),
  ...Object.entries(worldParts)
    .filter(([key]) => !isBackdropPart(key))
    .map(([key, part]) => ({
      key,
      url: worldFileUrl(part.file),
      widthU: part.widthU,
      heightU: part.heightU,
    })),
];

/** Backdrops and clouds: their own, coarser atlas (D-013). */
const BACKDROP_SOURCES: readonly ArtSource[] = Object.entries(worldParts)
  .filter(([key]) => isBackdropPart(key))
  .map(([key, part]) => ({
    key,
    url: worldFileUrl(part.file),
    widthU: part.widthU,
    heightU: part.heightU,
  }));

function hex(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}

function drawShapes(
  g: Phaser.GameObjects.Graphics,
  shapes: readonly Shape[],
  offsetX: number,
  offsetY: number,
): void {
  for (const shape of shapes) {
    g.fillStyle(hex(shape.color), 1);
    g.fillPoints(
      shape.points.map(
        ([x, y]) => new Phaser.Math.Vector2(x + offsetX, offsetY - y),
      ),
      true,
    );
  }
}

interface VisibleObject {
  id: string;
  x: number;
  /** Foot of the drawing (render y). */
  y: number;
  /** Middle of the drawing, where a tap aims. */
  centerY: number;
  /** Tap radius around the middle, covering the drawing. */
  radiusU: number;
}

interface VehicleSlot {
  container: Phaser.GameObjects.Container;
  /** Images in drawing order; slots are reused for any vehicle type. */
  images: Phaser.GameObjects.Image[];
  /** Texture frame each image shows, to skip redundant texture switches. */
  frames: string[];
}

/**
 * Side view of the ride (doc 03 §7, doc 07 §3) drawn from the simulation:
 * track chunks and objects only inside the render window, vehicles only when
 * on screen. Every vehicle has its own pose from its two bogie samples.
 */
export class RideScene extends Phaser.Scene {
  readonly #host: RideSceneHost;
  readonly #chunks = new Map<number, ChunkView>();
  readonly #objectImages = new Map<string, Phaser.GameObjects.Image>();
  readonly #slots: VehicleSlot[] = [];
  /** Vehicles of oncoming trains, behind the main track (doc 05 §6). */
  readonly #npcSlots: VehicleSlot[] = [];
  /** Scenery of the chunks around the view; pure, so cached per chunk. */
  readonly #scenery = new Map<number, ChunkScenery>();
  /** World y (up) of the top screen edge; eased between frames. */
  #cameraTopY: number | undefined;
  #framing: FramingConfig | undefined;
  /** Simulation tick of the last tunnel update. */
  #tunnelTick: number | undefined;
  /** Where the drawn pantograph touches the wire this frame (render). */
  #pantographContact: { x: number; y: number } | undefined;
  /** CSS px covered by controls at the top and bottom of the screen. */
  #insetsCss = { top: 0, bottom: 0, controls: 0 };
  #originX = 0;
  #rideRef: RideSimulation | undefined;
  /** Visible world rectangle (render-local units) of the latest frame. */
  #view = { left: 0, top: 0, zoom: 1 };
  #visibleObjects: VisibleObject[] = [];
  /** Vehicle and world art; undefined if it failed (placeholders drawn). */
  #art: ArtAtlas | undefined;
  /** Backdrop art; undefined if it failed (plain sky only). */
  #backdropArt: ArtAtlas | undefined;
  #backdrop: Backdrop | undefined;
  /** Render y of the rails the backdrop stands on; eased. */
  #horizonY: number | undefined;
  /** Render y the animals' feet stay above (free of the controls). */
  #freeBottomY = Infinity;
  /** Decorative particles (doc 14 §4); capacity from the quality profile. */
  readonly #particles = new ParticleField(
    PARTICLE_KINDS,
    gameConfig.quality.standard.maxDecorativeParticles,
    Math.random,
  );
  readonly #trainEffects = new TrainEffects(this.#particles, Math.random);
  readonly #npcEffects = new TrainEffects(this.#particles, Math.random);
  readonly #ambient = new AmbientLife(this.#particles, Math.random);
  #effectsView: EffectsView | undefined;
  #effectsTexture: string | undefined;
  /** Simulation tick the effects last advanced to. */
  #effectsTick: number | undefined;
  /** Backdrop atlas texture the backdrop currently shows. */
  #backdropTexture: string | undefined;
  stats: RenderStats = NO_STATS;

  constructor(host: RideSceneHost) {
    super('ride');
    this.#host = host;
  }

  /**
   * Strips covered by HUD controls; the whole train stays between them.
   * `controlsCss` is the height of the bottom strip including the brake's
   * enlarged touch area, which the interactive animals stay above.
   */
  setReservedInsets(
    topCss: number,
    bottomCss: number,
    controlsCss: number = bottomCss,
  ): void {
    this.#insetsCss = { top: topCss, bottom: bottomCss, controls: controlsCss };
  }

  /** Size of the art atlas, for diagnostics; undefined if it failed. */
  get artAtlas(): ArtAtlasInfo | undefined {
    return this.#art?.info;
  }

  /** Size of the backdrop atlas, for diagnostics. */
  get backdropAtlas(): ArtAtlasInfo | undefined {
    return this.#backdropArt?.info;
  }

  preload(): void {
    preloadArt(this, ART_SOURCES, ART_MAX_PX_PER_U);
    preloadArt(this, BACKDROP_SOURCES, BACKDROP_MAX_PX_PER_U);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#bfe3f2');
    // A failed download must not stop the ride (PWA-10): vehicles fall
    // back to their marked placeholder silhouettes, the backdrop to sky.
    try {
      this.#art = new ArtAtlas(this, ART_SOURCES, {
        maxPxPerU: ART_MAX_PX_PER_U,
        texturePrefix: 'art@',
      });
    } catch (error) {
      console.error(error);
    }
    try {
      this.#backdropArt = new ArtAtlas(this, BACKDROP_SOURCES, {
        maxPxPerU: BACKDROP_MAX_PX_PER_U,
        texturePrefix: 'backdrop@',
      });
    } catch (error) {
      console.error(error);
    }
    this.#effectsView = new EffectsView(this, DEPTH.effects);
    this.#backdrop = new Backdrop(this, {
      sky: DEPTH.sky,
      clouds: DEPTH.clouds,
      far: DEPTH.far,
      mid: DEPTH.mid,
    });
    this.events.once('destroy', () => {
      this.#backdrop?.destroy();
      this.#effectsView?.destroy();
      this.#art?.destroy();
      this.#backdropArt?.destroy();
    });
    let tallestU = 0;
    for (const vehicle of this.#host.catalogVehicles()) {
      const art = vehicleArt[vehicle.id];
      const height = PLACEHOLDER_BODY_HEIGHT_U;
      tallestU = Math.max(
        tallestU,
        art && this.#art ? art.heightU : height + vehicle.wheelRadiusU * 1.3,
      );
      // A transparent margin keeps rotated edges smooth without MSAA.
      const g = this.make.graphics({}, false);
      drawShapes(
        g,
        vehicleShapes(vehicle),
        PLACEHOLDER_MARGIN_PX,
        height + PLACEHOLDER_MARGIN_PX,
      );
      g.generateTexture(
        `vehicle-${vehicle.id}`,
        Math.ceil(vehicle.lengthU) + 2 * PLACEHOLDER_MARGIN_PX,
        Math.ceil(height) + 2 * PLACEHOLDER_MARGIN_PX,
      );
      g.destroy();
    }
    this.#framing = { ...gameConfig.camera, vehicleHeightU: tallestU + 8 };
    const wheel = this.make.graphics({}, false);
    const hub = 16 + PLACEHOLDER_MARGIN_PX;
    wheel.fillStyle(0x222222, 1).fillCircle(hub, hub, 16);
    wheel.fillStyle(0x7f8c8d, 1).fillCircle(hub, hub, 6);
    wheel
      .lineStyle(3, 0x7f8c8d, 1)
      .lineBetween(hub, hub - 14, hub, hub + 14)
      .lineBetween(hub - 14, hub, hub + 14, hub);
    wheel.generateTexture('wheel', 2 * hub, 2 * hub);
    wheel.destroy();
    const object = this.make.graphics({}, false);
    drawShapes(object, OBJECT_SHAPES, 32, 44);
    object.generateTexture('object-sheep', 64, 48);
    object.destroy();
  }

  /** CSS px → render-local world point for the latest drawn frame. */
  #toWorld(cssX: number, cssY: number, canvasRect: DOMRect) {
    const gamePerCss = this.scale.width / Math.max(1, canvasRect.width);
    return {
      x:
        this.#view.left +
        ((cssX - canvasRect.left) * gamePerCss) / this.#view.zoom,
      y:
        this.#view.top +
        ((cssY - canvasRect.top) * gamePerCss) / this.#view.zoom,
      unitsPerCss: gamePerCss / this.#view.zoom,
    };
  }

  /** CSS px → interactive object id under the finger (doc 02 §3). */
  hitObject(
    cssX: number,
    cssY: number,
    canvasRect: DOMRect,
  ): string | undefined {
    const world = this.#toWorld(cssX, cssY, canvasRect);
    let best: { id: string; distance: number } | undefined;
    for (const object of this.#visibleObjects) {
      // At least ~40 CSS px around the object, larger than the drawing.
      const radius = Math.max(object.radiusU, 40 * world.unitsPerCss);
      const distance = Math.hypot(world.x - object.x, world.y - object.centerY);
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { id: object.id, distance };
      }
    }
    return best?.id;
  }

  /** Screen box (CSS px) of the drawn vehicles, for diagnostics and E2E. */
  trainScreenBox(
    canvasRect: DOMRect,
  ): { left: number; top: number; right: number; bottom: number } | undefined {
    const cssPerGame = Math.max(1, canvasRect.width) / this.scale.width;
    let box:
      { left: number; top: number; right: number; bottom: number } | undefined;
    for (const image of this.#slots.flatMap((slot) =>
      slot.container.visible ? slot.images : [],
    )) {
      // A container's bounds would include hidden spare images.
      if (!image.visible) continue;
      // Bounds include the container's rotation and position.
      const bounds = image.getBounds();
      const left =
        canvasRect.left +
        (bounds.left - this.#view.left) * this.#view.zoom * cssPerGame;
      const right =
        canvasRect.left +
        (bounds.right - this.#view.left) * this.#view.zoom * cssPerGame;
      const top =
        canvasRect.top +
        (bounds.top - this.#view.top) * this.#view.zoom * cssPerGame;
      const bottom =
        canvasRect.top +
        (bounds.bottom - this.#view.top) * this.#view.zoom * cssPerGame;
      box = box
        ? {
            left: Math.min(box.left, left),
            top: Math.min(box.top, top),
            right: Math.max(box.right, right),
            bottom: Math.max(box.bottom, bottom),
          }
        : { left, top, right, bottom };
    }
    return box;
  }

  /** Screen x (CSS px) of the chunk boundaries in view, for E2E. */
  chunkEdgesScreenX(canvasRect: DOMRect): number[] {
    const cssPerGame = Math.max(1, canvasRect.width) / this.scale.width;
    const left = this.#view.left + this.#originX;
    const right = left + this.scale.width / this.#view.zoom;
    const edges: number[] = [];
    for (
      let k = Math.ceil(left / CHUNK_WIDTH_U);
      k * CHUNK_WIDTH_U <= right;
      k++
    )
      edges.push(
        canvasRect.left +
          (k * CHUNK_WIDTH_U - left) * this.#view.zoom * cssPerGame,
      );
    return edges;
  }

  /** Screen positions (CSS px) of visible objects, for diagnostics and E2E. */
  objectScreenPositions(
    canvasRect: DOMRect,
  ): { id: string; x: number; y: number }[] {
    const cssPerGame = Math.max(1, canvasRect.width) / this.scale.width;
    return this.#visibleObjects.map((object) => ({
      id: object.id,
      x:
        canvasRect.left +
        (object.x - this.#view.left) * this.#view.zoom * cssPerGame,
      y:
        canvasRect.top +
        (object.centerY - this.#view.top) * this.#view.zoom * cssPerGame,
    }));
  }

  /**
   * Near-meadow props in view, and those whose drawing overlaps a drawn
   * vehicle: always 0 (doc 14 §5: the scenery never covers the train).
   * Diagnostics and E2E.
   */
  nearPropCheck(): { inView: number; overTrain: number } {
    const view = this.cameras.main.worldView;
    const train = this.#slots
      .filter((slot) => slot.container.visible)
      .flatMap((slot) => slot.images.filter((image) => image.visible))
      .map((image) => image.getBounds());
    let inView = 0;
    let overTrain = 0;
    const near = [
      ...[...this.#chunks.values()].flatMap((chunk) => chunk.nearProps),
      // The interactive animals stand in the near meadow too.
      ...this.#objectImages.values(),
    ];
    {
      for (const prop of near) {
        const bounds = prop.getBounds();
        if (!Phaser.Geom.Rectangle.Overlaps(view, bounds)) continue;
        inView += 1;
        if (train.some((box) => Phaser.Geom.Rectangle.Overlaps(box, bounds)))
          overTrain += 1;
      }
    }
    return { inView, overTrain };
  }

  #reset(): void {
    this.#particles.clear();
    this.#effectsTick = undefined;
    this.#tunnelTick = undefined;
    this.#destroyChunks();
    this.#destroyObjects();
    this.#scenery.clear();
    for (const slot of [...this.#slots, ...this.#npcSlots])
      slot.container.destroy();
    this.#slots.length = 0;
    this.#npcSlots.length = 0;
    this.#cameraTopY = undefined;
    this.#horizonY = undefined;
    this.#visibleObjects = [];
  }

  #destroyObjects(): void {
    for (const image of this.#objectImages.values()) image.destroy();
    this.#objectImages.clear();
  }

  #sceneryOf(seed: number, chunkIndex: number): ChunkScenery {
    let scenery = this.#scenery.get(chunkIndex);
    if (!scenery) {
      scenery = chunkScenery(seed, chunkIndex);
      this.#scenery.set(chunkIndex, scenery);
    }
    return scenery;
  }

  override update(time: number, delta: number): void {
    const alpha = this.#host.frame(delta / 1000, time);
    const ride = this.#host.ride();
    if (ride !== this.#rideRef) {
      this.#reset();
      this.#rideRef = ride;
    }
    if (!ride) {
      this.stats = NO_STATS;
      return;
    }
    const vehicleFraming = this.#framing;
    if (!vehicleFraming) return;
    // Per-ride stats; the shared empty record stays untouched.
    if (this.stats === NO_STATS)
      this.stats = { ...NO_STATS, localities: [], tunnels: [] };
    this.stats.pantographGapU = undefined;
    this.#pantographContact = undefined;
    // The raised pantograph reaches the wire: keep it in view too.
    const framing = ride.electrified
      ? {
          ...vehicleFraming,
          vehicleHeightU: Math.max(
            vehicleFraming.vehicleHeightU,
            gameConfig.world.catenaryContactHeightU + 8,
          ),
        }
      : vehicleFraming;
    const camera = this.cameras.main;
    const gamePerCss =
      this.scale.width / Math.max(1, this.game.canvas.clientWidth);
    const viewport = {
      widthPx: this.scale.width,
      heightPx: this.scale.height,
      reservedTopPx: this.#insetsCss.top * gamePerCss,
      reservedBottomPx: this.#insetsCss.bottom * gamePerCss,
    };
    const layout = ride.layout;
    const consistLengthU = layout.frontOffsetU + layout.tailOffsetU;
    // One stable scale per screen, fitted to the longest allowed train.
    const zoom = trainZoom(
      viewport,
      Math.max(gameConfig.train.maxConsistLengthU, consistLengthU),
      framing,
    );
    camera.setZoom(zoom);
    this.#updateArtScale(zoom);
    const viewW = this.scale.width / zoom;
    const viewH = this.scale.height / zoom;

    const headS =
      ride.previousHeadS + (ride.headS - ride.previousHeadS) * alpha;
    const front = ride.sample(headS + layout.frontOffsetU);
    this.#originX = Math.floor(front.x / ORIGIN_STEP_U) * ORIGIN_STEP_U;
    // Rail heights under the whole train, so slopes never cut it off.
    let minRailY = front.y;
    let maxRailY = front.y;
    for (
      let s = headS - layout.tailOffsetU;
      s < headS + layout.frontOffsetU;
      s += SPAN_STEP_U
    ) {
      const y = ride.sample(s).y;
      minRailY = Math.min(minRailY, y);
      maxRailY = Math.max(maxRailY, y);
    }
    this.#cameraTopY = frameTopY(
      this.#cameraTopY,
      { minRailY, maxRailY },
      viewport,
      zoom,
      delta / 1000,
      framing,
    );
    // Horizontal follow is exact; the front keeps a stable screen position.
    const leftWorldX = frameLeftX(
      front.x,
      consistLengthU,
      viewport,
      zoom,
      framing,
    );
    const centerX = leftWorldX - this.#originX + viewW / 2;
    const centerY = -this.#cameraTopY + viewH / 2;
    camera.centerOn(centerX, centerY);
    this.#view = {
      left: centerX - viewW / 2,
      top: centerY - viewH / 2,
      zoom,
    };
    // Scenery moves by simulation time, so a paused ride stands still.
    const timeSec = ride.simulationTick / gameConfig.simulation.fixedHz;

    const leftX = leftWorldX - 64;
    const rightX = leftWorldX + viewW + 64;
    this.#drawTrack(ride, leftX, rightX, timeSec);
    // Animals stay above the controls in the bottom corners (doc 02).
    this.#freeBottomY =
      this.#view.top +
      (this.scale.height - this.#insetsCss.controls * gamePerCss) / zoom -
      FREE_BAND_MARGIN_U;
    this.#drawObjects(ride, leftX, rightX, timeSec);
    this.#drawTrain(ride, headS, leftX, rightX);
    this.#drawOncoming(ride, leftX, rightX);
    this.#drawEffects(ride, headS, leftX, rightX, viewW, viewH);

    const horizonTarget = -(minRailY + maxRailY) / 2;
    this.#horizonY =
      this.#horizonY === undefined
        ? horizonTarget
        : this.#horizonY +
          (horizonTarget - this.#horizonY) *
            (1 - Math.exp(-delta / 1000 / HORIZON_EASE_SEC));
    const aheadX = leftWorldX + viewW * BIOME_AHEAD_SHARE;
    const biome = this.#sceneryOf(
      ride.seed,
      Math.floor(aheadX / CHUNK_WIDTH_U),
    ).biome;
    // Lowest top edge of the ground behind the track in view.
    let groundTopY = -Infinity;
    for (
      let s = Math.max(
        ride.track.startS,
        headS + layout.frontOffsetU - viewW * 1.1,
      );
      s < Math.min(ride.track.endS, headS + layout.frontOffsetU + viewW * 0.5);
      s += 64
    ) {
      const point = ride.sample(s);
      if (point.x >= leftX && point.x <= rightX)
        groundTopY = Math.max(groundTopY, -point.y - BACK_PLANE_U);
    }
    this.#backdrop?.update(
      {
        left: this.#view.left,
        top: this.#view.top,
        width: viewW,
        height: viewH,
      },
      this.#horizonY,
      groundTopY,
      biome,
      timeSec,
      delta / 1000,
    );
    const localities: string[] = [];
    for (
      let k = Math.floor(leftWorldX / CHUNK_WIDTH_U);
      k * CHUNK_WIDTH_U < leftWorldX + viewW;
      k++
    )
      localities.push(this.#sceneryOf(ride.seed, k).locality);
    this.stats.biome = biome;
    this.stats.localities = localities;
  }

  #destroyChunks(): void {
    for (const chunk of this.#chunks.values()) chunk.destroy();
    this.#chunks.clear();
  }

  #drawTrack(
    ride: RideSimulation,
    leftX: number,
    rightX: number,
    timeSec: number,
  ): void {
    const first = Math.max(
      ride.track.firstChunkIndex,
      Math.floor(leftX / CHUNK_WIDTH_U) - 1,
    );
    const last = Math.min(
      ride.track.lastChunkIndex,
      Math.floor(rightX / CHUNK_WIDTH_U) + 1,
    );
    for (const [index, chunk] of this.#chunks) {
      if (index < first || index > last) {
        chunk.destroy();
        this.#chunks.delete(index);
      }
    }
    for (const index of this.#scenery.keys())
      if (index < first || index > last) this.#scenery.delete(index);
    const crossings = new Map(ride.crossings.map((c) => [c.id, c]));
    // Reduced effects calm the decorative motion (doc 07 §9).
    const motion = motionScale(this.#host.effectsQuality());
    // The whole train's x interval and the simulation time since the last
    // frame, for the tunnels' see-through cover (0 while paused).
    const trainSpan = {
      minX: ride.sample(ride.tailS).x,
      maxX: ride.sample(ride.frontS).x,
    };
    const tick = ride.simulationTick;
    const tunnelDtSec =
      this.#tunnelTick === undefined
        ? 0
        : Math.max(0, tick - this.#tunnelTick) / gameConfig.simulation.fixedHz;
    this.#tunnelTick = tick;
    const texture = this.#art?.textureKey;
    const pxPerU = this.#art?.info?.pxPerU;
    const art =
      texture !== undefined && pxPerU !== undefined
        ? { texture, pxPerU }
        : undefined;
    for (let k = first; k <= last; k++) {
      let chunk = this.#chunks.get(k);
      if (!chunk) {
        chunk = new ChunkView(
          this,
          ride.track.chunkTable(k),
          ride.seed,
          this.#sceneryOf(ride.seed, k),
          art,
          {
            backGround: DEPTH.backGround,
            backProps: DEPTH.backProps,
            ground: DEPTH.ground,
            track: DEPTH.track,
            train: DEPTH.train,
            wires: DEPTH.wires,
            nearProps: DEPTH.nearProps,
          },
          ride.electrified,
        );
        this.#chunks.set(k, chunk);
      }
      chunk.setX(k * CHUNK_WIDTH_U - this.#originX);
      const site = this.#sceneryOf(ride.seed, k).crossing;
      chunk.update(timeSec, site && crossings.get(site.id), motion);
      chunk.tunnel?.update(trainSpan, tunnelDtSec);
    }
    this.stats.tunnels = [...this.#chunks.values()].flatMap((chunk) =>
      chunk.tunnel
        ? [
            {
              id: chunk.tunnel.id,
              alpha: chunk.tunnel.alpha,
              train: chunk.tunnel.train,
            },
          ]
        : [],
    );
    this.stats.renderedChunks = this.#chunks.size;
    this.stats.catenaryPoles = [...this.#chunks.values()].reduce(
      (sum, chunk) => sum + chunk.catenaryPoles,
      0,
    );
  }

  #drawObjects(
    ride: RideSimulation,
    leftX: number,
    rightX: number,
    timeSec: number,
  ): void {
    const visible = new Set<string>();
    this.#visibleObjects = [];
    for (const object of ride.objectsBetween(
      ride.track.startS,
      ride.track.endS,
    )) {
      const point = ride.sample(object.s);
      if (point.x < leftX || point.x > rightX) continue;
      visible.add(object.id);
      const chunkIndex = chunkOfEntityId(object.id);
      if (chunkIndex === undefined) continue;
      const animal = this.#sceneryOf(ride.seed, chunkIndex).animal;
      const part = worldParts[animalParts[animal.kind]];
      const x = point.x - this.#originX;
      // The animal stands in the near meadow, at its depth (doc 05 §2).
      const meadowY =
        -point.y +
        TRACK_BED_DEPTH_U +
        bankHeightU(ride.seed, point.x) +
        NEAR_FOOT_OFFSET_U;
      const { depth, fit } = placeAnimal(
        animal.depth,
        part.heightU,
        (this.#freeBottomY - meadowY) / NEAR_DEPTH_RANGE_U,
      );
      const scale = fit * ANIMAL_SCALE * nearDepthScale(depth);
      let image = this.#objectImages.get(object.id);
      if (!image) {
        image = this.#animalImage(animalParts[animal.kind], part);
        // Animals face either way along the track, fixed per animal.
        image.setFlipX(hash32('animal-facing', object.id) % 2 === 1);
        this.#objectImages.set(object.id, image);
      }
      const age = ride.reactionAge(object.id);
      const hop =
        age !== undefined && age < REACTION_TICKS
          ? Math.sin((age / REACTION_TICKS) * Math.PI) * ANIMAL_HOP_U * fit
          : 0;
      const y = meadowY + depth * NEAR_DEPTH_RANGE_U;
      const pxPerU = this.#art?.info?.pxPerU;
      const drawn =
        pxPerU !== undefined && image.texture.key !== 'object-sheep';
      const heightU = drawn ? part.heightU * scale : OBJECT_RADIUS_U * 2;
      const widthU = drawn ? part.widthU * scale : OBJECT_RADIUS_U * 2;
      // Idle breathing: a slight squash, never taller than drawn.
      const breath =
        1 -
        ANIMAL_BREATH *
          motionScale(this.#host.effectsQuality()) *
          (0.5 +
            0.5 *
              Math.sin(
                2 *
                  Math.PI *
                  (0.8 * timeSec + (hash32('breath', object.id) % 1000) / 1000),
              ));
      const base = drawn ? scale / pxPerU : 1;
      image.setScale(base, base * breath).setPosition(x, y - hop);
      this.#visibleObjects.push({
        id: object.id,
        x,
        y,
        centerY: y - heightU / 2,
        radiusU: Math.max(heightU, widthU) * 0.6,
      });
    }
    for (const [id, image] of this.#objectImages) {
      if (!visible.has(id)) {
        image.destroy();
        this.#objectImages.delete(id);
      }
    }
  }

  /**
   * Particles and ambient life for this frame (doc 14 §4), advanced by
   * simulation time: a paused ride stands still.
   */
  #drawEffects(
    ride: RideSimulation,
    headS: number,
    leftX: number,
    rightX: number,
    viewW: number,
    viewH: number,
  ): void {
    const tick = ride.simulationTick;
    const dtSec =
      this.#effectsTick === undefined
        ? 0
        : Math.max(0, tick - this.#effectsTick) / gameConfig.simulation.fixedHz;
    this.#effectsTick = tick;
    const quality = this.#host.effectsQuality();
    this.#particles.setCapacity(
      gameConfig.quality[quality].maxDecorativeParticles,
    );
    const rateScale = quality === 'low' ? 0.5 : 1;
    const vehicles = this.#host.journeyVehicles();
    const locomotive = vehicles[0];
    const art = locomotive ? vehicleArt[locomotive.id] : undefined;
    const emitters: PlacedEmitter[] = [];
    const wheels: { x: number; y: number }[] = [];
    let front: TrainEffectsInput['front'] = { x: 0, y: 0, ground: undefined };
    if (locomotive) {
      const pose = ride.vehiclePose(0, headS);
      const effect = locomotive.effect;
      const kind =
        effect === 'steam' || effect === 'diesel'
          ? effect
          : effect === 'stars'
            ? 'stars'
            : undefined;
      if (art && kind !== undefined)
        for (const emitter of art.emitters ?? [])
          emitters.push({
            kind,
            ...emitterWorldPoint(
              emitter,
              { lengthU: locomotive.lengthU, heightU: art.heightU },
              pose,
            ),
          });
      const x =
        pose.centerX + Math.cos(pose.angleRad) * locomotive.bogieOffsetU;
      const y =
        -pose.centerY - Math.sin(pose.angleRad) * locomotive.bogieOffsetU;
      const k = Math.floor(x / CHUNK_WIDTH_U);
      front = {
        x,
        y,
        ground: passEffectAt(
          this.#sceneryOf(ride.seed, k).near,
          x - k * CHUNK_WIDTH_U,
        ),
      };
    }
    vehicles.forEach((vehicle, i) => {
      const pose = ride.vehiclePose(i, headS);
      if (pose.centerX < leftX || pose.centerX > rightX) return;
      for (const side of [-1, 1]) {
        const offset = side * vehicle.bogieOffsetU;
        wheels.push({
          x: pose.centerX + Math.cos(pose.angleRad) * offset,
          y: -pose.centerY - Math.sin(pose.angleRad) * offset,
        });
      }
    });
    this.#trainEffects.step({
      dtSec,
      speedUPerSec: ride.speedUPerSec,
      maxSpeedUPerSec: gameConfig.train.maxSpeedUPerSec,
      intent: ride.lastIntent,
      emitters,
      driverRadiusU: locomotive?.wheelRadiusU,
      wheels,
      front,
      rateScale,
      ...(this.#pantographContact
        ? { pantograph: this.#pantographContact }
        : {}),
    });
    // Oncoming steam and diesel trains smoke too, out of their tunnels.
    for (const train of ride.oncomingTrains) {
      const loco = train.vehicles[0];
      const shaped = this.#host
        .catalogVehicles()
        .find((candidate) => candidate.id === loco?.id);
      const npcArt = shaped ? vehicleArt[shaped.id] : undefined;
      const kind =
        shaped?.effect === 'steam' || shaped?.effect === 'diesel'
          ? shaped.effect
          : undefined;
      if (!loco || !shaped || !npcArt || kind === undefined) continue;
      const pose = train.vehiclePose(0);
      const npcEmitters: PlacedEmitter[] = (npcArt.emitters ?? [])
        .map((emitter) => ({
          kind,
          ...emitterWorldPoint(
            emitter,
            { lengthU: shaped.lengthU, heightU: npcArt.heightU },
            pose,
            { mirrored: true, scale: SECONDARY_SCALE },
          ),
        }))
        .filter(
          (emitter) =>
            emitter.x > train.site.fromX && emitter.x < train.site.toX,
        );
      this.#npcEffects.step({
        dtSec,
        speedUPerSec: train.speedUPerSec,
        maxSpeedUPerSec: gameConfig.train.maxSpeedUPerSec,
        intent: 'THROTTLE',
        emitters: npcEmitters,
        driverRadiusU: loco.wheelRadiusU,
        wheels: [],
        front: { x: 0, y: 0, ground: undefined },
        rateScale,
      });
    }
    const middleX = this.#view.left + this.#originX + viewW / 2;
    const k = Math.floor(middleX / CHUNK_WIDTH_U);
    const scenery = this.#sceneryOf(ride.seed, k);
    const nearHere = scenery.near.find(
      (span) =>
        middleX - k * CHUNK_WIDTH_U >= span.fromX &&
        middleX - k * CHUNK_WIDTH_U < span.toX,
    )?.style;
    this.#ambient.step({
      dtSec,
      view: {
        left: this.#view.left + this.#originX,
        top: this.#view.top,
        width: viewW,
        height: viewH,
      },
      meadowY:
        -ride.sample(
          Math.max(ride.track.startS, Math.min(ride.track.endS, headS)),
        ).y +
        TRACK_BED_DEPTH_U +
        NEAR_FOOT_OFFSET_U,
      meadow: nearHere === 'meadow' && !scenery.locality.startsWith('station'),
      rateScale,
    });
    this.#particles.step(dtSec);
    this.#effectsView?.draw(this.#particles, this.#originX);
  }

  /** Particle counts for diagnostics and E2E. */
  get effectsStats(): {
    live: number;
    capacity: number;
    kinds: Record<string, number>;
    checksum: number;
  } {
    const kinds: Record<string, number> = {};
    let checksum = 0;
    for (const particle of this.#particles.particles()) {
      const name = kindName(particle.kind) ?? 'unknown';
      kinds[name] = (kinds[name] ?? 0) + 1;
      checksum += Math.round(particle.x * 10) + Math.round(particle.y * 10);
    }
    return {
      live: this.#particles.live,
      capacity: this.#particles.capacity,
      kinds,
      checksum,
    };
  }

  /** An animal from the art atlas, or the marked placeholder without it. */
  #animalImage(
    key: string,
    part: { pivotU: { x: number; y: number } },
  ): Phaser.GameObjects.Image {
    const texture = this.#art?.textureKey;
    const pxPerU = this.#art?.info?.pxPerU;
    if (texture === undefined || pxPerU === undefined)
      return this.add
        .image(0, 0, 'object-sheep')
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.objects);
    const image = this.add.image(0, 0, texture, key).setDepth(DEPTH.objects);
    const origin = frameOrigin(part.pivotU, pxPerU, image.frame);
    return image.setOrigin(origin.x, origin.y);
  }

  #slot(index: number): VehicleSlot {
    let slot = this.#slots[index];
    if (!slot) {
      const container = this.add.container(0, 0).setDepth(DEPTH.train);
      slot = { container, images: [], frames: [] };
      this.#slots[index] = slot;
    }
    return slot;
  }

  #npcSlot(index: number): VehicleSlot {
    let slot = this.#npcSlots[index];
    if (!slot) {
      const container = this.add
        .container(0, 0)
        .setDepth(DEPTH.backProps + SECONDARY_DEPTH.train);
      slot = { container, images: [], frames: [] };
      this.#npcSlots[index] = slot;
    }
    return slot;
  }

  /**
   * Oncoming trains on their second tracks (doc 05 §6): mirrored (they
   * drive left), at the deeper layer's scale, between the tunnel mouths
   * and the portal hills; a vehicle deep inside a portal is not drawn.
   */
  #drawOncoming(ride: RideSimulation, leftX: number, rightX: number): void {
    const catalog = this.#host.catalogVehicles();
    let used = 0;
    let open = 0;
    for (const train of ride.oncomingTrains) {
      const { site } = train;
      train.vehicles.forEach((vehicle, i) => {
        const pose = train.vehiclePose(i);
        const half = vehicle.lengthU / 2;
        if (
          pose.centerX + half < Math.max(leftX, site.fromX - PORTAL_EDGE_U) ||
          pose.centerX - half > Math.min(rightX, site.toX + PORTAL_EDGE_U)
        )
          return;
        const shaped = catalog.find((candidate) => candidate.id === vehicle.id);
        if (!shaped) return;
        const slot = this.#npcSlot(used);
        used += 1;
        slot.container
          .setVisible(true)
          .setPosition(pose.centerX - this.#originX, -pose.centerY)
          .setRotation(-pose.angleRad)
          .setScale(-SECONDARY_SCALE, SECONDARY_SCALE);
        const drawn = this.#drawArtVehicle(
          slot,
          shaped,
          train.travelledU / SECONDARY_SCALE,
        );
        for (let k = drawn; k < slot.images.length; k++)
          slot.images[k]?.setVisible(false);
        if (pose.centerX > site.fromX && pose.centerX < site.toX) open += 1;
      });
    }
    for (let i = used; i < this.#npcSlots.length; i++)
      this.#npcSlots[i]?.container.setVisible(false);
    this.stats.oncomingVehicles = open;
  }

  /** Image `index` of a slot showing `texture`/`frame`, created on demand. */
  #image(
    slot: VehicleSlot,
    index: number,
    texture: string,
    frame?: string,
  ): Phaser.GameObjects.Image {
    let image = slot.images[index];
    if (!image) {
      image = this.add.image(0, 0, texture, frame);
      slot.container.add(image);
      slot.images[index] = image;
    } else if (slot.frames[index] !== `${texture}/${frame ?? ''}`) {
      image.setTexture(texture, frame);
    }
    slot.frames[index] = `${texture}/${frame ?? ''}`;
    return image.setVisible(true);
  }

  /** Re-rasterises the art for a new zoom step and moves every image over. */
  #updateArtScale(zoom: number): void {
    const backdropArt = this.#backdropArt;
    const replacedBackdrop = backdropArt?.update(zoom);
    const backdropKey = backdropArt?.textureKey;
    const backdropPxPerU = backdropArt?.info?.pxPerU;
    if (
      backdropKey !== undefined &&
      backdropPxPerU !== undefined &&
      backdropKey !== this.#backdropTexture
    ) {
      this.#backdrop?.setAtlas(backdropKey, backdropPxPerU);
      this.#backdropTexture = backdropKey;
      if (replacedBackdrop !== undefined)
        backdropArt?.release(replacedBackdrop);
    }
    const art = this.#art;
    const replaced = art?.update(zoom);
    const key = art?.textureKey;
    const pxPerU = art?.info?.pxPerU;
    if (
      key !== undefined &&
      pxPerU !== undefined &&
      key !== this.#effectsTexture
    ) {
      this.#effectsView?.setAtlas(key, pxPerU);
      this.#effectsTexture = key;
    }
    if (replaced === undefined || key === undefined) return;
    // Chunks and animals are rebuilt from the new atlas on this frame's draw.
    this.#destroyChunks();
    this.#destroyObjects();

    for (const slot of [...this.#slots, ...this.#npcSlots]) {
      slot.images.forEach((image, i) => {
        const shown = slot.frames[i];
        if (!shown?.startsWith(`${replaced}/`)) return;
        const frame = shown.slice(replaced.length + 1);
        image.setTexture(key, frame);
        slot.frames[i] = `${key}/${frame}`;
      });
    }
    art?.release(replaced);
  }

  /**
   * Distance from the locomotive's pantograph base up to the contact wire
   * (doc 03 §9); records how far the drawn head misses the wire.
   */
  #pantographReach(
    ride: RideSimulation,
    vehicle: ShapedVehicle,
    pose: { centerX: number; centerY: number; angleRad: number },
  ): number | undefined {
    const art = vehicleArt[vehicle.id];
    const pantograph = art?.pantograph;
    if (!art || !pantograph) return undefined;
    const base = emitterWorldPoint(
      pantograph,
      { lengthU: vehicle.lengthU, heightU: art.heightU },
      pose,
    );
    const rail = (x: number) =>
      heightAtX(
        ride.track.chunkTable(
          Math.min(
            ride.track.lastChunkIndex,
            Math.max(ride.track.firstChunkIndex, Math.floor(x / CHUNK_WIDTH_U)),
          ),
        ),
        x,
      );
    const wire = (x: number) => contactWireHeightU(ride.seed, x, rail);
    const reach = pantographReachU(base, pose.angleRad, wire);
    this.#pantographContact = {
      x: base.x - reach * Math.sin(pose.angleRad),
      y: base.y - reach * Math.cos(pose.angleRad),
    };
    // Where the drawn head ends after its limited stretch.
    const head = vehicleArtLayers(art, vehicle.lengthU, 0, reach).find(
      (layer) => layer.part === pantograph.head,
    );
    if (head) {
      const drawn =
        pantograph.yU - art.heightU - head.y + pantograph.headContactU;
      this.stats.pantographGapU = Math.abs(drawn - reach);
    }
    return reach;
  }

  /** Draws a vehicle's art parts; returns the number of images used. */
  #drawArtVehicle(
    slot: VehicleSlot,
    vehicle: ShapedVehicle,
    distanceU: number,
    pantographReach?: number,
  ): number {
    const art = vehicleArt[vehicle.id];
    const texture = this.#art?.textureKey;
    const pxPerU = this.#art?.info?.pxPerU;
    if (!art || texture === undefined || pxPerU === undefined) return 0;
    const layers = vehicleArtLayers(
      art,
      vehicle.lengthU,
      distanceU,
      pantographReach,
    );
    layers.forEach((layer, i) => {
      const part = artParts[layer.part];
      const image = this.#image(slot, i, texture, layer.part);
      const origin = frameOrigin(part.pivotU, pxPerU, image.frame);
      image
        .setOrigin(origin.x, origin.y)
        .setScale(1 / pxPerU, (layer.scaleY ?? 1) / pxPerU)
        .setPosition(layer.x, layer.y)
        .setRotation(layer.rotation);
    });
    return layers.length;
  }

  /** Marked placeholder silhouette with two turning wheels. */
  #drawPlaceholderVehicle(
    slot: VehicleSlot,
    vehicle: ShapedVehicle,
    distanceU: number,
  ): number {
    const lift = vehicle.wheelRadiusU * 1.3;
    this.#image(slot, 0, `vehicle-${vehicle.id}`)
      .setOrigin(
        0.5,
        (PLACEHOLDER_BODY_HEIGHT_U + PLACEHOLDER_MARGIN_PX) /
          (PLACEHOLDER_BODY_HEIGHT_U + 2 * PLACEHOLDER_MARGIN_PX),
      )
      .setScale(1)
      .setRotation(0)
      .setPosition(0, -lift);
    const wheelScale = (vehicle.wheelRadiusU * 2) / 32;
    [vehicle.bogieOffsetU, -vehicle.bogieOffsetU].forEach((x, i) => {
      this.#image(slot, i + 1, 'wheel')
        .setOrigin(0.5, 0.5)
        .setPosition(x, -vehicle.wheelRadiusU)
        .setScale(wheelScale)
        .setRotation(distanceU / vehicle.wheelRadiusU);
    });
    return 3;
  }

  #drawTrain(
    ride: RideSimulation,
    headS: number,
    leftX: number,
    rightX: number,
  ): void {
    const vehicles = this.#host.journeyVehicles();
    let rendered = 0;
    let art = 0;
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      if (!vehicle) break;
      const pose = ride.vehiclePose(i, headS);
      if (pose.centerX - vehicle.lengthU > rightX) continue;
      // Later vehicles are further left; stop once one is off screen.
      if (pose.centerX + vehicle.lengthU < leftX) break;
      const slot = this.#slot(rendered);
      rendered += 1;
      slot.container.setVisible(true);
      slot.container.setPosition(pose.centerX - this.#originX, -pose.centerY);
      slot.container.setRotation(-pose.angleRad);
      // Wheels turn with travelled distance, not with time (doc 03 §3).
      const distanceU = headS - (ride.layout.centerOffsetsU[i] ?? 0);
      let used = 0;
      if (this.#art) {
        const reach =
          i === 0 && ride.electrified
            ? this.#pantographReach(ride, vehicle, pose)
            : undefined;
        used = this.#drawArtVehicle(slot, vehicle, distanceU, reach);
        if (used > 0) art += 1;
      }
      if (used === 0)
        used = this.#drawPlaceholderVehicle(slot, vehicle, distanceU);
      for (let k = used; k < slot.images.length; k++)
        slot.images[k]?.setVisible(false);
    }
    for (let i = rendered; i < this.#slots.length; i++)
      this.#slots[i]?.container.setVisible(false);
    this.stats.renderedVehicles = rendered;
    this.stats.artVehicles = art;
  }
}
