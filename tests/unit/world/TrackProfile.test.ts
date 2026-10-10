import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  TRACK_GENERATOR_VERSION,
  blockPlan,
  generateTrackProfile,
  profileGrade,
  profileHeightU,
} from '../../../src/domain/world/TrackProfile.ts';

const width = gameConfig.world.chunkWidthU;
const maxGrade = gameConfig.world.maxTrackGrade;
const plan = gameConfig.world.profile;
const STEP_U = 8;

/** Grades every 8 u over `chunks` chunks starting at chunk `from`. */
function sampleGrades(seed: number, from: number, chunks: number): number[] {
  const grades: number[] = [];
  for (let k = from; k < from + chunks; k++) {
    const profile = generateTrackProfile(seed, k);
    for (let x = 0; x < width; x += STEP_U)
      grades.push(profileGrade(profile, x));
  }
  return grades;
}

/** Runs of constant grade as [grade, lengthU]. */
function constantRuns(grades: readonly number[]): [number, number][] {
  const runs: [number, number][] = [];
  let start = 0;
  for (let i = 1; i <= grades.length; i++) {
    if (
      i === grades.length ||
      Math.abs((grades[i] ?? 0) - (grades[start] ?? 0)) > 1e-12
    ) {
      runs.push([grades[start] ?? 0, (i - start) * STEP_U]);
      start = i;
    }
  }
  return runs;
}

describe('track generator v1 (doc 14 §6)', () => {
  it('is generator version 1', () => {
    expect(TRACK_GENERATOR_VERSION).toBe(1);
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

  it('GEN-04/05: 1000 seeds × 100 chunks are continuous, finite, bounded and within grade', () => {
    const violations: string[] = [];
    for (let seed = 0; seed < 1000; seed++) {
      let previous = generateTrackProfile(seed, -50);
      for (let k = -50; k < 50; k++) {
        const where = `seed ${seed}, version ${TRACK_GENERATOR_VERSION}, chunk ${k}`;
        const next = generateTrackProfile(seed, k + 1);
        if (
          Math.abs(profileHeightU(previous, width) - profileHeightU(next, 0)) >
          1e-9
        ) {
          violations.push(`${where}: height seam`);
        }
        if (
          Math.abs(profileGrade(previous, width) - profileGrade(next, 0)) >
          1e-12
        ) {
          violations.push(`${where}: grade seam`);
        }
        for (let x = 0; x <= width; x += 64) {
          const y = profileHeightU(previous, x);
          const grade = profileGrade(previous, x);
          if (!Number.isFinite(y) || !Number.isFinite(grade)) {
            violations.push(`${where}: non-finite at x=${x}`);
          } else if (Math.abs(grade) > maxGrade + 1e-9) {
            violations.push(`${where}: grade ${grade} at x=${x}`);
          } else if (Math.abs(y) > plan.maxHeightU + 1e-9) {
            violations.push(`${where}: height ${y} at x=${x}`);
          }
        }
        previous = next;
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('mostly holds a constant grade; transitions are short and smooth', () => {
    for (const seed of [1, 77, 123, 4_000_000_000]) {
      const grades = sampleGrades(seed, 0, 64);
      let changing = 0;
      for (let i = 1; i < grades.length; i++) {
        const change = Math.abs((grades[i] ?? 0) - (grades[i - 1] ?? 0));
        if (change > 1e-12) changing += 1;
        // No kink: the grade changes at most linearly over a transition.
        expect(change).toBeLessThanOrEqual(
          (plan.gradeRangeMax * STEP_U) / plan.transitionU + 1e-9,
        );
      }
      expect(changing / grades.length, `seed ${seed}`).toBeLessThan(0.25);
    }
  });

  it('alternates flats with long straight climbs and descents, not a regular wave', () => {
    let longFlats = 0;
    let climbs = 0;
    let descents = 0;
    const slopeLengths = new Set<number>();
    for (const seed of [1, 77, 123]) {
      for (const [grade, lengthU] of constantRuns(sampleGrades(seed, 0, 64))) {
        if (grade === 0 && lengthU >= 256) longFlats += 1;
        if (Math.abs(grade) >= plan.gradeRangeMin - 1e-9 && lengthU >= 512) {
          if (grade > 0) climbs += 1;
          else descents += 1;
          slopeLengths.add(Math.round(lengthU / 64));
        }
      }
    }
    expect(longFlats).toBeGreaterThan(15);
    expect(climbs).toBeGreaterThan(8);
    expect(descents).toBeGreaterThan(8);
    // Irregular: many different straight-slope lengths.
    expect(slopeLengths.size).toBeGreaterThanOrEqual(6);
  });

  it('block plans start and end flat at their seeded block heights', () => {
    const blockU = plan.blockChunks * width;
    for (let b = -5; b < 5; b++) {
      const vertices = blockPlan(31, b);
      const next = blockPlan(31, b + 1);
      expect(vertices[0]?.xU).toBe(0);
      expect(vertices.at(-1)?.xU).toBe(blockU);
      expect(vertices.at(-1)?.yU).toBe(next[0]?.yU);
      // Flat for at least a transition at both ends.
      expect((vertices[1]?.xU ?? 0) - 0).toBeGreaterThanOrEqual(
        plan.transitionU,
      );
      expect(vertices[1]?.yU).toBe(vertices[0]?.yU);
      expect(blockU - (vertices.at(-2)?.xU ?? 0)).toBeGreaterThanOrEqual(
        plan.transitionU,
      );
      expect(vertices.at(-2)?.yU).toBe(vertices.at(-1)?.yU);
    }
  });

  it('every plan segment is long enough for its transitions (no overlapping curves)', () => {
    const violations: string[] = [];
    for (let seed = 0; seed < 300; seed++) {
      for (let b = -10; b < 10; b++) {
        const vertices = blockPlan(seed, b);
        for (let i = 1; i < vertices.length; i++) {
          const a = vertices[i - 1];
          const c = vertices[i];
          if (!a || !c) continue;
          const lengthU = c.xU - a.xU;
          const grade = Math.abs((c.yU - a.yU) / lengthU);
          if (!(lengthU >= plan.transitionU)) {
            violations.push(
              `seed ${seed} block ${b} segment ${i}: ${lengthU} u`,
            );
          }
          if (grade > plan.gradeRangeMax + 1e-9) {
            violations.push(
              `seed ${seed} block ${b} segment ${i}: grade ${grade}`,
            );
          }
        }
      }
    }
    expect(violations.slice(0, 5)).toEqual([]);
  });

  it('works the same far from the start (chunk 10⁹)', () => {
    const k = 999_999_990;
    const a = generateTrackProfile(9, k);
    const b = generateTrackProfile(9, k + 1);
    expect(profileHeightU(a, width)).toBeCloseTo(profileHeightU(b, 0), 9);
    expect(Math.abs(profileHeightU(a, 512))).toBeLessThanOrEqual(
      plan.maxHeightU,
    );
  });

  it('grade is the derivative of height', () => {
    for (const k of [0, 3, 7, 12]) {
      const profile = generateTrackProfile(8, k);
      for (let x = 1; x < width; x += 37) {
        const numeric =
          (profileHeightU(profile, x + 1e-4) -
            profileHeightU(profile, x - 1e-4)) /
          2e-4;
        expect(profileGrade(profile, x)).toBeCloseTo(numeric, 5);
      }
    }
  });
});
