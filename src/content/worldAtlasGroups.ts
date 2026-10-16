import { STATION_KINDS } from '../domain/world/Scenery.ts';
import { STATION_SERVICE_KINDS } from '../domain/world/StationScenery.ts';
import { SETTLEMENT_KINDS } from '../domain/world/SettlementScenery.ts';
import { ROAD_STRETCH_KINDS } from '../domain/world/RoadStretches.ts';
import { FENCE_PARTS } from '../domain/world/Fences.ts';
import { snowField } from '../domain/world/scenes/rules.ts';
import { BIOMES, type Biome } from '../domain/world/Biomes.ts';
import type { Season } from '../domain/world/Regions.ts';
import type { ArtPart } from './artManifest.ts';
import { LOCALITIES } from '../domain/world/sceneryTemplates.ts';
import { worldParts, backdropParts, isBackdropPart } from './worldArt.ts';
import { worldAtlasPackageGroups } from './worldAtlasPackageGroups.ts';

export interface WorldAtlasGroup {
  /** Omitted = common base. */
  landscapes?: readonly Biome[];
  /** Omitted = every season. */
  seasons?: readonly Season[];
}
export type GroupedWorldPart = Pick<ArtPart, 'widthU' | 'heightU'> & {
  atlasGroup?: WorldAtlasGroup;
};
// Station service plants/stones follow long stations, road-stretch cars the
// roads beside the track, into any landscape.
const commonKeys = new Set<string>([
  ...STATION_KINDS,
  ...STATION_SERVICE_KINDS,
  ...ROAD_STRETCH_KINDS,
  ...Object.values(FENCE_PARTS).flatMap((style) => Object.values(style)),
]);
const winterForeground = new Set(snowField.flatMap((rule) => rule.kinds));
// Settlement generators place their kinds outside the scene rules, in the
// landscapes of the settlement scenes (village: countryside, town).
const settlementKinds = new Set<string>(SETTLEMENT_KINDS);
const settlementLandscapes = LOCALITIES.filter((scene) =>
  scene.id.startsWith('settlements-'),
).map((scene) => scene.biome);
const stationScene = (key: string) =>
  LOCALITIES.some(
    (scene) =>
      scene.station && scene.rules.some((rule) => rule.kinds.includes(key)),
  );
function placedLandscapes(key: string): Biome[] {
  const landscapes = LOCALITIES.filter((scene) =>
    scene.rules.some((rule) => rule.kinds.includes(key)),
  ).map((scene) => scene.biome);
  for (const biome of BIOMES)
    if (backdropParts[biome].far === key || backdropParts[biome].mid === key)
      landscapes.push(biome);
  if (settlementKinds.has(key)) landscapes.push(...settlementLandscapes);
  return landscapes;
}
/**
 * The renderer substitutes `<kind>-<season>`, `<kind>-snow` and
 * `<kind>-winter-snow` for a placed kind (seasonalFrame, backdropFrames):
 * such a variant appears wherever its base kind does.
 */
function seasonalBase(key: string): string | undefined {
  for (const suffix of [
    /-winter-snow$/,
    /-snow$/,
    /-(spring|summer|autumn|winter)$/,
  ]) {
    const base = key.replace(suffix, '');
    if (base !== key && base in worldParts) return base;
  }
  return undefined;
}
/** Groups the scene rules and generators imply; seasonal variants follow their base below. */
const shippedGroups: Readonly<Record<string, WorldAtlasGroup>> =
  Object.fromEntries(
    Object.keys(worldParts).map((key): [string, WorldAtlasGroup] => {
      if (commonKeys.has(key)) return [key, {}];
      if (winterForeground.has(key)) return [key, { seasons: ['winter'] }];
      if (stationScene(key)) return [key, {}];
      const landscapes = placedLandscapes(key);
      return [
        key,
        landscapes.length ? { landscapes: [...new Set(landscapes)] } : {},
      ];
    }),
  );
const registered: Readonly<Record<string, GroupedWorldPart>> = worldParts;

/** Inferred landscapes; undefined = every landscape. */
function inferredLandscapes(key: string): readonly Biome[] | undefined {
  const own = shippedGroups[key];
  const base = seasonalBase(key);
  const basePart = base === undefined ? undefined : registered[base];
  // Generator-owned common kinds (stations, fences, winter foreground) stay common.
  if (
    base === undefined ||
    !basePart ||
    !own ||
    commonKeys.has(key) ||
    winterForeground.has(key) ||
    stationScene(key)
  )
    return own?.landscapes;
  // A variant is drawn wherever its base is placed, plus its own placements.
  const inherited = worldAtlasGroup(base, basePart).landscapes;
  if (!inherited) return undefined;
  return [...new Set([...(own.landscapes ?? []), ...inherited])];
}

export function worldAtlasGroup(
  key: string,
  part: GroupedWorldPart,
): WorldAtlasGroup {
  if (key.startsWith('fx.')) return {};
  const inferred = shippedGroups[key];
  const packaged = worldAtlasPackageGroups[key];
  if (!part.atlasGroup && !packaged && !inferred)
    throw new RangeError(`unmapped world art ${key}`);
  const landscapes =
    part.atlasGroup?.landscapes ??
    packaged?.landscapes ??
    inferredLandscapes(key);
  const seasons = part.atlasGroup?.seasons ?? packaged?.seasons;
  return {
    ...(landscapes ? { landscapes } : {}),
    ...(seasons ? { seasons } : {}),
  };
}

/**
 * A backdrop band is not drawn in a season whose registered variant
 * `<band>-<season>` replaces it (Backdrop/backdropFrames); coast and dunes
 * always draw their base bands.
 */
function replacedBySeason(
  parts: Readonly<Record<string, unknown>>,
  key: string,
  region: { landscape: Biome; season: Season },
): boolean {
  return (
    key.startsWith('backdrop.') &&
    region.landscape !== 'coast' &&
    region.landscape !== 'dunes' &&
    `${key}-${region.season}` in parts
  );
}

export function worldAtlasKeys(
  parts: Readonly<Record<string, GroupedWorldPart>>,
  regions: readonly { landscape: Biome; season: Season }[],
): string[] {
  return Object.entries(parts).flatMap(([key, part]) => {
    const group = worldAtlasGroup(key, part);
    return regions.some(
      (region) =>
        (!group.landscapes || group.landscapes.includes(region.landscape)) &&
        (!group.seasons || group.seasons.includes(region.season)) &&
        !replacedBySeason(parts, key, region),
    )
      ? [key]
      : [];
  });
}

/**
 * Keys of a distance window of consecutive regions. A region's transition
 * block blends into the next region's climate (D-027 effectiveClimateAt), so
 * props of its landscape may already draw the next season's variants; the
 * backdrop crossfades with each region's own season instead.
 */
export function worldAtlasWindowKeys(
  parts: Readonly<Record<string, GroupedWorldPart>>,
  regions: readonly { landscape: Biome; season: Season }[],
): string[] {
  const selected = new Set(worldAtlasKeys(parts, regions));
  const blended = regions.flatMap((region, i) => {
    const next = regions[i + 1];
    return next && next.season !== region.season
      ? [{ landscape: region.landscape, season: next.season }]
      : [];
  });
  for (const key of worldAtlasKeys(parts, blended))
    if (!isBackdropPart(key)) selected.add(key);
  return Object.keys(parts).filter((key) => selected.has(key));
}
