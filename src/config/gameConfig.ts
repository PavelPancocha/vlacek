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

export interface GameConfig {
  input: InputConfig;
}

export const gameConfig: GameConfig = {
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
  const { input } = config;
  const checks: Check[] = [
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
