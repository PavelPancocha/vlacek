import type { ArtPart } from '../artManifest.ts';
export const parts = {
  'life.dispatcher-wave': {
    file: 'life.dispatcher-wave.svg',
    widthU: 16,
    heightU: 40,
    pivotU: {
      x: 8,
      y: 40,
    },
  },
  'life.dispatcher-arm': {
    file: 'life.dispatcher-arm.svg',
    widthU: 9,
    heightU: 19,
    pivotU: {
      x: 3,
      y: 3,
    },
  },
  'life.station-flag-a': {
    file: 'life.station-flag-a.svg',
    widthU: 20,
    heightU: 16,
    pivotU: {
      x: 2,
      y: 15,
    },
  },
  'life.station-flag-b': {
    file: 'life.station-flag-b.svg',
    widthU: 20,
    heightU: 16,
    pivotU: {
      x: 2,
      y: 15,
    },
  },
  'life.watermill-body': {
    file: 'life.watermill-body.svg',
    widthU: 130,
    heightU: 100,
    pivotU: {
      x: 65,
      y: 100,
    },
  },
  'life.watermill-wheel': {
    file: 'life.watermill-wheel.svg',
    widthU: 52,
    heightU: 52,
    pivotU: {
      x: 26,
      y: 26,
    },
  },
  'back.sled-child': {
    file: 'back.sled-child.svg',
    widthU: 32,
    heightU: 24,
    pivotU: {
      x: 16,
      y: 24,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
} as const satisfies Record<string, ArtPart>;
export const usedKeys = Object.keys(parts);
