import { animalParts } from '../../../src/content/worldArt.ts';
import {
  polygonsHit,
  projectedBounds,
} from '../../../src/domain/world/SceneryGeometry.ts';
import { sceneAt } from '../../../src/domain/world/WorldPlan.ts';
import { snowField } from '../../../src/domain/world/scenes/rules.ts';
import { worldPlacementCatalog } from '../../../src/content/worldPlacementCatalog.ts';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { biomeAt } from '../../../src/domain/world/Biomes.ts';
import { chunkObjects } from '../../../src/domain/world/ChunkObjects.ts';
import {
  WATER_END_U,
  chunkScenery,
  propDrawOrder,
  type ChunkScenery,
} from '../../../src/domain/world/Scenery.ts';
import { LOCALITIES } from '../../../src/domain/world/sceneryTemplates.ts';
import {
  BRIDGE_RESERVE_U,
  bridgeSite,
  tunnelSite,
} from '../../../src/domain/world/Structures.ts';
import {
  generateTrackProfile,
  profileGrade,
} from '../../../src/domain/world/TrackProfile.ts';

const { chunkWidthU, chunksPerBiomeBlock } = gameConfig.world;
const SEEDS = [1, 7, 123, 4242];
const CHUNKS = Array.from({ length: 160 }, (_, i) => i - 16);

const samples = SEEDS.flatMap((seed) =>
  CHUNKS.map((k) => ({
    seed,
    scenery: chunkScenery(seed, k, worldPlacementCatalog),
  })),
);
function each(callback: (scenery: ChunkScenery, seed: number) => void): void {
  for (const { seed, scenery } of samples) callback(scenery, seed);
}

const BOATS = new Set(['back.rowboat', 'back.sailboat', 'back.fishing-boat']);
/** Boats sail, reeds grow at the shore, the pier reaches into the water. */
const ON_WATER = new Set([...BOATS, 'back.reeds', 'back.pier']);

const template = (id: string) => LOCALITIES.find((t) => t.id === id);
const kindsOf = (id: string) =>
  new Set(template(id)?.rules.flatMap((rule) => rule.kinds) ?? []);

