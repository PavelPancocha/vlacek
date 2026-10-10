import type { GameConfig } from '../config/gameConfig.ts';
import type {
  Consist,
  LocomotiveDefinition,
  WagonDefinition,
  WagonInstance,
} from '../domain/types.ts';
import { TEST_TRACK_GENERATOR_VERSION } from '../domain/world/TrackProfile.ts';
import type { TrackCursor } from '../domain/world/TrackWindow.ts';

/** Save contracts of doc 08 §6, schema version 1. */
export interface Settings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  reducedEffects: boolean;
  maxSpeedFactor: 0.65 | 1;
  quality: 'auto' | 'low' | 'standard';
}

export interface JourneySave {
  seed: number;
  generatorVersion: number;
  consist: Consist;
  head: TrackCursor;
  simulationTick: number;
  /** Runtime scene components; 0.1 has none to restore and stores []. */
  activeEntities: [];
}

export interface SaveEnvelopeV1 {
  schemaVersion: 1;
  contentVersion: 1;
  savedAtIso: string;
  appBuildId: string;
  settings: Settings;
  lastConsist: Consist;
  builderDraft?: Consist;
  journey?: JourneySave;
}

export const defaultSettings: Settings = {
  sfxEnabled: true,
  musicEnabled: false,
  reducedEffects: false,
  maxSpeedFactor: 1,
  quality: 'auto',
};

export interface SaveRules {
  maxBytes: number;
  maxWagons: number;
  maxRuntimeComponents: number;
  locomotiveIds: ReadonlySet<string>;
  wagonIds: ReadonlySet<string>;
  /** Generator versions this build can continue (0.1: provisional v0). */
  generatorVersions: ReadonlySet<number>;
}

export type ParseResult =
  | { status: 'valid'; save: SaveEnvelopeV1 }
  | { status: 'invalid'; reason: string }
  | { status: 'newer'; schemaVersion: number };

/**
 * Upper bound of the schema 1 wagon list. Version 0.1 allowed 100 wagons; the
 * length limit of doc 14 is a game rule, not a format change, so older and
 * longer saves stay readable and keep every wagon.
 */
export const SAVE_V1_MAX_WAGONS = 100;

export function saveRules(
  config: GameConfig,
  locomotives: readonly LocomotiveDefinition[],
  wagons: readonly WagonDefinition[],
): SaveRules {
  return {
    maxBytes: config.save.maxBytes,
    maxWagons: SAVE_V1_MAX_WAGONS,
    maxRuntimeComponents: config.save.maxRuntimeComponents,
    locomotiveIds: new Set(locomotives.map((loco) => loco.id)),
    wagonIds: new Set(wagons.map((wagon) => wagon.id)),
    generatorVersions: new Set([TEST_TRACK_GENERATOR_VERSION]),
  };
}

class Invalid extends Error {}

const MAX_TEXT = 64;
/** Far beyond any real ride, small enough that chunk x stays exact. */
const MAX_CHUNK_INDEX = 1_000_000_000;
const INSTANCE_ID = /^[A-Za-z0-9_-]{1,32}$/;

type Json = Record<string, unknown>;

function object(value: unknown, path: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Invalid(`${path}: object expected`);
  }
  return value as Json;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > MAX_TEXT) {
    throw new Invalid(`${path}: short string expected`);
  }
  return value;
}

function bool(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean')
    throw new Invalid(`${path}: boolean expected`);
  return value;
}

function integer(
  value: unknown,
  path: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Invalid(`${path}: integer in [${min}, ${max}] expected`);
  }
  return value;
}

function finite(
  value: unknown,
  path: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Invalid(`${path}: number in [${min}, ${max}] expected`);
  }
  return value;
}

function oneOf<T extends string | number>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined)
    throw new Invalid(`${path}: one of ${allowed.join(', ')} expected`);
  return match;
}

function settings(value: unknown): Settings {
  const raw = object(value, 'settings');
  return {
    sfxEnabled: bool(raw['sfxEnabled'], 'settings.sfxEnabled'),
    musicEnabled: bool(raw['musicEnabled'], 'settings.musicEnabled'),
    reducedEffects: bool(raw['reducedEffects'], 'settings.reducedEffects'),
    maxSpeedFactor: oneOf(
      raw['maxSpeedFactor'],
      [0.65, 1] as const,
      'settings.maxSpeedFactor',
    ),
    quality: oneOf(
      raw['quality'],
      ['auto', 'low', 'standard'] as const,
      'settings.quality',
    ),
  };
}

