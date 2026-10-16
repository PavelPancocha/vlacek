import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  frameLeftX,
  projectWorldX,
  frameTopY,
  trainZoom,
  type FramingConfig,
  type FramingViewport,
} from '../../../src/render/cameraFraming.ts';

const CONFIG: FramingConfig = { ...gameConfig.camera, vehicleHeightU: 150 };
const SIZES = [
  [1280, 800],
  [1140, 512],
  [844, 390],
  [568, 320],
] as const;
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
  it('camera-1: a fixed 2000 u reference fits every ride at 60 percent of the width', () => {
    for (const [w, h] of SIZES) {
      const view = viewport(w, h);
      for (const lengthU of [144, 156, 648, 1000, 1600, 1800, 2000])
        expect(trainZoom(view, lengthU, CONFIG)).toBeCloseTo(
          (0.6 * w) / 2000,
          9,
        );
    }
  });

  it('camera-1: every allowed length is centred at 46 percent, with at least 16 percent behind and 24 percent ahead', () => {
    for (const [w, h] of SIZES) {
      const view = viewport(w, h);
      for (let lengthU = 144; lengthU <= 2000; lengthU += 4) {
        const zoom = trainZoom(view, lengthU, CONFIG);
        const frontX = 1_000_000;
        const left = frameLeftX(frontX, lengthU, view, zoom, CONFIG);
        const rearPx = screenX(frontX - lengthU, left, zoom);
        const frontPx = screenX(frontX, left, zoom);
        expect((rearPx + frontPx) / 2 / w).toBeCloseTo(0.46, 9);
        expect(rearPx / w).toBeGreaterThanOrEqual(0.16 - 1e-9);
        expect((w - frontPx) / w).toBeGreaterThanOrEqual(0.24 - 1e-9);
        // More world ahead even for the old short-train front anchor at 35%.
        const oldZoom = (0.72 * w) / Math.max(1600, lengthU);
        const oldFront = Math.max(0.35, 0.06 + (lengthU * oldZoom) / w);
        expect(rearPx / zoom).toBeGreaterThan(
          (oldFront * w) / oldZoom - lengthU,
        );
        expect((w - frontPx) / zoom).toBeGreaterThan(
          ((1 - oldFront) * w) / oldZoom,
        );
      }
      const zoom = trainZoom(view, 2000, CONFIG);
      expect(w / zoom).toBeCloseTo(3333.333333, 5);
      expect((0.24 * w) / zoom).toBeCloseTo(800, 9);
    }
  });

  it('camera-1: projects the drawn camera view in CSS pixels, including DPR, canvas offset and origin rebase', () => {
    expect(projectWorldX(200, 100, 0.5, 1280, { left: 10, width: 640 })).toBe(
      35,
    );
    expect(
      projectWorldX(16584, 16484, 0.5, 1280, { left: 10, width: 640 }),
    ).toBe(35);
    expect(projectWorldX(100, 100, 0.5, 1280, { left: 10, width: 640 })).toBe(
      10,
    );
  });

  it('the first frame puts the train in the free band without easing in', () => {
    const view = viewport(844, 390, 140);
    const zoom = trainZoom(view, MAX_LENGTH_U, CONFIG);
    const train = { minRailY: 300, maxRailY: 420 };
    const top = frameTopY(undefined, train, view, zoom, 1 / 60, CONFIG);
    const middle = (300 + 420 + 150) / 2;
    expect(screenY(middle, top, zoom)).toBeCloseTo(0.5 * (390 - 140), 6);
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

  it('camera-1: current and maximum grades keep the train in the middle band and the track ahead in view through climbs and descents', () => {
    for (const [w, h] of SIZES)
      for (const lengthU of [156, 2000])
        for (const grade of [
          gameConfig.world.profile.gradeRangeMax,
          gameConfig.world.maxTrackGrade,
        ]) {
          for (const heightU of [116, 168]) {
            const framing = { ...CONFIG, vehicleHeightU: heightU };
            const view = { ...viewport(w, h, 160), reservedTopPx: 80 };
            const zoom = trainZoom(view, lengthU, CONFIG);
            const height = (x: number) =>
              10000 + grade * Math.abs((x % 8000) - 4000);
            let top: number | undefined;
            for (let tick = 0; tick < 120; tick++) {
              const frontX = 15200 + tick * 8;
              const trainHeights = Array.from({ length: 33 }, (_, i) =>
                height(frontX - lengthU + (i * lengthU) / 32),
              );
              for (
                let x = Math.ceil((frontX - lengthU) / 4000) * 4000;
                x < frontX;
                x += 4000
              )
                trainHeights.push(height(x));
              const span = {
                minRailY: Math.min(...trainHeights),
                maxRailY: Math.max(...trainHeights),
              };
              top = frameTopY(top, span, view, zoom, 1 / 60, framing);
              const upper = screenY(
                span.maxRailY + framing.vehicleHeightU,
                top,
                zoom,
              );
              const lower = screenY(span.minRailY, top, zoom);
              expect(upper).toBeGreaterThanOrEqual(80 - 1e-6);
              expect(lower).toBeLessThanOrEqual(h - 160 + 1e-6);
              const centre = ((upper + lower) / 2 - 80) / (h - 240);
              expect(centre).toBeGreaterThanOrEqual(0.3);
              expect(centre).toBeLessThanOrEqual(0.7);
              const rightX =
                frameLeftX(frontX, lengthU, view, zoom, CONFIG) + w / zoom;
              for (let i = 0; i <= 16; i++) {
                const railY = screenY(
                  height(frontX + (i * (rightX - frontX)) / 16),
                  top,
                  zoom,
                );
                expect(railY).toBeGreaterThanOrEqual(0);
                expect(railY).toBeLessThanOrEqual(h);
              }
            }
          }
        }
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