describe('chunkScenery: logical localities along the track (doc 14 §5)', () => {
  it.each(SEEDS)(
    'is deterministic, with stable unique prop ids: seed %i',
    (seedUnderTest) => {
      const ids = new Set<string>();
      for (const { scenery, seed } of samples.filter(
        (sample) => sample.seed === seedUnderTest,
      )) {
        expect(
          chunkScenery(seed, scenery.chunkIndex, worldPlacementCatalog),
        ).toEqual(scenery);
        for (const prop of scenery.props) {
          expect(prop.id).toMatch(
            new RegExp(
              `^g\\d+:chunk:${scenery.chunkIndex}:prop:(rule:\\d+|station|perch|footbridge):candidate:\\d+$`,
            ),
          );
          const key = `${seed}/${prop.id}`;
          expect(ids.has(key), key).toBe(false);
          ids.add(key);
        }
      }
    },
  );

  it('follows its region and ordered scene plan, with station reservations taking precedence', () => {
    each((scenery, seed) => {
      const place = biomeAt(seed, scenery.chunkIndex);
      expect(scenery.biome).toBe(place.biome);
      expect(scenery.slot).toBe(place.slot);
      expect(scenery.scene).toEqual(sceneAt(seed, scenery.chunkIndex * 1024));
      if (scenery.locality !== 'station')
        expect(scenery.locality).toBe(scenery.scene.templateId);
    });
  });

  it('places only props of its locality: reeds by water, barns on farms', () => {
    each((scenery) => {
      const chosen = template(scenery.locality);
      if (!chosen || chosen.station) return;
      if (scenery.slot === chunksPerBiomeBlock - 1) return;
      const kinds = kindsOf(scenery.locality);
      if (scenery.region.season === 'winter')
        for (const kind of snowField.flatMap((r) => r.kinds)) kinds.add(kind);
      for (const prop of scenery.props) {
        if (prop.kind === 'animal.woodpecker' || prop.kind === 'animal.owl') {
          expect(prop.layer).toBe('back');
          expect(
            scenery.props.some(
              (tree) =>
                tree.kind.startsWith('tree.') &&
                prop.dependencies?.includes(tree.id),
            ),
          ).toBe(true);
          continue;
        }
        if (prop.kind === 'back.footbridge') {
          expect(prop.dependencies).toEqual([scenery.bridge?.id]);
          continue;
        }
        expect(kinds.has(prop.kind), `${scenery.locality}: ${prop.kind}`).toBe(
          true,
        );
      }
    });
    for (const locality of LOCALITIES) {
      const kinds = [...kindsOf(locality.id)];
      const water = locality.water !== undefined || kinds.includes('near.pond');
      if (kinds.some((kind) => kind.includes('reeds')))
        expect(water, locality.id).toBe(true);
      if (kinds.includes('back.barn')) expect(locality.id).toBe('farm');
    }
  });

  it('keeps boats on level water basins, also where they sail to', () => {
    let boats = 0;
    each((scenery) => {
      for (const basin of scenery.water) {
        expect(basin.toX - basin.fromX).toBeGreaterThan(2 * WATER_END_U);
        expect(basin.nearDepth).toBeLessThan(basin.farDepth);
      }
      for (const prop of scenery.props) {
        if (!BOATS.has(prop.kind)) continue;
        boats += 1;
        const reach = (prop.motion?.rangeU ?? 0) / 2;
        const afloat = scenery.water.some(
          (basin) =>
            prop.xU - reach >= basin.fromX + WATER_END_U &&
            prop.xU + reach <= basin.toX - WATER_END_U &&
            prop.depth > basin.nearDepth &&
            prop.depth < basin.farDepth,
        );
        expect(afloat, `${scenery.locality}: ${prop.id} ${prop.kind}`).toBe(
          true,
        );
      }
    });
    expect(boats).toBeGreaterThan(0);
  });

  it('stands houses, trees and the lighthouse on land, not in the water', () => {
    each((scenery) => {
      for (const prop of scenery.props) {
        if (prop.layer !== 'back' || ON_WATER.has(prop.kind)) continue;
        const inWater = scenery.water.some(
          (basin) =>
            prop.xU > basin.fromX + WATER_END_U / 2 &&
            prop.xU < basin.toX - WATER_END_U / 2 &&
            prop.depth > basin.nearDepth &&
            prop.depth < basin.farDepth,
        );
        expect(inWater, `${scenery.locality}: ${prop.kind}`).toBe(false);
      }
    });
  });

  it('puts at most one station per block, in slot 1 or 2, on a flat track', () => {
    let stations = 0;
    for (const seed of SEEDS) {
      for (let b = -2; b < 20; b++) {
        const inBlock = Array.from(
          { length: chunksPerBiomeBlock },
          (_, s) =>
            samples.find(
              (sample) =>
                sample.seed === seed &&
                sample.scenery.chunkIndex === b * chunksPerBiomeBlock + s,
            )?.scenery ??
            chunkScenery(
              seed,
              b * chunksPerBiomeBlock + s,
              worldPlacementCatalog,
            ),
        ).filter((scenery) => template(scenery.locality)?.station);
        expect(inBlock.length).toBeLessThanOrEqual(1);
        for (const station of inBlock) {
          stations += 1;
          expect([1, 2]).toContain(station.slot);
          const platform = station.props.find(
            (prop) => prop.kind === 'back.platform',
          );
          if (!platform) throw new Error('station without platform');
          const profile = generateTrackProfile(seed, station.chunkIndex);
          for (let x = platform.xU - 200; x <= platform.xU + 200; x += 8)
            expect(Math.abs(profileGrade(profile, x)), `x ${x}`).toBeLessThan(
              1e-9,
            );
        }
      }
    }
    // Flats are common enough that most worlds have stations.
    expect(stations).toBeGreaterThan(20);
  });

  it('keeps near props bounded and clear of the interactive animal', () => {
    let nearTotal = 0;
    let chunks = 0;
    each((scenery, seed) => {
      // Budget measured with the longest train (D-013).
      expect(scenery.props.length).toBeLessThanOrEqual(80);
      const near = scenery.props.filter((prop) => prop.layer === 'near');
      expect(near.length).toBeLessThanOrEqual(48);
      nearTotal += near.length;
      chunks += 1;
      const animalX = chunkObjects(seed, scenery.chunkIndex)[0]?.localXU ?? 0;
      const next = LOCALITIES.find(
        (t) => t.biome === biomeAt(seed, scenery.chunkIndex).next && t.calm,
      );
      const rules = [
        ...(template(scenery.locality)?.rules ?? []),
        ...(scenery.slot === chunksPerBiomeBlock - 1
          ? (next?.rules ?? [])
          : []),
      ];
      const around = new Set(
        rules
          .filter((rule) => rule.aroundAnimalU !== undefined)
          .flatMap((rule) => rule.kinds),
      );
      for (const prop of near) {
        if (around.has(prop.kind)) continue;
        if (prop.clip) {
          const part = worldPlacementCatalog[prop.kind];
          const animalPart =
            worldPlacementCatalog[animalParts[scenery.animal.kind]];
          if (!part || !animalPart) throw new Error('missing numerical art');
          const b = projectedBounds(seed, scenery.chunkIndex, prop, part);
          const a = projectedBounds(
            seed,
            scenery.chunkIndex,
            {
              kind: animalParts[scenery.animal.kind],
              layer: 'near',
              xU: animalX,
              depth: scenery.animal.depth,
              scale: 2,
              flip: false,
            },
            animalPart,
          );
          // A coherent clipped row/edge is judged by its visible 2D body, not its tile pivot.
          expect(
            b.rightU <= a.leftU ||
              b.leftU >= a.rightU ||
              b.bottomU <= a.topU ||
              b.topU >= a.bottomU,
            `${seed}/${scenery.chunkIndex}/${prop.id} animal body`,
          ).toBe(true);
          continue;
        }
        expect(Math.abs(prop.xU - animalX), prop.kind).toBeGreaterThanOrEqual(
          60,
        );
      }
      for (const prop of scenery.props) {
        if (prop.clip) {
          // A continuous group's anchor can precede this chunk, but all visible pixels belong to it.
          const part = worldPlacementCatalog[prop.kind];
          if (!part) throw new Error('missing composition art');
          const b = projectedBounds(seed, scenery.chunkIndex, prop, part);
          expect(b.leftU).toBeGreaterThanOrEqual(
            scenery.chunkIndex * chunkWidthU,
          );
          expect(b.rightU).toBeLessThanOrEqual(
            (scenery.chunkIndex + 1) * chunkWidthU,
          );
          expect(b.rightU).toBeGreaterThan(b.leftU);
        } else {
          expect(prop.xU).toBeGreaterThanOrEqual(0);
          expect(prop.xU).toBeLessThanOrEqual(chunkWidthU);
        }
        expect(prop.depth).toBeGreaterThanOrEqual(0);
        expect(prop.depth).toBeLessThanOrEqual(1);
      }
    });
    // The near meadow is never bare (doc 14 §5): about two dozen per chunk.
    expect(nearTotal / chunks).toBeGreaterThan(20);
  });

  it('gives the animal a fitting species; ducks swim on their pond', () => {
    each((scenery, seed) => {
      const species = new Set(template(scenery.locality)?.animals);
      if (scenery.slot === chunksPerBiomeBlock - 1) {
        // The transition chunk's animal may belong to the next biome.
        const next = biomeAt(seed, scenery.chunkIndex).next;
        for (const kind of LOCALITIES.find((t) => t.biome === next && t.calm)
          ?.animals ?? [])
          species.add(kind);
      }
      if (scenery.animal.kind !== 'frog')
        expect([...species]).toContain(scenery.animal.kind);
      if (scenery.animal.kind === 'duck')
        expect(scenery.props.some((p) => p.kind === 'near.pond')).toBe(true);
      const pond = scenery.props.find((prop) => prop.kind === 'near.pond');
      if (!pond) return;
      const animalX = chunkObjects(seed, scenery.chunkIndex)[0]?.localXU ?? 0;
      expect(pond.xU).toBeCloseTo(animalX, 9);
      // The animal stands a little behind the pond's near edge, on it.
      expect(scenery.animal.depth).toBeLessThan(pond.depth);
      expect(scenery.animal.depth).toBeGreaterThan(pond.depth - 0.1);
    });
  });

  it('keeps secondary track clearance and the actual 380-u portal hills free', () => {
    let guarded = 0;
    each((scenery) => {
      if (
        !scenery.reservations.some(
          (r) =>
            r.purpose === 'secondary-track' || r.purpose === 'secondary-hill',
        )
      )
        return;
      guarded++;
      for (const basin of scenery.water)
        expect(basin.nearDepth).toBeGreaterThanOrEqual(0.45);
    });
    expect(guarded).toBeGreaterThan(20);
  });

  it('keeps the stream under each bridge clear and names its bridge and tunnel (doc 03 §8)', () => {
    let bridges = 0;
    each((scenery, seed) => {
      expect(scenery.bridge).toEqual(bridgeSite(seed, scenery.chunkIndex));
      expect(scenery.tunnel).toEqual(tunnelSite(seed, scenery.chunkIndex));
      const site = scenery.bridge;
      if (!site) return;
      bridges += 1;
      const c = site.localXU;
      for (const prop of scenery.props) {
        if (prop.kind === 'back.footbridge') {
          expect(prop.layer).toBe('back');
          expect(prop.dependencies).toContain(site.id);
          expect(
            prop.relations?.some((r) => r.relation === 'bridge-over-river'),
          ).toBe(true);
          continue;
        }
        if (prop.clip) {
          for (const river of scenery.reservations.filter(
            (r) => r.purpose === 'river',
          ))
            expect(polygonsHit(prop.clip, river.polygon), prop.id).toBe(false);
          continue;
        }
        const reach = (prop.motion?.rangeU ?? 0) / 2;
        // The stream widens towards the viewer like the near props grow.
        const keep =
          prop.layer === 'near'
            ? BRIDGE_RESERVE_U * (1 + 0.5 * prop.depth)
            : BRIDGE_RESERVE_U;
        expect(Math.abs(prop.xU - c), prop.id).toBeGreaterThanOrEqual(
          keep + reach,
        );
      }
      for (const basin of scenery.water)
        expect(
          basin.toX <= c - BRIDGE_RESERVE_U ||
            basin.fromX >= c + BRIDGE_RESERVE_U,
        ).toBe(true);
    });
    expect(bridges).toBeGreaterThan(10);
  });

  it('covers the whole chunk with near and back ground', () => {
    each((scenery) => {
      for (const spans of [scenery.near, scenery.back]) {
        expect(spans[0]?.fromX).toBe(0);
        expect(spans.at(-1)?.toX).toBe(chunkWidthU);
        for (const [i, span] of spans.entries()) {
          expect(span.toX).toBeGreaterThan(span.fromX);
          if (i > 0) expect(span.fromX).toBe(spans[i - 1]?.toX);
        }
      }
    });
  });

  it('shows varied places over the complete 60-block route cycle', () => {
    const seen = new Set<string>();
    for (const seed of SEEDS)
      for (let k = 0; k < 480; k++)
        seen.add(sceneAt(seed, k * 1024).templateId);
    seen.add('station');
    expect(seen.size).toBeGreaterThanOrEqual(14);
  });

  it('draws each layer from far to near, so nearer props cover farther ones', () => {
    // Seed 0 chunk 7 mixes back and near props (Codex review PR #2).
    for (const [seed, k] of [
      [0, 7],
      [7, 3],
      [123, 12],
      [2026, 40],
    ] as const) {
      const ordered = propDrawOrder(
        chunkScenery(seed, k, worldPlacementCatalog).props,
      );
      const back = ordered.filter((prop) => prop.layer === 'back');
      const near = ordered.filter((prop) => prop.layer === 'near');
      for (let i = 1; i < back.length; i++)
        expect(
          back[i]?.depth ?? 0,
          `${seed}/${k} back ${i}`,
        ).toBeLessThanOrEqual(back[i - 1]?.depth ?? 0);
      for (let i = 1; i < near.length; i++)
        expect(
          near[i]?.depth ?? 0,
          `${seed}/${k} near ${i}`,
        ).toBeGreaterThanOrEqual(near[i - 1]?.depth ?? 0);
    }
  });
});
