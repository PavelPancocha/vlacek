import type { ArtPart } from '../artManifest.ts';
const sourceParts = {
  'back.platform-short': {
    file: 'back.platform-short.svg',
    widthU: 36,
    heightU: 24,
    pivotU: { x: 18, y: 24 },
    tileStepU: 32,
    seamBleedU: 2,
  },
  'back.house-gable': {
    file: 'back.house-gable.svg',
    widthU: 120,
    heightU: 104,
    pivotU: {
      x: 60,
      y: 104,
    },
    roofOutlinesU: [
      [
        {
          x: 4,
          y: 42,
        },
        {
          x: 43,
          y: 8,
        },
        {
          x: 95,
          y: 19,
        },
        {
          x: 111,
          y: 42,
        },
      ],
    ],
    chimneyU: {
      x: 90,
      y: 7,
    },
  },
  'back.house-hip': {
    file: 'back.house-hip.svg',
    widthU: 108,
    heightU: 90,
    pivotU: {
      x: 54,
      y: 90,
    },
    roofOutlinesU: [
      [
        {
          x: 4,
          y: 39,
        },
        {
          x: 25,
          y: 9,
        },
        {
          x: 81,
          y: 9,
        },
        {
          x: 104,
          y: 39,
        },
      ],
    ],
    chimneyU: {
      x: 67,
      y: 2,
    },
  },
  'back.barn-timber': {
    file: 'back.barn-timber.svg',
    widthU: 150,
    heightU: 112,
    pivotU: {
      x: 75,
      y: 112,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 46,
        },
        {
          x: 73,
          y: 7,
        },
        {
          x: 147,
          y: 46,
        },
      ],
    ],
  },
  'back.farmstead': {
    file: 'back.farmstead.svg',
    widthU: 180,
    heightU: 112,
    pivotU: {
      x: 90,
      y: 112,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 48,
        },
        {
          x: 14,
          y: 23,
        },
        {
          x: 91,
          y: 23,
        },
        {
          x: 103,
          y: 48,
        },
      ],
      [
        {
          x: 90,
          y: 40,
        },
        {
          x: 132,
          y: 9,
        },
        {
          x: 176,
          y: 40,
        },
      ],
    ],
    chimneyU: {
      x: 150,
      y: 4,
    },
  },
  'back.chapel': {
    file: 'back.chapel.svg',
    widthU: 70,
    heightU: 100,
    pivotU: {
      x: 35,
      y: 100,
    },
    roofOutlinesU: [
      [
        {
          x: 10,
          y: 60,
        },
        {
          x: 41,
          y: 31,
        },
        {
          x: 67,
          y: 60,
        },
      ],
      [
        {
          x: 14,
          y: 29,
        },
        {
          x: 24,
          y: 5,
        },
        {
          x: 35,
          y: 29,
        },
      ],
    ],
  },
  'back.bus-shelter': {
    file: 'back.bus-shelter.svg',
    widthU: 60,
    heightU: 45,
    pivotU: {
      x: 30,
      y: 45,
    },
    roofOutlinesU: [
      [
        {
          x: 2,
          y: 11,
        },
        {
          x: 8,
          y: 4,
        },
        {
          x: 54,
          y: 4,
        },
        {
          x: 59,
          y: 11,
        },
      ],
    ],
  },
  'back.bus': {
    file: 'back.bus.svg',
    widthU: 100,
    heightU: 40,
    pivotU: {
      x: 50,
      y: 40,
    },
    attachmentsU: [
      {
        part: 'back.bus-wheel',
        atU: {
          x: 19,
          y: 33,
        },
      },
      {
        part: 'back.bus-wheel',
        atU: {
          x: 83,
          y: 33,
        },
      },
    ],
  },
  'back.bus-wheel': {
    file: 'back.bus-wheel.svg',
    widthU: 14,
    heightU: 14,
    pivotU: {
      x: 7,
      y: 7,
    },
  },
  'back.playground': {
    file: 'back.playground.svg',
    widthU: 140,
    heightU: 70,
    pivotU: {
      x: 70,
      y: 70,
    },
    roofOutlinesU: [
      [
        {
          x: 100,
          y: 28,
        },
        {
          x: 111,
          y: 17,
        },
        {
          x: 124,
          y: 28,
        },
      ],
    ],
    attachmentsU: [
      {
        part: 'back.playground-swing',
        atU: {
          x: 51,
          y: 17,
        },
      },
    ],
  },
  'back.playground-swing': {
    file: 'back.playground-swing.svg',
    widthU: 34,
    heightU: 38,
    pivotU: {
      x: 17,
      y: 2,
    },
  },
  'back.row-house': {
    file: 'back.row-house.svg',
    widthU: 120,
    heightU: 100,
    pivotU: {
      x: 60,
      y: 100,
    },
    roofOutlinesU: [
      [
        {
          x: 2,
          y: 29,
        },
        {
          x: 14,
          y: 9,
        },
        {
          x: 105,
          y: 9,
        },
        {
          x: 118,
          y: 29,
        },
      ],
    ],
  },
  'back.apartment-house': {
    file: 'back.apartment-house.svg',
    widthU: 180,
    heightU: 150,
    pivotU: {
      x: 90,
      y: 150,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 31,
        },
        {
          x: 18,
          y: 9,
        },
        {
          x: 161,
          y: 9,
        },
        {
          x: 177,
          y: 31,
        },
      ],
    ],
  },
  'back.panel-house': {
    file: 'back.panel-house.svg',
    widthU: 220,
    heightU: 180,
    pivotU: {
      x: 110,
      y: 180,
    },
    roofOutlinesU: [
      [
        {
          x: 5,
          y: 10,
        },
        {
          x: 215,
          y: 10,
        },
        {
          x: 215,
          y: 15,
        },
        {
          x: 5,
          y: 15,
        },
      ],
    ],
  },
  'back.warehouse': {
    file: 'back.warehouse.svg',
    widthU: 180,
    heightU: 90,
    pivotU: {
      x: 90,
      y: 90,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 34,
        },
        {
          x: 90,
          y: 8,
        },
        {
          x: 177,
          y: 34,
        },
      ],
    ],
  },
  'back.sawmill': {
    file: 'back.sawmill.svg',
    widthU: 180,
    heightU: 90,
    pivotU: {
      x: 90,
      y: 90,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 34,
        },
        {
          x: 90,
          y: 8,
        },
        {
          x: 177,
          y: 34,
        },
      ],
    ],
  },
  'backdrop.town-sparse': {
    file: 'backdrop.town-sparse.svg',
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    roofOutlinesU: [
      [
        {
          x: 51,
          y: 111,
        },
        {
          x: 69.95,
          y: 97,
        },
        {
          x: 105.05000000000001,
          y: 97,
        },
        {
          x: 124,
          y: 111,
        },
      ],
      [
        {
          x: 166,
          y: 89,
        },
        {
          x: 189.55,
          y: 75,
        },
        {
          x: 235.45,
          y: 75,
        },
        {
          x: 259,
          y: 89,
        },
      ],
      [
        {
          x: 326,
          y: 99,
        },
        {
          x: 347.02,
          y: 85,
        },
        {
          x: 386.98,
          y: 85,
        },
        {
          x: 408,
          y: 99,
        },
      ],
      [
        {
          x: 501,
          y: 79,
        },
        {
          x: 528.92,
          y: 65,
        },
        {
          x: 585.08,
          y: 65,
        },
        {
          x: 613,
          y: 79,
        },
      ],
      [
        {
          x: 699,
          y: 107,
        },
        {
          x: 720.48,
          y: 93,
        },
        {
          x: 761.52,
          y: 93,
        },
        {
          x: 783,
          y: 107,
        },
      ],
      [
        {
          x: 868,
          y: 87,
        },
        {
          x: 894.08,
          y: 73,
        },
        {
          x: 945.92,
          y: 73,
        },
        {
          x: 972,
          y: 87,
        },
      ],
    ],
    parallax: 0.25,
  },
  'backdrop.town-dense': {
    file: 'backdrop.town-dense.svg',
    widthU: 1024,
    heightU: 180,
    pivotU: {
      x: 0,
      y: 180,
    },
    roofOutlinesU: [
      [
        {
          x: 51,
          y: 111,
        },
        {
          x: 69.95,
          y: 97,
        },
        {
          x: 105.05000000000001,
          y: 97,
        },
        {
          x: 124,
          y: 111,
        },
      ],
      [
        {
          x: 166,
          y: 89,
        },
        {
          x: 189.55,
          y: 75,
        },
        {
          x: 235.45,
          y: 75,
        },
        {
          x: 259,
          y: 89,
        },
      ],
      [
        {
          x: 326,
          y: 99,
        },
        {
          x: 347.02,
          y: 85,
        },
        {
          x: 386.98,
          y: 85,
        },
        {
          x: 408,
          y: 99,
        },
      ],
      [
        {
          x: 501,
          y: 79,
        },
        {
          x: 528.92,
          y: 65,
        },
        {
          x: 585.08,
          y: 65,
        },
        {
          x: 613,
          y: 79,
        },
      ],
      [
        {
          x: 699,
          y: 107,
        },
        {
          x: 720.48,
          y: 93,
        },
        {
          x: 761.52,
          y: 93,
        },
        {
          x: 783,
          y: 107,
        },
      ],
      [
        {
          x: 868,
          y: 87,
        },
        {
          x: 894.08,
          y: 73,
        },
        {
          x: 945.92,
          y: 73,
        },
        {
          x: 972,
          y: 87,
        },
      ],
      [
        {
          x: 252,
          y: 114,
        },
        {
          x: 272.1,
          y: 100,
        },
        {
          x: 309.9,
          y: 100,
        },
        {
          x: 330,
          y: 114,
        },
      ],
      [
        {
          x: 406,
          y: 88,
        },
        {
          x: 430.93,
          y: 74,
        },
        {
          x: 480.07,
          y: 74,
        },
        {
          x: 505,
          y: 88,
        },
      ],
      [
        {
          x: 786,
          y: 105,
        },
        {
          x: 808.17,
          y: 91,
        },
        {
          x: 850.83,
          y: 91,
        },
        {
          x: 873,
          y: 105,
        },
      ],
      [
        {
          x: 5,
          y: 119,
        },
        {
          x: 17.740000000000002,
          y: 105,
        },
        {
          x: 38.260000000000005,
          y: 105,
        },
        {
          x: 51,
          y: 119,
        },
      ],
      [
        {
          x: 111,
          y: 80,
        },
        {
          x: 127.88,
          y: 66,
        },
        {
          x: 158.12,
          y: 66,
        },
        {
          x: 175,
          y: 80,
        },
      ],
      [
        {
          x: 609,
          y: 102,
        },
        {
          x: 632.09,
          y: 88,
        },
        {
          x: 676.91,
          y: 88,
        },
        {
          x: 700,
          y: 102,
        },
      ],
      [
        {
          x: 968,
          y: 117,
        },
        {
          x: 980.28,
          y: 103,
        },
        {
          x: 999.72,
          y: 103,
        },
        {
          x: 1012,
          y: 117,
        },
      ],
    ],
    parallax: 0.55,
  },
  'back.station-medium': {
    file: 'back.station-medium.svg',
    widthU: 200,
    heightU: 118,
    pivotU: {
      x: 100,
      y: 118,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 44,
        },
        {
          x: 16,
          y: 18,
        },
        {
          x: 184,
          y: 18,
        },
        {
          x: 197,
          y: 44,
        },
      ],
      [
        {
          x: 68,
          y: 40,
        },
        {
          x: 100,
          y: 9,
        },
        {
          x: 132,
          y: 40,
        },
      ],
      [
        {
          x: 55,
          y: 87,
        },
        {
          x: 141,
          y: 87,
        },
        {
          x: 137,
          y: 92,
        },
        {
          x: 55,
          y: 92,
        },
      ],
    ],
    chimneyU: {
      x: 159.5,
      y: 9,
    },
  },
  'back.station-big': {
    file: 'back.station-big.svg',
    widthU: 320,
    heightU: 146,
    pivotU: {
      x: 160,
      y: 146,
    },
    roofOutlinesU: [
      [
        {
          x: 3,
          y: 55,
        },
        {
          x: 16,
          y: 29,
        },
        {
          x: 304,
          y: 29,
        },
        {
          x: 317,
          y: 55,
        },
      ],
      [
        {
          x: 110,
          y: 51,
        },
        {
          x: 160,
          y: 9,
        },
        {
          x: 210,
          y: 51,
        },
      ],
      [
        {
          x: 97,
          y: 98,
        },
        {
          x: 219,
          y: 98,
        },
        {
          x: 215,
          y: 103,
        },
        {
          x: 97,
          y: 103,
        },
      ],
    ],
    chimneyU: {
      x: 253.10000000000002,
      y: 20,
    },
  },
  'back.platform-start': {
    file: 'back.platform-start.svg',
    widthU: 36,
    heightU: 24,
    pivotU: {
      x: 18,
      y: 24,
    },
    joinsU: {
      left: {
        x: 2,
        y: 24,
      },
      right: {
        x: 34,
        y: 24,
      },
    },
    tileStepU: 32,
    seamBleedU: 2,
    usableInsetU: 16,
  },
  'back.platform-middle': {
    file: 'back.platform-middle.svg',
    widthU: 132,
    heightU: 24,
    pivotU: {
      x: 66,
      y: 24,
    },
    joinsU: {
      left: {
        x: 2,
        y: 24,
      },
      right: {
        x: 130,
        y: 24,
      },
    },
    tileStepU: 128,
    seamBleedU: 2,
    usableInsetU: 0,
  },
  'back.platform-end': {
    file: 'back.platform-end.svg',
    widthU: 36,
    heightU: 24,
    pivotU: {
      x: 18,
      y: 24,
    },
    joinsU: {
      left: {
        x: 2,
        y: 24,
      },
      right: {
        x: 34,
        y: 24,
      },
    },
    tileStepU: 32,
    seamBleedU: 2,
    usableInsetU: 16,
  },
  'back.platform-canopy': {
    file: 'back.platform-canopy.svg',
    widthU: 160,
    heightU: 60,
    pivotU: {
      x: 80,
      y: 60,
    },
    attachmentsU: [
      {
        part: 'back.platform-canopy-roof',
        atU: {
          x: 80,
          y: 16,
        },
      },
    ],
  },
  'back.platform-canopy-roof': {
    file: 'back.platform-canopy-roof.svg',
    widthU: 160,
    heightU: 20,
    pivotU: {
      x: 80,
      y: 16,
    },
    roofOutlinesU: [
      [
        {
          x: 1,
          y: 13,
        },
        {
          x: 12,
          y: 4,
        },
        {
          x: 147,
          y: 4,
        },
        {
          x: 159,
          y: 13,
        },
        {
          x: 155,
          y: 17,
        },
        {
          x: 5,
          y: 17,
        },
      ],
    ],
  },
  'back.station-bench': {
    file: 'back.station-bench.svg',
    widthU: 36,
    heightU: 20,
    pivotU: {
      x: 18,
      y: 20,
    },
  },
  'back.station-lamp': {
    file: 'back.station-lamp.svg',
    widthU: 14,
    heightU: 64,
    pivotU: {
      x: 7,
      y: 64,
    },
  },
  'back.passenger-a': {
    motionBoundsU: { leftU: -12, rightU: 12, topU: -44, bottomU: 0 },
    file: 'back.passenger-a.svg',
    widthU: 16,
    heightU: 36,
    pivotU: {
      x: 8,
      y: 36,
    },
    attachmentsU: [
      {
        part: 'back.passenger-arm-a',
        atU: {
          x: 11,
          y: 15,
        },
        restAngleRad: 0,
        waveAngleRad: -2.15,
      },
    ],
  },
  'back.passenger-arm-a': {
    file: 'back.passenger-arm-a.svg',
    widthU: 9,
    heightU: 14,
    pivotU: {
      x: 3,
      y: 3,
    },
  },
  'back.passenger-b': {
    motionBoundsU: { leftU: -12, rightU: 12, topU: -44, bottomU: 0 },
    file: 'back.passenger-b.svg',
    widthU: 16,
    heightU: 40,
    pivotU: {
      x: 8,
      y: 40,
    },
    attachmentsU: [
      {
        part: 'back.passenger-arm-b',
        atU: {
          x: 11,
          y: 15,
        },
        restAngleRad: 0,
        waveAngleRad: -2.15,
      },
    ],
  },
  'back.passenger-arm-b': {
    file: 'back.passenger-arm-b.svg',
    widthU: 9,
    heightU: 14,
    pivotU: {
      x: 3,
      y: 3,
    },
  },
  'back.dispatcher-wave': {
    motionBoundsU: { leftU: -12, rightU: 12, topU: -44, bottomU: 0 },
    file: 'back.dispatcher-wave.svg',
    widthU: 16,
    heightU: 40,
    pivotU: {
      x: 8,
      y: 40,
    },
    attachmentsU: [
      {
        part: 'back.dispatcher-arm',
        atU: {
          x: 11,
          y: 15,
        },
        restAngleRad: 0,
        waveAngleRad: -2.15,
      },
    ],
  },
  'back.dispatcher-arm': {
    file: 'back.dispatcher-arm.svg',
    widthU: 9,
    heightU: 19,
    pivotU: {
      x: 3,
      y: 3,
    },
  },
  'near.garden-spring': {
    file: 'near.garden-spring.svg',
    widthU: 100,
    heightU: 20,
    pivotU: {
      x: 50,
      y: 20,
    },
    atlasGroup: {
      seasons: ['spring'],
    },
  },
  'near.garden-summer': {
    file: 'near.garden-summer.svg',
    widthU: 100,
    heightU: 20,
    pivotU: {
      x: 50,
      y: 20,
    },
    atlasGroup: {
      seasons: ['summer'],
    },
  },
  'near.garden-autumn': {
    file: 'near.garden-autumn.svg',
    widthU: 100,
    heightU: 20,
    pivotU: {
      x: 50,
      y: 20,
    },
    atlasGroup: {
      seasons: ['autumn'],
    },
  },
  'near.garden-winter': {
    file: 'near.garden-winter.svg',
    widthU: 100,
    heightU: 20,
    pivotU: {
      x: 50,
      y: 20,
    },
    atlasGroup: {
      seasons: ['winter'],
    },
  },
} as const;
export const parts = { ...sourceParts } as const satisfies Record<
  string,
  ArtPart
>;
export const usedKeys = [
  'back.platform-short',
  'back.house-gable',
  'back.house-hip',
  'back.barn-timber',
  'back.farmstead',
  'back.chapel',
  'back.bus-shelter',
  'back.bus',
  'back.bus-wheel',
  'back.playground',
  'back.playground-swing',
  'back.row-house',
  'back.apartment-house',
  'back.panel-house',
  'back.warehouse',
  'back.sawmill',
  'backdrop.town-sparse',
  'backdrop.town-dense',
  'back.station-medium',
  'back.station-big',
  'back.platform-start',
  'back.platform-middle',
  'back.platform-end',
  'back.platform-canopy',
  'back.platform-canopy-roof',
  'back.station-bench',
  'back.station-lamp',
  'back.passenger-a',
  'back.passenger-arm-a',
  'back.passenger-b',
  'back.passenger-arm-b',
  'back.dispatcher-wave',
  'back.dispatcher-arm',
  'near.garden-spring',
  'near.garden-summer',
  'near.garden-autumn',
  'near.garden-winter',
] as const;
