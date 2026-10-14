import type { Season } from './Regions.ts';
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
  /** Named near scene support, accepted before dependent props. */
  surface?: 'field' | 'forest-floor';
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
  nearSurface?: {
    kind: 'field' | 'forest-floor';
    seasons?: readonly Season[];
    depth: readonly [number, number];
  };
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
