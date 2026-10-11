import type { Biome } from './Biomes.ts';

/** Land drawn behind the track (between the rails and the horizon). */
export type BackGround =
  'meadow' | 'glade' | 'wheat' | 'crops' | 'forest' | 'sand' | 'snow';

/** Ground drawn in front of the track (the near meadow). */
export type NearGround = 'meadow' | 'forest' | 'sand' | 'snow';

/** Species of a chunk's interactive animal (doc 06 §6). */
export type AnimalKind =
  | 'sheep'
  | 'cow'
  | 'hen'
  | 'dog'
  | 'cat'
  | 'deer'
  | 'fox'
  | 'squirrel'
  | 'hedgehog'
  | 'duck'
  | 'frog'
  | 'gull';

/** A prop that drives back and forth (tractor, car, boat), u/s. */
export interface PatrolMotion {
  rangeU: number;
  speedUPerSec: number;
}

/**
 * How to place one kind of prop. `back` props stand behind the track,
 * depth 0 at the track and 1 at the horizon; `near` props stand on the
 * near meadow, depth 0 at the bank foot and 1 nearest to the viewer. Near
 * props are low (`NEAR_PROP_MAX_HEIGHT_U`) so they never hide the train.
 */
export interface PropRule {
  kinds: readonly string[];
  layer: 'back' | 'near';
  count: readonly [number, number];
  /** Chunk-local x range; the whole chunk when omitted. */
  x?: readonly [number, number];
  depth: readonly [number, number];
  scale?: readonly [number, number];
  /** Smallest x distance between two props of this rule. */
  spacingU?: number;
  /** Mirror half of them (never props with lettering). */
  flip?: boolean;
  motion?: PatrolMotion;
  /** Placed around the interactive animal, ± this many u. */
  aroundAnimalU?: number;
}

/** Ground over a chunk-local x range. */
export interface GroundSpan<G> {
  style: G;
  fromX: number;
  toX: number;
}

/**
 * A pond, lake or bay behind the track: level water between two depths of
 * the back ground, over a chunk-local x range (the whole chunk when
 * omitted). Its shore curves in at both ends, so water never runs across
 * a chunk boundary and every basin can keep its own level.
 */
export interface WaterBody {
  x?: readonly [number, number];
  depth: readonly [number, number];
}

export interface LocalityTemplate {
  id: string;
  biome: Biome;
  /** Relative chance among the biome's localities of a free slot. */
  weight: number;
  near: NearGround;
  /** Back ground; spans over parts of the chunk on top of the base. */
  back: BackGround;
  backSpans?: readonly GroundSpan<BackGround>[];
  water?: WaterBody;
  rules: readonly PropRule[];
  animals: readonly AnimalKind[];
  /** Where the animal stands in the near meadow (depth). */
  animalDepth?: readonly [number, number];
  /** Calm locality used for slot 0 and the transition slot. */
  calm?: boolean;
  /** Needs a flat track (stations, doc 04 §6). */
  station?: boolean;
}

