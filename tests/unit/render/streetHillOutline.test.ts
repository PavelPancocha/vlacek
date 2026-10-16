import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { worldParts } from '../../../src/content/worldArt.ts';
import { streetHillCoversCap } from '../../../src/domain/world/StreetHillCover.ts';
import { secondarySite } from '../../../src/domain/world/SecondaryTrack.ts';
import {
  generateTrackProfile,
  profileGrade,
} from '../../../src/domain/world/TrackProfile.ts';
import { railYUpU } from '../../../src/domain/world/SceneryGeometry.ts';

for (const mirrored of [false, true])
  it(`secondary SVG flank includes placement, grade and mirroring=${mirrored}`, () => {
    const seed = 0,
      site = secondarySite(seed, 1);
    if (!site) throw Error('missing secondary track');
    const portal = mirrored ? site.toX : site.fromX;
    const grade = profileGrade(generateTrackProfile(seed, portal / 1024), 0);
    expect(Math.abs(grade)).toBeGreaterThan(0);
    const angle = -Math.atan(grade),
      c = Math.cos(angle),
      s = Math.sin(angle);
    const world = (x: number, y: number) => {
      const dx = (x - 380) * (mirrored ? -1 : 1),
        dy = y - 194;
      return {
        xU: portal + c * dx - s * dy,
        yU: -railYUpU(seed, portal) - 64 + s * dx + c * dy,
      };
    };
    const hill = {
      purpose: 'secondary-hill' as const,
      ownerId: `${site.id}:portal:${portal}`,
    };
    const covers = (x: number, y: number) =>
      streetHillCoversCap(seed, Math.floor(portal / 1024), hill, [
        world(x, y - 10.6),
        world(x, y + 10.6),
      ]);
    // The old rectangular-reservation witness, one exposed shoulder, and opaque grass.
    expect(covers(28, 73)).toBe(false);
    expect(covers(60, 82)).toBe(false);
    expect(covers(100, 110)).toBe(true);
    expect(covers(380, 150)).toBe(false); // Open portal is not opaque grass.
  });

it('secondary SVG changes require review of the local hill outline', () => {
  const svg = readFileSync(
    `assets/world/${worldParts['secondary.portal-hill'].file}`,
  );
  expect(
    createHash('sha256').update(svg).digest('hex'),
    'Review StreetHillCover outline data before updating this SVG fingerprint (opaque fill, opacity and clipping included).',
  ).toBe('95d328a0c09f8c452c66fdf9448229f62abb9bfda3d368194845460c084a1466');
});

it('secondary manifest matches the local hill dimensions and pivot', () => {
  expect(worldParts['secondary.portal-hill']).toMatchObject({
    file: 'secondary.portal-hill.svg',
    widthU: 440,
    heightU: 200,
    pivotU: { x: 380, y: 194 },
  });
});
