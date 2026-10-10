/** Read-only diagnostics exposed as `window.__vlacek` with `?debug=1`. */
export interface DebugSnapshot {
  buildId: string;
  renderer: string;
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
  /** The vehicle art atlas (D-011); undefined if the art failed to load. */
  artAtlas:
    | { width: number; height: number; frames: number; pxPerU: number }
    | undefined;
  /** Decorative particles (doc 14 §4, D-014): counts and a position sum. */
  effects: {
    live: number;
    capacity: number;
    kinds: Record<string, number>;
    /** Sum of particle positions; unchanged while the ride is paused. */
    checksum: number;
  };
  /** The backdrop atlas (D-013); undefined if the art failed to load. */
  backdropAtlas:
    | { width: number; height: number; frames: number; pxPerU: number }
    | undefined;
  /** Landscape in view (doc 14 §5). */
  scenery: {
    /** Biome of the backdrop, undefined outside a ride. */
    biome: string | undefined;
    /** Localities of the chunks in view, left to right. */
    localities: string[];
    /** Near-meadow props in view. */
    nearProps: number;
    /** Near-meadow props overlapping a drawn vehicle; always 0. */
    nearPropsOverTrain: number;
  };
  /** Level crossings the ride simulates (doc 05 §4, D-015). */
  crossings: {
    id: string;
    phase: string;
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
  objects: { id: string; x: number; y: number }[];
  /** Screen x of the chunk boundaries in view, CSS px (seam checks). */
  chunkEdges: number[];
  /** Screen box of all drawn vehicles, CSS px (doc 14 §2 checks). */
  trainBox:
    { left: number; top: number; right: number; bottom: number } | undefined;
  brakeRect:
    { left: number; top: number; width: number; height: number } | undefined;
  audio: string;
}
