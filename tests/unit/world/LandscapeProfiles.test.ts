import { validateTrackProfile } from '../../../src/domain/world/WorldValidation.ts';
import { expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { regionAt, REGION_BLOCK_U } from '../../../src/domain/world/Regions.ts';
import {
  generateTrackProfile,
  profileGrade,
  profileHeightU,
} from '../../../src/domain/world/TrackProfile.ts';

const envelopes = {
  countryside: [100, 0.035],
  forest: [160, 0.06],
  lakes: [60, 0.025],
  foothills: [260, 0.1],
  mountains: [380, 0.1],
  coast: [60, 0.025],
  dunes: [100, 0.04],
  town: [120, 0.03],
} as const;
it('SCN-G12: landscape height/grade envelopes over 50 complete seeded cycles and their borders', () => {
  const failures: string[] = [];
  for (let seed = 0; seed < 50; seed++)
    for (let k = -8; k < 488; k++) {
      const r = regionAt(seed, k * 1024),
        [height, grade] = envelopes[r.landscape];
      const p = generateTrackProfile(seed, k),
        next = generateTrackProfile(seed, k + 1);
      failures.push(...validateTrackProfile(p).map((e) => `${seed}/${k}/${e}`));
      for (let x = 0; x <= 1024; x += 128)
        if (
          Math.abs(profileHeightU(p, x)) > height + 1e-8 ||
          Math.abs(profileGrade(p, x)) > grade + 1e-9
        )
          failures.push(`${seed}/${k}/${r.landscape}/${x}`);
      if (
        Math.abs(profileHeightU(p, 1024) - profileHeightU(next, 0)) > 1e-8 ||
        Math.abs(profileGrade(p, 1024) - profileGrade(next, 0)) > 1e-10
      )
        failures.push(`seam ${seed}/${k}`);
    }
  expect(failures.slice(0, 10)).toEqual([]);
});
it('SCN-MO02/03/04 and FH02: mountain and foothill cores have higher peaks, deep valleys and both long grades', () => {
  for (let seed = 0; seed < 30; seed++) {
    let r = regionAt(seed, 0);
    for (let i = 0; i < 12; i++, r = regionAt(seed, r.toXU)) {
      if (r.landscape !== 'mountains' && r.landscape !== 'foothills') continue;
      const heights: number[] = [],
        grades: number[] = [];
      for (let k = r.fromXU / 1024; k < (r.toXU - REGION_BLOCK_U) / 1024; k++) {
        const p = generateTrackProfile(seed, k);
        for (let x = 0; x < 1024; x += 32) {
          heights.push(profileHeightU(p, x));
          grades.push(profileGrade(p, x));
        }
      }
      expect(
        Math.max(...heights) - Math.min(...heights),
        `${seed}/${r.id}`,
      ).toBeGreaterThanOrEqual(r.landscape === 'mountains' ? 500 : 260);
      if (r.landscape === 'mountains')
        expect(Math.max(...heights)).toBeGreaterThanOrEqual(300);
      expect(
        grades.some((g) => g >= (r.landscape === 'mountains' ? 0.08 : 0.04)),
      ).toBe(true);
      expect(
        grades.some((g) => g <= -(r.landscape === 'mountains' ? 0.08 : 0.04)),
      ).toBe(true);
    }
  }
});
it('pantograph grade ceiling is an explicit bounded config value', () => {
  expect('pantographMaxTrackGrade' in gameConfig.world).toBe(true);
});
import { validateGameConfig } from '../../../src/config/gameConfig.ts';
it('rejects unsafe or non-finite pantograph grade bounds', () => {
  for (const value of [0.13, 0, NaN])
    expect(
      validateGameConfig({
        ...gameConfig,
        world: { ...gameConfig.world, pantographMaxTrackGrade: value },
      }),
    ).toContain('world.pantographMaxTrackGrade');
});
it('SCN-MO03/04: mountain cores have both 1536u constant grades and a 768u usable flat', () => {
  for (let seed = 0; seed < 30; seed++) {
    let r = regionAt(seed, 0);
    while (r.landscape !== 'mountains') r = regionAt(seed, r.toXU);
    let prior = NaN,
      length = 0,
      up = false,
      down = false,
      flat = false;
    const record = () => {
      if (length >= 1536 && prior >= 0.08 - 1e-10) up = true;
      if (length >= 1536 && prior <= -0.08 + 1e-10) down = true;
      if (length >= 768 && Math.abs(prior) < 1e-10) flat = true;
    };
    for (let x = r.fromXU; x < r.toXU - 8192; x += 8) {
      const k = Math.floor(x / 1024),
        g = profileGrade(generateTrackProfile(seed, k), x - k * 1024);
      if (Math.abs(g - prior) < 1e-10) length += 8;
      else {
        record();
        prior = g;
        length = 8;
      }
    }
    record();
    expect({ up, down, flat }, `seed ${seed} region ${r.id}`).toEqual({
      up: true,
      down: true,
      flat: true,
    });
  }
});
