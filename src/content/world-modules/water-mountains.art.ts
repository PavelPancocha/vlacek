import type { ArtPart, ArtPoint } from '../artManifest.ts';
import type { Season } from '../../domain/world/Regions.ts';
export interface WaterMountainPart extends ArtPart {
  workBoundsU?: {
    leftU: number;
    rightU: number;
    topU: number;
    bottomU: number;
  };
  anchorsU?: Readonly<Record<string, ArtPoint>>;
  tileU?: { x: number };
  front?: 'left' | 'right';
  endU?: ArtPoint;
  wheels?: readonly { part: string; atU: ArtPoint }[];
  subParts?: readonly {
    part: string;
    atU: ArtPoint;
    rotationRad: number;
    parent?: string;
  }[];
  atlasGroup?: { seasons: readonly Season[] };
}
export const parts = {
  'tree.sahara-pine-a': {
    file: 'tree.sahara-pine-a.svg',
    widthU: 60,
    heightU: 120,
    pivotU: { x: 30, y: 120 },
    atlasGroup: { seasons: ['summer'] },
  },
  'tree.sahara-pine-b': {
    file: 'tree.sahara-pine-b.svg',
    widthU: 60,
    heightU: 120,
    pivotU: { x: 30, y: 120 },
    atlasGroup: { seasons: ['summer'] },
  },
  'near.fisherman': {
    workBoundsU: { leftU: -14, rightU: 48, topU: -50, bottomU: 0 },
    file: 'near.fisherman.svg',
    widthU: 28,
    heightU: 30,
    pivotU: {
      x: 14,
      y: 30,
    },
    anchorsU: {
      rod: {
        x: 20,
        y: 16,
      },
    },
  },
  'near.fishing-rod': {
    file: 'near.fishing-rod.svg',
    widthU: 40,
    heightU: 32,
    pivotU: {
      x: 1,
      y: 31,
    },
  },
  'back.ferry': {
    file: 'back.ferry.svg',
    widthU: 90,
    heightU: 35,
    pivotU: {
      x: 45,
      y: 32,
    },
    anchorsU: {
      bow: {
        x: 86,
        y: 24,
      },
      stern: {
        x: 5,
        y: 24,
      },
      waterline: {
        x: 45,
        y: 32,
      },
      arm: {
        x: 57,
        y: 13,
      },
    },
  },
  'back.ferryman-arm': {
    file: 'back.ferryman-arm.svg',
    widthU: 10,
    heightU: 12,
    pivotU: {
      x: 2,
      y: 10,
    },
  },
  'back.fishpond-sluice': {
    file: 'back.fishpond-sluice.svg',
    widthU: 100,
    heightU: 35,
    pivotU: {
      x: 50,
      y: 35,
    },
    anchorsU: {
      channel: {
        x: 50,
        y: 35,
      },
      bankLeft: {
        x: 0,
        y: 20,
      },
      bankRight: {
        x: 100,
        y: 20,
      },
    },
  },
  'near.reed-clump': {
    file: 'near.reed-clump.svg',
    widthU: 100,
    heightU: 45,
    pivotU: {
      x: 50,
      y: 45,
    },
  },
  'near.reed-clump-autumn': {
    file: 'near.reed-clump-autumn.svg',
    widthU: 100,
    heightU: 45,
    pivotU: {
      x: 50,
      y: 45,
    },
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'back.coast-rock': {
    file: 'back.coast-rock.svg',
    widthU: 180,
    heightU: 110,
    pivotU: {
      x: 90,
      y: 110,
    },
  },
  'near.coast-rock': {
    file: 'near.coast-rock.svg',
    widthU: 120,
    heightU: 38,
    pivotU: {
      x: 60,
      y: 38,
    },
  },
  'back.harbour-pier': {
    file: 'back.harbour-pier.svg',
    widthU: 128,
    heightU: 36,
    pivotU: {
      x: 0,
      y: 15,
    },
    anchorsU: {
      shore: {
        x: 0,
        y: 15,
      },
      mooring: {
        x: 112,
        y: 9,
      },
      joinRight: {
        x: 128,
        y: 15,
      },
    },
  },
  'back.harbour-quay': {
    file: 'back.harbour-quay.svg',
    widthU: 128,
    heightU: 40,
    pivotU: {
      x: 64,
      y: 11,
    },
    anchorsU: {
      shoreLeft: {
        x: 0,
        y: 11,
      },
      shoreRight: {
        x: 128,
        y: 11,
      },
      waterFoot: {
        x: 64,
        y: 40,
      },
    },
  },
  'backdrop.dunes-ridge': {
    file: 'backdrop.dunes-ridge.svg',
    widthU: 512,
    heightU: 100,
    pivotU: {
      x: 0,
      y: 100,
    },
    tileU: {
      x: 512,
    },
  },
  'backdrop.dunes-pines': {
    file: 'backdrop.dunes-pines.svg',
    widthU: 512,
    heightU: 150,
    pivotU: {
      x: 0,
      y: 150,
    },
    tileU: {
      x: 512,
    },
  },
  'near.young-pine': {
    file: 'near.young-pine.svg',
    widthU: 40,
    heightU: 44,
    pivotU: {
      x: 20,
      y: 44,
    },
  },
  'near.heather': {
    file: 'near.heather.svg',
    widthU: 80,
    heightU: 24,
    pivotU: {
      x: 40,
      y: 24,
    },
  },
  'near.heather-green': {
    file: 'near.heather-green.svg',
    widthU: 80,
    heightU: 24,
    pivotU: {
      x: 40,
      y: 24,
    },
  },
  'backdrop.mountains-ridges': {
    file: 'backdrop.mountains-ridges.svg',
    widthU: 1024,
    heightU: 320,
    pivotU: {
      x: 0,
      y: 320,
    },
    tileU: {
      x: 1024,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'backdrop.mountains-slope': {
    file: 'backdrop.mountains-slope.svg',
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    tileU: {
      x: 1024,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'backdrop.mountains-ridges-snow': {
    file: 'backdrop.mountains-ridges-snow.svg',
    widthU: 1024,
    heightU: 320,
    pivotU: {
      x: 0,
      y: 320,
    },
    tileU: {
      x: 1024,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'backdrop.mountains-slope-snow': {
    file: 'backdrop.mountains-slope-snow.svg',
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    tileU: {
      x: 1024,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.cutting-rock': {
    file: 'back.cutting-rock.svg',
    widthU: 160,
    heightU: 100,
    pivotU: {
      x: 80,
      y: 100,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'back.cutting-rock-snow': {
    file: 'back.cutting-rock-snow.svg',
    widthU: 160,
    heightU: 100,
    pivotU: {
      x: 80,
      y: 100,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.cableway-tower': {
    workBoundsU: { leftU: -70, rightU: 400, topU: -200, bottomU: 50 },
    file: 'back.cableway-tower.svg',
    widthU: 20,
    heightU: 80,
    pivotU: {
      x: 10,
      y: 80,
    },
    anchorsU: {
      cable: {
        x: 10,
        y: 5,
      },
    },
  },
  'back.cableway-cabin': {
    file: 'back.cableway-cabin.svg',
    widthU: 56,
    heightU: 48,
    pivotU: {
      x: 28,
      y: 2,
    },
    anchorsU: {
      cable: {
        x: 28,
        y: 2,
      },
    },
  },
  'back.cableway-station': {
    file: 'back.cableway-station.svg',
    widthU: 70,
    heightU: 45,
    pivotU: {
      x: 35,
      y: 45,
    },
    anchorsU: {
      cable: {
        x: 24,
        y: 27,
      },
    },
  },
  'back.quarry-wall': {
    file: 'back.quarry-wall.svg',
    widthU: 512,
    heightU: 180,
    pivotU: {
      x: 256,
      y: 180,
    },
    atlasGroup: {
      seasons: ['spring', 'summer', 'autumn'],
    },
  },
  'back.quarry-wall-snow': {
    file: 'back.quarry-wall-snow.svg',
    widthU: 512,
    heightU: 180,
    pivotU: {
      x: 256,
      y: 180,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.excavator': {
    workBoundsU: { leftU: -50, rightU: 80, topU: -95, bottomU: 0 },
    file: 'back.excavator.svg',
    widthU: 100,
    heightU: 70,
    pivotU: {
      x: 50,
      y: 70,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.excavator',
        atU: {
          x: 22,
          y: 60,
        },
      },
      {
        part: 'wheel.excavator',
        atU: {
          x: 66,
          y: 60,
        },
      },
    ],
    subParts: [
      {
        part: 'back.excavator-boom',
        atU: {
          x: 48,
          y: 38,
        },
        rotationRad: -0.85,
      },
      {
        part: 'back.excavator-stick',
        atU: {
          x: 33,
          y: 7,
        },
        rotationRad: 1.65,
        parent: 'back.excavator-boom',
      },
      {
        part: 'back.excavator-bucket',
        atU: {
          x: 26,
          y: 5,
        },
        rotationRad: -0.8,
        parent: 'back.excavator-stick',
      },
    ],
    anchorsU: {
      armJoint: {
        x: 48,
        y: 38,
      },
    },
  },
  'back.excavator-boom': {
    file: 'back.excavator-boom.svg',
    widthU: 38,
    heightU: 16,
    pivotU: {
      x: 4,
      y: 10,
    },
    endU: {
      x: 33,
      y: 7,
    },
  },
  'back.excavator-stick': {
    file: 'back.excavator-stick.svg',
    widthU: 30,
    heightU: 12,
    pivotU: {
      x: 4,
      y: 5,
    },
    endU: {
      x: 26,
      y: 5,
    },
  },
  'back.excavator-bucket': {
    file: 'back.excavator-bucket.svg',
    widthU: 22,
    heightU: 18,
    pivotU: {
      x: 5,
      y: 3,
    },
  },
  'wheel.excavator': {
    file: 'wheel.excavator.svg',
    widthU: 18,
    heightU: 18,
    pivotU: {
      x: 9,
      y: 9,
    },
  },
  'back.water-footbridge': {
    file: 'back.footbridge.svg',
    widthU: 100,
    heightU: 35,
    pivotU: {
      x: 50,
      y: 35,
    },
    anchorsU: {
      leftBank: {
        x: 8,
        y: 34,
      },
      rightBank: {
        x: 92,
        y: 34,
      },
    },
  },
} as const satisfies Record<string, WaterMountainPart>;
export const waterMountainParts: Readonly<Record<string, WaterMountainPart>> =
  parts;
// Compound children and the two parallax layers are used by WaterMountainView/Backdrop.
export const usedKeys: readonly string[] = Object.keys(parts);
