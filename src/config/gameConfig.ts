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
  maxWagons: number;
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

export interface WorldConfig {
  chunkWidthU: number;
  maxTrackGrade: number;
  boundaryHeightScale: number;
  arcSampleSpacingU: number;
  geometryLookAheadU: number;
  geometryTailMarginU: number;
  spawnChunkIndex: number;
  spawnLocalXU: number;
}

export interface GameConfig {
  simulation: SimulationConfig;
  train: TrainConfig;
  world: WorldConfig;
  input: InputConfig;
}

export const gameConfig: GameConfig = {
  simulation: { fixedHz: 60, maxCatchUpSteps: 5 },
  train: {
    maxWagons: 100,
    maxVehicleLengthU: 220,
    couplerGapU: 8,
    maxSpeedUPerSec: 180,
    accelerationUPerSec2: 65,
    coastDecelerationUPerSec2: 30,
    brakeDecelerationUPerSec2: 180,
    stopEpsilonUPerSec: 0.5,
    uphillSpeedReduction: 0.1,
    gradeAccelerationFactor: 0.25,
    slowModeSpeedFactor: 0.65,
  },
  world: {
    chunkWidthU: 1024,
    maxTrackGrade: 0.12,
    boundaryHeightScale: 8,
    arcSampleSpacingU: 8,
    geometryLookAheadU: 2048,
    geometryTailMarginU: 1024,
    spawnChunkIndex: 0,
    spawnLocalXU: 512,
  },
  input: {
    maxPointers: 5,
    leftSwipeDistanceCssPx: 64,
    leftSwipeMaxDurationMs: 500,
    leftSwipeHorizontalRatio: 1.5,
    minTargetCssPx: 64,
    primaryControlTargetCssPx: 80,
  },
};

type Check = readonly [path: string, valid: boolean];

const positiveInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;
const positive = (value: number) => Number.isFinite(value) && value > 0;

/** Returns the paths of invalid values; an empty list means valid. */
export function validateGameConfig(config: GameConfig): string[] {
  const { simulation, train, world, input } = config;
  const fraction = (value: number) =>
    Number.isFinite(value) && value >= 0 && value < 1;
  const checks: Check[] = [
    ['simulation.fixedHz', positiveInteger(simulation.fixedHz)],
    ['simulation.maxCatchUpSteps', positiveInteger(simulation.maxCatchUpSteps)],
    ['train.maxWagons', positiveInteger(train.maxWagons)],
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
    ['world.maxTrackGrade', positive(world.maxTrackGrade)],
    ['world.boundaryHeightScale', positive(world.boundaryHeightScale)],
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
  ];
  return checks.filter(([, valid]) => !valid).map(([path]) => path);
}
