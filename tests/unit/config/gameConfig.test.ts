import { trainZoom } from '../../../src/render/cameraFraming.ts';
import { vehicleArt } from '../../../src/content/artManifest.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import { describe, expect, it } from 'vitest';
import {
  crossingCloseDistanceU,
  gameConfig,
  validateGameConfig,
  type GameConfig,
} from '../../../src/config/gameConfig.ts';

const catalogArt = [...locomotives, ...wagons].map(({ id }) => {
  const art = vehicleArt[id];
  if (!art) throw new Error(`Catalog art missing: ${id}`);
  return { id, art };
});

describe('gameConfig', () => {
  it('carries the doc 13 input defaults', () => {
    expect(gameConfig.input).toEqual({
      maxPointers: 5,
      leftSwipeDistanceCssPx: 64,
      leftSwipeMaxDurationMs: 500,
      leftSwipeHorizontalRatio: 1.5,
      minTargetCssPx: 64,
      primaryControlTargetCssPx: 80,
    });
  });

  it('camera-1: the wider fixed scale changes screen speed while preserving motion', () => {
    const { train, camera } = gameConfig;
    const framing = { ...camera, vehicleHeightU: 150 };
    const view = {
      widthPx: 1280,
      heightPx: 800,
      reservedTopPx: 0,
      reservedBottomPx: 0,
    };
    // Camera-1 keeps one fixed wider scale for every allowed ride.
    expect(
      (train.maxSpeedUPerSec * trainZoom(view, 1600, framing)) / view.widthPx,
    ).toBeCloseTo(0.144, 9);
    expect(
      (train.maxSpeedUPerSec *
        trainZoom(view, train.maxConsistLengthU, framing)) /
        view.widthPx,
    ).toBeCloseTo(0.144, 9);
    // Smooth start and coast: seconds from standstill to full speed and back.
    const toFull = train.maxSpeedUPerSec / train.accelerationUPerSec2;
    const coast = train.maxSpeedUPerSec / train.coastDecelerationUPerSec2;
    const brake = train.maxSpeedUPerSec / train.brakeDecelerationUPerSec2;
    expect(toFull).toBeGreaterThanOrEqual(2);
    expect(toFull).toBeLessThanOrEqual(4);
    expect(coast).toBeGreaterThanOrEqual(4);
    expect(coast).toBeLessThanOrEqual(7);
    expect(brake).toBeLessThan(coast / 3);
  });

  it('carries the doc 13 catenary spacing and contact height (doc 03 §9)', () => {
    expect(gameConfig.world.catenaryPoleSpacingU).toBe(256);
    expect(gameConfig.world.catenaryContactHeightU).toBe(128);
  });

  it('TRN-08: clears every catalog roof and load by 20 u without towering over the train', () => {
    const tallest = Math.max(...catalogArt.map(({ art }) => art.heightU));
    for (const { id, art } of catalogArt)
      expect(
        gameConfig.world.catenaryContactHeightU - art.heightU,
        id,
      ).toBeGreaterThanOrEqual(20);
    expect(gameConfig.world.catenaryContactHeightU).toBeLessThanOrEqual(
      1.25 * tallest,
    );
  });

  it('TRN-08: rejects a config that would leave less than 20 u above a catalog roof or load', () => {
    const tallest = Math.max(...catalogArt.map(({ art }) => art.heightU));
    for (const height of [tallest, tallest + 19.9, NaN, Infinity])
      expect(
        validateGameConfig({
          ...gameConfig,
          world: { ...gameConfig.world, catenaryContactHeightU: height },
        }),
      ).toContain('world.catenaryContactHeightU');
  });

  it('rejects poles that would not keep one phase across chunks', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: {
        ...gameConfig.world,
        catenaryPoleSpacingU: 300,
        catenaryContactHeightU: 0,
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'world.catenaryPoleSpacingU',
      'world.catenaryContactHeightU',
    ]);
  });

  it('carries the doc 13 second-track and oncoming-train defaults (doc 04 §7, doc 05 §6)', () => {
    const { world, interaction } = gameConfig;
    expect([
      world.secondaryTrackOffsetU,
      world.secondaryRailProbability,
      world.forcedSecondaryBiomeBlock,
      world.npcTriggerBeforeFeatureU,
      world.npcHiddenPathMarginU,
    ]).toEqual([64, 1 / 3, 1, 512, 256]);
    expect(interaction).toEqual({
      defaultCooldownSeconds: 1.5,
      hornMinIntervalSeconds: 0.7,
      npcHornCooldownSeconds: 8,
      hornResponseRadiusU: 800,
      npcTrainMaxWagons: 5,
      npcTrainMinSpeedUPerSec: 100,
      npcTrainMaxSpeedUPerSec: 160,
    });
  });

  it('rejects an oncoming train faster at its slowest than at its fastest', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: { ...gameConfig.world, secondaryRailProbability: 1.5 },
      interaction: {
        ...gameConfig.interaction,
        npcTrainMinSpeedUPerSec: 200,
        npcTrainMaxWagons: 0,
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'interaction.npcTrainMaxWagons',
      'interaction.npcTrainSpeedUPerSec',
      'world.secondaryRailProbability',
    ]);
  });

  it('R2: rejects an infinite maximum speed for oncoming trains', () => {
    const broken: GameConfig = {
      ...gameConfig,
      interaction: {
        ...gameConfig.interaction,
        npcTrainMaxSpeedUPerSec: Infinity,
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'interaction.npcTrainSpeedUPerSec',
    ]);
  });

  it('carries the doc 13 quality profiles with their particle budgets', () => {
    expect(gameConfig.quality).toEqual({
      low: { maxDpr: 1, targetFps: 30, maxDecorativeParticles: 96 },
      standard: { maxDpr: 1.5, targetFps: 60, maxDecorativeParticles: 240 },
    });
  });

  it('rejects a quality profile without a particle budget', () => {
    const broken: GameConfig = {
      ...gameConfig,
      quality: {
        ...gameConfig.quality,
        low: { ...gameConfig.quality.low, maxDecorativeParticles: 0 },
        standard: { ...gameConfig.quality.standard, maxDpr: 0.5 },
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'quality.low.maxDecorativeParticles',
      'quality.standard.maxDpr',
    ]);
  });

  it('carries the doc 13 crossing timings and derives Dclose from the top speed (doc 05 §4)', () => {
    expect(gameConfig.crossing).toEqual({
      roadClearanceSeconds: 2,
      warningSeconds: 1.2,
      maxWarningSeconds: 4,
      openHysteresisSeconds: 0.5,
      closingSeconds: 0.8,
      openingSeconds: 0.8,
      safetySeconds: 0.5,
      distanceMarginU: 80,
      maxQueuedCars: 6,
      maxQueuedBikes: 2,
    });
    // Doc 05 example: 180 u/s gives 890 u; the ride now tops out at 480 u/s.
    expect(crossingCloseDistanceU(gameConfig.crossing, 180)).toBeCloseTo(
      890,
      9,
    );
    expect(
      crossingCloseDistanceU(
        gameConfig.crossing,
        gameConfig.train.maxSpeedUPerSec,
      ),
    ).toBeCloseTo(480 * 4.5 + 80, 9);
  });

  it('is valid as shipped', () => {
    expect(validateGameConfig(gameConfig)).toEqual([]);
  });

  it('rejects a road clearance shorter than the slowest road actor needs (doc 05 §4)', () => {
    // A shorter clearance also shortens Dclose: a train at top speed would
    // reach the crossing before the barriers are down.
    const withClearance = (roadClearanceSeconds: number): GameConfig => ({
      ...gameConfig,
      crossing: { ...gameConfig.crossing, roadClearanceSeconds },
    });
    expect(validateGameConfig(withClearance(0.1))).toEqual([
      'crossing.roadClearanceSeconds',
    ]);
    expect(validateGameConfig(withClearance(1.9))).toEqual([
      'crossing.roadClearanceSeconds',
    ]);
    expect(validateGameConfig(withClearance(Number.NaN))).toEqual([
      'crossing.roadClearanceSeconds',
    ]);
    expect(validateGameConfig(withClearance(2))).toEqual([]);
  });

  it('reports out-of-range values with their path', () => {
    const broken: GameConfig = {
      ...gameConfig,
      input: {
        ...gameConfig.input,
        maxPointers: 0,
        leftSwipeDistanceCssPx: Number.NaN,
        primaryControlTargetCssPx: 40,
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'input.maxPointers',
      'input.leftSwipeDistanceCssPx',
      'input.primaryControlTargetCssPx',
    ]);
  });

  it('rejects a train-width fraction of zero (the camera would not zoom)', () => {
    const broken: GameConfig = {
      ...gameConfig,
      camera: { ...gameConfig.camera, trainWidthFraction: 0 },
    };
    expect(validateGameConfig(broken)).toEqual(['camera.trainWidthFraction']);
  });

  it('camera-1: rejects a centre that clips the reference train', () => {
    const camera = { ...gameConfig.camera, trainCenterFraction: 0.1 };
    expect(validateGameConfig({ ...gameConfig, camera })).toEqual([
      'camera.trainCenterFraction',
    ]);
  });

  it('rejects a terrain without lattice or with a negative embankment', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: {
        ...gameConfig.world,
        terrain: { latticeU: 0, maxEmbankmentU: -1 },
      },
    };
    expect(validateGameConfig(broken)).toEqual([
      'world.terrain.latticeU',
      'world.terrain.maxEmbankmentU',
    ]);
  });

  it('R8: rejects a biome block with four chunks instead of eight', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: { ...gameConfig.world, chunksPerBiomeBlock: 4 },
    };
    expect(validateGameConfig(broken)).toEqual(['world.chunksPerBiomeBlock']);
  });

  it('R9: rejects an infinite geometry look-ahead', () => {
    const broken: GameConfig = {
      ...gameConfig,
      world: { ...gameConfig.world, geometryLookAheadU: Infinity },
    };
    expect(validateGameConfig(broken)).toEqual(['world.geometryLookAheadU']);
  });

  it('camera-2: rejects a tail reserve below the wider view or an unbounded reserve', () => {
    for (const geometryTailMarginU of [1024, 1599, Infinity, NaN]) {
      expect(
        validateGameConfig({
          ...gameConfig,
          world: { ...gameConfig.world, geometryTailMarginU },
        }),
      ).toEqual(['world.geometryTailMarginU']);
    }
  });
});

