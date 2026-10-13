export interface DevTapState {
  count: number;
  startMs: number;
}
/** Five activations in one three-second window; time comes from the caller. */
export function devTap(
  state: DevTapState,
  nowMs: number,
): DevTapState & { open: boolean } {
  const reset = state.count === 0 || nowMs - state.startMs > 3000;
  const count = reset ? 1 : state.count + 1;
  return {
    count: count === 5 ? 0 : count,
    startMs: reset ? nowMs : state.startMs,
    open: count === 5,
  };
}
