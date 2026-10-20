import type { ArtPart } from '../artManifest.ts';
export const parts = {
  'bridge.steel-span': {
    file: 'bridge.steel-span.svg',
    widthU: 256,
    heightU: 90,
    pivotU: {
      x: 128,
      y: 2,
    },
  },
  'bridge.abutment': {
    file: 'bridge.abutment.svg',
    widthU: 50,
    heightU: 100,
    pivotU: {
      x: 25,
      y: 2,
    },
  },
  'bridge.viaduct-arch': {
    file: 'bridge.viaduct-arch.svg',
    widthU: 160,
    heightU: 160,
    pivotU: {
      x: 80,
      y: 2,
    },
  },
  'bridge.viaduct-pier': {
    file: 'bridge.viaduct-pier.svg',
    widthU: 40,
    heightU: 160,
    pivotU: {
      x: 20,
      y: 0,
    },
  },
  'bridge.railing-long': {
    file: 'bridge.railing-long.svg',
    widthU: 256,
    heightU: 20,
    pivotU: {
      x: 128,
      y: 19,
    },
  },
  'bridge.catenary-console': {
    file: 'bridge.catenary-console.svg',
    widthU: 36,
    heightU: 170,
    pivotU: {
      x: 8,
      y: 170,
    },
  },
  'tunnel.contact': {
    file: 'tunnel.contact.svg',
    widthU: 128,
    heightU: 12,
    pivotU: {
      x: 64,
      y: 11,
    },
  },
  'tunnel.rock-portal-front': {
    file: 'tunnel.rock-portal-front.svg',
    widthU: 180,
    heightU: 240,
    pivotU: {
      x: 90,
      y: 236,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'tunnel.rock-portal-mouth': {
    file: 'tunnel.rock-portal-mouth.svg',
    widthU: 90,
    heightU: 190,
    pivotU: {
      x: 90,
      y: 186,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'tunnel.rock-portal-front-snow': {
    file: 'tunnel.rock-portal-front-snow.svg',
    widthU: 180,
    heightU: 240,
    pivotU: {
      x: 90,
      y: 236,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'tunnel.rock-portal-mouth-snow': {
    file: 'tunnel.rock-portal-mouth-snow.svg',
    widthU: 90,
    heightU: 190,
    pivotU: {
      x: 90,
      y: 186,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'tunnel.rock-cover': {
    file: 'tunnel.rock-cover.svg',
    widthU: 256,
    heightU: 290,
    pivotU: {
      x: 128,
      y: 290,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'tunnel.rock-cap': {
    file: 'tunnel.rock-cap.svg',
    widthU: 256,
    heightU: 76,
    pivotU: {
      x: 128,
      y: 76,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'tunnel.rock-cover-snow': {
    file: 'tunnel.rock-cover-snow.svg',
    widthU: 256,
    heightU: 290,
    pivotU: {
      x: 128,
      y: 290,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'tunnel.rock-cap-snow': {
    file: 'tunnel.rock-cap-snow.svg',
    widthU: 256,
    heightU: 76,
    pivotU: {
      x: 128,
      y: 76,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'bridge.snow-cap': {
    file: 'bridge.snow-cap.svg',
    widthU: 256,
    heightU: 8,
    pivotU: {
      x: 128,
      y: 2,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
} as const satisfies Record<string, ArtPart>;
export const usedKeys = Object.keys(parts);
