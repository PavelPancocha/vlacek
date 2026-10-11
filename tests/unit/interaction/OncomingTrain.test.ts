import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import {
  OncomingTrain,
  type NpcFleet,
} from '../../../src/domain/interaction/OncomingTrain.ts';
import {
  SECONDARY_SCALE,
  secondarySite,
} from '../../../src/domain/world/SecondaryTrack.ts';

const fleet: NpcFleet = {
  locomotives: [
    { id: 'steam_local', lengthU: 156, bogieOffsetU: 46, wheelRadiusU: 15 },
    { id: 'diesel_mainline', lengthU: 196, bogieOffsetU: 62, wheelRadiusU: 13 },
  ],
  wagons: [
    { id: 'cargo_box', lengthU: 164, bogieOffsetU: 51, wheelRadiusU: 12 },
    { id: 'cargo_container', lengthU: 188, bogieOffsetU: 58, wheelRadiusU: 12 },
    { id: 'passenger_open', lengthU: 144, bogieOffsetU: 45, wheelRadiusU: 12 },
  ],
};
const { interaction } = gameConfig;
const DT = 1 / gameConfig.simulation.fixedHz;

function site(seed: number) {
  const found = secondarySite(seed, gameConfig.world.forcedSecondaryBiomeBlock);
  if (!found) throw new Error('no forced second track');
  return found;
}

describe('OncomingTrain (doc 05 §6, SCN-09)', () => {
  it('is a steam or diesel train with 1–5 wagons at 100–160 u/s, the same for the same seed', () => {
    const wagons = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const train = new OncomingTrain(seed, site(seed), fleet, gameConfig);
      const [loco, ...rest] = train.vehicles;
      expect(['steam_local', 'diesel_mainline']).toContain(loco?.id);
      expect(rest.length).toBeGreaterThanOrEqual(1);
      expect(rest.length).toBeLessThanOrEqual(interaction.npcTrainMaxWagons);
      wagons.add(rest.length);
      expect(train.speedUPerSec).toBeGreaterThanOrEqual(
        interaction.npcTrainMinSpeedUPerSec,
      );
      expect(train.speedUPerSec).toBeLessThanOrEqual(
        interaction.npcTrainMaxSpeedUPerSec,
      );
      // Laid out at the deeper layer's scale.
      expect(loco?.lengthU).toBeCloseTo(
        (fleet.locomotives.find((l) => l.id === loco?.id)?.lengthU ?? 0) *
          SECONDARY_SCALE,
        9,
      );
      expect(
        new OncomingTrain(seed, site(seed), fleet, gameConfig).vehicles,
      ).toEqual(train.vehicles);
    }
    expect(wagons.size).toBeGreaterThan(2);
  });

  it('comes out of the right portal, drives right to left and hides whole in the left one', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const where = site(seed);
      const train = new OncomingTrain(seed, where, fleet, gameConfig);
      // Starts whole in the hidden right part.
      expect(train.done).toBe(false);
      expect(train.xSpan().minX).toBeGreaterThanOrEqual(where.toX);
      let previous = train.xSpan();
      let steps = 0;
      while (!train.done) {
        train.step(DT);
        steps += 1;
        // Every vehicle stands on existing geometry all the way.
        for (let i = 0; i < train.vehicles.length; i++) train.vehiclePose(i);
        const span = train.xSpan();
        expect(span.minX).toBeLessThan(previous.minX);
        previous = span;
        if (steps > 60 * 120) throw new Error(`seed ${seed}: never arrives`);
      }
      // Done only when its last vehicle is hidden in the left portal.
      expect(train.xSpan().maxX).toBeLessThanOrEqual(where.fromX);
    }
  });

  it('keeps its wagons behind the locomotive, to its right (d = −1)', () => {
    const train = new OncomingTrain(5, site(5), fleet, gameConfig);
    expect(train.travelledU).toBe(0);
    for (let i = 0; i < 600; i++) train.step(DT);
    // Distance for the wheels: speed × time.
    expect(train.travelledU).toBeCloseTo(train.speedUPerSec * 600 * DT, 6);
    const xs = train.vehicles.map((_, i) => train.vehiclePose(i).centerX);
    for (let i = 1; i < xs.length; i++)
      expect(xs[i] ?? 0).toBeGreaterThan(xs[i - 1] ?? 0);
  });
});
