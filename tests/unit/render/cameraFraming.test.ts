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
const MAX_LENGTH_U = 2000;

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
  it('D-028: preserves the old scale up to 1600 u and scales longer rides proportionally', () => {
    const view = viewport(1280, 800);
    for (const lengthU of [156, 800, 1528, 1600])
      expect(trainZoom(view, lengthU, CONFIG)).toBeCloseTo(0.576, 9);
    expect(trainZoom(view, 1800, CONFIG)).toBeCloseTo((0.576 * 1600) / 1800, 9);
    expect(trainZoom(view, 2000, CONFIG)).toBeCloseTo(0.4608, 9);
  });

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
    for (const [w, h] of [
      [1280, 800],
      [844, 390],
    ] as const) {
      const view = viewport(w, h);
      for (const [lengthU, lookAheadU] of [
        [1600, 488.888889],
        [2000, 611.111111],
      ] as const) {
        const zoom = trainZoom(view, lengthU, CONFIG);
        const frontX = 1_000_000;
        const left = frameLeftX(frontX, lengthU, view, zoom, CONFIG);
        expect(screenX(frontX - lengthU, left, zoom)).toBeCloseTo(0.06 * w, 6);
        expect(screenX(frontX, left, zoom)).toBeCloseTo(0.78 * w, 6);
        expect((w - screenX(frontX, left, zoom)) / zoom).toBeCloseTo(
          lookAheadU,
          5,
        );
      }
    }
  });

  it('a short train keeps its front far enough right to see ahead', () => {
    const view = viewport(1280, 720);
    const zoom = trainZoom(view, 156, CONFIG);
    const left = frameLeftX(500, 156, view, zoom, CONFIG);
    expect(screenX(500, left, zoom)).toBeCloseTo(0.35 * 1280, 6);
    // The scale stays fixed for this journey, including while driving.
    expect(trainZoom(view, 156, CONFIG)).toBe(zoom);
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
