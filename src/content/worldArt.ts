import type { Biome } from '../domain/world/Biomes.ts';
import type {
  AnimalKind,
  NearGround,
} from '../domain/world/sceneryTemplates.ts';
import type { ArtPart, ArtPoint } from './artManifest.ts';

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
  'catenary.pole': {
    file: 'catenary.pole.svg',
    widthU: 30,
    heightU: 192,
    pivotU: { x: 8, y: 192 },
  },
  'catenary.span': {
    file: 'catenary.span.svg',
    widthU: 256,
    heightU: 28,
    pivotU: { x: 0, y: 26 },
  },
  'crossing.boom': {
    file: 'crossing.boom.svg',
    widthU: 38,
    heightU: 6,
    pivotU: { x: 3, y: 3 },
  },
  'crossing.deck': {
    file: 'crossing.deck.svg',
    widthU: 68,
    heightU: 24,
    pivotU: { x: 34, y: 2 },
  },
  'crossing.glow-red': {
    file: 'crossing.glow-red.svg',
    widthU: 16,
    heightU: 16,
    pivotU: { x: 8, y: 8 },
  },
  'crossing.glow-white': {
    file: 'crossing.glow-white.svg',
    widthU: 14,
    heightU: 14,
    pivotU: { x: 7, y: 7 },
  },
  'crossing.post': {
    file: 'crossing.post.svg',
    widthU: 34,
    heightU: 96,
    pivotU: { x: 17, y: 96 },
  },
  'crossing.post-low': {
    file: 'crossing.post-low.svg',
    widthU: 34,
    heightU: 46,
    pivotU: { x: 17, y: 46 },
  },
  'fx.bird-down': {
    file: 'fx.bird-down.svg',
    widthU: 15,
    heightU: 8,
    pivotU: { x: 7.5, y: 4 },
  },
  'fx.bird-up': {
    file: 'fx.bird-up.svg',
    widthU: 15,
    heightU: 8,
    pivotU: { x: 7.5, y: 4 },
  },
  'fx.butterfly-a-closed': {
    file: 'fx.butterfly-a-closed.svg',
    widthU: 10,
    heightU: 8,
    pivotU: { x: 5, y: 4 },
  },
  'fx.butterfly-a-open': {
    file: 'fx.butterfly-a-open.svg',
    widthU: 10,
    heightU: 8,
    pivotU: { x: 5, y: 4 },
  },
  'fx.butterfly-b-closed': {
    file: 'fx.butterfly-b-closed.svg',
    widthU: 10,
    heightU: 8,
    pivotU: { x: 5, y: 4 },
  },
  'fx.butterfly-b-open': {
    file: 'fx.butterfly-b-open.svg',
    widthU: 10,
    heightU: 8,
    pivotU: { x: 5, y: 4 },
  },
  'fx.diesel': {
    file: 'fx.diesel.svg',
    widthU: 16,
    heightU: 16,
    pivotU: { x: 8, y: 8 },
  },
  'fx.glint': {
    file: 'fx.glint.svg',
    widthU: 10,
    heightU: 10,
    pivotU: { x: 5, y: 5 },
  },
  'fx.leaf-a': {
    file: 'fx.leaf-a.svg',
    widthU: 10,
    heightU: 7,
    pivotU: { x: 5, y: 3.5 },
  },
  'fx.leaf-b': {
    file: 'fx.leaf-b.svg',
    widthU: 9,
    heightU: 6,
    pivotU: { x: 4.5, y: 3 },
  },
  'fx.leaf-c': {
    file: 'fx.leaf-c.svg',
    widthU: 9,
    heightU: 8,
    pivotU: { x: 4.5, y: 4 },
  },
  'fx.smoke': {
    file: 'fx.smoke.svg',
    widthU: 24,
    heightU: 24,
    pivotU: { x: 12, y: 12 },
  },
  'fx.snow': {
    file: 'fx.snow.svg',
    widthU: 5,
    heightU: 5,
    pivotU: { x: 2.5, y: 2.5 },
  },
  'fx.spark': {
    file: 'fx.spark.svg',
    widthU: 10,
    heightU: 4,
    pivotU: { x: 5, y: 2 },
  },
  'fx.star': {
    file: 'fx.star.svg',
    widthU: 14,
    heightU: 14,
    pivotU: { x: 7, y: 7 },
  },
  'fx.steam': {
    file: 'fx.steam.svg',
    widthU: 24,
    heightU: 24,
    pivotU: { x: 12, y: 12 },
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
  'road.bike-back': {
    file: 'road.bike-back.svg',
    widthU: 16,
    heightU: 30,
    pivotU: { x: 8, y: 30 },
  },
  'road.bike-front': {
    file: 'road.bike-front.svg',
    widthU: 16,
    heightU: 30,
    pivotU: { x: 8, y: 30 },
  },
  'road.car-a-back': {
    file: 'road.car-a-back.svg',
    widthU: 34,
    heightU: 26,
    pivotU: { x: 17, y: 26 },
  },
  'road.car-a-front': {
    file: 'road.car-a-front.svg',
    widthU: 34,
    heightU: 26,
    pivotU: { x: 17, y: 26 },
  },
  'road.car-b-back': {
    file: 'road.car-b-back.svg',
    widthU: 34,
    heightU: 26,
    pivotU: { x: 17, y: 26 },
  },
  'road.car-b-front': {
    file: 'road.car-b-front.svg',
    widthU: 34,
    heightU: 26,
    pivotU: { x: 17, y: 26 },
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

/**
 * Particle and ambient sprites (doc 14 §4, D-014): smoke, steam, exhaust,
 * stars, sparks, leaves, snow, birds, butterflies and water glints. Their
 * pivot is the middle.
 */
export const effectParts: readonly WorldPartKey[] = [
  'fx.smoke',
  'fx.steam',
  'fx.diesel',
  'fx.star',
  'fx.spark',
  'fx.leaf-a',
  'fx.leaf-b',
  'fx.leaf-c',
  'fx.snow',
  'fx.bird-up',
  'fx.bird-down',
  'fx.butterfly-a-open',
  'fx.butterfly-a-closed',
  'fx.butterfly-b-open',
  'fx.butterfly-b-closed',
  'fx.glint',
];

/**
 * Level crossing (doc 05 §4): deck, the tall post behind the track and the
 * low one in front of it (below the train, D-015), boom and lamp glows.
 */
export const crossingParts = {
  deck: 'crossing.deck',
  post: 'crossing.post',
  postLow: 'crossing.post-low',
  boom: 'crossing.boom',
  glowRed: 'crossing.glow-red',
  glowWhite: 'crossing.glow-white',
} as const satisfies Record<string, WorldPartKey>;

/** Lamps and boom hinge on a crossing post, part units from top left. */
export interface CrossingPostAnchors {
  /** The two red lamps, flashing in turn. */
  red: readonly [ArtPoint, ArtPoint];
  /** The white lamp, blinking while the crossing is open. */
  white: ArtPoint;
  /** Where the boom turns. */
  hinge: ArtPoint;
}

/** Lamps and hinges as drawn in the post SVGs. */
export const crossingPostAnchors: Readonly<
  Record<'crossing.post' | 'crossing.post-low', CrossingPostAnchors>
> = {
  'crossing.post': {
    red: [
      { x: 10, y: 34 },
      { x: 24, y: 34 },
    ],
    white: { x: 17, y: 46 },
    hinge: { x: 17, y: 88 },
  },
  'crossing.post-low': {
    red: [
      { x: 10.5, y: 20 },
      { x: 23.5, y: 20 },
    ],
    white: { x: 17, y: 30 },
    hinge: { x: 17, y: 39 },
  },
};

/** Catenary of an electric journey (doc 03 §9): mast and wire span. */
export const catenaryParts = {
  pole: 'catenary.pole',
  span: 'catenary.span',
} as const satisfies Record<string, WorldPartKey>;

/** A mast's foot stands this far behind the rail (back ground depth, u). */
export const CATENARY_POLE_DEPTH_U = 12;

/** Where a mast holds the contact and messenger wires (part units). */
export const catenaryAnchors: Readonly<
  Record<'contact' | 'messenger', ArtPoint>
> = {
  contact: { x: 16, y: 44 },
  messenger: { x: 16, y: 20 },
};

/** Road traffic at crossings, seen from the front and from behind. */
export const roadActorParts: Readonly<
  Record<
    'car-a' | 'car-b' | 'bike',
    { front: WorldPartKey; back: WorldPartKey }
  >
> = {
  'car-a': { front: 'road.car-a-front', back: 'road.car-a-back' },
  'car-b': { front: 'road.car-b-front', back: 'road.car-b-back' },
  bike: { front: 'road.bike-front', back: 'road.bike-back' },
};

/** Backdrops and clouds go to their own, coarser atlas (D-013). */
export function isBackdropPart(key: string): boolean {
  return key.startsWith('backdrop.') || key.startsWith('cloud.');
}
