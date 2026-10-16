import type { ArtPart, ArtPoint } from '../artManifest.ts';
import type { BoundsU } from '../../domain/world/SceneryGeometry.ts';
export interface FarmForestPart extends ArtPart {
  front?: 'right' | 'left';
  wheels?: readonly { part: string; atU: ArtPoint }[];
  subParts?: readonly {
    part: string;
    atU: ArtPoint;
    rotationRad: number;
    parent?: string;
  }[];
  anchorsU?: Readonly<Record<string, ArtPoint>>;
  pose?: string;
  season?: string;
  tileWidthU?: number;
  /** Conservative whole animation/tool envelope, relative to the body's foot. */
  workBoundsU?: BoundsU;
}
export const parts = {
  'wheel.farm-large': {
    file: 'wheel.farm-large.svg',
    widthU: 24,
    heightU: 24,
    pivotU: {
      x: 12.0,
      y: 12.0,
    },
  },
  'wheel.farm-small': {
    file: 'wheel.farm-small.svg',
    widthU: 16,
    heightU: 16,
    pivotU: {
      x: 8.0,
      y: 8.0,
    },
  },
  'wheel.farm-medium': {
    file: 'wheel.farm-medium.svg',
    widthU: 20,
    heightU: 20,
    pivotU: {
      x: 10.0,
      y: 10.0,
    },
  },
  'wheel.forest': {
    file: 'wheel.forest.svg',
    widthU: 22,
    heightU: 22,
    pivotU: {
      x: 11.0,
      y: 11.0,
    },
  },
  'wheel.log-truck': {
    file: 'wheel.log-truck.svg',
    widthU: 16,
    heightU: 16,
    pivotU: {
      x: 8.0,
      y: 8.0,
    },
  },
  'back.tractor-work': {
    file: 'back.tractor-work.svg',
    widthU: 70,
    heightU: 46,
    pivotU: {
      x: 35.0,
      y: 46,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.farm-large',
        atU: {
          x: 22,
          y: 33,
        },
      },
      {
        part: 'wheel.farm-small',
        atU: {
          x: 54,
          y: 37,
        },
      },
    ],
    anchorsU: {
      rearHitch: {
        x: 4,
        y: 30,
      },
      frontHitch: {
        x: 63,
        y: 32,
      },
    },
    workBoundsU: {
      leftU: -92,
      rightU: 74,
      topU: -46,
      bottomU: 3,
    },
  },
  'back.plough': {
    file: 'back.plough.svg',
    widthU: 44,
    heightU: 24,
    pivotU: {
      x: 22.0,
      y: 24,
    },
    front: 'right',
    anchorsU: {
      hitch: {
        x: 43,
        y: 5,
      },
    },
  },
  'back.baler': {
    file: 'back.baler.svg',
    widthU: 60,
    heightU: 38,
    pivotU: {
      x: 30.0,
      y: 38,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.farm-small',
        atU: {
          x: 23,
          y: 29,
        },
      },
    ],
    anchorsU: {
      hitch: {
        x: 59,
        y: 20,
      },
    },
  },
  'back.snow-blade': {
    file: 'back.snow-blade.svg',
    widthU: 36,
    heightU: 22,
    pivotU: {
      x: 18.0,
      y: 22,
    },
    front: 'right',
    anchorsU: {
      hitch: {
        x: 1,
        y: 12,
      },
    },
  },
  'back.combine': {
    file: 'back.combine.svg',
    widthU: 110,
    heightU: 60,
    pivotU: {
      x: 55.0,
      y: 60,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.farm-medium',
        atU: {
          x: 20,
          y: 49,
        },
      },
      {
        part: 'wheel.farm-large',
        atU: {
          x: 64,
          y: 47,
        },
      },
    ],
    subParts: [
      {
        part: 'back.combine-header',
        atU: {
          x: 92,
          y: 46,
        },
        rotationRad: 0,
      },
    ],
    anchorsU: {
      header: {
        x: 92,
        y: 46,
      },
    },
    workBoundsU: {
      leftU: -55,
      rightU: 62,
      topU: -60,
      bottomU: 0,
    },
  },
  'back.combine-header': {
    file: 'back.combine-header.svg',
    widthU: 36,
    heightU: 22,
    pivotU: {
      x: 18,
      y: 11,
    },
  },
  'back.farmer-work': {
    file: 'back.farmer-work.svg',
    widthU: 16,
    heightU: 36,
    pivotU: {
      x: 8.0,
      y: 36,
    },
    pose: 'work',
  },
  'back.farmer-wave': {
    file: 'back.farmer-wave.svg',
    widthU: 16,
    heightU: 36,
    pivotU: {
      x: 8.0,
      y: 36,
    },
    pose: 'wave',
  },
  'near.water-trough': {
    file: 'near.water-trough.svg',
    widthU: 60,
    heightU: 20,
    pivotU: {
      x: 30.0,
      y: 20,
    },
  },
  'near.crop-rows-spring': {
    file: 'near.crop-rows-spring.svg',
    widthU: 128,
    heightU: 22,
    pivotU: {
      x: 64.0,
      y: 22,
    },
    season: 'spring',
    atlasGroup: {
      seasons: ['spring'],
    },
  },
  'near.crop-rows-summer': {
    file: 'near.crop-rows-summer.svg',
    widthU: 128,
    heightU: 22,
    pivotU: {
      x: 64.0,
      y: 22,
    },
    season: 'summer',
    atlasGroup: {
      seasons: ['summer'],
    },
  },
  'near.stubble': {
    file: 'near.stubble.svg',
    widthU: 100,
    heightU: 18,
    pivotU: {
      x: 50.0,
      y: 18,
    },
    season: 'summer/autumn',
    atlasGroup: {
      seasons: ['summer', 'autumn'],
    },
  },
  'backdrop.forest-dense-far-spring': {
    file: 'backdrop.forest-dense-far-spring.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'spring',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['spring'],
    },
  },
  'backdrop.forest-dense-far-summer': {
    file: 'backdrop.forest-dense-far-summer.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'summer',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['summer'],
    },
  },
  'backdrop.forest-dense-far-autumn': {
    file: 'backdrop.forest-dense-far-autumn.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'autumn',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'backdrop.forest-dense-far-winter': {
    file: 'backdrop.forest-dense-far-winter.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'winter',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'backdrop.forest-dense-mid-spring': {
    file: 'backdrop.forest-dense-mid-spring.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'spring',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['spring'],
    },
  },
  'backdrop.forest-dense-mid-summer': {
    file: 'backdrop.forest-dense-mid-summer.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'summer',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['summer'],
    },
  },
  'backdrop.forest-dense-mid-autumn': {
    file: 'backdrop.forest-dense-mid-autumn.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'autumn',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'backdrop.forest-dense-mid-winter': {
    file: 'backdrop.forest-dense-mid-winter.svg',
    widthU: 512,
    heightU: 160,
    pivotU: {
      x: 0,
      y: 160,
    },
    season: 'winter',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'near.forest-edge-spring': {
    file: 'near.forest-edge-spring.svg',
    widthU: 512,
    heightU: 48,
    pivotU: {
      x: 0,
      y: 48,
    },
    season: 'spring',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['spring'],
    },
  },
  'near.forest-edge-summer': {
    file: 'near.forest-edge-summer.svg',
    widthU: 512,
    heightU: 48,
    pivotU: {
      x: 0,
      y: 48,
    },
    season: 'summer',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['summer'],
    },
  },
  'near.forest-edge-autumn': {
    file: 'near.forest-edge-autumn.svg',
    widthU: 512,
    heightU: 48,
    pivotU: {
      x: 0,
      y: 48,
    },
    season: 'autumn',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'near.forest-edge-winter': {
    file: 'near.forest-edge-winter.svg',
    widthU: 512,
    heightU: 48,
    pivotU: {
      x: 0,
      y: 48,
    },
    season: 'winter',
    tileWidthU: 512,
    atlasGroup: {
      seasons: ['winter'],
    },
  },
  'back.harvester': {
    file: 'back.harvester.svg',
    widthU: 110,
    heightU: 72,
    pivotU: {
      x: 55.0,
      y: 72,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.forest',
        atU: {
          x: 21,
          y: 60,
        },
      },
      {
        part: 'wheel.forest',
        atU: {
          x: 46,
          y: 60,
        },
      },
      {
        part: 'wheel.forest',
        atU: {
          x: 75,
          y: 60,
        },
      },
      {
        part: 'wheel.forest',
        atU: {
          x: 97,
          y: 60,
        },
      },
    ],
    subParts: [
      {
        part: 'back.forest-boom',
        atU: {
          x: 64,
          y: 38,
        },
        rotationRad: -0.85,
      },
      {
        part: 'back.forest-stick',
        atU: {
          x: 30,
          y: 5,
        },
        rotationRad: 1.1,
        parent: 'back.forest-boom',
      },
      {
        part: 'back.harvester-gripper',
        atU: {
          x: 26,
          y: 5,
        },
        rotationRad: -0.25,
        parent: 'back.forest-stick',
      },
    ],
    anchorsU: {
      armJoint: {
        x: 64,
        y: 38,
      },
    },
    workBoundsU: {
      leftU: -55,
      rightU: 115,
      topU: -155,
      bottomU: 4,
    },
  },
  'back.forwarder': {
    file: 'back.forwarder.svg',
    widthU: 120,
    heightU: 60,
    pivotU: {
      x: 60.0,
      y: 60,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.forest',
        atU: {
          x: 19,
          y: 48,
        },
      },
      {
        part: 'wheel.forest',
        atU: {
          x: 43,
          y: 48,
        },
      },
      {
        part: 'wheel.forest',
        atU: {
          x: 80,
          y: 48,
        },
      },
      {
        part: 'wheel.forest',
        atU: {
          x: 106,
          y: 48,
        },
      },
    ],
    subParts: [
      {
        part: 'back.forest-boom',
        atU: {
          x: 73,
          y: 31,
        },
        rotationRad: -2.4,
      },
      {
        part: 'back.forest-stick',
        atU: {
          x: 30,
          y: 5,
        },
        rotationRad: 1.6,
        parent: 'back.forest-boom',
      },
      {
        part: 'back.harvester-gripper',
        atU: {
          x: 26,
          y: 5,
        },
        rotationRad: 0.8,
        parent: 'back.forest-stick',
      },
    ],
    anchorsU: {
      armJoint: {
        x: 73,
        y: 31,
      },
    },
    workBoundsU: {
      leftU: -115,
      rightU: 115,
      topU: -155,
      bottomU: 4,
    },
  },
  'back.forest-boom': {
    file: 'back.forest-boom.svg',
    widthU: 34,
    heightU: 14,
    pivotU: {
      x: 4,
      y: 8,
    },
    endU: {
      x: 30,
      y: 5,
    },
  },
  'back.forest-stick': {
    file: 'back.forest-stick.svg',
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
  'back.harvester-gripper': {
    file: 'back.harvester-gripper.svg',
    widthU: 16,
    heightU: 22,
    pivotU: {
      x: 8,
      y: 2,
    },
    anchorsU: {
      grip: {
        x: 8,
        y: 13,
      },
    },
    pose: 'closed',
  },
  'back.harvester-gripper-open': {
    file: 'back.harvester-gripper-open.svg',
    widthU: 16,
    heightU: 22,
    pivotU: {
      x: 8,
      y: 2,
    },
    anchorsU: {
      grip: {
        x: 8,
        y: 13,
      },
    },
    pose: 'open',
  },
  'back.work-trunk': {
    file: 'back.work-trunk.svg',
    widthU: 24,
    heightU: 100,
    pivotU: {
      x: 12.0,
      y: 100,
    },
    anchorsU: {
      grip: {
        x: 12,
        y: 62,
      },
      base: {
        x: 12,
        y: 98,
      },
    },
  },
  'back.log-truck': {
    file: 'back.log-truck.svg',
    widthU: 110,
    heightU: 48,
    pivotU: {
      x: 55.0,
      y: 48,
    },
    front: 'right',
    wheels: [
      {
        part: 'wheel.log-truck',
        atU: {
          x: 20,
          y: 39,
        },
      },
      {
        part: 'wheel.log-truck',
        atU: {
          x: 43,
          y: 39,
        },
      },
      {
        part: 'wheel.log-truck',
        atU: {
          x: 90,
          y: 39,
        },
      },
    ],
  },
  'back.footbridge': {
    file: 'back.footbridge.svg',
    widthU: 100,
    heightU: 35,
    pivotU: {
      x: 50.0,
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
  'back.feeding-rack': {
    file: 'back.feeding-rack.svg',
    widthU: 60,
    heightU: 50,
    pivotU: {
      x: 30.0,
      y: 50,
    },
  },
  'animal.woodpecker': {
    file: 'animal.woodpecker.svg',
    widthU: 18,
    heightU: 24,
    pivotU: {
      x: 9.0,
      y: 24,
    },
    front: 'right',
    anchorsU: {
      feet: {
        x: 14,
        y: 21,
      },
      beak: {
        x: 18,
        y: 7,
      },
    },
  },
  'animal.owl': {
    file: 'animal.owl.svg',
    widthU: 24,
    heightU: 28,
    pivotU: {
      x: 12.0,
      y: 28,
    },
  },
} as const satisfies Record<string, FarmForestPart>;
// Compound children and parallax bands are used by the lane's renderers.
export const usedKeys: readonly string[] = Object.keys(parts);
export const farmForestParts: Readonly<Record<string, FarmForestPart>> = parts;
