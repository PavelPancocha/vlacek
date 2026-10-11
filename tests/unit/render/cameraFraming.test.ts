import { describe, expect, it } from 'vitest';
import {
  frameLeftX,
  frameTopY,
  trainZoom,
  type FramingConfig,
  type FramingViewport,
} from '../../../src/render/cameraFraming.ts';

const CONFIG: FramingConfig = {
  trainWidthFraction: 0.72,
  rearMarginFraction: 0.06,
  minFrontFraction: 0.35,
  bandAnchor: 0.55,
  vehicleHeightU: 150,
  verticalFollowPerSec: 3,
};
const MAX_LENGTH_U = 1600;

function viewport(
  widthPx: number,
  heightPx: number,
  reservedBottomPx = 0,
): FramingViewport {
  return { widthPx, heightPx, reservedTopPx: 0, reservedBottomPx };
}

/** Screen px of a world point for a camera (left/top edge in world u). */
const screenX = (x: number, left: number, zoom: number) => (x - left) * zoom;
const screenY = (y: number, top: number, zoom: number) => (top - y) * zoom;

describe('cameraFraming (doc 14 §2)', () => {
  it('the longest allowed train fills 72 % of the width on any screen', () => {
    for (const [w, h] of [
      [1280, 720],
      [1024, 768],
      [2560, 1080],
      [844, 390],
    ] as const) {
      const zoom = trainZoom(viewport(w, h), MAX_LENGTH_U, CONFIG);
      expect((MAX_LENGTH_U * zoom) / w).toBeCloseTo(0.72, 6);
    }
  });

  it('the longest train stands between the rear margin and its front anchor', () => {
    const view = viewport(1280, 720);
    const zoom = trainZoom(view, MAX_LENGTH_U, CONFIG);
    const frontX = 1_000_000;
    const left = frameLeftX(frontX, MAX_LENGTH_U, view, zoom, CONFIG);
    expect(screenX(frontX - MAX_LENGTH_U, left, zoom)).toBeCloseTo(
      0.06 * 1280,
      6,
    );
    expect(screenX(frontX, left, zoom)).toBeCloseTo(0.78 * 1280, 6);
  });

  it('a short train keeps its front far enough right to see ahead', () => {
    const view = viewport(1280, 720);
    const zoom = trainZoom(view, MAX_LENGTH_U, CONFIG);
    const left = frameLeftX(500, 156, view, zoom, CONFIG);
    expect(screenX(500, left, zoom)).toBeCloseTo(0.35 * 1280, 6);
    // The scale never depends on the current train (no zoom per wagon).
    expect(trainZoom(view, MAX_LENGTH_U, CONFIG)).toBe(zoom);
  });

  it('the first frame puts the train in the free band without easing in', () => {
    const view = viewport(844, 390, 140);
    const zoom = trainZoom(view, MAX_LENGTH_U, CONFIG);
    const train = { minRailY: 300, maxRailY: 420 };
    const top = frameTopY(undefined, train, view, zoom, 1 / 60, CONFIG);
    const middle = (300 + 420 + 150) / 2;
    expect(screenY(middle, top, zoom)).toBeCloseTo(0.55 * (390 - 140), 6);
  });

  it('follows smoothly, without overshoot, and never lets the train leave the band', () => {
    const view = viewport(844, 390, 140);
    const zoom = trainZoom(view, MAX_LENGTH_U, CONFIG);
    const low = { minRailY: 0, maxRailY: 100 };
    const high = { minRailY: 260, maxRailY: 360 };
    let top = frameTopY(undefined, low, view, zoom, 1 / 60, CONFIG);
    const start = top;
    const target = frameTopY(undefined, high, view, zoom, 1 / 60, CONFIG);
    let previous = top;
    for (let frame = 0; frame < 240; frame++) {
      top = frameTopY(top, high, view, zoom, 1 / 60, CONFIG);
      // The whole train (rails up to vehicle tops) stays inside the band.
      expect(screenY(high.maxRailY + 150, top, zoom)).toBeGreaterThanOrEqual(
        -1e-6,
      );
      expect(screenY(high.minRailY, top, zoom)).toBeLessThanOrEqual(
        390 - 140 + 1e-6,
      );
      expect(top).toBeGreaterThanOrEqual(previous - 1e-9);
      expect(top).toBeLessThanOrEqual(target + 1e-9);
      previous = top;
    }
    // Settled to well under a pixel after four seconds.
    expect(Math.abs(top - target) * zoom).toBeLessThan(0.01);
    expect(top).toBeGreaterThan(start);
  });

  it('moves only a little per frame when the train is well inside the band', () => {
    const view = viewport(1280, 720, 130);
    const zoom = trainZoom(view, MAX_LENGTH_U, CONFIG);
    const a = { minRailY: 0, maxRailY: 40 };
    const b = { minRailY: 20, maxRailY: 60 };
    const top = frameTopY(undefined, a, view, zoom, 1 / 60, CONFIG);
    const next = frameTopY(top, b, view, zoom, 1 / 60, CONFIG);
    expect(Math.abs(next - top) * zoom).toBeLessThan(1);
  });
});
