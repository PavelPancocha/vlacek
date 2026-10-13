import { describe, expect, it } from 'vitest';
import {
  pantographReach,
  pantographReachU,
  PANTOGRAPH_WORKING_HEIGHT_U,
} from '../../../src/render/pantograph.ts';
import { artParts, vehicleArt } from '../../../src/content/artManifest.ts';
import {
  PANTOGRAPH_STRETCH,
  vehicleArtLayers,
} from '../../../src/content/artLayers.ts';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import { poseVehicle } from '../../../src/domain/train/TrainGeometry.ts';
import { contactWireHeightU } from '../../../src/domain/world/Catenary.ts';
import { heightAtX } from '../../../src/domain/world/ArcLengthTable.ts';
import {
  generateTrackProfile,
  TRACK_GENERATOR_VERSION,
} from '../../../src/domain/world/TrackProfile.ts';
import { TrackWindow } from '../../../src/domain/world/TrackWindow.ts';
import {
  bridgeSite,
  tunnelSite,
} from '../../../src/domain/world/Structures.ts';
import { emitterWorldPoint } from '../../../src/render/particles/emission.ts';

/** Contact point (render coordinates, y down) for a reach along "up". */
const contact = (
  base: { x: number; y: number },
  angleRad: number,
  reach: number,
) => ({
  x: base.x - reach * Math.sin(angleRad),
  y: base.y - reach * Math.cos(angleRad),
});

