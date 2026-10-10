/**
 * Typed default parameters owned by doc 13 (13_VYCHOZI_KONFIGURACE.md).
 * Only sections used by implemented features live here; units are in the
 * names (`U` world units, `CssPx` CSS pixels, `Ms` milliseconds).
 */
export interface InputConfig {
  maxPointers: number;
  leftSwipeDistanceCssPx: number;
  leftSwipeMaxDurationMs: number;
  leftSwipeHorizontalRatio: number;
  minTargetCssPx: number;
  primaryControlTargetCssPx: number;
}

export interface SimulationConfig {
  fixedHz: number;
  maxCatchUpSteps: number;
}

export interface TrainConfig {
  /**
   * Longest train, locomotive front to last wagon end with couplers (doc 14
   * §2). The camera fits this length into its share of the screen width.
   */
  maxConsistLengthU: number;
  maxVehicleLengthU: number;
  couplerGapU: number;
  maxSpeedUPerSec: number;
  accelerationUPerSec2: number;
  coastDecelerationUPerSec2: number;
  brakeDecelerationUPerSec2: number;
  stopEpsilonUPerSec: number;
  uphillSpeedReduction: number;
  gradeAccelerationFactor: number;
  slowModeSpeedFactor: number;
}

/**
 * Track profile of generator v1 (doc 14 §6, D-009): blocks of chunks made of
 * flats and long constant grades joined by short parabolic transitions.
 * Every value is a geometry input: changing one needs a new generator version.
 */
export interface TrackProfileConfig {
  blockChunks: number;
  /** Track height stays within ±maxHeightU. */
  maxHeightU: number;
  /** Block boundary heights are seeded within ±blockHeightRangeU. */
  blockHeightRangeU: number;
  flatMinU: number;
  flatMaxU: number;
  slopeMinU: number;
  slopeMaxU: number;
  gradeRangeMin: number;
  gradeRangeMax: number;
  /** Length of one grade transition (vertical curve). */
  transitionU: number;
  /** Segment lengths are multiples of this. */
  lengthStepU: number;
}

/** Ground around the track (`src/domain/world/Terrain.ts`). */
export interface TerrainConfig {
  /** Spacing of the seeded height nodes; heights blend between them. */
  latticeU: number;
  /** Highest track bed above the near meadow. */
  maxEmbankmentU: number;
}

export interface WorldConfig {
  chunkWidthU: number;
  /** Chunks of one biome block (doc 04 §5–6). */
  chunksPerBiomeBlock: number;
  /** Biome blocks of one route itinerary (doc 04 §5). */
  blocksPerRouteCycle: number;
  /** Absolute grade bound for validation and the motion model. */
  maxTrackGrade: number;
  profile: TrackProfileConfig;
  terrain: TerrainConfig;
  /** Tries per scenery prop before it is left out (doc 04 §6). */
  maxPlacementAttempts: number;
  arcSampleSpacingU: number;
  geometryLookAheadU: number;
  geometryTailMarginU: number;
  spawnChunkIndex: number;
  spawnLocalXU: number;
  /**
   * Catenary of an electric journey (doc 03 §9): pole spacing in one
   * global phase (a divisor of the chunk width) and the contact wire's
   * height above the rail.
   */
  catenaryPoleSpacingU: number;
  catenaryContactHeightU: number;
  /**
   * Second track (doc 04 §7): this far behind the main track, in a share
   * of the biome blocks (always in `forcedSecondaryBiomeBlock`); the
   * oncoming train starts when the player's front is this close before its
   * visible stretch, and its hidden ends are its length plus this margin.
   */
  secondaryTrackOffsetU: number;
  secondaryRailProbability: number;
  forcedSecondaryBiomeBlock: number;
  npcTriggerBeforeFeatureU: number;
  npcHiddenPathMarginU: number;
}