const tufts: PropRule = {
  kinds: ['near.grass-a', 'near.grass-b', 'near.grass-c'],
  layer: 'near',
  count: [12, 18],
  depth: [0, 1],
  scale: [0.9, 1.2],
  flip: true,
};
const flowers: PropRule = {
  kinds: ['near.flowers-a', 'near.flowers-b', 'near.flowers-c'],
  layer: 'near',
  count: [5, 9],
  depth: [0.05, 1],
  flip: true,
};
/** Larger plants and stones deeper in the meadow give the foreground body. */
const meadowFeatures: readonly PropRule[] = [
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
const meadowLife: readonly PropRule[] = [tufts, flowers, ...meadowFeatures];
/** Forest floor: ferns, berries, young spruces, a fallen log. */
const forestFloor: readonly PropRule[] = [
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
const snowField: readonly PropRule[] = [
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
const beachSand: readonly PropRule[] = [
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
const broadleaf = ['tree.oak', 'tree.linden', 'tree.birch'];
const conifers = ['tree.spruce', 'tree.pine'];

/**
 * Locality templates (doc 14 §5: logical places, not a jumble): farms
 * belong to fields, reeds to water, platforms to stations. Data only; art
 * keys resolve in `src/content/worldArt.ts`.
 */
export const LOCALITIES: readonly LocalityTemplate[] = [
  // Countryside.
  {
    id: 'pasture',
    biome: 'countryside',
    weight: 3,
    calm: true,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.fence'],
        layer: 'back',
        count: [5, 9],
        depth: [0.12, 0.14],
        spacingU: 64,
      },
      {
        kinds: broadleaf,
        layer: 'back',
        count: [3, 5],
        depth: [0.3, 0.95],
        spacingU: 140,
        flip: true,
      },
      {
        kinds: ['back.bush-a', 'back.bush-b'],
        layer: 'back',
        count: [2, 4],
        depth: [0.05, 0.6],
        flip: true,
      },
      ...meadowLife,
    ],
    animals: ['sheep', 'cow'],
  },
  {
    id: 'field',
    biome: 'countryside',
    weight: 3,
    near: 'meadow',
    back: 'wheat',
    rules: [
      {
        kinds: ['back.haybale'],
        layer: 'back',
        count: [3, 6],
        depth: [0.2, 0.75],
        spacingU: 90,
      },
      {
        kinds: ['back.tractor'],
        layer: 'back',
        count: [1, 1],
        x: [300, 700],
        depth: [0.45, 0.55],
        motion: { rangeU: 220, speedUPerSec: 26 },
      },
      {
        kinds: broadleaf,
        layer: 'back',
        count: [0, 2],
        depth: [0.85, 1],
        spacingU: 200,
        flip: true,
      },
      tufts,
      { ...flowers, kinds: ['near.poppies'] },
      ...meadowFeatures,
    ],
    animals: ['dog', 'hedgehog'],
  },
  {
    id: 'farm',
    biome: 'countryside',
    weight: 2,
    near: 'meadow',
    back: 'meadow',
    backSpans: [{ style: 'crops', fromX: 640, toX: 1024 }],
    rules: [
      {
        kinds: ['back.farmhouse'],
        layer: 'back',
        count: [1, 1],
        x: [140, 260],
        depth: [0.4, 0.5],
      },
      {
        kinds: ['back.barn'],
        layer: 'back',
        count: [1, 1],
        x: [380, 520],
        depth: [0.45, 0.55],
      },
      {
        kinds: ['back.fence'],
        layer: 'back',
        count: [4, 6],
        x: [40, 600],
        depth: [0.12, 0.14],
        spacingU: 64,
      },
      {
        kinds: ['tree.apple', 'tree.linden'],
        layer: 'back',
        count: [2, 3],
        x: [0, 640],
        depth: [0.6, 0.95],
        spacingU: 150,
        flip: true,
      },
      {
        kinds: ['back.haybale'],
        layer: 'back',
        count: [1, 3],
        x: [660, 1000],
        depth: [0.25, 0.6],
        spacingU: 90,
      },
      ...meadowLife,
    ],
    animals: ['hen', 'cat', 'dog'],
  },
  {
    id: 'orchard',
    biome: 'countryside',
    weight: 2,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['tree.apple', 'tree.apple', 'tree.plum'],
        layer: 'back',
        count: [6, 9],
        depth: [0.15, 0.85],
        spacingU: 90,
        flip: true,
      },
      {
        kinds: ['back.crates'],
        layer: 'back',
        count: [1, 2],
        depth: [0.08, 0.3],
        spacingU: 200,
      },
      ...meadowLife,
    ],
    animals: ['hedgehog', 'cat'],
  },
  {
    id: 'village',
    biome: 'countryside',
    weight: 3,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.house-a', 'back.house-b', 'back.house-c'],
        layer: 'back',
        count: [3, 4],
        depth: [0.3, 0.6],
        spacingU: 190,
      },
      {
        kinds: ['back.church'],
        layer: 'back',
        count: [0, 1],
        depth: [0.8, 0.9],
      },
      {
        kinds: ['back.car'],
        layer: 'back',
        count: [1, 1],
        // The road bends away to the horizon within the chunk.
        x: [320, 704],
        depth: [0.2, 0.22],
        motion: { rangeU: 400, speedUPerSec: 70 },
      },
      {
        kinds: broadleaf,
        layer: 'back',
        count: [4, 6],
        depth: [0.62, 1],
        spacingU: 120,
        flip: true,
      },
      {
        kinds: ['back.bush-a', 'back.bush-b', 'tree.apple'],
        layer: 'back',
        count: [3, 5],
        depth: [0.25, 0.65],
        spacingU: 90,
        flip: true,
      },
      {
        kinds: ['near.picket-fence'],
        layer: 'near',
        count: [2, 4],
        depth: [0.05, 0.12],
        spacingU: 80,
      },
      ...meadowLife,
    ],
    animals: ['dog', 'cat', 'hen'],
  },
  {
    id: 'station',
    biome: 'countryside',
    weight: 0,
    station: true,
    near: 'meadow',
    back: 'meadow',
    rules: [],
    animals: ['dog', 'cat'],
  },
  // Forest.
  {
    id: 'forest',
    biome: 'forest',
    weight: 4,
    calm: true,
    near: 'forest',
    back: 'forest',
    rules: [
      // A forest is dense: a deep row and trees in front of it.
      {
        kinds: [...conifers, ...conifers, ...conifers, 'tree.oak'],
        layer: 'back',
        count: [18, 24],
        depth: [0.55, 1],
        flip: true,
      },
      {
        kinds: [...conifers, ...conifers, 'tree.oak', 'tree.birch'],
        layer: 'back',
        count: [10, 14],
        depth: [0.08, 0.55],
        spacingU: 50,
        flip: true,
      },
      {
        kinds: ['back.bush-a', 'back.bush-b'],
        layer: 'back',
        count: [2, 4],
        depth: [0, 0.4],
        flip: true,
      },
      ...forestFloor,
    ],
    animals: ['deer', 'fox', 'squirrel', 'hedgehog'],
  },
  {
    id: 'clearing',
    biome: 'forest',
    weight: 2,
    near: 'forest',
    back: 'forest',
    backSpans: [{ style: 'glade', fromX: 250, toX: 770 }],
    rules: [
      {
        kinds: conifers,
        layer: 'back',
        count: [6, 9],
        x: [0, 260],
        depth: [0.1, 1],
        flip: true,
      },
      {
        kinds: conifers,
        layer: 'back',
        count: [6, 9],
        x: [760, 1024],
        depth: [0.1, 1],
        flip: true,
      },
      {
        kinds: ['back.stump', 'back.logs'],
        layer: 'back',
        count: [2, 3],
        x: [300, 720],
        depth: [0.1, 0.6],
        spacingU: 120,
      },
      tufts,
      { ...flowers, count: [6, 10] },
      ...meadowFeatures,
      {
        kinds: ['near.mushrooms', 'near.fern'],
        layer: 'near',
        count: [2, 4],
        depth: [0, 1],
        flip: true,
      },
    ],
    animals: ['deer', 'hedgehog', 'fox'],
  },
  {
    id: 'lodge',
    biome: 'forest',
    weight: 1,
    near: 'forest',
    back: 'forest',
    rules: [
      {
        kinds: ['back.lodge'],
        layer: 'back',
        count: [1, 1],
        x: [380, 640],
        depth: [0.35, 0.45],
      },
      {
        kinds: ['back.logs'],
        layer: 'back',
        count: [1, 1],
        x: [660, 760],
        depth: [0.2, 0.3],
      },
      {
        kinds: conifers,
        layer: 'back',
        count: [14, 18],
        depth: [0.5, 1],
        flip: true,
      },
      ...forestFloor,
    ],
    animals: ['dog', 'deer'],
  },
  // Lakes.
  {
    id: 'pond',
    biome: 'lakes',
    weight: 3,
    calm: true,
    near: 'meadow',
    back: 'meadow',
    // The animal floats on the pond, behind its near edge.
    animalDepth: [0.33, 0.36],
    rules: [
      {
        kinds: ['near.pond'],
        layer: 'near',
        count: [1, 1],
        depth: [0.4, 0.4],
        aroundAnimalU: 0,
      },
      {
        kinds: ['near.reeds'],
        layer: 'near',
        count: [2, 3],
        depth: [0.36, 0.5],
        aroundAnimalU: 110,
        flip: true,
      },
      {
        kinds: ['tree.willow', 'tree.birch'],
        layer: 'back',
        count: [2, 4],
        depth: [0.2, 0.9],
        spacingU: 160,
        flip: true,
      },
      tufts,
      flowers,
      {
        kinds: ['near.wildflowers', 'near.tall-grass'],
        layer: 'near',
        count: [2, 4],
        depth: [0.55, 1],
        spacingU: 120,
        flip: true,
      },
    ],
    animals: ['duck', 'frog'],
  },
  {
    id: 'lakeside',
    biome: 'lakes',
    weight: 2,
    near: 'meadow',
    back: 'meadow',
    water: { depth: [0.08, 0.84] },
    rules: [
      {
        kinds: ['back.reeds'],
        layer: 'back',
        count: [4, 7],
        depth: [0.03, 0.08],
        flip: true,
      },
      {
        kinds: ['back.rowboat'],
        layer: 'back',
        count: [1, 1],
        x: [160, 864],
        depth: [0.45, 0.6],
        motion: { rangeU: 160, speedUPerSec: 12 },
      },
      {
        kinds: ['tree.willow'],
        layer: 'back',
        count: [0, 2],
        depth: [0.9, 1],
        spacingU: 300,
        flip: true,
      },
      ...meadowLife,
    ],
    animals: ['duck', 'frog'],
  },
  {
    id: 'mill',
    biome: 'lakes',
    weight: 1,
    near: 'meadow',
    back: 'meadow',
    water: { x: [540, 1024], depth: [0.08, 0.8] },
    rules: [
      {
        kinds: ['back.watermill'],
        layer: 'back',
        count: [1, 1],
        x: [420, 520],
        depth: [0.35, 0.4],
      },
      {
        kinds: ['tree.willow', 'tree.linden'],
        layer: 'back',
        count: [2, 3],
        x: [0, 380],
        depth: [0.3, 0.9],
        spacingU: 140,
        flip: true,
      },
      {
        kinds: ['back.reeds'],
        layer: 'back',
        count: [2, 4],
        x: [580, 1000],
        depth: [0.03, 0.08],
        flip: true,
      },
      ...meadowLife,
    ],
    animals: ['duck', 'cat'],
  },
  // Foothills.
  {
    id: 'hill-pasture',
    biome: 'foothills',
    weight: 3,
    calm: true,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.rock-a', 'back.rock-b'],
        layer: 'back',
        count: [2, 4],
        depth: [0.1, 0.8],
        spacingU: 120,
        flip: true,
      },
      {
        kinds: ['tree.birch', 'tree.spruce'],
        layer: 'back',
        count: [2, 4],
        depth: [0.4, 1],
        spacingU: 150,
        flip: true,
      },
      {
        kinds: ['back.fence'],
        layer: 'back',
        count: [3, 6],
        depth: [0.12, 0.14],
        spacingU: 64,
      },
      tufts,
      { ...flowers, count: [6, 10] },
      ...meadowFeatures,
      {
        kinds: ['near.stones', 'near.young-spruce'],
        layer: 'near',
        count: [2, 4],
        depth: [0.2, 1],
        spacingU: 140,
        flip: true,
      },
    ],
    animals: ['cow', 'sheep'],
  },
  {
    id: 'hamlet',
    biome: 'foothills',
    weight: 2,
    near: 'meadow',
    back: 'meadow',
    rules: [
      {
        kinds: ['back.chalet'],
        layer: 'back',
        count: [1, 2],
        depth: [0.35, 0.6],
        spacingU: 260,
      },
      {
        kinds: ['back.hayrack'],
        layer: 'back',
        count: [1, 2],
        depth: [0.15, 0.3],
        spacingU: 200,
      },
      {
        kinds: ['tree.spruce', 'tree.birch'],
        layer: 'back',
        count: [3, 5],
        depth: [0.5, 1],
        spacingU: 120,
        flip: true,
      },
      ...meadowLife,
    ],
    animals: ['dog', 'hen'],
  },
  // Mountains (snow: doc 14 §7 "zimní úsek").
  {
    id: 'snowfield',
    biome: 'mountains',
    weight: 3,
    calm: true,
    near: 'snow',
    back: 'snow',
    rules: [
      {
        kinds: ['tree.spruce-snow', 'tree.spruce-snow', 'tree.pine-snow'],
        layer: 'back',
        count: [6, 10],
        depth: [0.05, 1],
        flip: true,
      },
      {
        kinds: ['back.rock-snow'],
        layer: 'back',
        count: [1, 3],
        depth: [0.1, 0.7],
        spacingU: 150,
        flip: true,
      },
      {
        kinds: ['back.snowman'],
        layer: 'back',
        count: [0, 1],
        depth: [0.08, 0.2],
      },
      ...snowField,
    ],
    animals: ['fox', 'deer'],
  },
  {
    id: 'alpine',
    biome: 'mountains',
    weight: 2,
    near: 'snow',
    back: 'snow',
    rules: [
      {
        kinds: ['back.chalet-snow'],
        layer: 'back',
        count: [1, 1],
        x: [300, 700],
        depth: [0.35, 0.5],
      },
      {
        kinds: ['tree.spruce-snow'],
        layer: 'back',
        count: [4, 7],
        depth: [0.3, 1],
        spacingU: 90,
        flip: true,
      },
      ...snowField,
    ],
    animals: ['dog', 'fox'],
  },
  // Coast.
  {
    id: 'beach',
    biome: 'coast',
    weight: 3,
    calm: true,
    near: 'sand',
    back: 'sand',
    water: { depth: [0.3, 0.9] },
    rules: [
      {
        kinds: ['back.sailboat'],
        layer: 'back',
        count: [1, 2],
        x: [210, 814],
        depth: [0.55, 0.85],
        spacingU: 300,
        motion: { rangeU: 260, speedUPerSec: 18 },
      },
      {
        kinds: ['back.beach-hut', 'back.parasol'],
        layer: 'back',
        count: [2, 4],
        depth: [0.05, 0.2],
        spacingU: 160,
      },
      ...beachSand,
      {
        kinds: ['near.sand-toys'],
        layer: 'near',
        count: [0, 1],
        depth: [0.2, 0.9],
      },
    ],
    animals: ['gull'],
  },
  {
    id: 'harbour',
    biome: 'coast',
    weight: 2,
    near: 'sand',
    back: 'sand',
    water: { x: [0, 760], depth: [0.1, 0.86] },
    rules: [
      {
        kinds: ['back.lighthouse'],
        layer: 'back',
        count: [1, 1],
        x: [820, 960],
        depth: [0.6, 0.75],
      },
      {
        kinds: ['back.pier'],
        layer: 'back',
        count: [1, 1],
        x: [200, 420],
        depth: [0.1, 0.12],
      },
      {
        kinds: ['back.fishing-boat'],
        layer: 'back',
        count: [1, 2],
        x: [140, 620],
        depth: [0.3, 0.6],
        spacingU: 200,
        motion: { rangeU: 120, speedUPerSec: 10 },
      },
      ...beachSand,
    ],
    animals: ['gull', 'cat'],
  },
];
