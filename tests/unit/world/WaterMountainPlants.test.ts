import { expect, it } from 'vitest';
import {
  swayAmplitudeRad,
  swayAngle,
} from '../../../src/render/ambientMotion.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
it.each([
  'near.heather',
  'near.heather-green',
  'near.young-pine',
  'near.reed-clump',
  'near.reed-clump-autumn',
])(
  'DU/LA: %s has seeded gentle wind and a matching placement envelope',
  (kind) => {
    expect(swayAmplitudeRad(kind)).toBeGreaterThan(0);
    expect(worldPlacementCatalog[kind]?.swayRad).toBe(swayAmplitudeRad(kind));
    expect(swayAngle(kind, 2, 0.1)).not.toBe(swayAngle(kind, 2, 0.8));
    expect(Math.abs(swayAngle(kind, 2, 0.1))).toBeLessThanOrEqual(
      swayAmplitudeRad(kind),
    );
  },
);
