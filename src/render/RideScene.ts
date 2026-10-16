import { particleRadiusU } from './particles/particleRadius.ts';
import { setFrameResolver } from './frameTexture.ts';
import { mixColour, scenerySnowCoverage } from './groundPalette.ts';
import { atlasProof } from './AtlasProof.ts';
import { AtlasMetrics } from './AtlasMetrics.ts';
import { TextureMemory } from './TextureMemory.ts';
import { worldAtlasWindowKeys } from '../content/worldAtlasGroups.ts';
import { worldAtlasRegions } from './worldAtlasWindow.ts';
import { WorldOverlay } from './WorldOverlay.ts';
import type { WorldOverlayOptions } from '../domain/world/WorldDebugGeometry.ts';
import { transitionAt } from '../domain/world/Regions.ts';
import { worldDiagnostics } from '../domain/world/WorldValidation.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import Phaser from 'phaser';
import type { WorldHit } from '../platform/InputRouter.ts';
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
import type { NpcFleet } from '../domain/interaction/OncomingTrain.ts';
import type { RideSimulation } from '../domain/ride/RideSimulation.ts';
import type { Biome } from '../domain/world/Biomes.ts';
import { heightAtX } from '../domain/world/ArcLengthTable.ts';
import {
  catenaryPoleXs,
  contactWireHeightU,
} from '../domain/world/Catenary.ts';
import {
  PORTAL_HILL_U,
  SECONDARY_SCALE,
  SecondaryLine,
  secondarySiteOfChunk,
} from '../domain/world/SecondaryTrack.ts';
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
  artSourceTextureCount,
  type ArtAtlasInfo,
  type ArtSource,
} from './ArtAtlas.ts';
import {
  ART_MAX_PX_PER_U,
  BACKDROP_MAX_PX_PER_U,
  frameOrigin,
  journeyArtKeys,
  profileArtScale,
  profileBackdropScale,
} from './atlasPacking.ts';
import { placeAnimal } from './animalPlacement.ts';
import { DEPTH } from './RideSceneDepth.ts';
import { effectiveClimateAt } from '../domain/world/Seasons.ts';
import {
  SeasonalEffects,
  frostyWireAt,
  type SeasonalSource,
} from './particles/SeasonalEffects.ts';
import { AmbientLife } from './particles/AmbientLife.ts';
import { EffectsView } from './particles/EffectsView.ts';
import { emitterWorldPoint, passEffectAt } from './particles/emission.ts';
import { ParticleField } from './particles/ParticleField.ts';
import {
  bubbleAt,
  bubbleRadiusU,
  popBubble,
  visibleBubbles,
} from './particles/bubbleInteraction.ts';
import { PARTICLE_KINDS, kindName } from './particles/particleKinds.ts';
import {
  TrainEffects,
  TrainEffectsByTrain,
  type PlacedEmitter,
  type TrainEffectsInput,
} from './particles/TrainEffects.ts';
import { Backdrop } from './Backdrop.ts';
import { ChunkView, SECONDARY_DEPTH } from './ChunkView.ts';
import { BACK_PLANE_U, NEAR_FOOT_OFFSET_U } from './groundLayout.ts';
import { grazingStep, motionScale } from './ambientMotion.ts';
import { pantographReach } from './pantograph.ts';
import {
  secondaryPortalCoversPoint,
  secondaryWeatherCoversPoint,
  vehicleInCover,
  type TrainInTunnel,
} from './tunnelCover.ts';
import { secondaryPortalFeet } from './SecondaryView.ts';
import { WorldAtlasRequests } from './WorldAtlasRequests.ts';
import { rebindWorldImage } from './worldImage.ts';
import {
  frameLeftX,
  frameTopY,
  projectWorldX,
  trainZoom,
  type FramingConfig,
} from './cameraFraming.ts';

/** What the scene needs from the application each frame. */
export interface RideSceneHost {
  worldOverlays?(): WorldOverlayOptions;
  /** Runs one application frame; returns the render interpolation alpha. */
  frame(deltaSec: number, nowMs: number): number;
  ride(): RideSimulation | undefined;
  /** Opaque UI coverage; the application frame must still run underneath. */
  worldHidden(): boolean;
  /** Paused/covered preparation stays asynchronous without waiting for ride frames. */
  worldRunning?(): boolean;
  /** A prepared ride frame has passed through Phaser's renderer. */
  worldDrawn(): void;
  /** Vehicle definitions of the current journey, locomotive first. */
  journeyVehicles(): readonly ShapedVehicle[];
  journeyNpcFleet(): NpcFleet | undefined;
  catalogVehicles(): readonly ShapedVehicle[];
  /** Effects density profile (doc 13 `quality`, reduced effects). */
  effectsQuality(): 'low' | 'standard';
  /** Atlas residency profile; reduced motion does not reduce art resolution. */
  artQuality(): 'low' | 'standard';
}

export interface RenderStats {
  renderedVehicles: number;
  /** Rendered vehicles drawn from their art (the rest are placeholders). */
  artVehicles: number;
  renderedChunks: number;
  /** Target biome of the backdrop (the landscape ahead of the train). */
  biome: Biome | undefined;
  /** Actual backdrop layers and their crossfade progress. */
  backdrop: Backdrop['state'] | undefined;
  /** Localities of the chunks in view, left to right. */
  localities: string[];
  /** Catenary masts in the rendered chunks (doc 03 §9). */
  catenaryPoles: number;
  /** Level crossings drawn in the rendered chunks (art or plain). */
  crossingViews: number;
  /** Second-track chunks and portal hills drawn with art or plain. */
  secondaryTrackViews: number;
  secondaryPortalViews: number;
  /** The first mid backdrop tile's x from the view's left edge, u. */
  backdropMidOffsetU: number;
  /**
   * How far the drawn pantograph head misses the contact wire, u; undefined
   * without a raised pantograph in view.
   */
  pantographGapU: number | undefined;
  pantographOutOfRange: number;
  /** Vehicles of oncoming trains drawn out in the open (doc 05 §6). */
  oncomingVehicles: number;
  /** Tunnels in the rendered chunks, their hills' opacity and the train. */
  tunnels: {
    id: string;
    alpha: number;
    train: TrainInTunnel;
    vehicles: TrainInTunnel[];
  }[];
}

