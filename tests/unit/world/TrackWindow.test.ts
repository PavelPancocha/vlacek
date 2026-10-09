import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { generateTrackProfile } from '../../../src/domain/world/TrackProfile.ts';
import { TrackWindow } from '../../../src/domain/world/TrackWindow.ts';

const world = gameConfig.world;
const seed = 1234;
const source = (k: number) => generateTrackProfile(seed, k);

describe('TrackWindow', () => {
  it('anchors s = 0 at the start of the anchor chunk', () => {
    const window = new TrackWindow(source, 0, world);
    window.ensureRange(0, 100);
    expect(window.sample(0).x).toBe(0);
    expect(window.cursorAt(0)).toEqual({ chunkIndex: 0, arcOffsetU: 0 });
  });

  it('TRN-07: prepares track behind a long consist, including negative chunks', () => {
    const window = new TrackWindow(source, 0, world);
    const head = window.sFromLocalX(0, world.spawnLocalXU);
    const tail = head - 100 * 228 - 156;
    window.ensureRange(
      tail - world.geometryTailMarginU,
      head + world.geometryLookAheadU,
    );
    expect(window.firstChunkIndex).toBeLessThan(0);
    expect(window.startS).toBeLessThanOrEqual(tail - world.geometryTailMarginU);
    expect(window.endS).toBeGreaterThanOrEqual(head + world.geometryLookAheadU);
    expect(Number.isFinite(window.sample(tail).y)).toBe(true);
  });

  it('is continuous across chunk boundaries in both directions', () => {
    const window = new TrackWindow(source, 0, world);
    window.ensureRange(-5000, 5000);
    let previous = window.sample(-5000);
    for (let s = -5000 + 4; s <= 5000; s += 4) {
      const point = window.sample(s);
      expect(
        Math.hypot(point.x - previous.x, point.y - previous.y),
      ).toBeLessThanOrEqual(4 + 1e-6);
      expect(point.x).toBeGreaterThan(previous.x);
      previous = point;
    }
  });

  it('GEN-11: cursor and local s round-trip at a chunk boundary and inside a hill', () => {
    const window = new TrackWindow(source, 0, world);
    window.ensureRange(-3000, 3000);
    for (const s of [
      window.chunkStartS(1),
      window.chunkStartS(1) + 333.3,
      -1234.5,
    ]) {
      const cursor = window.cursorAt(s);
      expect(window.sAt(cursor)).toBeCloseTo(s, 9);
      expect(cursor.arcOffsetU).toBeGreaterThanOrEqual(0);
    }
    const restored = new TrackWindow(
      source,
      window.cursorAt(2000).chunkIndex,
      world,
    );
    restored.ensureRange(-100, 100);
    const cursor = window.cursorAt(2000);
    const there = restored.sample(restored.sAt(cursor));
    const here = window.sample(2000);
    expect(there.x).toBeCloseTo(here.x, 9);
    expect(there.y).toBeCloseTo(here.y, 9);
  });

  it('GEN-09/10: streaming 10 000 chunks keeps a bounded window behind the tail', () => {
    const window = new TrackWindow(source, 0, world);
    const consistLengthU = 100 * 228 + 156;
    let maxLive = 0;
    let removed = 0;
    for (let head = 0; head < 10_000 * world.chunkWidthU; head += 997) {
      const tail = head - consistLengthU;
      const change = window.ensureRange(
        tail - world.geometryTailMarginU,
        head + world.geometryLookAheadU,
      );
      removed += change.removed.length;
      maxLive = Math.max(maxLive, window.chunkCount);
      expect(window.startS).toBeLessThanOrEqual(
        tail - world.geometryTailMarginU,
      );
      expect(window.endS).toBeGreaterThanOrEqual(
        head + world.geometryLookAheadU,
      );
    }
    expect(removed).toBeGreaterThan(9_900);
    expect(maxLive).toBeLessThanOrEqual(30);
  });

  it('refuses to sample outside the prepared window', () => {
    const window = new TrackWindow(source, 0, world);
    window.ensureRange(0, 100);
    expect(() => window.sample(window.endS + 1)).toThrow(RangeError);
  });
});
