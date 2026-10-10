import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  POLE_ROAD_CLEARANCE_U,
  POLE_STREAM_CLEARANCE_U,
  TUNNEL_MAST_CLEARANCE_U,
  catenaryPoleXs,
  catenarySupport,
  contactWireHeightU,
} from '../../../src/domain/world/Catenary.ts';
import {
  crossingSite,
  crossingWorldX,
} from '../../../src/domain/world/Crossings.ts';
import {
  BRIDGE_HALF_U,
  bridgeSite,
  tunnelSite,
} from '../../../src/domain/world/Structures.ts';
import {
  generateTrackProfile,
  profileHeightU,
} from '../../../src/domain/world/TrackProfile.ts';

const { chunkWidthU, catenaryPoleSpacingU, catenaryContactHeightU } =
  gameConfig.world;
const SEEDS = [1, 7, 123, 2026];
const CHUNKS = 64;

/** Rail height (world, up) at world x, from the generator alone. */
const railHeight = (seed: number) => (x: number) => {
  const k = Math.floor(x / chunkWidthU);
  return profileHeightU(generateTrackProfile(seed, k), x - k * chunkWidthU);
};

describe('catenary of an electric journey (doc 03 §9, TRN-08)', () => {
  it('stands its poles in one global phase, whichever chunks are asked', () => {
    for (const seed of SEEDS) {
      const whole = catenaryPoleXs(seed, 0, CHUNKS * chunkWidthU);
      const byChunk = Array.from({ length: CHUNKS }, (_, k) =>
        catenaryPoleXs(seed, k * chunkWidthU, (k + 1) * chunkWidthU),
      ).flat();
      expect(byChunk).toEqual(whole);
      expect(whole.length).toBeGreaterThan(
        (CHUNKS * chunkWidthU) / catenaryPoleSpacingU - 1,
      );
      for (let i = 1; i < whole.length; i++) {
        const gap = (whole[i] ?? 0) - (whole[i - 1] ?? 0);
        // A pole beside a road or a stream moves by at most the larger
        // clearance.
        expect(gap).toBeGreaterThanOrEqual(
          catenaryPoleSpacingU - POLE_STREAM_CLEARANCE_U,
        );
        expect(gap).toBeLessThanOrEqual(
          catenaryPoleSpacingU + POLE_STREAM_CLEARANCE_U,
        );
      }
    }
  });

  it('keeps every pole off the crossing roads', () => {
    let crossings = 0;
    for (const seed of SEEDS)
      for (let k = 0; k < CHUNKS; k++) {
        const site = crossingSite(seed, k);
        if (!site) continue;
        crossings += 1;
        const road = crossingWorldX(site);
        for (const x of catenaryPoleXs(seed, road - 512, road + 512))
          expect(
            Math.abs(x - road),
            `seed ${seed} chunk ${k}`,
          ).toBeGreaterThanOrEqual(POLE_ROAD_CLEARANCE_U);
      }
    expect(crossings).toBeGreaterThan(10);
    // The clearance keeps the road and its posts free.
    expect(POLE_ROAD_CLEARANCE_U).toBeGreaterThanOrEqual(44);
  });

  it('keeps every pole out of the streams under bridges', () => {
    let bridges = 0;
    for (const seed of SEEDS)
      for (let k = 0; k < CHUNKS; k++) {
        const site = bridgeSite(seed, k);
        if (!site) continue;
        bridges += 1;
        const river = k * chunkWidthU + site.localXU;
        for (const x of catenaryPoleXs(seed, river - 512, river + 512))
          expect(Math.abs(x - river)).toBeGreaterThanOrEqual(BRIDGE_HALF_U);
      }
    expect(bridges).toBeGreaterThan(10);
  });

  it('hangs the contact wire at contact height at each pole, without a break at chunk seams', () => {
    for (const seed of SEEDS) {
      const rail = railHeight(seed);
      for (const x of catenaryPoleXs(seed, 0, 16 * chunkWidthU))
        expect(contactWireHeightU(seed, x, rail)).toBeCloseTo(
          rail(x) + catenaryContactHeightU,
          9,
        );
      for (let k = 1; k < 16; k++) {
        const seam = k * chunkWidthU;
        expect(contactWireHeightU(seed, seam - 1e-6, rail)).toBeCloseTo(
          contactWireHeightU(seed, seam + 1e-6, rail),
          4,
        );
      }
    }
  });

  it('stays close to contact height everywhere, so the pantograph always reaches it', () => {
    let worst = 0;
    for (const seed of SEEDS) {
      const rail = railHeight(seed);
      for (let x = 0; x < CHUNKS * chunkWidthU; x += 8)
        worst = Math.max(
          worst,
          Math.abs(
            contactWireHeightU(seed, x, rail) -
              rail(x) -
              catenaryContactHeightU,
          ),
        );
    }
    // Chords between poles over the generator's gentle transitions.
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(PANTOGRAPH_SLACK_U);
  });

  it('holds the wire by ceiling hangers in and at a tunnel, by masts elsewhere', () => {
    // World 123: the tunnel of chunk 6 runs from 6272 to 6720.
    expect(catenarySupport(123, 6400)).toBe('hanger');
    expect(catenarySupport(123, 6656)).toBe('hanger');
    expect(catenarySupport(123, 6144)).toBe('mast');
    expect(catenarySupport(123, 6912)).toBe('mast');
    for (const seed of SEEDS)
      for (let k = 0; k < CHUNKS; k++) {
        const tunnel = tunnelSite(seed, k);
        for (const x of catenaryPoleXs(
          seed,
          k * chunkWidthU,
          (k + 1) * chunkWidthU,
        )) {
          const local = x - k * chunkWidthU;
          const atTunnel =
            tunnel !== undefined &&
            local > tunnel.fromX - TUNNEL_MAST_CLEARANCE_U &&
            local < tunnel.toX + TUNNEL_MAST_CLEARANCE_U;
          expect(catenarySupport(seed, x)).toBe(atTunnel ? 'hanger' : 'mast');
        }
      }
  });
});

/** The pantograph adapts its height this much (doc 03 §9: limited). */
const PANTOGRAPH_SLACK_U = 6;
