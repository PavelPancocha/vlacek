import type { ArtPart } from '../artManifest.ts';
export const parts = {
  'backdrop.town-sparse-autumn': {
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    file: 'backdrop.town-sparse-autumn.svg',
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'backdrop.town-sparse-winter': {
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    file: 'backdrop.town-sparse-winter.svg',
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'backdrop.town-dense-autumn': {
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    file: 'backdrop.town-dense-autumn.svg',
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'backdrop.town-dense-winter': {
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    file: 'backdrop.town-dense-winter.svg',
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'near.bush-winter': {
    file: 'near.bush-winter.svg',
    widthU: 64,
    heightU: 42,
    pivotU: {
      x: 32,
      y: 42,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'near.bush-autumn': {
    file: 'near.bush-autumn.svg',
    widthU: 64,
    heightU: 42,
    pivotU: {
      x: 32,
      y: 42,
    },
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'back.house-a-winter': {
    file: 'back.house-a-winter.svg',
    widthU: 96,
    heightU: 96,
    pivotU: {
      x: 48,
      y: 96,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.house-b-winter': {
    file: 'back.house-b-winter.svg',
    widthU: 90,
    heightU: 92,
    pivotU: {
      x: 45,
      y: 92,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.house-c-winter': {
    file: 'back.house-c-winter.svg',
    widthU: 120,
    heightU: 104,
    pivotU: {
      x: 60,
      y: 104,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.lodge-winter': {
    file: 'back.lodge-winter.svg',
    widthU: 120,
    heightU: 90,
    pivotU: {
      x: 60,
      y: 90,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.logs-winter': {
    file: 'back.logs-winter.svg',
    widthU: 60,
    heightU: 22,
    pivotU: {
      x: 30,
      y: 22,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
} as const satisfies Record<string, ArtPart>;
export const usedKeys = Object.keys(parts);