it('rejects invalid crossing deadlines and a maximum warning shorter than the minimum', () => {
  for (const maxWarningSeconds of [
    0,
    NaN,
    Infinity,
    gameConfig.crossing.warningSeconds - 0.1,
  ]) {
    expect(
      validateGameConfig({
        ...gameConfig,
        crossing: { ...gameConfig.crossing, maxWarningSeconds },
      }),
    ).toContain('crossing.maxWarningSeconds');
  }
  for (const openHysteresisSeconds of [0, NaN, Infinity]) {
    expect(
      validateGameConfig({
        ...gameConfig,
        crossing: { ...gameConfig.crossing, openHysteresisSeconds },
      }),
    ).toContain('crossing.openHysteresisSeconds');
  }
});

it('D-024: station reaction defaults follow document 13 and invalid timing is rejected', () => {
  expect(gameConfig.station).toEqual({
    stopSpeedThresholdUPerSec: 4,
    stopDetectionSeconds: 0.5,
    sceneCooldownSeconds: 12,
  });
  for (const key of [
    'stopSpeedThresholdUPerSec',
    'stopDetectionSeconds',
    'sceneCooldownSeconds',
  ] as const)
    expect(
      validateGameConfig({
        ...gameConfig,
        station: { ...gameConfig.station, [key]: 0 },
      }),
    ).toContain(`station.${key}`);
});