describe('pantographReachU (doc 03 §9)', () => {
  it('reaches straight up to a level wire on level track', () => {
    expect(pantographReachU({ x: 40, y: -86 }, 0, () => 128)).toBeCloseTo(
      42,
      9,
    );
  });

  it('touches a sloping wire from a tilted roof at the point of contact', () => {
    for (const angle of [-0.08, -0.03, 0.03, 0.08]) {
      const wire = (x: number) => 128 + 0.06 * x;
      const base = { x: 300, y: -(86 + 0.06 * 300) };
      const reach = pantographReachU(base, angle, wire);
      const point = contact(base, angle, reach);
      // Render y is down: the wire's render y is minus its height.
      expect(point.y).toBeCloseTo(-wire(point.x), 6);
    }
  });

  it('TRN-08: has compact wide arms, with at most 60 u of working reach', () => {
    for (const art of Object.values(vehicleArt)) {
      const p = art?.pantograph;
      if (!p) continue;
      const arms = artParts[p.arms];
      expect(arms.widthU).toBeGreaterThanOrEqual(
        arms.heightU * PANTOGRAPH_STRETCH[1],
      );
      expect(
        arms.heightU * PANTOGRAPH_STRETCH[1] + p.headContactU,
      ).toBeLessThanOrEqual(60);
    }
  });

  it('TRN-08: clamps and reports an out-of-reach wire without throwing in the render path', () => {
    const base = { x: 40, y: -86 };
    const [min, max] = PANTOGRAPH_WORKING_HEIGHT_U;
    for (const [wire, expected] of [
      [200, max],
      [90, min],
      [86 + max + 0.01, max],
      [Number.NaN, min],
      [Infinity, max],
      [-Infinity, min],
    ] as const) {
      expect(pantographReach(base, 0, () => wire)).toEqual({
        reachU: expected,
        outOfRange: true,
      });
      expect(pantographReachU(base, 0, () => wire)).toBe(expected);
    }
    for (const reachU of [min, 42, max])
      expect(pantographReach(base, 0, () => 86 + reachU)).toEqual({
        reachU,
        outOfRange: false,
      });
  });

  it.each([
    { grade: gameConfig.world.maxTrackGrade, reversal: false, fits: true },
    { grade: 0.098, reversal: true, fits: true },
    { grade: gameConfig.world.maxTrackGrade, reversal: true, fits: false },
  ])(
    'TRN-08: sweeps grade $grade, reversal $reversal, fits $fits at the configured transition length',
    ({ grade, reversal, fits }) => {
      const { chunkWidthU, profile } = gameConfig.world;
      let clamped = 0;
      for (const g of [grade / 2, grade])
        for (const [before, after] of reversal
          ? ([
              [g, -g],
              [-g, g],
            ] as const)
          : ([
              [0, g],
              [g, 0],
              [0, -g],
              [-g, 0],
            ] as const))
          for (const [seed, chunk] of [
            [123, 0],
            [0, 4],
          ] as const)
            for (const phaseU of [-376, -256, 0, 128, 384]) {
              const vertexXU = chunk * chunkWidthU + 512 + phaseU;
              const track = new TrackWindow(
                (k) => ({
                  transitionU: profile.transitionU,
                  vertices: [
                    {
                      xU: vertexXU - 2048 - k * chunkWidthU,
                      yU: -2048 * before,
                    },
                    { xU: vertexXU - k * chunkWidthU, yU: 0 },
                    { xU: vertexXU + 2048 - k * chunkWidthU, yU: 2048 * after },
                  ],
                }),
                chunk,
                gameConfig.world,
              );
              track.ensureRange(-2048, 3072);
              const rail = (x: number) =>
                heightAtX(track.chunkTable(Math.floor(x / chunkWidthU)), x);
              const wire = (x: number) => contactWireHeightU(seed, x, rail);
              for (
                let xU = Math.max(0, 512 + phaseU - 256);
                xU <= Math.min(1024, 512 + phaseU + 256);
                xU += 32
              )
                for (const loco of locomotives.filter(
                  (l) => l.requiresCatenary,
                )) {
                  const art = vehicleArt[loco.id];
                  const p = art?.pantograph;
                  if (!art || !p) throw new Error(`no pantograph: ${loco.id}`);
                  const pose = poseVehicle(
                    (s) => track.sample(s),
                    track.sFromLocalX(chunk, xU),
                    loco,
                  );
                  const base = emitterWorldPoint(
                    p,
                    { lengthU: loco.lengthU, heightU: art.heightU },
                    pose,
                  );
                  const result = pantographReach(base, pose.angleRad, wire);
                  const context = `seed ${seed}, chunk ${chunk}, grade ${before} -> ${after}, transition ${profile.transitionU}, phase ${phaseU}, x ${xU}, ${loco.id}`;
                  expect(result.reachU, context).toBeGreaterThanOrEqual(
                    PANTOGRAPH_WORKING_HEIGHT_U[0],
                  );
                  expect(result.reachU, context).toBeLessThanOrEqual(
                    PANTOGRAPH_WORKING_HEIGHT_U[1],
                  );
                  if (fits) expect(result.outOfRange, context).toBe(false);
                  if (result.outOfRange) clamped++;
                  else {
                    const point = contact(base, pose.angleRad, result.reachU);
                    expect(point.y + wire(point.x), context).toBeCloseTo(0, 4);
                  }
                }
            }
      if (fits) expect(clamped).toBe(0);
      else expect(clamped).toBeGreaterThan(0);
    },
  );

  it('TRN-08: tilted roofs and loads keep at least 12 u below the drawn wire on vertical curves', () => {
    for (const seed of [123, 2026]) {
      const track = new TrackWindow(
        (k) => generateTrackProfile(seed, k),
        0,
        gameConfig.world,
      );
      track.ensureRange(-2048, 9 * gameConfig.world.chunkWidthU);
      const rail = (x: number) =>
        heightAtX(
          track.chunkTable(Math.floor(x / gameConfig.world.chunkWidthU)),
          x,
        );
      for (let k = 0; k < 8; k++)
        for (
          let localXU = 0;
          localXU < gameConfig.world.chunkWidthU;
          localXU += 128
        )
          for (const vehicle of [...locomotives, ...wagons]) {
            const art = vehicleArt[vehicle.id];
            if (!art) throw new Error(`no art: ${vehicle.id}`);
            const s = track.sFromLocalX(k, localXU);
            const pose = poseVehicle((s) => track.sample(s), s, vehicle);
            for (const xU of [0, vehicle.lengthU / 2, vehicle.lengthU]) {
              const roof = emitterWorldPoint(
                { xU, yU: 0 },
                { lengthU: vehicle.lengthU, heightU: art.heightU },
                pose,
              );
              const gap = contactWireHeightU(seed, roof.x, rail) + roof.y;
              expect(
                gap,
                `g${TRACK_GENERATOR_VERSION}, seed ${seed}, chunk ${k}, x ${localXU}, ${vehicle.id}`,
              ).toBeGreaterThanOrEqual(12);
            }
          }
    }
  });

  it('TRN-08: every electric head touches the wire within 34–60 u on slopes, bridges and in tunnels across seeds', () => {
    let bridges = 0;
    let tunnels = 0;
    let slopes = 0;
    for (const seed of [0, 1, 7, 123, 2026, 98765, 2147483647, 4294967295]) {
      const track = new TrackWindow(
        (k) => generateTrackProfile(seed, k),
        0,
        gameConfig.world,
      );
      track.ensureRange(-2048, 32 * gameConfig.world.chunkWidthU + 1024);
      const rail = (x: number) =>
        heightAtX(
          track.chunkTable(Math.floor(x / gameConfig.world.chunkWidthU)),
          x,
        );
      const wire = (x: number) => contactWireHeightU(seed, x, rail);
      for (let k = -1; k < 32; k++) {
        if (bridgeSite(seed, k)) bridges++;
        if (tunnelSite(seed, k)) tunnels++;
        for (
          let localXU = 0;
          localXU < gameConfig.world.chunkWidthU;
          localXU += 128
        ) {
          const s = track.sFromLocalX(k, localXU);
          for (const loco of locomotives.filter((l) => l.requiresCatenary)) {
            const art = vehicleArt[loco.id];
            const p = art?.pantograph;
            if (!art || !p) throw new Error(`no pantograph: ${loco.id}`);
            const pose = poseVehicle((s) => track.sample(s), s, loco);
            if (Math.abs(pose.angleRad) > 0.01) slopes++;
            const base = emitterWorldPoint(
              p,
              { lengthU: loco.lengthU, heightU: art.heightU },
              pose,
            );
            const reach = pantographReachU(base, pose.angleRad, wire);
            const context = `g${TRACK_GENERATOR_VERSION}, seed ${seed}, chunk ${k}, x ${localXU}, ${loco.id}`;
            expect(reach, context).toBeGreaterThanOrEqual(34);
            expect(reach, context).toBeLessThanOrEqual(60);
            const head = vehicleArtLayers(art, loco.lengthU, 0, reach).find(
              (l) => l.part === p.head,
            );
            if (!head) throw new Error('head missing');
            const drawnReach = p.yU - art.heightU - head.y + p.headContactU;
            const point = contact(base, pose.angleRad, drawnReach);
            expect(point.y + wire(point.x), context).toBeCloseTo(0, 5);
          }
        }
      }
    }
    expect(bridges).toBeGreaterThan(10);
    expect(tunnels).toBeGreaterThan(10);
    expect(slopes).toBeGreaterThan(100);
  });
});
