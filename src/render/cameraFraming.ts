/**
 * Camera framing for the whole train (doc 14 §2). Pure functions in world
 * units (y up) and render pixels (y down); no Phaser, testable in Node.
 */
export interface FramingConfig {
  /** Share of the width the longest allowed train fills. */
  trainWidthFraction: number;
  /** Room kept behind the last wagon, as a share of the width. */
  rearMarginFraction: number;
  /** A short train's front stays at least this far right, to see ahead. */
  minFrontFraction: number;
  /** Where the train's middle sits in the free band (0 top, 1 bottom). */
  bandAnchor: number;
  /** Height above the rails kept in view for vehicle tops. */
  vehicleHeightU: number;
  /** Vertical follow rate (1/s); horizontal follow is exact. */
  verticalFollowPerSec: number;
}

/** Render size and the strips covered by controls, in render pixels. */
export interface FramingViewport {
  widthPx: number;
  heightPx: number;
  reservedTopPx: number;
  reservedBottomPx: number;
}

/** Rail height range under the whole train, world units. */
export interface TrainSpan {
  minRailY: number;
  maxRailY: number;
}

/**
 * Render pixels per world unit. Depends only on the screen and the longest
 * allowed train, never on the current one: no zooming per added wagon.
 */
export function trainZoom(
  viewport: FramingViewport,
  maxConsistLengthU: number,
  config: FramingConfig,
): number {
  return (config.trainWidthFraction * viewport.widthPx) / maxConsistLengthU;
}

/**
 * World x of the left screen edge. The front sits where the longest train
 * would leave its rear margin, or further right for a short train.
 */
export function frameLeftX(
  frontX: number,
  consistLengthU: number,
  viewport: FramingViewport,
  zoom: number,
  config: FramingConfig,
): number {
  const trainFraction = (consistLengthU * zoom) / viewport.widthPx;
  const frontFraction = Math.max(
    config.minFrontFraction,
    config.rearMarginFraction + trainFraction,
  );
  return frontX - (frontFraction * viewport.widthPx) / zoom;
}

/**
 * World y of the top screen edge. Eases towards putting the train's middle
 * at the band anchor, then clamps so rails and vehicle tops stay inside the
 * band left free by controls (the clamp wins over smoothness).
 */
export function frameTopY(
  previousTopY: number | undefined,
  train: TrainSpan,
  viewport: FramingViewport,
  zoom: number,
  dtSec: number,
  config: FramingConfig,
): number {
  const bandTopPx = viewport.reservedTopPx;
  const bandBottomPx = viewport.heightPx - viewport.reservedBottomPx;
  const trainTop = train.maxRailY + config.vehicleHeightU;
  const trainBottom = train.minRailY;
  const anchorPx = bandTopPx + config.bandAnchor * (bandBottomPx - bandTopPx);
  const target = (trainTop + trainBottom) / 2 + anchorPx / zoom;
  let topY =
    previousTopY === undefined
      ? target
      : previousTopY +
        (target - previousTopY) *
          (1 - Math.exp(-config.verticalFollowPerSec * dtSec));
  const lowest = trainTop + bandTopPx / zoom;
  const highest = trainBottom + bandBottomPx / zoom;
  // Taller than the band (should not happen within the limit): keep wheels.
  topY =
    lowest <= highest ? Math.min(highest, Math.max(lowest, topY)) : highest;
  return topY;
}
