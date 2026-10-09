import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  buildArcLengthTable,
  sampleArcLengthTable,
} from '../../../src/domain/world/ArcLengthTable.ts';
import {
  generateTrackProfile,
  profileHeightU,
  type TrackProfile,
} from '../../../src/domain/world/TrackProfile.ts';

const { chunkWidthU, arcSampleSpacingU } = gameConfig.world;

/** Steep valid hill: 32.768 u over 512 u ramps, the doc 04 grade limit. */
const extremeHill: TrackProfile = {
  kind: 'hill',
  startHeightU: 0,
  endHeightU: 0,
  middleHeightU: (0.12 * 512) / 1.875,
};

function referencePoint(profile: TrackProfile, arcU: number) {
  // Fine numerical arc length as an independent reference.
  const step = 0.01;
  let travelled = 0;
  let x = 0;
  let y = profileHeightU(profile, 0);
  while (x < chunkWidthU) {
    const nx = Math.min(chunkWidthU, x + step);
    const ny = profileHeightU(profile, nx);
    const segment = Math.hypot(nx - x, ny - y);
    if (travelled + segment >= arcU) {
      const f = (arcU - travelled) / segment;
      return { x: x + (nx - x) * f, y: y + (ny - y) * f };
    }
    travelled += segment;
    x = nx;
    y = ny;
  }
  return { x, y };
}

describe('ArcLengthTable', () => {
  const table = buildArcLengthTable(
    extremeHill,
    3,
    chunkWidthU,
    arcSampleSpacingU,
  );

  it('samples at most every 8 u along x and in chunk-global x', () => {
    expect(table.xs[0]).toBe(3 * chunkWidthU);
    expect(table.xs.at(-1)).toBe(4 * chunkWidthU);
    for (let i = 1; i < table.xs.length; i++) {
      expect((table.xs[i] ?? 0) - (table.xs[i - 1] ?? 0)).toBeLessThanOrEqual(
        arcSampleSpacingU,
      );
    }
  });

  it('has a monotonic cumulative arc longer than the chunk width on slopes', () => {
    for (let i = 1; i < table.cumulativeArcU.length; i++) {
      expect(table.cumulativeArcU[i]).toBeGreaterThan(
        table.cumulativeArcU[i - 1] ?? 0,
      );
    }
    expect(table.lengthU).toBeGreaterThan(chunkWidthU);
  });

  it('TRN-10: positions are within 0.5 u of the true curve on an extreme profile', () => {
    for (let arc = 0; arc < table.lengthU; arc += 13.7) {
      const sample = sampleArcLengthTable(table, arc);
      const reference = referencePoint(extremeHill, arc);
      const error = Math.hypot(
        sample.x - 3 * chunkWidthU - reference.x,
        sample.y - reference.y,
      );
      expect(error, `arc ${arc}`).toBeLessThanOrEqual(0.5);
    }
  });

  it('clamps to the chunk ends and reports the track grade', () => {
    expect(sampleArcLengthTable(table, -5).x).toBe(3 * chunkWidthU);
    expect(sampleArcLengthTable(table, table.lengthU + 5).x).toBe(
      4 * chunkWidthU,
    );
    expect(sampleArcLengthTable(table, 0).grade).toBe(0);
    expect(
      Math.abs(sampleArcLengthTable(table, table.lengthU / 4).grade),
    ).toBeGreaterThan(0.05);
  });

  it('adjacent chunks meet within 0.1 u', () => {
    for (let k = -3; k < 3; k++) {
      const a = buildArcLengthTable(
        generateTrackProfile(9, k),
        k,
        chunkWidthU,
        arcSampleSpacingU,
      );
      const b = buildArcLengthTable(
        generateTrackProfile(9, k + 1),
        k + 1,
        chunkWidthU,
        arcSampleSpacingU,
      );
      const end = sampleArcLengthTable(a, a.lengthU);
      const start = sampleArcLengthTable(b, 0);
      expect(Math.hypot(end.x - start.x, end.y - start.y)).toBeLessThanOrEqual(
        0.1,
      );
    }
  });
});
