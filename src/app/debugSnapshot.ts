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
  brakeRect:
    { left: number; top: number; width: number; height: number } | undefined;
  audio: string;
}
