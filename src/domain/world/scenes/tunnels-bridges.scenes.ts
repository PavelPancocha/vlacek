import { hash32 } from '../Hash.ts';
import { regionAt } from '../Regions.ts';
import { generateTrackProfile, profileGrade } from '../TrackProfile.ts';
import type { LocalityTemplate } from '../sceneryTemplates.ts';

/** Infrastructure is inserted into its host scene, never weighted as a new biome. */
export const scenes: readonly LocalityTemplate[] = [];

export function longTunnelRange(seed: number, ownerChunk: number) {
  const region = regionAt(seed, ownerChunk * 1024);
  if (!['mountains', 'foothills'].includes(region.landscape)) return undefined;
  const fromX = -1024 + 128;
  const length =
    3072 + 256 * (hash32(seed, 'tunnels-v2:length', ownerChunk) % 2);
  const toX = fromX + length;
  if (ownerChunk * 1024 + toX + 170 >= region.toXU) return undefined;
  const startChunk = ownerChunk - 1;
  if (
    Math.abs(profileGrade(generateTrackProfile(seed, startChunk), 128)) < 0.015
  )
    return undefined;
  return { fromX, toX, season: region.season };
}

/** The whole rigid bridge deck must fit an existing constant gentle grade. */
function computeLargeBridgeRange(
  seed: number,
  chunkIndex: number,
  animalX: number | undefined,
) {
  const landscape = regionAt(seed, chunkIndex * 1024).landscape;
  const variant: 'viaduct' | 'steel' | undefined = [
    'mountains',
    'foothills',
  ].includes(landscape)
    ? 'viaduct'
    : landscape === 'lakes'
      ? 'steel'
      : undefined;
  if (!variant) return undefined;
  const profile = generateTrackProfile(seed, chunkIndex);
  const length = variant === 'steel' ? 512 : 640;
  for (let fromX = 96; fromX + length <= 928; fromX += 32) {
    const streamX = fromX + length / 2 + (variant === 'viaduct' ? 80 : 0);
    if (animalX !== undefined && Math.abs(animalX - streamX) <= 192) continue;
    const grade = profileGrade(profile, fromX);
    if (Math.abs(grade) > 0.03) continue;
    let fits = true;
    for (let x = fromX; x <= fromX + length; x += 8)
      if (Math.abs(profileGrade(profile, x) - grade) > 1e-9) fits = false;
    if (fits) return { variant, fromX, toX: fromX + length };
  }
  return undefined;
}

const bridgeCache = new Map<
  string,
  ReturnType<typeof computeLargeBridgeRange>
>();
export function largeBridgeRange(
  seed: number,
  chunkIndex: number,
  animalX: number | undefined,
) {
  const key = `${seed}/${chunkIndex}/${animalX ?? 'none'}`;
  if (bridgeCache.has(key)) return bridgeCache.get(key);
  const result = computeLargeBridgeRange(seed, chunkIndex, animalX);
  if (bridgeCache.size === 128) {
    const first = bridgeCache.keys().next().value;
    if (first !== undefined) bridgeCache.delete(first);
  }
  bridgeCache.set(key, result);
  return result;
}

/** Shared terrain envelope, relative to the true rail; independent of fragment queries. */
export function rockMountainHeightU(
  fromX: number,
  toX: number,
  x: number,
): number {
  const shoulder = Math.min(
    1,
    Math.max(0, Math.min(x - fromX + 170, toX + 170 - x) / 170),
  );
  const t = Math.max(0, Math.min(1, (x - fromX) / (toX - fromX)));
  return 264 * Math.sqrt(shoulder) + 280 * Math.sin(Math.PI * t) ** 2;
}