export interface InteractionConfig {
  defaultCooldownSeconds: number;
  hornMinIntervalSeconds: number;
  /** The oncoming train answers the horn at most this often (doc 05 §8). */
  npcHornCooldownSeconds: number;
  /** A horn reaches answering actors this far, u. */
  hornResponseRadiusU: number;
  /** The oncoming train (doc 05 §6): wagons and speed range. */
  npcTrainMaxWagons: number;
  npcTrainMinSpeedUPerSec: number;
  npcTrainMaxSpeedUPerSec: number;
}

export interface SaveConfig {
  schemaVersion: number;
  intervalSeconds: number;
  editDebounceMs: number;
  targetBytes: number;
  maxBytes: number;
  maxRuntimeComponents: number;
}

/** Ride camera framing (doc 14 §2); see `src/render/cameraFraming.ts`. */
export interface CameraConfig {
  /** Share of the screen width the longest allowed train fills. */
  trainWidthFraction: number;
  /** Room behind the last wagon, share of the width. */
  rearMarginFraction: number;
  /** A short train's front stays at least this far right. */
  minFrontFraction: number;
  /** Train middle within the band free of controls (0 top, 1 bottom). */
  bandAnchor: number;
  /** Vertical follow rate, 1/s. */
  verticalFollowPerSec: number;
}

/** Level crossing timings (doc 05 §4, doc 13 `crossing`). */
export interface CrossingConfig {
  /** Longest a road actor may take through the conflict zone. */
  roadClearanceSeconds: number;
  warningSeconds: number;
  closingSeconds: number;
  openingSeconds: number;
  safetySeconds: number;
  distanceMarginU: number;
  maxQueuedCars: number;
  maxQueuedBikes: number;
}

/**
 * Dclose (doc 05 §4): how far ahead of the conflict zone a crossing
 * starts closing, derived from the top speed so a train that sets off at
 * full throttle can never reach an open crossing.
 */
export function crossingCloseDistanceU(
  crossing: CrossingConfig,
  maxSpeedUPerSec: number,
): number {
  return (
    maxSpeedUPerSec *
      (crossing.roadClearanceSeconds +
        crossing.warningSeconds +
        crossing.closingSeconds +
        crossing.safetySeconds) +
    crossing.distanceMarginU
  );
}

/** One render quality profile (doc 13 `quality`). */
export interface QualityProfile {
  /** Upper bound of the render buffer density. */
  maxDpr: number;
  /** Render preference, never the physics rate (doc 13). */
  targetFps: number;
  /** Cap of decorative particles; functional actors do not count. */
  maxDecorativeParticles: number;
}

export interface QualityConfig {
  low: QualityProfile;
  standard: QualityProfile;
}

export interface GameConfig {
  simulation: SimulationConfig;
  save: SaveConfig;
  interaction: InteractionConfig;
  train: TrainConfig;
  world: WorldConfig;
  camera: CameraConfig;
  input: InputConfig;
  quality: QualityConfig;
  crossing: CrossingConfig;
}