function consist(value: unknown, path: string, rules: SaveRules): Consist {
  const raw = object(value, path);
  const locomotiveId = text(raw['locomotiveId'], `${path}.locomotiveId`);
  if (!rules.locomotiveIds.has(locomotiveId))
    throw new Invalid(`${path}: unknown locomotive`);
  const list = raw['wagons'];
  if (!Array.isArray(list) || list.length > rules.maxWagons) {
    throw new Invalid(`${path}.wagons: at most ${rules.maxWagons} expected`);
  }
  const seen = new Set<string>();
  const wagons = list.map((item: unknown, index): WagonInstance => {
    const at = `${path}.wagons[${index}]`;
    const wagon = object(item, at);
    const instanceId = text(wagon['instanceId'], `${at}.instanceId`);
    if (!INSTANCE_ID.test(instanceId) || seen.has(instanceId)) {
      throw new Invalid(`${at}.instanceId: unique simple id expected`);
    }
    seen.add(instanceId);
    const definitionId = text(wagon['definitionId'], `${at}.definitionId`);
    if (!rules.wagonIds.has(definitionId))
      throw new Invalid(`${at}: unknown wagon type`);
    return {
      instanceId,
      definitionId,
      visualSeed: integer(
        wagon['visualSeed'],
        `${at}.visualSeed`,
        0,
        0xffffffff,
      ),
    };
  });
  return { locomotiveId, wagons };
}

function journey(value: unknown, rules: SaveRules): JourneySave {
  const raw = object(value, 'journey');
  const generatorVersion = integer(
    raw['generatorVersion'],
    'journey.generatorVersion',
    0,
    1_000,
  );
  if (!rules.generatorVersions.has(generatorVersion)) {
    throw new Invalid('journey.generatorVersion: unsupported');
  }
  const head = object(raw['head'], 'journey.head');
  const entities = raw['activeEntities'];
  if (
    !Array.isArray(entities) ||
    entities.length > rules.maxRuntimeComponents
  ) {
    throw new Invalid('journey.activeEntities: bounded list expected');
  }
  return {
    seed: integer(raw['seed'], 'journey.seed', 0, 0xffffffff),
    generatorVersion,
    consist: consist(raw['consist'], 'journey.consist', rules),
    head: {
      chunkIndex: integer(
        head['chunkIndex'],
        'journey.head.chunkIndex',
        -MAX_CHUNK_INDEX,
        MAX_CHUNK_INDEX,
      ),
      // Exact chunk length is checked when the track is rebuilt on restore.
      arcOffsetU: finite(
        head['arcOffsetU'],
        'journey.head.arcOffsetU',
        0,
        4096,
      ),
    },
    simulationTick: integer(
      raw['simulationTick'],
      'journey.simulationTick',
      0,
      Number.MAX_SAFE_INTEGER,
    ),
    // 0.1 restores no runtime scene components; entries are dropped (doc 08 §5).
    activeEntities: [],
  };
}

/**
 * Runtime validation of untrusted stored JSON (doc 08 §7). Never throws.
 * Returns a freshly built object containing only known, checked fields.
 */
export function parseSave(json: string, rules: SaveRules): ParseResult {
  if (json.length > rules.maxBytes)
    return { status: 'invalid', reason: 'too large' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { status: 'invalid', reason: 'not JSON' };
  }
  try {
    const raw = object(parsed, 'save');
    const schemaVersion = integer(
      raw['schemaVersion'],
      'schemaVersion',
      0,
      Number.MAX_SAFE_INTEGER,
    );
    if (schemaVersion > 1) return { status: 'newer', schemaVersion };
    if (schemaVersion !== 1) throw new Invalid('schemaVersion: unknown');
    if (raw['contentVersion'] !== 1)
      throw new Invalid('contentVersion: unsupported');
    const save: SaveEnvelopeV1 = {
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: text(raw['savedAtIso'], 'savedAtIso'),
      appBuildId: text(raw['appBuildId'], 'appBuildId'),
      settings: settings(raw['settings']),
      lastConsist: consist(raw['lastConsist'], 'lastConsist', rules),
    };
    if (raw['builderDraft'] !== undefined) {
      save.builderDraft = consist(raw['builderDraft'], 'builderDraft', rules);
    }
    if (raw['journey'] !== undefined)
      save.journey = journey(raw['journey'], rules);
    return { status: 'valid', save };
  } catch (error) {
    if (error instanceof Invalid)
      return { status: 'invalid', reason: error.message };
    throw error;
  }
}
