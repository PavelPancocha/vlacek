import type { Biome } from '../domain/world/Biomes.ts';
import type {
  AnimalKind,
  NearGround,
} from '../domain/world/sceneryTemplates.ts';
import type { ArtPart } from './artManifest.ts';

/**
 * World art manifest (D-011, D-012, D-013): track, scenery, animals,
 * backdrops and clouds, hand-authored SVG in `assets/world/` in world
 * units. Props stand on their foot centre (pivot at the bottom middle),
 * track tiles on the rail top, backdrops on their bottom left corner.
 * Prop keys are the kinds the world generator places.
 */
export const worldParts = {
  'animal.cat': {
    file: 'animal.cat.svg',
    widthU: 22,
    heightU: 20,
    pivotU: { x: 11, y: 20 },
  },
  'animal.cow': {
    file: 'animal.cow.svg',
    widthU: 60,
    heightU: 40,
    pivotU: { x: 30, y: 40 },
  },
  'animal.deer': {
    file: 'animal.deer.svg',
    widthU: 46,
    heightU: 50,
    pivotU: { x: 23, y: 50 },
  },
  'animal.dog': {
    file: 'animal.dog.svg',
    widthU: 30,
    heightU: 24,
    pivotU: { x: 15, y: 24 },
  },
  'animal.duck': {
    file: 'animal.duck.svg',
    widthU: 22,
    heightU: 18,
    pivotU: { x: 11, y: 18 },
  },
  'animal.fox': {
    file: 'animal.fox.svg',
    widthU: 40,
    heightU: 24,
    pivotU: { x: 20, y: 24 },
  },
  'animal.frog': {
    file: 'animal.frog.svg',
    widthU: 14,
    heightU: 10,
    pivotU: { x: 7, y: 10 },
  },
  'animal.gull': {
    file: 'animal.gull.svg',
    widthU: 26,
    heightU: 22,
    pivotU: { x: 13, y: 22 },
  },
  'animal.hedgehog': {
    file: 'animal.hedgehog.svg',
    widthU: 22,
    heightU: 14,
    pivotU: { x: 11, y: 14 },
  },
  'animal.hen': {
    file: 'animal.hen.svg',
    widthU: 18,
    heightU: 20,
    pivotU: { x: 9, y: 20 },
  },
  'animal.sheep': {
    file: 'animal.sheep.svg',
    widthU: 40,
    heightU: 30,
    pivotU: { x: 20, y: 30 },
  },
  'animal.squirrel': {
    file: 'animal.squirrel.svg',
    widthU: 18,
    heightU: 20,
    pivotU: { x: 9, y: 20 },
  },
  'back.barn': {
    file: 'back.barn.svg',
    widthU: 140,
    heightU: 110,
    pivotU: { x: 70, y: 110 },
  },
  'back.beach-hut': {
    file: 'back.beach-hut.svg',
    widthU: 40,
    heightU: 50,
    pivotU: { x: 20, y: 50 },
  },
  'back.bench': {
    file: 'back.bench.svg',
    widthU: 30,
    heightU: 16,
    pivotU: { x: 15, y: 16 },
  },
  'back.bush-a': {
    file: 'back.bush-a.svg',
    widthU: 50,
    heightU: 30,
    pivotU: { x: 25, y: 30 },
  },
  'back.bush-b': {
    file: 'back.bush-b.svg',
    widthU: 40,
    heightU: 28,
    pivotU: { x: 20, y: 28 },
  },
  'back.car': {
    file: 'back.car.svg',
    widthU: 60,
    heightU: 28,
    pivotU: { x: 30, y: 28 },
  },
  'back.chalet-snow': {
    file: 'back.chalet-snow.svg',
    widthU: 120,
    heightU: 104,
    pivotU: { x: 60, y: 104 },
  },
  'back.chalet': {
    file: 'back.chalet.svg',
    widthU: 120,
    heightU: 100,
    pivotU: { x: 60, y: 100 },
  },
  'back.church': {
    file: 'back.church.svg',
    widthU: 90,
    heightU: 190,
    pivotU: { x: 45, y: 190 },
  },
  'back.crates': {
    file: 'back.crates.svg',
    widthU: 40,
    heightU: 22,
    pivotU: { x: 20, y: 22 },
  },
  'back.dispatcher': {
    file: 'back.dispatcher.svg',
    widthU: 16,
    heightU: 40,
    pivotU: { x: 8, y: 40 },
  },
  'back.farmhouse': {
    file: 'back.farmhouse.svg',
    widthU: 130,
    heightU: 92,
    pivotU: { x: 65, y: 92 },
  },
  'back.fence': {
    file: 'back.fence.svg',
    widthU: 66,
    heightU: 22,
    pivotU: { x: 33, y: 22 },
  },
  'back.fishing-boat': {
    file: 'back.fishing-boat.svg',
    widthU: 70,
    heightU: 50,
    pivotU: { x: 35, y: 50 },
  },
  'back.haybale': {
    file: 'back.haybale.svg',
    widthU: 34,
    heightU: 28,
    pivotU: { x: 17, y: 28 },
  },
  'back.hayrack': {
    file: 'back.hayrack.svg',
    widthU: 60,
    heightU: 50,
    pivotU: { x: 30, y: 50 },
  },
  'back.house-a': {
    file: 'back.house-a.svg',
    widthU: 96,
    heightU: 96,
    pivotU: { x: 48, y: 96 },
  },
  'back.house-b': {
    file: 'back.house-b.svg',
    widthU: 90,
    heightU: 92,
    pivotU: { x: 45, y: 92 },
  },
  'back.house-c': {
    file: 'back.house-c.svg',
    widthU: 120,
    heightU: 104,
    pivotU: { x: 60, y: 104 },
  },
  'back.lamp': {
    file: 'back.lamp.svg',
    widthU: 10,
    heightU: 60,
    pivotU: { x: 5, y: 60 },
  },
  'back.lighthouse': {
    file: 'back.lighthouse.svg',
    widthU: 46,
    heightU: 180,
    pivotU: { x: 23, y: 180 },
  },
  'back.lodge': {
    file: 'back.lodge.svg',
    widthU: 120,
    heightU: 90,
    pivotU: { x: 60, y: 90 },
  },
  'back.logs': {
    file: 'back.logs.svg',
    widthU: 60,
    heightU: 22,
    pivotU: { x: 30, y: 22 },
  },
  'back.parasol': {
    file: 'back.parasol.svg',
    widthU: 40,
    heightU: 46,
    pivotU: { x: 20, y: 46 },
  },
  'back.person-a': {
    file: 'back.person-a.svg',
    widthU: 14,
    heightU: 36,
    pivotU: { x: 7, y: 36 },
  },
  'back.person-b': {
    file: 'back.person-b.svg',
    widthU: 14,
    heightU: 36,
    pivotU: { x: 7, y: 36 },
  },
  'back.person-c': {
    file: 'back.person-c.svg',
    widthU: 14,
    heightU: 36,
    pivotU: { x: 7, y: 36 },
  },
  'back.pier': {
    file: 'back.pier.svg',
    widthU: 200,
    heightU: 26,
    pivotU: { x: 100, y: 26 },
  },
  'back.platform': {
    file: 'back.platform.svg',
    widthU: 330,
    heightU: 10,
    pivotU: { x: 165, y: 10 },
  },
  'back.reeds': {
    file: 'back.reeds.svg',
    widthU: 30,
    heightU: 36,
    pivotU: { x: 15, y: 36 },
  },
  'back.rock-a': {
    file: 'back.rock-a.svg',
    widthU: 50,
    heightU: 34,
    pivotU: { x: 25, y: 34 },
  },
  'back.rock-b': {
    file: 'back.rock-b.svg',
    widthU: 70,
    heightU: 44,
    pivotU: { x: 35, y: 44 },
  },
  'back.rock-snow': {
    file: 'back.rock-snow.svg',
    widthU: 60,
    heightU: 40,
    pivotU: { x: 30, y: 40 },
  },
  'back.rowboat': {
    file: 'back.rowboat.svg',
    widthU: 50,
    heightU: 18,
    pivotU: { x: 25, y: 18 },
  },
  'back.sailboat': {
    file: 'back.sailboat.svg',
    widthU: 60,
    heightU: 80,
    pivotU: { x: 30, y: 80 },
  },
  'back.snowman': {
    file: 'back.snowman.svg',
    widthU: 26,
    heightU: 40,
    pivotU: { x: 13, y: 40 },
  },
  'back.station': {
    file: 'back.station.svg',
    widthU: 180,
    heightU: 110,
    pivotU: { x: 90, y: 110 },
  },
  'back.stump': {
    file: 'back.stump.svg',
    widthU: 24,
    heightU: 16,
    pivotU: { x: 12, y: 16 },
  },
  'back.tractor': {
    file: 'back.tractor.svg',
    widthU: 70,
    heightU: 46,
    pivotU: { x: 35, y: 46 },
  },
  'back.watermill': {
    file: 'back.watermill.svg',
    widthU: 130,
    heightU: 100,
    pivotU: { x: 65, y: 100 },
  },
  'backdrop.coast-far': {
    file: 'backdrop.coast-far.svg',
    widthU: 1020,
    heightU: 215,
    pivotU: { x: 0, y: 215 },
  },
  'backdrop.coast-mid': {
    file: 'backdrop.coast-mid.svg',
    widthU: 1020,
    heightU: 108,
    pivotU: { x: 0, y: 108 },
  },
  'backdrop.countryside-far': {
    file: 'backdrop.countryside-far.svg',
    widthU: 1020,
    heightU: 234,
    pivotU: { x: 0, y: 234 },
  },
  'backdrop.countryside-mid': {
    file: 'backdrop.countryside-mid.svg',
    widthU: 1020,
    heightU: 135,
    pivotU: { x: 0, y: 135 },
  },
  'backdrop.foothills-far': {
    file: 'backdrop.foothills-far.svg',
    widthU: 1020,
    heightU: 291,
    pivotU: { x: 0, y: 291 },
  },
  'backdrop.foothills-mid': {
    file: 'backdrop.foothills-mid.svg',
    widthU: 1020,
    heightU: 159,
    pivotU: { x: 0, y: 159 },
  },
  'backdrop.forest-far': {
    file: 'backdrop.forest-far.svg',
    widthU: 1020,
    heightU: 304,
    pivotU: { x: 0, y: 304 },
  },
  'backdrop.forest-mid': {
    file: 'backdrop.forest-mid.svg',
    widthU: 1020,
    heightU: 160,
    pivotU: { x: 0, y: 160 },
  },
  'backdrop.lakes-far': {
    file: 'backdrop.lakes-far.svg',
    widthU: 1020,
    heightU: 205,
    pivotU: { x: 0, y: 205 },
  },
  'backdrop.lakes-mid': {
    file: 'backdrop.lakes-mid.svg',
    widthU: 1020,
    heightU: 115,
    pivotU: { x: 0, y: 115 },
  },
  'backdrop.mountains-far': {
    file: 'backdrop.mountains-far.svg',
    widthU: 1020,
    heightU: 327,
    pivotU: { x: 0, y: 327 },
  },
  'backdrop.mountains-mid': {
    file: 'backdrop.mountains-mid.svg',
    widthU: 1020,
    heightU: 166,
    pivotU: { x: 0, y: 166 },
  },
  'cloud.a': {
    file: 'cloud.a.svg',
    widthU: 160,
    heightU: 60,
    pivotU: { x: 80, y: 60 },
  },
  'cloud.b': {
    file: 'cloud.b.svg',
    widthU: 120,
    heightU: 50,
    pivotU: { x: 60, y: 50 },
  },
  'cloud.c': {
    file: 'cloud.c.svg',
    widthU: 200,
    heightU: 70,
    pivotU: { x: 100, y: 70 },
  },
  'near.beach-rocks': {
    file: 'near.beach-rocks.svg',
    widthU: 62,
    heightU: 24,
    pivotU: { x: 31, y: 24 },
  },
  'near.berry-bush': {
    file: 'near.berry-bush.svg',
    widthU: 50,
    heightU: 32,
    pivotU: { x: 25, y: 32 },
  },
  'near.boulder': {
    file: 'near.boulder.svg',
    widthU: 58,
    heightU: 36,
    pivotU: { x: 29, y: 36 },
  },
  'near.bush': {
    file: 'near.bush.svg',
    widthU: 64,
    heightU: 42,
    pivotU: { x: 32, y: 42 },
  },
  'near.driftwood': {
    file: 'near.driftwood.svg',
    widthU: 74,
    heightU: 18,
    pivotU: { x: 37, y: 18 },
  },
  'near.dune-grass': {
    file: 'near.dune-grass.svg',
    widthU: 26,
    heightU: 22,
    pivotU: { x: 13, y: 22 },
  },
  'near.fern-big': {
    file: 'near.fern-big.svg',
    widthU: 54,
    heightU: 36,
    pivotU: { x: 27, y: 36 },
  },
  'near.fern': {
    file: 'near.fern.svg',
    widthU: 26,
    heightU: 18,
    pivotU: { x: 13, y: 18 },
  },
  'near.flowers-a': {
    file: 'near.flowers-a.svg',
    widthU: 22,
    heightU: 16,
    pivotU: { x: 11, y: 16 },
  },
  'near.flowers-b': {
    file: 'near.flowers-b.svg',
    widthU: 22,
    heightU: 16,
    pivotU: { x: 11, y: 16 },
  },
  'near.flowers-c': {
    file: 'near.flowers-c.svg',
    widthU: 22,
    heightU: 16,
    pivotU: { x: 11, y: 16 },
  },
  'near.grass-a': {
    file: 'near.grass-a.svg',
    widthU: 20,
    heightU: 14,
    pivotU: { x: 10, y: 14 },
  },
  'near.grass-b': {
    file: 'near.grass-b.svg',
    widthU: 24,
    heightU: 16,
    pivotU: { x: 12, y: 16 },
  },
  'near.grass-c': {
    file: 'near.grass-c.svg',
    widthU: 18,
    heightU: 12,
    pivotU: { x: 9, y: 12 },
  },
  'near.log': {
    file: 'near.log.svg',
    widthU: 76,
    heightU: 24,
    pivotU: { x: 38, y: 24 },
  },
  'near.mushrooms': {
    file: 'near.mushrooms.svg',
    widthU: 18,
    heightU: 12,
    pivotU: { x: 9, y: 12 },
  },
  'near.picket-fence': {
    file: 'near.picket-fence.svg',
    widthU: 66,
    heightU: 20,
    pivotU: { x: 33, y: 20 },
  },
  'near.pond': {
    file: 'near.pond.svg',
    widthU: 200,
    heightU: 40,
    pivotU: { x: 100, y: 40 },
  },
  'near.poppies': {
    file: 'near.poppies.svg',
    widthU: 22,
    heightU: 16,
    pivotU: { x: 11, y: 16 },
  },
  'near.reeds': {
    file: 'near.reeds.svg',
    widthU: 30,
    heightU: 26,
    pivotU: { x: 15, y: 26 },
  },
  'near.sand-toys': {
    file: 'near.sand-toys.svg',
    widthU: 46,
    heightU: 26,
    pivotU: { x: 23, y: 26 },
  },
  'near.shells': {
    file: 'near.shells.svg',
    widthU: 14,
    heightU: 6,
    pivotU: { x: 7, y: 6 },
  },
  'near.snow-bush': {
    file: 'near.snow-bush.svg',
    widthU: 30,
    heightU: 20,
    pivotU: { x: 15, y: 20 },
  },
  'near.snow-drift': {
    file: 'near.snow-drift.svg',
    widthU: 92,
    heightU: 20,
    pivotU: { x: 46, y: 20 },
  },
  'near.snow-stones': {
    file: 'near.snow-stones.svg',
    widthU: 22,
    heightU: 12,
    pivotU: { x: 11, y: 12 },
  },
  'near.stones': {
    file: 'near.stones.svg',
    widthU: 20,
    heightU: 10,
    pivotU: { x: 10, y: 10 },
  },
  'near.tall-grass': {
    file: 'near.tall-grass.svg',
    widthU: 46,
    heightU: 34,
    pivotU: { x: 23, y: 34 },
  },
  'near.wildflowers': {
    file: 'near.wildflowers.svg',
    widthU: 84,
    heightU: 24,
    pivotU: { x: 42, y: 24 },
  },
  'near.young-spruce-snow': {
    file: 'near.young-spruce-snow.svg',
    widthU: 34,
    heightU: 46,
    pivotU: { x: 17, y: 46 },
  },
  'near.young-spruce': {
    file: 'near.young-spruce.svg',
    widthU: 34,
    heightU: 46,
    pivotU: { x: 17, y: 46 },
  },
  'track.sand-a': {
    file: 'track.sand-a.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.sand-b': {
    file: 'track.sand-b.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.snow-a': {
    file: 'track.snow-a.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.snow-b': {
    file: 'track.snow-b.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.tile-a': {
    file: 'track.tile-a.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.tile-b': {
    file: 'track.tile-b.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'track.tile-c': {
    file: 'track.tile-c.svg',
    widthU: 66,
    heightU: 24,
    pivotU: { x: 0, y: 1 },
  },
  'tree.apple': {
    file: 'tree.apple.svg',
    widthU: 70,
    heightU: 80,
    pivotU: { x: 35, y: 80 },
  },
  'tree.birch': {
    file: 'tree.birch.svg',
    widthU: 50,
    heightU: 120,
    pivotU: { x: 25, y: 120 },
  },
  'tree.linden': {
    file: 'tree.linden.svg',
    widthU: 80,
    heightU: 120,
    pivotU: { x: 40, y: 120 },
  },
  'tree.oak': {
    file: 'tree.oak.svg',
    widthU: 90,
    heightU: 120,
    pivotU: { x: 45, y: 120 },
  },
  'tree.pine-snow': {
    file: 'tree.pine-snow.svg',
    widthU: 60,
    heightU: 120,
    pivotU: { x: 30, y: 120 },
  },
  'tree.pine': {
    file: 'tree.pine.svg',
    widthU: 60,
    heightU: 120,
    pivotU: { x: 30, y: 120 },
  },
  'tree.plum': {
    file: 'tree.plum.svg',
    widthU: 60,
    heightU: 75,
    pivotU: { x: 30, y: 75 },
  },
  'tree.spruce-snow': {
    file: 'tree.spruce-snow.svg',
    widthU: 50,
    heightU: 130,
    pivotU: { x: 25, y: 130 },
  },
  'tree.spruce': {
    file: 'tree.spruce.svg',
    widthU: 50,
    heightU: 130,
    pivotU: { x: 25, y: 130 },
  },
  'tree.willow': {
    file: 'tree.willow.svg',
    widthU: 100,
    heightU: 100,
    pivotU: { x: 50, y: 100 },
  },
} satisfies Record<string, ArtPart>;

export type WorldPartKey = keyof typeof worldParts;

/**
 * Track tiles start every `TRACK_TILE_STEP_U` along x; their extra width
 * overlaps the next tile and hides the joints. The rail top is the pivot.
 */
export const TRACK_TILE_STEP_U = 64;
const grassTiles: readonly WorldPartKey[] = [
  'track.tile-a',
  'track.tile-b',
  'track.tile-c',
];
/** Track tiles whose verge matches the near ground. */
export const trackTileSets: Readonly<
  Record<NearGround, readonly WorldPartKey[]>
> = {
  meadow: grassTiles,
  forest: grassTiles,
  snow: ['track.snow-a', 'track.snow-b'],
  sand: ['track.sand-a', 'track.sand-b'],
};

/** Track bed depth below the rail top that the tiles cover. */
export const TRACK_BED_DEPTH_U = 22;

/** Far and mid parallax backdrops of each biome (doc 07 §3). */
export const backdropParts: Readonly<
  Record<Biome, { far: WorldPartKey; mid: WorldPartKey }>
> = {
  countryside: {
    far: 'backdrop.countryside-far',
    mid: 'backdrop.countryside-mid',
  },
  forest: { far: 'backdrop.forest-far', mid: 'backdrop.forest-mid' },
  lakes: { far: 'backdrop.lakes-far', mid: 'backdrop.lakes-mid' },
  foothills: { far: 'backdrop.foothills-far', mid: 'backdrop.foothills-mid' },
  mountains: { far: 'backdrop.mountains-far', mid: 'backdrop.mountains-mid' },
  coast: { far: 'backdrop.coast-far', mid: 'backdrop.coast-mid' },
};

export const cloudParts: readonly WorldPartKey[] = [
  'cloud.a',
  'cloud.b',
  'cloud.c',
];

/** Art of each interactive animal species. */
export const animalParts: Readonly<Record<AnimalKind, WorldPartKey>> = {
  sheep: 'animal.sheep',
  cow: 'animal.cow',
  hen: 'animal.hen',
  dog: 'animal.dog',
  cat: 'animal.cat',
  deer: 'animal.deer',
  fox: 'animal.fox',
  squirrel: 'animal.squirrel',
  hedgehog: 'animal.hedgehog',
  duck: 'animal.duck',
  frog: 'animal.frog',
  gull: 'animal.gull',
};

/** Backdrops and clouds go to their own, coarser atlas (D-013). */
export function isBackdropPart(key: string): boolean {
  return key.startsWith('backdrop.') || key.startsWith('cloud.');
}
