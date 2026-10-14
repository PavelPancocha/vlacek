import type { PropRule } from '../sceneryTypes.ts';
export const tufts: PropRule = {
  kinds: ['near.grass-a', 'near.grass-b', 'near.grass-c'],
  layer: 'near',
  count: [12, 18],
  depth: [0, 1],
  scale: [0.9, 1.2],
  flip: true,
};
export const flowers: PropRule = {
  kinds: ['near.flowers-a', 'near.flowers-b', 'near.flowers-c'],
  layer: 'near',
  count: [5, 9],
  depth: [0.05, 1],
  flip: true,
};
/** Larger plants and stones deeper in the meadow give the foreground body. */
export const meadowFeatures: readonly PropRule[] = [
  {
    kinds: ['near.wildflowers', 'near.tall-grass'],
    layer: 'near',
    count: [3, 5],
    depth: [0.1, 1],
    spacingU: 110,
    flip: true,
  },
  {
    kinds: ['near.bush'],
    layer: 'near',
    count: [1, 2],
    depth: [0.2, 1],
    spacingU: 320,
    flip: true,
  },
  {
    kinds: ['near.boulder'],
    layer: 'near',
    count: [0, 1],
    depth: [0.15, 1],
    flip: true,
  },
];
export const meadowLife: readonly PropRule[] = [
  tufts,
  flowers,
  ...meadowFeatures,
];
/** Forest floor: ferns, berries, young spruces, a fallen log. */
export const forestFloor: readonly PropRule[] = [
  {
    kinds: ['near.fern', 'near.mushrooms', 'near.grass-b'],
    layer: 'near',
    count: [8, 12],
    depth: [0, 1],
    flip: true,
  },
  {
    kinds: ['near.fern-big', 'near.berry-bush'],
    layer: 'near',
    count: [3, 5],
    depth: [0.1, 1],
    spacingU: 110,
    flip: true,
  },
  {
    kinds: ['near.young-spruce'],
    layer: 'near',
    count: [1, 3],
    depth: [0.2, 1],
    spacingU: 160,
    flip: true,
  },
  {
    kinds: ['near.log'],
    layer: 'near',
    count: [0, 1],
    depth: [0.15, 1],
    flip: true,
  },
];
/** Snowy meadow: drifts, small snowy spruces, bushes and stones. */
export const snowField: readonly PropRule[] = [
  {
    kinds: ['near.snow-bush', 'near.snow-stones'],
    layer: 'near',
    count: [6, 10],
    depth: [0, 1],
    flip: true,
  },
  {
    kinds: ['near.snow-drift'],
    layer: 'near',
    count: [2, 4],
    depth: [0.05, 1],
    spacingU: 180,
    flip: true,
  },
  {
    kinds: ['near.young-spruce-snow'],
    layer: 'near',
    count: [1, 3],
    depth: [0.2, 1],
    spacingU: 180,
    flip: true,
  },
];
/** Sand in front of the track: dune grass, shells, driftwood, stones. */
export const beachSand: readonly PropRule[] = [
  {
    kinds: ['near.dune-grass'],
    layer: 'near',
    count: [8, 12],
    depth: [0, 1],
    flip: true,
  },
  {
    kinds: ['near.shells'],
    layer: 'near',
    count: [3, 5],
    depth: [0, 1],
    flip: true,
  },
  {
    kinds: ['near.driftwood', 'near.beach-rocks'],
    layer: 'near',
    count: [1, 3],
    depth: [0.1, 1],
    spacingU: 200,
    flip: true,
  },
];
export const broadleaf = ['tree.oak', 'tree.linden', 'tree.birch'];
export const conifers = ['tree.spruce', 'tree.pine'];
