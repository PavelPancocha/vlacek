/**
 * Camera framing for the whole train (doc 14 §2). Pure functions in world
 * units (y up) and render pixels (y down); no Phaser, testable in Node.
 */
export interface FramingConfig {
  /** Share of the width a 2000 u reference train fills. */
  trainWidthFraction: number;
  /** Train middle, slightly left of screen centre to see more ahead. */
  trainCenterFraction: number;
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
 * Stable scale for a ride and viewport, with a 2000 u reference (D-028).
 * Grades, speed and position never change the zoom.
 */
export function trainZoom(
  viewport: FramingViewport,
  consistLengthU: number,
  config: FramingConfig,
): number {
  return (
    (config.trainWidthFraction * viewport.widthPx) /
    Math.max(2000, consistLengthU)
  );
}

/**
 * World x of the left edge; the whole train's middle keeps its screen anchor.
 */
export function frameLeftX(
  frontX: number,
  consistLengthU: number,
  viewport: FramingViewport,
  zoom: number,
  config: FramingConfig,
): number {
  const trainFraction = (consistLengthU * zoom) / viewport.widthPx;
  const frontFraction = config.trainCenterFraction + trainFraction / 2;
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

/** Screen projection of the actual drawn camera view, not a second framing calculation. */
export function projectWorldX(
  worldX: number,
  leftWorldX: number,
  zoom: number,
  renderWidthPx: number,
  canvasRect: { left: number; width: number },
): number {
  return (
    canvasRect.left +
    (worldX - leftWorldX) *
      zoom *
      (Math.max(1, canvasRect.width) / renderWidthPx)
  );
}