const NO_STATS: RenderStats = {
  renderedVehicles: 0,
  artVehicles: 0,
  renderedChunks: 0,
  biome: undefined,
  backdrop: undefined,
  localities: [],
  catenaryPoles: 0,
  crossingViews: 0,
  secondaryTrackViews: 0,
  secondaryPortalViews: 0,
  backdropMidOffsetU: 0,
  pantographGapU: undefined,
  pantographOutOfRange: 0,
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

/** Sources decode once; only the journey subset is rasterised (D-019). */
const VEHICLE_SOURCES: readonly ArtSource[] = Object.entries(artParts).map(
  ([key, part]) => ({
    key,
    url: artFileUrl(part.file),
    widthU: part.widthU,
    heightU: part.heightU,
  }),
);
/** World parts have a persistent atlas, independent of the journey vehicles. */
const ART_SOURCES: readonly ArtSource[] = Object.entries(worldParts)
  .filter(([key]) => !isBackdropPart(key))
  .map(([key, part]) => ({
    key,
    url: worldFileUrl(part.file),
    widthU: part.widthU,
    heightU: part.heightU,
  }));

/** Backdrops and clouds: their own, coarser atlas (D-013). */
const BACKDROP_SOURCES: readonly ArtSource[] = Object.entries(worldParts)
  .filter(([key]) => isBackdropPart(key))
  .map(([key, part]) => ({
    key,
    url: worldFileUrl(part.file),
    widthU: part.widthU,
    heightU: part.heightU,
  }));

/**
 * Radius of each wheel part in u. A wheel turns, and the box of its turning
 * square frame grows by up to √2 (and by its transparent margin); the
 * drawn disc does not.
 */
const WHEEL_RADIUS_U: ReadonlyMap<string, number> = new Map(
  Object.values(vehicleArt).flatMap((art) =>
    (art?.wheels ?? []).map(
      (wheel) => [wheel.part, artParts[wheel.part].heightU / 2] as const,
    ),
  ),
);
/** Radius of the placeholder wheel's disc in its texture, px. */
const PLACEHOLDER_WHEEL_RADIUS_PX = 16;

/**
 * World box of what an image draws, for the overlap checks: a wheel's disc
 * (its pivot is the centre), otherwise the image's bounds.
 */
function drawnBounds(
  image: Phaser.GameObjects.Image,
  pxPerU: number | undefined,
): Phaser.Geom.Rectangle {
  const radiusU = WHEEL_RADIUS_U.get(image.frame.name);
  const radiusPx =
    image.texture.key === 'wheel'
      ? PLACEHOLDER_WHEEL_RADIUS_PX
      : radiusU !== undefined && pxPerU !== undefined
        ? radiusU * pxPerU
        : undefined;
  if (radiusPx === undefined) return image.getBounds();
  const m = image.getWorldTransformMatrix();
  const r = radiusPx * Math.hypot(m.a, m.b);
  return new Phaser.Geom.Rectangle(m.tx - r, m.ty - r, 2 * r, 2 * r);
}

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
const WEATHER_SPRITE_SAMPLES = [
  [0, 0],
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export class RideScene extends Phaser.Scene {
  readonly #host: RideSceneHost;
  #worldOverlay: WorldOverlay | undefined;
  readonly #chunks = new Map<number, ChunkView>();
  readonly #objectImages = new Map<string, Phaser.GameObjects.Image>();
  readonly #slots: VehicleSlot[] = [];
  /** Vehicles of oncoming trains, behind the main track (doc 05 §6). */
  readonly #npcSlots: VehicleSlot[] = [];
  readonly #portalFeet = new Map<number, Phaser.GameObjects.Graphics[]>();
  /** Scenery of the chunks around the view; pure, so cached per chunk. */
  readonly #scenery = new Map<number, ChunkScenery>();
  /** World y (up) of the top screen edge; eased between frames. */
  #cameraTopY: number | undefined;
  #framing: FramingConfig | undefined;
  /**
   * Simulation tick of the previous frame. Eased and animated motion
   * advances by simulation time since then, so a paused ride holds still.
   */
  #frameTick: number | undefined;
  /** Where the drawn pantograph touches the wire this frame (render). */
  #pantographContact: TrainEffectsInput['pantograph'];
  readonly #pantographPoint = { x: 0, y: 0, outOfRange: false, tiltDeg: 0 };
  #contactSupportChunk: number | undefined;
  #contactSupportXs: readonly number[] = [];
  /** CSS px covered by controls at the top and bottom of the screen. */
  #insetsCss = { top: 0, bottom: 0, controls: 0 };
  #originX = 0;
  #rideRef: RideSimulation | undefined;
  /** Visible world rectangle (render-local units) of the latest frame. */
  #view = { left: 0, top: 0, zoom: 1 };
  #visibleObjects: VisibleObject[] = [];
  /** World art; undefined if it failed (plain shapes drawn). */
  #art: ArtAtlas | undefined;
  readonly atlasMetrics = new AtlasMetrics();
  readonly #textureMemory = new TextureMemory();
  /** Created in preload with the world and backdrop atlas owners. */
  #windowRequests = new WorldAtlasRequests(undefined, undefined);
  readonly #worldLoadFailures: string[] = [];
  #worldSwaps = 0;
  #worldRegions: ReturnType<typeof worldAtlasRegions> = [];
  /** Journey vehicles and NPC fleet, independent of world art failure. */
  #vehicleArt: ArtAtlas | undefined;
  #vehicleRequest: string | undefined;
  #vehicleGeneration = 0;
  #vehiclePending = false;
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
  #bubblePops = 0;
  readonly #trainEffects = new TrainEffects(this.#particles, Math.random);
  /** Oncoming trains' smoke, one emission state per train. */
  readonly #npcEffects = new TrainEffectsByTrain(this.#particles, Math.random);
  readonly #ambient = new AmbientLife(this.#particles, Math.random);
  readonly #seasonalEffects = new SeasonalEffects(this.#particles, Math.random);
  readonly #seasonalSources: SeasonalSource[] = [];
  #effectsCostMs = 0;
  #animationCostMs = 0;
  readonly #weatherSample = { x: 0, y: 0 };
  readonly #weatherPortalByChunk = new Map<
    number,
    { x: number; y: number; grade: number; mirrored: boolean }[]
  >();
  readonly #weatherPortals: {
    x: number;
    y: number;
    grade: number;
    mirrored: boolean;
  }[] = [];
  #animationBudgetRemaining = 0;
  #animalAnimated = 0;
  readonly #animalTimes = new Map<string, number>();
  #lastAnimalSec: number | undefined;
  #effectsView: EffectsView | undefined;
  #effectsTexture: string | undefined;
  stats: RenderStats = NO_STATS;
  rideFramesDrawn = 0;

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
  get artAtlas(): (ArtAtlasInfo & { textureKey: string }) | undefined {
    const info = this.#art?.info;
    const textureKey = this.#art?.textureKey;
    return info && textureKey ? { ...info, textureKey } : undefined;
  }

  get vehicleAtlas():
    (ArtAtlasInfo & { textureKey: string; vehicleIds: string[] }) | undefined {
    const info = this.#vehicleArt?.info;
    const textureKey = this.#vehicleArt?.textureKey;
    return info && textureKey
      ? {
          ...info,
          textureKey,
          vehicleIds: Object.entries(vehicleArt).flatMap(([id, art]) =>
            art && this.textures.get(textureKey).has(art.body) ? [id] : [],
          ),
        }
      : undefined;
  }

  /** Size of the backdrop atlas, for diagnostics. */
  get backdropAtlas(): ArtAtlasInfo | undefined {
    return this.#backdropArt?.info;
  }

  /** Known RGBA8 texture copies and allocation high water, including source and buffer overlap. */
  get worldAtlases() {
    const atlases = [this.#art, this.#backdropArt];
    const memory = this.#textureMemory.snapshot;
    return {
      pending: this.#windowRequests.pending || this.#vehiclePending,
      failure:
        this.#windowRequests.failure ??
        (this.#worldLoadFailures.length
          ? this.#worldLoadFailures.join('; ')
          : undefined),
      swaps: this.#worldSwaps,
      regions: this.#worldRegions.map(({ id, landscape, season }) => ({
        id,
        landscape,
        season,
      })),
      pages: atlases.flatMap(
        (atlas) =>
          atlas?.pages.map(({ key, info }) => ({ textureKey: key, ...info })) ??
          [],
      ),
      textureBytes: memory.bytes,
      memory,
      performance: this.atlasMetrics.snapshot,
      bufferBytes: atlases.reduce(
        (sum, atlas) => sum + (atlas?.decodedBytes ?? 0),
        0,
      ),
      liveTextures: this.textures
        .getTextureKeys()
        .filter((key) => key.startsWith('art@') || key.startsWith('backdrop@'))
        .length,
      ...this.#worldArtDiagnostics(),
    };
  }

  #worldArtDiagnostics(): { drawnParts: number; missingFrames: string[] } {
    const missing = new Set<string>();
    let drawnParts = 0;
    const visit = (object: Phaser.GameObjects.GameObject): void => {
      if (object instanceof Phaser.GameObjects.Container) {
        if (object.visible) object.list.forEach(visit);
        return;
      }
      if (!(object instanceof Phaser.GameObjects.Image) || !object.visible)
        return;
      const expected: unknown = object.getData('world-part');
      if (typeof expected !== 'string') return;
      drawnParts++;
      if (object.frame.name !== expected) missing.add(expected);
    };
    this.children.list.forEach(visit);
    for (const frame of this.#backdrop?.state.missingFrames ?? [])
      missing.add(frame);
    for (const chunk of this.#chunks.values())
      for (const frame of chunk.missingCompositionFrames) missing.add(frame);
    return { drawnParts, missingFrames: [...missing] };
  }

  #closeAtlasProof: (() => void) | undefined;
  async atlasProof(
    catalogue?: import('../app/debugSnapshot.ts').AtlasProofSources,
  ) {
    this.#closeAtlasProof?.();
    const proof = await atlasProof(
      this,
      this.#textureMemory,
      this.atlasMetrics,
      catalogue,
    );
    this.#closeAtlasProof = proof.close;
    return { cycles: proof.cycles, performance: proof.performance };
  }
  closeAtlasProof(): void {
    this.#closeAtlasProof?.();
    this.#closeAtlasProof = undefined;
  }

  #watchTextureMemory(): void {
    if (!this.textures) return;
    const add = (key: string, texture: Phaser.Textures.Texture) => {
      let canvas = 0,
        sources = 0,
        gpu = 0;
      for (const source of texture.source) {
        const image = source.image;
        if (image instanceof HTMLCanvasElement)
          canvas += image.width * image.height * 4;
        else if (image instanceof HTMLImageElement)
          sources += image.width * image.height * 4;
        if (source.glTexture) gpu += source.width * source.height * 4;
      }
      const imageData: unknown = Reflect.get(texture, 'imageData');
      this.#textureMemory.set(`texture:${key}`, {
        canvas,
        sources,
        gpu,
        imageData:
          imageData instanceof ImageData ? imageData.data.byteLength : 0,
      });
    };
    const remove = (key: string) =>
      this.#textureMemory.remove(`texture:${key}`);
    for (const key of Object.keys(this.textures.list))
      add(key, this.textures.get(key));
    this.textures.on('addtexture', add);
    this.textures.on('removetexture', remove);
    this.events.once('destroy', () => {
      this.textures.off('addtexture', add);
      this.textures.off('removetexture', remove);
    });
  }

  /** Loaded SVG sources not yet released, for diagnostics. */
  get artSourceTextures(): number {
    return artSourceTextureCount(this);
  }

  preload(): void {
    this.#watchTextureMemory();
    try {
      this.#art = new ArtAtlas(this, ART_SOURCES, {
        maxPxPerU: ART_MAX_PX_PER_U,
        texturePrefix: 'art@',
        decodeOnDemand: true,
        prefetchText: true,
        yieldToFrame: () => this.#host.worldRunning?.() ?? true,
        gpuOnly: this.game.renderer.type === 2,
        metrics: this.atlasMetrics,
        memory: this.#textureMemory,
      });
    } catch (error) {
      this.#worldLoadFailures.push(`world: ${String(error)}`);
      console.error(error);
    }
    try {
      this.#backdropArt = new ArtAtlas(this, BACKDROP_SOURCES, {
        maxPxPerU: BACKDROP_MAX_PX_PER_U,
        texturePrefix: 'backdrop@',
        decodeOnDemand: true,
        prefetchText: true,
        yieldToFrame: () => this.#host.worldRunning?.() ?? true,
        gpuOnly: this.game.renderer.type === 2,
        metrics: this.atlasMetrics,
        memory: this.#textureMemory,
      });
    } catch (error) {
      this.#worldLoadFailures.push(`backdrop: ${String(error)}`);
      console.error(error);
    }
    const vehicles = () => this.#vehicleArt;
    this.#windowRequests = new WorldAtlasRequests(
      this.#art,
      this.#backdropArt,
      console.error,
      {
        get ready() {
          return vehicles()?.ready ?? false;
        },
        get settling() {
          return vehicles()?.settling ?? false;
        },
      },
    );
    // Every frameTexture caller resolves through the published D-030 pages.
    setFrameResolver(
      (frame) =>
        this.#art?.textureFor(frame) ?? this.#backdropArt?.textureFor(frame),
    );
    this.events.once('destroy', () => {
      setFrameResolver(undefined);
      this.#art?.destroy();
      this.#backdropArt?.destroy();
    });
  }

  create(): void {
    let renderedFrames = this.rideFramesDrawn;
    const presented = () => {
      this.atlasMetrics.frame(performance.now());
      if (this.rideFramesDrawn === renderedFrames) return;
      renderedFrames = this.rideFramesDrawn;
      this.#host.worldDrawn();
    };
    const renderer = this.game.renderer;
    renderer.on(Phaser.Renderer.Events.POST_RENDER, presented);
    const stopPresenting = () => {
      renderer.off(Phaser.Renderer.Events.POST_RENDER, presented);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopPresenting);
    const restore = () => {
      this.#destroyChunks();
      this.#destroyObjects();
      this.#backdrop?.destroy();
      this.#effectsView?.destroy();
      this.#backdrop = new Backdrop(this, {
        sky: DEPTH.sky,
        clouds: DEPTH.clouds,
        far: DEPTH.far,
        mid: DEPTH.mid,
      });
      this.#effectsView = new EffectsView(this, DEPTH.effects);
      this.#art?.invalidate();
      this.#backdropArt?.invalidate();
      this.#vehicleArt?.invalidate();
      this.#vehicleRequest = undefined;
      this.#vehicleGeneration++;
      this.#vehiclePending = false;
      this.#windowRequests.reset();
      this.#effectsTexture = undefined;
      for (const slot of [...this.#slots, ...this.#npcSlots])
        slot.container.destroy();
      this.#slots.length = 0;
      this.#npcSlots.length = 0;
    };
    renderer.on('restorewebgl', restore);
    this.events.once('destroy', () => renderer.off('restorewebgl', restore));
    this.cameras.main.setBackgroundColor('#bfe3f2');
    // A failed download must not stop the ride (PWA-10): vehicles fall
    // back to their marked placeholder silhouettes, the backdrop to sky.
    try {
      this.#vehicleArt = new ArtAtlas(this, VEHICLE_SOURCES, {
        maxPxPerU: ART_MAX_PX_PER_U,
        texturePrefix: 'vehicle@',
        singlePage: true,
        decodeOnDemand: true,
        prefetchText: true,
        yieldToFrame: () => this.#host.worldRunning?.() ?? true,
        gpuOnly: this.game.renderer.type === 2,
        metrics: this.atlasMetrics,
        memory: this.#textureMemory,
      });
    } catch (error) {
      console.error(error);
    }
    this.#worldOverlay = new WorldOverlay(this, DEPTH.effects + 1);
    this.#effectsView = new EffectsView(this, DEPTH.effects);
    this.#backdrop = new Backdrop(this, {
      sky: DEPTH.sky,
      clouds: DEPTH.clouds,
      far: DEPTH.far,
      mid: DEPTH.mid,
    });
    this.events.once('destroy', () => {
      this.closeAtlasProof();
      stopPresenting();
      this.#worldOverlay?.destroy();
      for (const feet of this.#portalFeet.values())
        for (const foot of feet) foot.destroy();
      this.#portalFeet.clear();
      this.#backdrop?.destroy();
      this.#effectsView?.destroy();
      this.#windowRequests.reset();
      this.#vehicleArt?.destroy();
    });
    let tallestU = 0;
    for (const vehicle of this.#host.catalogVehicles()) {
      const art = vehicleArt[vehicle.id];
      const height = PLACEHOLDER_BODY_HEIGHT_U;
      tallestU = Math.max(
        tallestU,
        art ? art.heightU : height + vehicle.wheelRadiusU * 1.3,
      );
    }
    this.#framing = { ...gameConfig.camera, vehicleHeightU: tallestU + 8 };
    const wheel = this.make.graphics({}, false);
    const hub = PLACEHOLDER_WHEEL_RADIUS_PX + PLACEHOLDER_MARGIN_PX;
    wheel
      .fillStyle(0x222222, 1)
      .fillCircle(hub, hub, PLACEHOLDER_WHEEL_RADIUS_PX);
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

  /** World render point exposed by the same geometry that covers train particles. */
  readonly #outsideTunnel = (point: { x: number; y: number }): boolean => {
    for (const chunk of this.#chunks.values())
      if (chunk.tunnel?.coversPoint(point)) return false;
    return true;
  };

  #weatherOutside(point: { x: number; y: number }, radiusU: number): boolean {
    const ride = this.#host.ride();
    if (!ride) return true;
    const p = this.#weatherSample;
    for (const [dx, dy] of WEATHER_SPRITE_SAMPLES) {
      p.x = point.x + dx * radiusU;
      p.y = point.y + dy * radiusU;
      if (!this.#outsideTunnel(p)) return false;
    }
    for (const portal of this.#weatherPortals)
      if (
        Math.abs(point.x - portal.x) < 450 &&
        secondaryWeatherCoversPoint(point, portal, radiusU)
      )
        return false;
    return true;
  }

  /** CSS px → interactive object id under the finger (doc 02 §3). */
  hitObject(
    cssX: number,
    cssY: number,
    canvasRect: DOMRect,
  ): WorldHit | undefined {
    const world = this.#toWorld(cssX, cssY, canvasRect);
    if (this.#effectsTexture !== undefined) {
      const bubbleId = bubbleAt(
        this.#particles,
        world.x + this.#originX,
        world.y,
        this.#outsideTunnel,
        (gameConfig.input.minTargetCssPx / 2) * world.unitsPerCss,
      );
      if (bubbleId !== undefined) return { bubbleId };
    }
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

  popBubble(id: number): boolean {
    if (
      !popBubble(
        this.#particles,
        id,
        this.#host.effectsQuality() === 'low' ? 0.5 : 1,
        this.#outsideTunnel,
      )
    )
      return false;
    this.#bubblePops += 1;
    return true;
  }

  /** Visible bubbles in CSS px; the hit test uses the same drawn positions. */
  bubbleScreenPositions(
    canvasRect: DOMRect,
  ): { id: number; x: number; y: number; radiusCssPx: number }[] {
    if (this.#effectsTexture === undefined) return [];
    const scale =
      (this.#view.zoom * Math.max(1, canvasRect.width)) / this.scale.width;
    return visibleBubbles(this.#particles, this.#outsideTunnel)
      .map((bubble) => {
        const at = this.#particles.positionOf(bubble);
        return {
          id: bubble.id,
          x: canvasRect.left + (at.x - this.#originX - this.#view.left) * scale,
          y: canvasRect.top + (at.y - this.#view.top) * scale,
          radiusCssPx:
            bubbleRadiusU(this.#particles, bubble, 1 / scale) * scale,
        };
      })
      .filter(
        ({ x, y }) =>
          x >= canvasRect.left &&
          x <= canvasRect.right &&
          y >= canvasRect.top &&
          y <= canvasRect.bottom,
      );
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

  get roadVehicles() {
    return [...this.#chunks.values()].flatMap((chunk) => chunk.roadVehicles);
  }

  get worldOverlayCount(): number {
    return this.#worldOverlay?.count ?? 0;
  }

  /** Projects with the latest drawn camera, including interpolation and rebase. */
  worldScreenX(worldX: number, canvasRect: DOMRect): number {
    return projectWorldX(
      worldX,
      this.#view.left + this.#originX,
      this.#view.zoom,
      this.scale.width,
      canvasRect,
    );
  }

  /** Screen x (CSS px) of the chunk boundaries in view, for E2E. */
  chunkEdgesScreenX(canvasRect: DOMRect): number[] {
    const left = this.#view.left + this.#originX;
    const right = left + this.scale.width / this.#view.zoom;
    const edges: number[] = [];
    for (
      let k = Math.ceil(left / CHUNK_WIDTH_U);
      k * CHUNK_WIDTH_U <= right;
      k++
    )
      edges.push(this.worldScreenX(k * CHUNK_WIDTH_U, canvasRect));
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
  waterMountainCheck() {
    return [...this.#chunks.values()].flatMap(
      (chunk) => chunk.waterMountainDiagnostics,
    );
  }
  farmForestCheck() {
    return [...this.#chunks.values()].flatMap((chunk) => chunk.farmDiagnostics);
  }
  nearPropCheck(): { inView: number; overTrain: number; overlaps: string[] } {
    const view = this.cameras.main.worldView;
    const train = this.#slots
      .filter((slot) => slot.container.visible)
      .flatMap((slot) => slot.images.filter((image) => image.visible))
      .map((image) => ({
        frame: image.frame.name,
        box: drawnBounds(image, this.#vehicleArt?.info?.pxPerU),
      }));
    let inView = 0;
    let overTrain = 0;
    const overlaps: string[] = [];
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
        const hit = train.find(({ box }) =>
          Phaser.Geom.Rectangle.Overlaps(box, bounds),
        );
        if (!hit) continue;
        overTrain += 1;
        overlaps.push(`${prop.frame.name} over ${hit.frame}`);
      }
    }
    return { inView, overTrain, overlaps };
  }

  #reset(): void {
    this.#particles.clear();
    this.#trainEffects.reset();
    this.#contactSupportChunk = undefined;
    this.#contactSupportXs = [];
    this.#ambient.reset();
    this.#seasonalEffects.clear();
    this.#animalTimes.clear();
    this.#weatherPortalByChunk.clear();
    this.#weatherPortals.length = 0;
    this.#lastAnimalSec = undefined;
    this.#seasonalSources.length = 0;
    this.#backdrop?.reset();
    this.#bubblePops = 0;
    this.#npcEffects.clear();
    this.#frameTick = undefined;
    this.#destroyChunks();
    this.#destroyObjects();
    this.#scenery.clear();
    for (const slot of [...this.#slots, ...this.#npcSlots])
      slot.container.destroy();
    this.#slots.length = 0;
    this.#npcSlots.length = 0;
    const vehicles = this.#host.journeyVehicles();
    const fleet = this.#host.journeyNpcFleet() ?? {
      locomotives: [],
      wagons: [],
    };
    this.#vehicleRequest = undefined;
    this.#vehicleGeneration++;
    this.#vehiclePending = false;
    this.#vehicleArt?.selectParts(journeyArtKeys(vehicles, fleet));
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
      scenery = chunkScenery(seed, chunkIndex, worldPlacementCatalog);
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
    if (this.#host.worldHidden()) {
      this.sys.setVisible(false);
      return;
    }
    if (!this.sys.isVisible()) {
      // Snap after hidden resize; the normal draw reconciles the chunk window.
      this.#cameraTopY = undefined;
      this.#horizonY = undefined;
      this.sys.setVisible(true);
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
    this.stats.pantographOutOfRange = 0;
    this.#pantographContact = undefined;
    // Simulation time since the last frame: 0 while paused (and on a
    // ride's first frame), at most the simulation's catch-up per frame.
    const tick = ride.simulationTick;
    const simDtSec =
      this.#frameTick === undefined
        ? 0
        : Math.max(0, tick - this.#frameTick) / gameConfig.simulation.fixedHz;
    this.#frameTick = tick;
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
    // Fixed for this journey and viewport; neither grades nor speed zoom it.
    const zoom = trainZoom(viewport, consistLengthU, framing);
    camera.setZoom(zoom);

    this.#updateVehicleArtScale(zoom);
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
      simDtSec,
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
    // A fresh ride/jump cannot bake its chunks from the preceding region's pages.
    // Existing chunks keep rendering while their next window prepares in flight.
    if (
      this.#vehiclePending &&
      (!this.#vehicleArt?.textureKey || this.#chunks.size === 0)
    )
      return;
    // Cancelled vehicle decoders settle before world allocations start (D-030).
    if (!this.#vehiclePending && !this.#vehicleArt?.settling)
      this.#updateWorldWindow(ride.seed, leftX, rightX, zoom);
    if (
      this.#windowRequests.pending &&
      (!this.#art?.textureKey ||
        !this.#backdropArt?.textureKey ||
        this.#chunks.size === 0)
    )
      return;
    this.#drawTrack(ride, leftX, rightX, timeSec);
    this.#worldOverlay?.draw(
      ride.seed,
      Math.max(ride.track.firstChunkIndex, Math.floor(leftX / 1024) - 1),
      Math.min(ride.track.lastChunkIndex, Math.floor(rightX / 1024) + 1),
      this.#originX,
      zoom,
      this.#host.worldOverlays?.() ?? {
        areas: false,
        boundaries: false,
        roads: false,
      },
    );
    // Animals stay above the controls in the bottom corners (doc 02).
    this.#freeBottomY =
      this.#view.top +
      (this.scale.height - this.#insetsCss.controls * gamePerCss) / zoom -
      FREE_BAND_MARGIN_U;
    this.#drawObjects(ride, leftX, rightX, timeSec);
    this.#drawTrain(ride, headS, leftX, rightX);
    this.#drawOncoming(ride, leftX, rightX);
    this.#drawEffects(
      ride,
      headS,
      leftX,
      rightX,
      viewW,
      viewH,
      simDtSec,
      gamePerCss / zoom,
    );

    const horizonTarget = -(minRailY + maxRailY) / 2;
    this.#horizonY =
      this.#horizonY === undefined
        ? horizonTarget
        : this.#horizonY +
          (horizonTarget - this.#horizonY) *
            (1 - Math.exp(-simDtSec / HORIZON_EASE_SEC));
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
        worldLeft: this.#view.left + this.#originX,
        top: this.#view.top,
        width: viewW,
        height: viewH,
      },
      this.#horizonY,
      groundTopY,
      transitionAt(ride.seed, ride.sample(ride.headS).x),
      timeSec,
      {
        ...worldDiagnostics(
          ride.seed,
          ride.sample(ride.headS).x,
          [...this.#scenery.values()],
          this.#chunks.size,
        ),
        animatedObjects:
          [...this.#chunks.values()].reduce(
            (sum, chunk) => sum + chunk.animatedObjectCount,
            0,
          ) + this.#animalAnimated,
        renderedFragments: [...this.#chunks.values()].reduce(
          (sum, chunk) => sum + chunk.fragmentIds.length,
          0,
        ),
      },
    );
    this.stats.backdrop = this.#backdrop?.state;
    this.stats.backdropMidOffsetU = this.#backdrop?.midOffsetU ?? 0;
    const localities: string[] = [];
    for (
      let k = Math.floor(leftWorldX / CHUNK_WIDTH_U);
      k * CHUNK_WIDTH_U < leftWorldX + viewW;
      k++
    )
      localities.push(this.#sceneryOf(ride.seed, k).locality);
    this.stats.biome = biome;
    this.stats.localities = localities;
    this.rideFramesDrawn++;
  }

  #destroyChunks(): void {
    this.#worldOverlay?.clear();
    for (const chunk of this.#chunks.values()) chunk.destroy();
    this.#chunks.clear();
    this.#weatherPortalByChunk.clear();
    this.#weatherPortals.length = 0;
    for (const feet of this.#portalFeet.values())
      for (const foot of feet) foot.destroy();
    this.#portalFeet.clear();
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
        for (const foot of this.#portalFeet.get(index) ?? []) foot.destroy();
        this.#portalFeet.delete(index);
        this.#weatherPortalByChunk.delete(index);
      }
    }
    for (const index of this.#scenery.keys())
      if (index < first || index > last) this.#scenery.delete(index);
    const crossings = new Map(ride.crossings.map((c) => [c.id, c]));
    // Reduced effects calm the decorative motion (doc 07 §9).
    const motion = motionScale(this.#host.effectsQuality());
    // The whole train's x interval, for tunnel coverage diagnostics.
    const trainSpan = {
      minX: ride.sample(ride.tailS).x,
      maxX: ride.sample(ride.frontS).x,
    };
    const texture = this.#art?.textureKey;
    const pxPerU = this.#art?.info?.pxPerU;
    const art =
      texture !== undefined && pxPerU !== undefined
        ? {
            texture,
            pxPerU,
            textureFor: (frame: string) =>
              this.#art?.textureFor(frame) ?? 'object-sheep',
          }
        : undefined;
    const animationStarted = performance.now();
    let animationBudget =
      (this.#host.effectsQuality() === 'low' ? 64 : 160) - 8;
    const backdropAtlas = this.#backdropArt;
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
          this.#backdropArt?.textureKey && this.#backdropArt.info
            ? {
                get texture() {
                  return backdropAtlas?.textureKey ?? 'object-sheep';
                },
                get pxPerU() {
                  return backdropAtlas?.info?.pxPerU ?? 1;
                },
                textureFor: (frame: string) => backdropAtlas?.textureFor(frame),
              }
            : undefined,
          this.#textureMemory,
        );
        this.#chunks.set(k, chunk);
        const site = secondarySiteOfChunk(ride.seed, k);
        if (site && chunk.secondaryPortalViews > 0) {
          const line = new SecondaryLine(ride.seed, site, PORTAL_HILL_U);
          const portals = [
            [site.fromX, false],
            [site.toX, true],
          ] as const;
          this.#weatherPortalByChunk.set(
            k,
            portals
              .filter(
                ([x, mirrored]) =>
                  (mirrored
                    ? Math.ceil(x / CHUNK_WIDTH_U) - 1
                    : Math.floor(x / CHUNK_WIDTH_U)) === k,
              )
              .map(([x, mirrored]) => {
                const rail = line.sample(line.sAtX(x));
                return { x, y: -rail.y, grade: rail.grade, mirrored };
              }),
          );
          this.#portalFeet.set(
            k,
            secondaryPortalFeet(
              this,
              site,
              (x) => -line.sample(line.sAtX(x)).y,
              DEPTH.backProps + SECONDARY_DEPTH.hill,
              k,
              (x) =>
                mixColour(
                  0x6eae43,
                  0xe7f0f5,
                  effectiveClimateAt(ride.seed, x).winter,
                ),
            ),
          );
        }
      }
      chunk.setX(k * CHUNK_WIDTH_U - this.#originX);
      chunk.setVisibleRange(
        leftX - k * CHUNK_WIDTH_U,
        rightX - k * CHUNK_WIDTH_U,
      );
      for (const foot of this.#portalFeet.get(k) ?? [])
        foot.setX(-this.#originX);
      chunk.tunnel?.update(trainSpan);
    }
    this.#weatherPortals.length = 0;
    for (const portals of this.#weatherPortalByChunk.values())
      this.#weatherPortals.push(...portals);
    const visibleChunks = [...this.#chunks.entries()].sort(([a], [b]) => {
      const center = (leftX + rightX) / 2 / CHUNK_WIDTH_U;
      return Math.abs(a - center) - Math.abs(b - center);
    });
    for (const stage of ['life', 'decoration'] as const)
      for (const [k, chunk] of visibleChunks) {
        const site = this.#sceneryOf(ride.seed, k).crossing;
        animationBudget -= chunk.update(
          timeSec,
          site && crossings.get(site.id),
          motion,
          ride.sample(ride.frontS).x,
          Math.max(0, animationBudget),
          {
            left: leftX - k * CHUNK_WIDTH_U,
            right: rightX - k * CHUNK_WIDTH_U,
          },
          stage,
          trainSpan.maxX - ride.layout.frontOffsetU,
          ride.speedUPerSec,
          this.#host.worldOverlays?.().roads ?? false,
        );
      }
    this.#animationBudgetRemaining = Math.max(0, animationBudget) + 8;
    if (this.#lastAnimalSec === undefined || timeSec > this.#lastAnimalSec)
      this.#animationCostMs = performance.now() - animationStarted;
    this.stats.tunnels = [...this.#chunks.values()].flatMap((chunk) => {
      const tunnel = chunk.tunnel;
      if (!tunnel) return [];
      return [
        {
          id: tunnel.id,
          alpha: tunnel.alpha,
          train: tunnel.train,
          vehicles: this.#host.journeyVehicles().map((vehicle, i) => {
            const pose = ride.vehiclePose(i);
            const half = vehicle.lengthU / 2;
            return vehicleInCover(
              { minX: pose.centerX - half, maxX: pose.centerX + half },
              [tunnel.coverRange],
            );
          }),
        },
      ];
    });
    this.stats.renderedChunks = this.#chunks.size;
    this.stats.crossingViews = [...this.#chunks.values()].filter(
      (chunk) => chunk.hasCrossingView,
    ).length;
    this.stats.secondaryTrackViews = [...this.#chunks.values()].filter(
      (chunk) => chunk.hasSecondaryTrackView,
    ).length;
    this.stats.secondaryPortalViews = [...this.#chunks.values()].reduce(
      (sum, chunk) => sum + chunk.secondaryPortalViews,
      0,
    );
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
    const started = performance.now();
    const dt =
      this.#lastAnimalSec === undefined
        ? 0
        : Math.min(0.1, Math.max(0, timeSec - this.#lastAnimalSec));
    this.#lastAnimalSec = timeSec;
    this.#animalAnimated = 0;
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
      const phase = (hash32('graze', object.id) % 1000) / 1000;
      const grazer = animal.kind === 'cow' || animal.kind === 'sheep';
      // The animal stands in the near meadow, at its depth (doc 05 §2).
      const meadowY =
        -point.y +
        TRACK_BED_DEPTH_U +
        bankHeightU(ride.seed, point.x) +
        NEAR_FOOT_OFFSET_U;
      const placed = placeAnimal(
        animal.depth,
        part.heightU,
        (this.#freeBottomY - meadowY) / NEAR_DEPTH_RANGE_U,
      );
      if (!placed) {
        // A small phone: even the bank foot is among the controls, so the
        // animal is left out, neither drawn nor touchable (doc 02).
        this.#objectImages.get(object.id)?.setVisible(false);
        continue;
      }
      const animate = this.#animationBudgetRemaining > 0;
      if (animate) {
        this.#animationBudgetRemaining--;
        this.#animalAnimated++;
      }
      const localTime =
        (this.#animalTimes.get(object.id) ?? 0) + (animate ? dt : 0);
      this.#animalTimes.set(object.id, localTime);
      const step =
        grazingStep(animal.kind, localTime, phase, part.widthU) *
        ANIMAL_SCALE *
        nearDepthScale(animal.depth);
      const x = point.x - this.#originX + step;
      const { depth, fit } = placed;
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
                  (0.8 * localTime +
                    (hash32('breath', object.id) % 1000) / 1000),
              ));
      const base = drawn ? scale / pxPerU : 1;
      image
        .setVisible(true)
        .setScale(base * (grazer ? 0.94 : 1), base * breath)
        .setPosition(x, y - hop);
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
    for (const id of this.#animalTimes.keys())
      if (!visible.has(id)) this.#animalTimes.delete(id);
    if (dt > 0) this.#animationCostMs += performance.now() - started;
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
    dtSec: number,
    unitsPerCss: number,
  ): void {
    const started = performance.now();
    const quality = this.#host.effectsQuality();
    this.#particles.setCapacity(
      gameConfig.quality[quality].maxDecorativeParticles,
    );
    const rateScale = quality === 'low' ? 0.5 : 1;
    this.#seasonalSources.length = 0;
    for (const chunk of this.#chunks.values())
      this.#seasonalSources.push(...chunk.seasonalSources);
    const vehicles = this.#host.journeyVehicles();
    const locomotive = vehicles[0];
    const art = locomotive ? vehicleArt[locomotive.id] : undefined;
    const emitters: PlacedEmitter[] = [];
    const wheels: { x: number; y: number }[] = [];
    let front: TrainEffectsInput['front'] = { x: 0, y: 0, ground: undefined };
    if (locomotive) {
      const pose = ride.vehiclePose(0, headS);
      const effect = locomotive.effect;
      const kind = effect === 'none' ? undefined : effect;
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
      travelDirection: 1,
      maxSpeedUPerSec: gameConfig.train.maxSpeedUPerSec,
      intent: ride.lastIntent,
      emitters,
      canEmit: this.#outsideTunnel,
      depth: DEPTH.trainEffects,
      driverRadiusU: locomotive?.wheelRadiusU,
      wheels,
      front,
      rateScale,
      groundAt: (x) => {
        const c = effectiveClimateAt(ride.seed, x);
        const k = Math.floor(x / CHUNK_WIDTH_U);
        const sc = this.#sceneryOf(ride.seed, k);
        const snow = scenerySnowCoverage(ride.seed, x, sc);
        if (snow > 0) return { kind: 'snow', strength: snow };
        if (
          c.autumn > 0 &&
          this.#seasonalSources.some(
            (source) =>
              (source.kind === 'deciduous' || source.kind === 'blossom') &&
              Math.abs(source.x - x) < 180,
          )
        )
          return { kind: 'leaves', strength: c.autumn };
        return undefined;
      },
      catenarySupportXs: this.#contactSupportXs,
      ...(this.#pantographContact
        ? {
            pantograph: this.#pantographContact,
            frostyWire: frostyWireAt(ride.seed, this.#pantographContact.x),
          }
        : {}),
    });
    // Oncoming locomotives emit their own effect outside their tunnels.
    this.#npcEffects.retain(new Set(ride.oncomingTrains.map((t) => t.id)));
    for (const train of ride.oncomingTrains) {
      const loco = train.vehicles[0];
      const shaped = this.#host
        .catalogVehicles()
        .find((candidate) => candidate.id === loco?.id);
      const npcArt = shaped ? vehicleArt[shaped.id] : undefined;
      const kind = shaped?.effect === 'none' ? undefined : shaped?.effect;
      if (!loco || !shaped || !npcArt || kind === undefined) continue;
      const pose = train.vehiclePose(0);
      const npcEmitters: PlacedEmitter[] = (npcArt.emitters ?? []).map(
        (emitter) => ({
          kind,
          ...emitterWorldPoint(
            emitter,
            { lengthU: shaped.lengthU, heightU: npcArt.heightU },
            pose,
            { mirrored: true, scale: SECONDARY_SCALE },
          ),
        }),
      );
      this.#npcEffects.step(train.id, {
        dtSec,
        speedUPerSec: train.speedUPerSec,
        travelDirection: -1,
        maxSpeedUPerSec: gameConfig.train.maxSpeedUPerSec,
        intent: 'THROTTLE',
        emitters: npcEmitters,
        depth: DEPTH.npcEffects,
        canEmit: (point) => {
          if (point.x <= train.site.fromX || point.x >= train.site.toX)
            return false;
          return ![train.site.fromX, train.site.toX].some((portalX) => {
            const rail = train.line.sample(train.line.sAtX(portalX));
            return secondaryPortalCoversPoint(point, {
              x: portalX,
              y: -rail.y,
              grade: rail.grade,
              mirrored: portalX === train.site.toX,
            });
          });
        },
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
      meadow:
        nearHere === 'meadow' &&
        !scenery.locality.startsWith('station') &&
        effectiveClimateAt(ride.seed, middleX).winter < 0.1,
      coast: ['coast', 'dunes'].includes(
        transitionAt(ride.seed, middleX).from.landscape,
      ),
      rateScale,
    });
    this.#seasonalEffects.step({
      seed: ride.seed,
      dtSec,
      timeSec: ride.simulationTick / gameConfig.simulation.fixedHz,
      view: {
        left: this.#view.left + this.#originX,
        top: this.#view.top,
        width: viewW,
        height: viewH,
      },
      sources: this.#seasonalSources,
      frontXU: ride.sample(headS + ride.layout.frontOffsetU).x,
      speedUPerSec: ride.speedUPerSec,
      rateScale,
      canEmit: (point) => this.#weatherOutside(point, 12),
      weatherBottomAt: (x, depth) => {
        if (depth > DEPTH.train) return this.#freeBottomY;
        const k = Math.floor(x / CHUNK_WIDTH_U);
        if (k < ride.track.firstChunkIndex || k > ride.track.lastChunkIndex)
          return this.#view.top;
        return (
          -heightAtX(ride.track.chunkTable(k), x) +
          TRACK_BED_DEPTH_U +
          bankHeightU(ride.seed, x) +
          NEAR_FOOT_OFFSET_U
        );
      },
    });
    this.#particles.step(dtSec);
    this.#effectsView?.draw(
      this.#particles,
      this.#originX,
      unitsPerCss,
      (particle, point) => {
        const name = kindName(particle.kind);
        if (
          name === 'snow-far' ||
          name === 'snow-mid' ||
          name === 'snow-near' ||
          name === 'rain'
        ) {
          const climate = effectiveClimateAt(ride.seed, point.x);
          const k = Math.floor(point.x / CHUNK_WIDTH_U);
          if (k < ride.track.firstChunkIndex || k > ride.track.lastChunkIndex)
            return 0;
          const y = heightAtX(ride.track.chunkTable(k), point.x);
          return this.#weatherOutside(
            point,
            particleRadiusU(this.#particles, particle),
          ) &&
            point.y <
              (particle.depth !== undefined && particle.depth > DEPTH.train
                ? this.#freeBottomY
                : -y +
                  TRACK_BED_DEPTH_U +
                  bankHeightU(ride.seed, point.x) +
                  NEAR_FOOT_OFFSET_U)
            ? name === 'rain'
              ? climate.rainfall
              : climate.snowfall
            : 0;
        }
        if (
          name === 'leaf-fall' ||
          name === 'petal' ||
          name === 'songbird' ||
          name === 'dragonfly'
        )
          return this.#outsideTunnel(point) ? 1 : 0;
        return 1;
      },
    );
    if (dtSec > 0) this.#effectsCostMs = performance.now() - started;
  }

  /** Particle counts for diagnostics and E2E. */
  get effectsStats(): {
    live: number;
    capacity: number;
    kinds: Record<string, number>;
    checksum: number;
    bubblePops: number;
    seasonalSources: number;
    costMs: number;
    animationCostMs: number;
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
      bubblePops: this.#bubblePops,
      seasonalSources: this.#seasonalEffects.sourceCount,
      costMs: this.#effectsCostMs,
      animationCostMs: this.#animationCostMs,
    };
  }

  /** An animal from the art atlas, or the marked placeholder without it. */
  #animalImage(
    key: string,
    part: { pivotU: { x: number; y: number } },
  ): Phaser.GameObjects.Image {
    const texture = this.#art?.textureFor(key);
    const pxPerU = this.#art?.info?.pxPerU;
    if (texture === undefined || pxPerU === undefined)
      return this.add
        .image(0, 0, 'object-sheep')
        .setData('world-part', key)
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.objects);
    const image = this.add
      .image(0, 0, texture, key)
      .setData('world-part', key)
      .setDepth(DEPTH.objects);
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
      const covers = [
        { fromX: -Infinity, toX: site.fromX - PORTAL_EDGE_U },
        { fromX: site.toX + PORTAL_EDGE_U, toX: Infinity },
      ];
      train.vehicles.forEach((vehicle, i) => {
        const pose = train.vehiclePose(i);
        const half = vehicle.lengthU / 2;
        if (
          pose.centerX + half < leftX ||
          pose.centerX - half > rightX ||
          vehicleInCover(
            { minX: pose.centerX - half, maxX: pose.centerX + half },
            covers,
          ) === 'inside'
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
        const distanceU = train.travelledU / SECONDARY_SCALE;
        // Without the art, the marked placeholder (PWA-10): a train that
        // moves and whistles is never invisible.
        const drawn =
          this.#drawArtVehicle(slot, shaped, distanceU) ||
          this.#drawPlaceholderVehicle(slot, shaped, distanceU);
        for (let k = drawn; k < slot.images.length; k++)
          slot.images[k]?.setVisible(false);
        if (drawn > 0 && pose.centerX > site.fromX && pose.centerX < site.toX)
          open += 1;
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

  /** Request once per subset/scale; promises never mutate the displayed texture. */
  #updateWorldWindow(
    seed: number,
    leftXU: number,
    rightXU: number,
    zoom: number,
  ): void {
    const regions = worldAtlasRegions(seed, leftXU, rightXU);
    this.#worldRegions = regions;
    const keys = worldAtlasWindowKeys(worldParts, regions);
    const artScale = profileArtScale(zoom, this.#host.artQuality());
    const backdropScale = profileBackdropScale(zoom, this.#host.artQuality());
    this.#windowRequests.update(
      {
        id: `${artScale}/${backdropScale}/${keys.join(',')}`,
        world: {
          keys: keys.filter((key) => !isBackdropPart(key)),
          pxPerU: artScale,
        },
        backdrop: { keys: keys.filter(isBackdropPart), pxPerU: backdropScale },
      },
      (backdrop) =>
        this.#activateWorldAtlas(
          backdrop ? this.#backdropArt : this.#art,
          backdrop,
        ),
    );
  }

  /** Safe boundary: no render is in progress and all images move before old pages are released. */
  #activateWorldAtlas(atlas: ArtAtlas | undefined, backdrop: boolean): void {
    if (!atlas?.ready) return;
    this.atlasMetrics.measure(
      backdrop ? 'backdropActivate' : 'worldActivate',
      () => {
        const previousScale = atlas.info?.pxPerU;
        const old = atlas.commitPrepared();
        const texture = atlas.textureKey,
          scale = atlas.info?.pxPerU;
        if (!texture || scale === undefined) return;
        const textureFor = (frame: string) => atlas.textureFor(frame);
        if (backdrop) {
          this.#backdrop?.setAtlas(texture, scale, textureFor);
        } else {
          this.#worldSwaps++;
          // A resize changes ground raster scale; region swaps preserve baked ground and objects.
          if (previousScale !== scale) {
            this.#destroyChunks();
            this.#destroyObjects();
          } else {
            const retarget = (object: Phaser.GameObjects.GameObject): void => {
              if (object instanceof Phaser.GameObjects.Container)
                object.list.forEach(retarget);
              if (!(object instanceof Phaser.GameObjects.Image)) return;
              rebindWorldImage(object, textureFor, scale);
            };
            this.children.list.forEach(retarget);
          }
          this.#effectsView?.setAtlas(texture, scale, textureFor);
          this.#effectsTexture = texture;
        }
        old.forEach((key) => atlas.release(key));
      },
    );
  }

  /** Vehicle scale changes never rebuild world chunks or world textures. */
  #updateVehicleArtScale(zoom: number): void {
    // Vehicle, world and backdrop preparation have disjoint allocation
    // lifetimes, including decoder work of cancelled builds; the request
    // owner decides when the vehicle raster starts.
    if (!this.#vehicleArt) return;
    const atlas = this.#vehicleArt;
    const artScale = profileArtScale(zoom, this.#host.artQuality());
    const request = `${this.#vehicleGeneration}/${artScale}`;
    if (request !== this.#vehicleRequest) {
      this.#vehicleRequest = request;
      this.#windowRequests.requestVehicles({
        id: request,
        prepare: () => {
          this.#vehiclePending = true;
          return atlas.prepareSelected(artScale).then(
            () => {
              if (this.#vehicleRequest === request)
                this.#vehiclePending = false;
            },
            (error: unknown) => {
              if (this.#vehicleRequest === request)
                this.#vehiclePending = false;
              throw error;
            },
          );
        },
      });
    }
    if (!atlas.ready) return;
    const replaced = atlas.commitPrepared();
    const key = atlas.textureKey;
    if (!key) return;
    for (const slot of [...this.#slots, ...this.#npcSlots]) {
      slot.images.forEach((image, i) => {
        const shown = slot.frames[i];
        const old = replaced.find((texture) =>
          shown?.startsWith(`${texture}/`),
        );
        if (!shown || !old) return;
        const frame = shown.slice(old.length + 1);
        image.setTexture(key, frame);
        slot.frames[i] = `${key}/${frame}`;
      });
    }
    replaced.forEach((texture) => atlas.release(texture));
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
    const result = pantographReach(base, pose.angleRad, wire);
    if (result.outOfRange) this.stats.pantographOutOfRange++;
    const reach = result.reachU;
    const contact = this.#pantographPoint;
    contact.x = base.x - reach * Math.sin(pose.angleRad);
    contact.y = base.y - reach * Math.cos(pose.angleRad);
    contact.outOfRange = result.outOfRange;
    contact.tiltDeg = (-pose.angleRad * 180) / Math.PI;
    this.#pantographContact = contact;
    const chunk = Math.floor(contact.x / CHUNK_WIDTH_U);
    if (chunk !== this.#contactSupportChunk) {
      // Bounded window also covers a passage across the chunk seam. Allocate
      // only on a chunk change, using the same shifted supports as the drawing.
      this.#contactSupportXs = catenaryPoleXs(
        ride.seed,
        (chunk - 1) * CHUNK_WIDTH_U,
        (chunk + 2) * CHUNK_WIDTH_U,
      );
      this.#contactSupportChunk = chunk;
    }
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
    const texture = this.#vehicleArt?.textureKey;
    const pxPerU = this.#vehicleArt?.info?.pxPerU;
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

  /** Allocate a silhouette only when a vehicle actually needs fallback art. */
  #placeholder(vehicle: ShapedVehicle): void {
    if (this.textures.exists(`vehicle-${vehicle.id}`)) return;
    const height = PLACEHOLDER_BODY_HEIGHT_U;
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

  /** Marked placeholder silhouette with two turning wheels. */
  #drawPlaceholderVehicle(
    slot: VehicleSlot,
    vehicle: ShapedVehicle,
    distanceU: number,
  ): number {
    this.#placeholder(vehicle);
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
      if (this.#vehicleArt) {
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