export const gameConfig: GameConfig = {
  simulation: { fixedHz: 60, maxCatchUpSteps: 5 },
  save: {
    schemaVersion: 1,
    intervalSeconds: 5,
    editDebounceMs: 250,
    targetBytes: 131072,
    maxBytes: 524288,
    maxRuntimeComponents: 512,
  },
  interaction: {
    defaultCooldownSeconds: 1.5,
    hornMinIntervalSeconds: 0.7,
    npcHornCooldownSeconds: 8,
    hornResponseRadiusU: 800,
    npcTrainMaxWagons: 5,
    npcTrainMinSpeedUPerSec: 100,
    npcTrainMaxSpeedUPerSec: 160,
  },
  train: {
    maxConsistLengthU: 1600,
    maxVehicleLengthU: 220,
    couplerGapU: 8,
    // ≈ 0.22 screen widths per second at the doc 14 §2 scale (doc 14 §6).
    maxSpeedUPerSec: 480,
    accelerationUPerSec2: 160,
    coastDecelerationUPerSec2: 96,
    brakeDecelerationUPerSec2: 480,
    stopEpsilonUPerSec: 0.5,
    uphillSpeedReduction: 0.1,
    gradeAccelerationFactor: 0.25,
    slowModeSpeedFactor: 0.65,
  },
  world: {
    chunkWidthU: 1024,
    chunksPerBiomeBlock: 8,
    blocksPerRouteCycle: 8,
    maxTrackGrade: 0.12,
    profile: {
      blockChunks: 8,
      maxHeightU: 400,
      blockHeightRangeU: 160,
      flatMinU: 384,
      flatMaxU: 1536,
      slopeMinU: 768,
      slopeMaxU: 2304,
      gradeRangeMin: 0.03,
      gradeRangeMax: 0.08,
      transitionU: 192,
      lengthStepU: 64,
    },
    terrain: { latticeU: 512, maxEmbankmentU: 40 },
    maxPlacementAttempts: 8,
    arcSampleSpacingU: 8,
    geometryLookAheadU: 2048,
    geometryTailMarginU: 1024,
    spawnChunkIndex: 0,
    spawnLocalXU: 512,
    catenaryPoleSpacingU: 256,
    catenaryContactHeightU: 160,
    secondaryTrackOffsetU: 64,
    secondaryRailProbability: 1 / 3,
    forcedSecondaryBiomeBlock: 1,
    npcTriggerBeforeFeatureU: 512,
    npcHiddenPathMarginU: 256,
  },
  camera: {
    trainWidthFraction: 0.72,
    rearMarginFraction: 0.06,
    minFrontFraction: 0.35,
    bandAnchor: 0.55,
    verticalFollowPerSec: 3,
  },
  input: {
    maxPointers: 5,
    leftSwipeDistanceCssPx: 64,
    leftSwipeMaxDurationMs: 500,
    leftSwipeHorizontalRatio: 1.5,
    minTargetCssPx: 64,
    primaryControlTargetCssPx: 80,
  },
  quality: {
    low: { maxDpr: 1, targetFps: 30, maxDecorativeParticles: 96 },
    standard: { maxDpr: 1.5, targetFps: 60, maxDecorativeParticles: 240 },
  },
  crossing: {
    roadClearanceSeconds: 2,
    warningSeconds: 1.2,
    closingSeconds: 0.8,
    openingSeconds: 0.8,
    safetySeconds: 0.5,
    distanceMarginU: 80,
    maxQueuedCars: 6,
    maxQueuedBikes: 2,
  },
};

type Check = readonly [path: string, valid: boolean];

const positiveInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;
const positive = (value: number) => Number.isFinite(value) && value > 0;

