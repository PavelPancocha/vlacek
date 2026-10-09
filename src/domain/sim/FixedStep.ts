export interface FixedStepParams {
  stepSec: number;
  maxStepsPerFrame: number;
}

export interface FixedStepState {
  accumulatorSec: number;
}

export interface FixedStepResult {
  state: FixedStepState;
  /** Simulation steps to run for this rendered frame. */
  steps: number;
  /** Fraction of the next step already elapsed, for render interpolation. */
  alpha: number;
  /** Backlog discarded instead of catching up (e.g. after a stall). */
  droppedSec: number;
}

/** Tolerance for float accumulation of frame times (1/60 s is inexact). */
const EPSILON_SEC = 1e-9;

export function initialFixedStep(): FixedStepState {
  return { accumulatorSec: 0 };
}

/**
 * Converts a rendered frame duration into fixed simulation steps (doc 03 §2).
 * The caller stops calling this while paused; no time accrues meanwhile.
 */
export function advanceFixedStep(
  state: FixedStepState,
  frameSec: number,
  params: FixedStepParams,
): FixedStepResult {
  const delta = Number.isFinite(frameSec) && frameSec > 0 ? frameSec : 0;
  let accumulator = state.accumulatorSec + delta;
  const due = Math.floor((accumulator + EPSILON_SEC) / params.stepSec);
  const steps = Math.min(due, params.maxStepsPerFrame);
  accumulator = Math.max(0, accumulator - steps * params.stepSec);
  let droppedSec = 0;
  if (due > steps) {
    droppedSec = accumulator;
    accumulator = 0;
  }
  return {
    state: { accumulatorSec: accumulator },
    steps,
    alpha: Math.min(1, accumulator / params.stepSec),
    droppedSec,
  };
}
