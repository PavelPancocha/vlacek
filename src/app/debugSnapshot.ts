import type { FarmForestDiagnostic } from '../render/farmForestMotion.ts';
import type { TestSceneLocation } from '../domain/world/TestScenes.ts';
import type { WorldOverlayOptions } from '../domain/world/WorldDebugGeometry.ts';
import type { WorldDiagnostics } from '../domain/world/WorldValidation.ts';
import type { RenderProfile } from './renderProfile.ts';
import type { Settings } from '../platform/SaveValidation.ts';

/** Read-only diagnostics via `?debug=1` or the hidden parent developer menu. */
export interface DebugSnapshot {
  worldDebug: {
    temporaryRide: boolean;
    location: TestSceneLocation | undefined;
    overlays: WorldOverlayOptions;
    overlayPrimitives: number;
  };
  buildId: string;
  renderer: string;
  renderProfile: RenderProfile & { quality: Settings['quality'] };
  screen: string;
  seed: number | undefined;
  generatorVersion: number;
  headChunk: number | undefined;
  liveChunks: number;
  renderedChunks: number;
  vehicles: number;
  renderedVehicles: number;
  /** Rendered vehicles drawn from their art (doc 14 §3). */
  artVehicles: number;
  /** The world art atlas (D-019); undefined if this atlas failed. */
  artAtlas:
    | {
        width: number;
        height: number;
        frames: number;
        pxPerU: number;
        textureKey: string;
      }
    | undefined;
  /** Journey vehicle atlas; IDs include the NPC fleet (D-019). */
  vehicleAtlas:
    | {
        width: number;
        height: number;
        frames: number;
        pxPerU: number;
        textureKey: string;
        vehicleIds: string[];
      }
    | undefined;
  /** Decorative particles (doc 14 §4, D-014): counts and a position sum. */
  effects: {
    live: number;
    capacity: number;
    kinds: Record<string, number>;
    /** Sum of particle positions; unchanged while the ride is paused. */
    checksum: number;
    bubblePops: number;
  };
  /**
   * Loaded SVG sources still held as textures; 0 once the atlases are
   * built, and also when one failed (D-011).
   */
  artSourceTextures: number;
  /** The backdrop atlas (D-013); undefined if the art failed to load. */
  backdropAtlas:
    | { width: number; height: number; frames: number; pxPerU: number }
    | undefined;
  /** Landscape in view (doc 14 §5). */
  scenery: {
    /** Target biome of the backdrop, undefined outside a ride. */
    biome: string | undefined;
    /** Localities of the chunks in view, left to right. */
    localities: string[];
    work: readonly (FarmForestDiagnostic & { layer: 'near' | 'back' })[];
    /** Near-meadow props in view. */
    nearProps: number;
    /** Near-meadow props overlapping a drawn vehicle; always 0. */
    nearPropsOverTrain: number;
    /** What overlapped: "prop frame over vehicle frame" (diagnostics). */
    nearPropOverlaps: string[];
    /** Level crossings drawn in view, with art or its fallback. */
    crossingViews: number;
    /** Second-track chunks and portal hills drawn with art or plain. */
    secondaryTrackViews: number;
    secondaryPortalViews: number;
  };
  /** Catenary of an electric journey (doc 03 §9, D-016). */
  catenary: {
    electrified: boolean;
    /** Masts in the rendered chunks. */
    poles: number;
    /** How far the drawn pantograph head misses the wire, u. */
    pantographGapU: number | undefined;
    /** Player pantographs currently clamped by their working reach. */
    outOfRange: number;
  };
  /**
   * Tunnels in view, the opacity of their hills (1 opaque) and whether the
   * train is outside, partly or wholly inside (doc 03 §8, TRN-06, D-018).
   */
  tunnels: {
    id: string;
    alpha: number;
    train: 'outside' | 'partly' | 'inside';
    /** Each player's vehicle relative to the opaque core (in consist order). */
    vehicles: ('outside' | 'partly' | 'inside')[];
  }[];
  /** Actual backdrop layers and crossfade progress (0 … 1), if a journey exists. */
  backdrop:
    | {
        currentBiome: string | undefined;
        incomingBiome: string | undefined;
        fade: number;
        world: WorldDiagnostics | undefined;
      }
    | undefined;
  /** Parallax: the first mid backdrop tile's x from the view's left, u. */
  backdropMidOffsetU: number;
  /** Oncoming trains on second tracks (doc 05 §6, D-017). */
  oncoming: {
    trains: {
      id: string;
      /** Catalog identity of the actual NPC locomotive (horn checks). */
      locomotiveId: string | undefined;
      /** World x interval of the whole train. */
      minX: number;
      maxX: number;
      /** Its second track's visible stretch, between the portals. */
      fromX: number;
      toX: number;
      vehicles: number;
    }[];
    /** Its vehicles drawn out in the open, between the portals. */
    drawnInOpen: number;
  };
  /** Level crossings the ride simulates (doc 05 §4, D-015). */
  crossings: {
    id: string;
    /** Crossing centre in world units and CSS px, including offscreen positions. */
    worldX: number;
    screenX: number;
    /** Player train tail in world units, to observe clearance of the extended zone. */
    tailX: number;
    phase: string;
    /** Every distinct phase so far, recorded each frame, newest last. */
    phases: string[];
    /** 0 barriers up … 1 down. */
    barrier: number;
    /** Some part of the train is on the road. */
    occupied: boolean;
    actors: number;
    waiting: number;
    /** Road actors that have crossed the track so far. */
    crossed: number;
  }[];
  consistLengthU: number;
  intent: string;
  speedUPerSec: number;
  headS: number;
  tailS: number;
  frontS: number;
  trackStartS: number;
  trackEndS: number;
  simulationTick: number;
  pointers: number;
  draftWagons: number;
  notices: string[];
  medianFps: number;
  p95FrameMs: number;
  worstFrameMs: number;
  frameSamples: number;
  /** Cumulative frames that drew the ride, excluding opaque screens. */
  rideFramesDrawn: number;
  /** Visible bubbles: stable ID and drawn center/radius in CSS px (H3). */
  bubbles: { id: number; x: number; y: number; radiusCssPx: number }[];
  objects: { id: string; x: number; y: number }[];
  /** Screen x of the chunk boundaries in view, CSS px (seam checks). */
  chunkEdges: number[];
  /** Screen box of all drawn vehicles, CSS px (doc 14 §2 checks). */
  trainBox:
    { left: number; top: number; right: number; bottom: number } | undefined;
  brakeRect:
    { left: number; top: number; width: number; height: number } | undefined;
  audioDetails: {
    active: { id: string; kind: string; key: string }[];
    played: string[];
    loaded: number;
    pending: number;
    pendingLayers: number;
    failures: { file: string; reason: string }[];
    covered: number;
  };
  audio: string;
}
