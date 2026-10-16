import type { ChunkScenery } from './Scenery.ts';
import { bridgeSite, tunnelSite, valleyDepthU } from './Structures.ts';
import { generateTrackProfile, profileGrade } from './TrackProfile.ts';
import { secondarySite } from './SecondaryTrack.ts';
import { biomeAt } from './Biomes.ts';

/** Bounded independent structure sweep; zero coverage is an error. No render dependencies. */
export function validateStructures(seeds: readonly number[], chunks = 480) {
  const errors: string[] = [];
  const coverage = {
    longTunnel: 0,
    stone: 0,
    steel: 0,
    viaduct: 0,
    tunnelSeams: 0,
  };
  for (const seed of seeds)
    for (let b = 0; b < Math.ceil(chunks / 8); b++) {
      const k = b * 8 + 6,
        tunnel = tunnelSite(seed, k);
      const fail = (message: string) =>
        errors.push(`seed=${seed} generator=2 chunk=${k} ${message}`);
      if (tunnel?.rock) {
        coverage.longTunnel++;
        const from = k * 1024 + tunnel.fromX,
          to = k * 1024 + tunnel.toX;
        if (to - from < 3072 || secondarySite(seed, b))
          fail('long tunnel slot/length');
        if (!['mountains', 'foothills'].includes(biomeAt(seed, k).biome))
          fail('rock without mountain host');
        for (
          let chunk = Math.floor(from / 1024);
          chunk <= Math.floor(to / 1024);
          chunk++
        ) {
          const fragment = tunnelSite(seed, chunk);
          if (
            fragment?.id !== tunnel.id ||
            chunk * 1024 + fragment.fromX !== from ||
            chunk * 1024 + fragment.toX !== to
          )
            fail(`discontinuous tunnel at ${chunk}`);
          else coverage.tunnelSeams++;
        }
      }
      const bridge = bridgeSite(seed, b * 8 + 4);
      if (!bridge) continue;
      coverage[bridge.variant ?? 'stone']++;
      if (bridge.fromX === undefined || bridge.toX === undefined) continue;
      const profile = generateTrackProfile(seed, bridge.chunkIndex),
        grade = profileGrade(profile, bridge.fromX);
      for (let x = bridge.fromX; x <= bridge.toX; x += 8)
        if (
          Math.abs(grade) > 0.03 ||
          Math.abs(profileGrade(profile, x) - grade) > 1e-9
        )
          fail('bridge deck outside constant grade');
      if (
        bridge.variant === 'viaduct' &&
        valleyDepthU(seed, bridge.chunkIndex * 1024 + bridge.localXU) < 160
      )
        fail('viaduct without valley');
      const step =
        bridge.variant === 'viaduct' ? 160 : bridge.toX - bridge.fromX;
      for (let x = bridge.fromX; x <= bridge.toX; x += step)
        if (Math.abs(x - bridge.localXU) < 60)
          fail('bridge pier obstructs water');
    }
  for (const [motif, count] of Object.entries(coverage))
    if (!count) errors.push(`zero structure coverage: ${motif}`);
  return { errors, coverage };
}

/** Logical extents describe the complete structure, independently of the render fragment. */
export function validateStructureFeatures(sc: ChunkScenery): string[] {
  const errors: string[] = [],
    x0 = sc.chunkIndex * 1024;
  for (const site of [sc.bridge, sc.tunnel]) {
    if (!site) continue;
    const from =
      'localXU' in site ? (site.fromX ?? site.localXU - 96) : site.fromX;
    const to = 'localXU' in site ? (site.toX ?? site.localXU + 96) : site.toX;
    const feature = sc.features.find((f) => f.id === site.id);
    if (feature?.fromXU !== x0 + from || feature.toXU !== x0 + to)
      errors.push(`chunk=${sc.chunkIndex} structure extent ${site.id}`);
  }
  return errors;
}