/** Returns the paths of invalid values; an empty list means valid. */
export function validateGameConfig(config: GameConfig): string[] {
  const { simulation, save, interaction, train, world, camera, input } = config;
  const profile = (name: keyof QualityConfig): Check[] => {
    const q = config.quality[name];
    return [
      [`quality.${name}.maxDpr`, Number.isFinite(q.maxDpr) && q.maxDpr >= 1],
      [`quality.${name}.targetFps`, positiveInteger(q.targetFps)],
      [
        `quality.${name}.maxDecorativeParticles`,
        positiveInteger(q.maxDecorativeParticles),
      ],
    ];
  };
  const fraction = (value: number) =>
    Number.isFinite(value) && value >= 0 && value < 1;
  const checks: Check[] = [
    ['simulation.fixedHz', positiveInteger(simulation.fixedHz)],
    ['simulation.maxCatchUpSteps', positiveInteger(simulation.maxCatchUpSteps)],
    ['save.schemaVersion', save.schemaVersion === 1],
    ['save.intervalSeconds', positive(save.intervalSeconds)],
    ['save.editDebounceMs', positive(save.editDebounceMs)],
    ['save.targetBytes', positiveInteger(save.targetBytes)],
    [
      'save.maxBytes',
      positiveInteger(save.maxBytes) && save.maxBytes >= save.targetBytes,
    ],
    ['save.maxRuntimeComponents', positiveInteger(save.maxRuntimeComponents)],
    [
      'interaction.defaultCooldownSeconds',
      positive(interaction.defaultCooldownSeconds),
    ],
    [
      'interaction.hornMinIntervalSeconds',
      positive(interaction.hornMinIntervalSeconds),
    ],
    [
      'interaction.npcHornCooldownSeconds',
      positive(interaction.npcHornCooldownSeconds),
    ],
    [
      'interaction.hornResponseRadiusU',
      positive(interaction.hornResponseRadiusU),
    ],
    [
      'interaction.npcTrainMaxWagons',
      positiveInteger(interaction.npcTrainMaxWagons),
    ],
    [
      'interaction.npcTrainSpeedUPerSec',
      positive(interaction.npcTrainMinSpeedUPerSec) &&
        interaction.npcTrainMinSpeedUPerSec <=
          interaction.npcTrainMaxSpeedUPerSec,
    ],
    [
      'train.maxConsistLengthU',
      train.maxConsistLengthU >= 2 * train.maxVehicleLengthU,
    ],
    ['train.maxVehicleLengthU', positive(train.maxVehicleLengthU)],
    ['train.couplerGapU', positive(train.couplerGapU)],
    ['train.maxSpeedUPerSec', positive(train.maxSpeedUPerSec)],
    ['train.accelerationUPerSec2', positive(train.accelerationUPerSec2)],
    [
      'train.coastDecelerationUPerSec2',
      positive(train.coastDecelerationUPerSec2),
    ],
    [
      'train.brakeDecelerationUPerSec2',
      train.brakeDecelerationUPerSec2 > train.coastDecelerationUPerSec2,
    ],
    ['train.stopEpsilonUPerSec', positive(train.stopEpsilonUPerSec)],
    ['train.uphillSpeedReduction', fraction(train.uphillSpeedReduction)],
    ['train.gradeAccelerationFactor', fraction(train.gradeAccelerationFactor)],
    [
      'train.slowModeSpeedFactor',
      positive(train.slowModeSpeedFactor) && train.slowModeSpeedFactor <= 1,
    ],
    ['world.chunkWidthU', positive(world.chunkWidthU)],
    ['world.chunksPerBiomeBlock', positiveInteger(world.chunksPerBiomeBlock)],
    [
      'world.blocksPerRouteCycle',
      // One block per biome of the itinerary (doc 04 §5).
      world.blocksPerRouteCycle === 8,
    ],
    [
      'camera.trainWidthFraction',
      // It sets the zoom, so 0 would divide the viewport by zero.
      positive(camera.trainWidthFraction) &&
        camera.trainWidthFraction + camera.rearMarginFraction < 1,
    ],
    ['camera.rearMarginFraction', fraction(camera.rearMarginFraction)],
    ['camera.minFrontFraction', fraction(camera.minFrontFraction)],
    ['camera.bandAnchor', fraction(camera.bandAnchor)],
    ['camera.verticalFollowPerSec', positive(camera.verticalFollowPerSec)],
    ['world.maxTrackGrade', positive(world.maxTrackGrade)],
    ['world.profile.blockChunks', positiveInteger(world.profile.blockChunks)],
    [
      'world.profile.maxHeightU',
      world.profile.maxHeightU > world.profile.blockHeightRangeU,
    ],
    [
      'world.profile.flatMinU',
      world.profile.flatMinU >= world.profile.transitionU &&
        world.profile.flatMaxU >= world.profile.flatMinU,
    ],
    [
      'world.profile.slopeMinU',
      world.profile.slopeMinU >= world.profile.transitionU &&
        world.profile.slopeMaxU >= world.profile.slopeMinU,
    ],
    [
      'world.profile.gradeRangeMax',
      positive(world.profile.gradeRangeMin) &&
        world.profile.gradeRangeMax >= world.profile.gradeRangeMin &&
        world.profile.gradeRangeMax <= world.maxTrackGrade,
    ],
    ['world.profile.transitionU', positive(world.profile.transitionU)],
    ['world.profile.lengthStepU', positive(world.profile.lengthStepU)],
    ['world.terrain.latticeU', positive(world.terrain.latticeU)],
    ['world.maxPlacementAttempts', positiveInteger(world.maxPlacementAttempts)],
    [
      'world.terrain.maxEmbankmentU',
      Number.isFinite(world.terrain.maxEmbankmentU) &&
        world.terrain.maxEmbankmentU >= 0,
    ],
    [
      // A block can always go from one boundary height to the next.
      'world.profile.blockLength',
      world.profile.blockChunks * world.chunkWidthU >=
        world.profile.flatMaxU +
          world.profile.flatMinU +
          world.profile.lengthStepU +
          Math.max(
            world.profile.slopeMinU,
            (2 * world.profile.blockHeightRangeU) / world.profile.gradeRangeMax,
          ),
    ],
    [
      'world.arcSampleSpacingU',
      positive(world.arcSampleSpacingU) && world.arcSampleSpacingU <= 8,
    ],
    ['world.geometryLookAheadU', world.geometryLookAheadU >= 2048],
    ['world.geometryTailMarginU', positive(world.geometryTailMarginU)],
    ['world.spawnChunkIndex', Number.isSafeInteger(world.spawnChunkIndex)],
    [
      'world.spawnLocalXU',
      world.spawnLocalXU >= 0 && world.spawnLocalXU < world.chunkWidthU,
    ],
    [
      'world.catenaryPoleSpacingU',
      positiveInteger(world.catenaryPoleSpacingU) &&
        world.chunkWidthU % world.catenaryPoleSpacingU === 0,
    ],
    ['world.catenaryContactHeightU', positive(world.catenaryContactHeightU)],
    ['world.secondaryTrackOffsetU', positive(world.secondaryTrackOffsetU)],
    [
      'world.secondaryRailProbability',
      Number.isFinite(world.secondaryRailProbability) &&
        world.secondaryRailProbability >= 0 &&
        world.secondaryRailProbability <= 1,
    ],
    [
      'world.forcedSecondaryBiomeBlock',
      Number.isSafeInteger(world.forcedSecondaryBiomeBlock),
    ],
    [
      'world.npcTriggerBeforeFeatureU',
      positive(world.npcTriggerBeforeFeatureU),
    ],
    ['world.npcHiddenPathMarginU', positive(world.npcHiddenPathMarginU)],
    ['input.maxPointers', positiveInteger(input.maxPointers)],
    ['input.leftSwipeDistanceCssPx', positive(input.leftSwipeDistanceCssPx)],
    ['input.leftSwipeMaxDurationMs', positive(input.leftSwipeMaxDurationMs)],
    [
      'input.leftSwipeHorizontalRatio',
      positive(input.leftSwipeHorizontalRatio),
    ],
    ['input.minTargetCssPx', input.minTargetCssPx >= 64],
    [
      'input.primaryControlTargetCssPx',
      input.primaryControlTargetCssPx >= 80 &&
        input.primaryControlTargetCssPx >= input.minTargetCssPx,
    ],
    ...profile('low'),
    ...profile('standard'),
    ...(
      [
        'roadClearanceSeconds',
        'warningSeconds',
        'closingSeconds',
        'openingSeconds',
        'safetySeconds',
        'distanceMarginU',
      ] as const
    ).map((key): Check => [`crossing.${key}`, positive(config.crossing[key])]),
    ['crossing.maxQueuedCars', positiveInteger(config.crossing.maxQueuedCars)],
    [
      'crossing.maxQueuedBikes',
      positiveInteger(config.crossing.maxQueuedBikes),
    ],
  ];
  return checks.filter(([, valid]) => !valid).map(([path]) => path);
}
