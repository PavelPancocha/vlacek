import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  TEST_TRACK_GENERATOR_VERSION,
  boundaryHeightU,
  generateTrackProfile,
  profileGrade,
  profileHeightU,
} from '../../../src/domain/world/TrackProfile.ts';

const width = gameConfig.world.chunkWidthU;
const maxGrade = gameConfig.world.maxTrackGrade;

describe('provisional track generator v0', () => {
  it('is generator version 0, distinct from the V1 generator', () => {
    expect(TEST_TRACK_GENERATOR_VERSION).toBe(0);
  });

  it('keeps boundary heights within ±32 u (doc 04 §4)', () => {
    for (let k = -200; k < 200; k++) {
      expect(Math.abs(boundaryHeightU(99, k))).toBeLessThanOrEqual(32);
    }
  });

  it('GEN-01: the same seed and index give the same profile', () => {
    expect(JSON.stringify(generateTrackProfile(42, 17))).toBe(
      JSON.stringify(generateTrackProfile(42, 17)),
    );
  });

  it('GEN-02: generation order does not change a chunk', () => {
    const forward = [0, 1, 2].map((k) => generateTrackProfile(5, k));
    const shuffled = [2, 0, 1].map((k) => generateTrackProfile(5, k));
    expect(shuffled[1]).toEqual(forward[0]);
    expect(shuffled[2]).toEqual(forward[1]);
    expect(shuffled[0]).toEqual(forward[2]);
  });

  it('produces every profile kind', () => {
    const kinds = new Set<string>();
    for (let k = 0; k < 200; k++) kinds.add(generateTrackProfile(3, k).kind);
    expect([...kinds].sort()).toEqual(['dip', 'flat-middle', 'hill', 'smooth']);
  });

  it('GEN-04/05: 1000 seeds × 100 chunks are continuous, finite and within grade', () => {
    const violations: string[] = [];
    for (let seed = 0; seed < 1000; seed++) {
      for (let k = -50; k < 50; k++) {
        const where = `seed ${seed}, version ${TEST_TRACK_GENERATOR_VERSION}, chunk ${k}`;
        const profile = generateTrackProfile(seed, k);
        const next = generateTrackProfile(seed, k + 1);
        if (profileHeightU(profile, width) !== profileHeightU(next, 0)) {
          violations.push(`${where}: height seam`);
        }
        if (profileGrade(profile, width) !== 0 || profileGrade(next, 0) !== 0) {
          violations.push(`${where}: grade at boundary`);
        }
        for (let x = 0; x <= width; x += 32) {
          const y = profileHeightU(profile, x);
          const grade = profileGrade(profile, x);
          if (!Number.isFinite(y) || !Number.isFinite(grade)) {
            violations.push(`${where}: non-finite at x=${x}`);
          } else if (Math.abs(grade) > maxGrade + 1e-9) {
            violations.push(`${where}: grade ${grade} at x=${x}`);
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('hills rise above and dips sink below both boundaries', () => {
    for (let k = 0; k < 300; k++) {
      const profile = generateTrackProfile(11, k);
      const middle = profileHeightU(profile, width / 2);
      const low = Math.min(profile.startHeightU, profile.endHeightU);
      const high = Math.max(profile.startHeightU, profile.endHeightU);
      if (profile.kind === 'hill') expect(middle).toBeGreaterThanOrEqual(high);
      if (profile.kind === 'dip') expect(middle).toBeLessThanOrEqual(low);
      if (profile.kind === 'flat-middle') {
        expect(Math.abs(profileGrade(profile, width / 2))).toBe(0);
        expect(profileHeightU(profile, 300)).toBe(profileHeightU(profile, 700));
      }
    }
  });

  it('grade is the derivative of height', () => {
    const profile = generateTrackProfile(8, 3);
    for (let x = 1; x < width; x += 37) {
      const numeric =
        (profileHeightU(profile, x + 1e-4) -
          profileHeightU(profile, x - 1e-4)) /
        2e-4;
      expect(profileGrade(profile, x)).toBeCloseTo(numeric, 5);
    }
  });
});
