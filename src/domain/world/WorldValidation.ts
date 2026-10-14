import { workRoadSupports } from './WorkGeometry.ts';
import { streamBendU, streamHalfWidthU } from './StreamGeometry.ts';
import { propScale, propFootU } from './SceneryGeometry.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import { catenaryPoleXs, catenarySupport } from './Catenary.ts';
import { templateById } from './WorldPlan.ts';
import { contextAt } from './WorldPlan.ts';
import { transitionAt } from './Regions.ts';
import {
  TRACK_GENERATOR_VERSION,
  generateTrackProfile,
  profileGrade,
  profileHeightU,
} from './TrackProfile.ts';
import { footprintAdmissible, placementConflict } from './Placement.ts';
import {
  projectedBounds,
  boundsHitPolygon,
  clipPolygonX,
  polygonsHit,
  roadPolygon,
  waterPolygon,
  railYUpU,
  pointInside,
  rectPolygon,
  waterSectionU,
  waterLevelU,
} from './SceneryGeometry.ts';
import type { ChunkScenery } from './Scenery.ts';
import type { PlacementCatalog } from './SceneryGeometry.ts';
import type { RegionPlan } from './Regions.ts';
export interface WorldDiagnostics {
  generatorVersion: number;
  seed: number;
  worldXU: number;
  regionId: string;
  sceneId: string;
  landscape: RegionPlan['landscape'];
  subzone: string;
  season: RegionPlan['season'];
  weather: RegionPlan['weather'];
  transitionProgress: number;
  logicalFeatures: number;
  renderedFragments: number;
  props: number;
  animatedObjects: number;
}
/** Cheap road/water rules for a broad seeded sweep, independent of decorative prop checks. */
export function validateInfrastructureSurfaces(
  seed: number,
  sc: ChunkScenery,
): string[] {
  const errors: string[] = [];
  const fail = (message: string) =>
    errors.push(
      `seed=${seed} generator=${TRACK_GENERATOR_VERSION} region=${sc.region.id} scene=${sc.scene.id} chunk=${sc.chunkIndex} ${message}`,
    );
  const x0 = sc.chunkIndex * 1024;
  const waters = sc.water.map((w) => ({
    id: w.id,
    polygon: waterPolygon(seed, sc.chunkIndex, w),
  }));
  for (const x of catenaryPoleXs(seed, x0, x0 + 1024)) {
    if (catenarySupport(seed, x) !== 'mast') continue;
    const y = -railYUpU(seed, x) - 12;
    for (const water of waters)
      if (
        boundsHitPolygon(
          { leftU: x - 16, rightU: x + 14, topU: y - 2, bottomU: y + 2 },
          water.polygon,
        )
      )
        fail(`catenary-water pole=${x} water=${water.id}`);
  }
  for (const road of sc.roads)
    for (const r of sc.reservations) {
      if (r.purpose !== 'track') continue;
      const crossing = sc.crossing,
        center = crossing ? sc.chunkIndex * 1024 + crossing.localXU : 0;
      const track =
        road.ownerId === crossing?.id
          ? [
              clipPolygonX(r.polygon, sc.chunkIndex * 1024 - 200, center - 64),
              clipPolygonX(r.polygon, center + 64, sc.chunkIndex * 1024 + 1224),
            ]
          : [r.polygon];
      if (track.some((p) => polygonsHit(roadPolygon(road), p)))
        fail(`unplanned-road-crossing ${road.id} track=${r.id}`);
    }
  return errors;
}
export function validateChunkScenery(
  seed: number,
  sc: ChunkScenery,
  catalog: PlacementCatalog,
): string[] {
  const errors: string[] = [];
  const where = `seed=${seed} generator=${TRACK_GENERATOR_VERSION} region=${sc.region.id} scene=${sc.scene.id} chunk=${sc.chunkIndex}`;
  const fail = (message: string) => errors.push(`${where} ${message}`);
  errors.push(...validateInfrastructureSurfaces(seed, sc));
  const seen = new Set<string>();
  for (const p of sc.props) {
    if (seen.has(p.id)) fail(`duplicate prop ${p.id}`);
    seen.add(p.id);
    if (!catalog[p.kind]) {
      fail(`missing catalog ${p.id}/${p.kind}`);
      continue;
    }
    if (!footprintAdmissible(seed, sc.chunkIndex, p, catalog))
      fail(`context ${p.id}/${p.kind}`);
    const conflict = placementConflict(
      seed,
      sc.chunkIndex,
      p,
      catalog,
      sc.reservations,
      p.relations,
    );
    if (conflict) fail(`collision ${p.id} with ${conflict}`);
    if (
      p.work &&
      p.work !== 'farmer' &&
      !sc.roads.some(
        (r) =>
          r.surface === 'dirt' &&
          (r.layer ?? 'back') === p.layer &&
          p.dependencies?.includes(r.id),
      )
    )
      fail(`dependency machine ${p.id} has no work road`);
    if (p.work && p.work !== 'farmer') {
      const road = sc.roads.find(
        (r) => p.dependencies?.includes(r.id) && r.surface === 'dirt',
      );
      const part = catalog[p.kind];
      if (
        !road ||
        !part ||
        !workRoadSupports(seed, sc.chunkIndex, p, part, road)
      )
        fail(`work-support ${p.id}`);
    }
    if (
      (p.kind === 'animal.woodpecker' || p.kind === 'animal.owl') &&
      !sc.props.some(
        (tree) =>
          tree.kind.startsWith('tree.') &&
          tree.layer === 'back' &&
          p.dependencies?.includes(tree.id),
      )
    )
      fail(`dependency bird ${p.id} has no tree`);
    if (
      p.kind === 'back.footbridge' &&
      (!sc.bridge ||
        !p.dependencies?.includes(sc.bridge.id) ||
        Math.abs(
          p.xU - sc.bridge.localXU - streamBendU(sc.chunkIndex, -p.depth * 220),
        ) > 1e-6)
    )
      fail(`dependency footbridge ${p.id} has no stream`);
    if (p.kind === 'back.footbridge' && sc.bridge) {
      const part = catalog[p.kind];
      if (part) {
        const foot = propFootU(
          p,
          sc.chunkIndex * 1024 + p.xU,
          railYUpU(seed, sc.chunkIndex * 1024 + p.xU),
          0,
        );
        if (part.bankAnchorsU?.length !== 2)
          fail(`footbridge-bank anchors missing ${p.id}`);
        for (const anchor of part.bankAnchorsU ?? []) {
          const y = foot.yU + anchor.yU * propScale(p),
            roadU =
              y + railYUpU(seed, sc.chunkIndex * 1024 + sc.bridge.localXU);
          const centre =
            sc.chunkIndex * 1024 +
            sc.bridge.localXU +
            streamBendU(sc.chunkIndex, roadU);
          if (
            Math.abs(foot.xU + anchor.xU * propScale(p) - centre) <=
            streamHalfWidthU(roadU) + 3
          )
            fail(`footbridge-bank ${p.id}`);
        }
      }
    }
    const supporting = sc.reservations.find(
      (r) =>
        (r.purpose === 'field' || r.purpose === 'forest-floor') &&
        p.dependencies?.includes(r.ownerId),
    );
    if (supporting && p.clip) {
      const min = Math.min(...p.clip.map((v) => v.xU)),
        max = Math.max(...p.clip.map((v) => v.xU));
      const expected = clipPolygonX(supporting.polygon, min, max);
      if (
        expected.length !== p.clip.length ||
        expected.some(
          (v, i) =>
            Math.hypot(
              v.xU - (p.clip?.[i]?.xU ?? Infinity),
              v.yU - (p.clip?.[i]?.yU ?? Infinity),
            ) > 1e-5,
        )
      )
        fail(`surface-clip ${p.id}`);
    }
    if (supporting && !p.clip) {
      const part = catalog[p.kind];
      if (
        part &&
        !rectPolygon(projectedBounds(seed, sc.chunkIndex, p, part, true)).every(
          (v) => pointInside(v, supporting.polygon),
        )
      )
        fail(`surface-envelope ${p.id} support=${supporting.ownerId}`);
    }
  }
  const features = new Set<string>();
  for (const f of sc.features) {
    if (features.has(f.id)) fail(`duplicate feature ${f.id}`);
    features.add(f.id);
    if (!(f.toXU > f.fromXU)) fail(`invalid extent ${f.id}`);
  }
  const supports = new Set([...seen, ...features]);
  for (const p of sc.props)
    for (const id of p.dependencies ?? [])
      if (!supports.has(id)) fail(`dependency ${p.id} missing ${id}`);
  for (const f of sc.features)
    for (const id of f.dependencies)
      if (!supports.has(id)) fail(`dependency ${f.id} missing ${id}`);
  for (const p of sc.props.filter((p) => p.kind.includes('boat'))) {
    const part = catalog[p.kind];
    if (!part) continue;
    const bounds = projectedBounds(seed, sc.chunkIndex, p, part);
    const support = sc.water.find((w) => p.dependencies?.includes(w.id));
    if (!support) {
      fail(`dependency boat ${p.id} has no water`);
      continue;
    }
    const level = waterLevelU(seed, sc.chunkIndex, support);
    if (
      bounds.leftU < sc.chunkIndex * 1024 + support.fromX + 72 ||
      bounds.rightU > sc.chunkIndex * 1024 + support.toX - 72
    )
      fail(`boat envelope outside water ${p.id}/${support.id}`);
    for (const x of [
      p.xU - (p.motion?.rangeU ?? 0) / 2,
      p.xU,
      p.xU + (p.motion?.rangeU ?? 0) / 2,
    ]) {
      const b = projectedBounds(
          seed,
          sc.chunkIndex,
          { ...p, xU: x, motion: { rangeU: 0 } },
          part,
          true,
        ),
        section = waterSectionU(seed, sc.chunkIndex, support, x, level);
      if (b.bottomU < section.topU || b.bottomU > section.bottomU)
        fail(`boat foot outside water ${p.id}/${support.id}`);
    }
  }
  for (const p of sc.props.filter((p) => p.kind === 'back.pier')) {
    const part = catalog[p.kind];
    if (
      !part ||
      !sc.water.some(
        (w) =>
          p.dependencies?.includes(w.id) &&
          boundsHitPolygon(
            projectedBounds(seed, sc.chunkIndex, p, part),
            waterPolygon(seed, sc.chunkIndex, w),
          ),
      )
    )
      fail(`dependency pier ${p.id} has no geometric water contact`);
  }
  for (const p of sc.props.filter((p) => p.kind === 'back.watermill'))
    if (
      !sc.water.some(
        (w) => w.kind === 'channel' && p.dependencies?.includes(w.id),
      )
    )
      fail(`dependency mill ${p.id} has no flowing water`);
  if (
    sc.animal.kind === 'duck' &&
    !sc.props.some((p) => p.kind === 'near.pond')
  )
    fail('dependency duck has no foreground water');
  for (const f of sc.fences) {
    if (
      (f.posts[0]?.xU ?? NaN) !== f.fromXU ||
      (f.posts.at(-1)?.xU ?? NaN) !== f.toXU
    )
      fail(`fence endpoints ${f.id}`);
    for (let i = 1; i < f.posts.length; i++) {
      const a = f.posts[i - 1],
        b = f.posts[i];
      if (!a || !b) continue;
      const distance = Math.hypot(b.xU - a.xU, b.yU - a.yU);
      if (!(distance > 8 && distance <= 64 + 1e-6))
        fail(`fence post spacing ${f.id}/${i}`);
    }
  }
  const a = generateTrackProfile(seed, sc.chunkIndex),
    b = generateTrackProfile(seed, sc.chunkIndex + 1);
  for (const error of validateTrackProfile(a)) fail(error);
  if (
    Math.abs(profileHeightU(a, 1024) - profileHeightU(b, 0)) > 1e-8 ||
    Math.abs(profileGrade(a, 1024) - profileGrade(b, 0)) > 1e-10
  )
    fail('track seam');
  if (
    sc.props.length > 80 ||
    sc.props.filter((p) => p.layer === 'near').length > 48
  )
    fail('prop budget');
  return errors;
}
export function validateWorld(
  cases: readonly { seed: number; scenery: ChunkScenery }[],
  catalog: PlacementCatalog,
): string[] {
  if (cases.length === 0) return ['world validator exercised zero cases'];
  const errors = cases.flatMap((c) =>
    validateChunkScenery(c.seed, c.scenery, catalog),
  );
  for (const seed of new Set(cases.map((c) => c.seed)))
    errors.push(
      ...validateMotifSpacing(
        cases
          .filter((c) => c.seed === seed)
          .flatMap((c) => prominentMotifs(c.scenery)),
      ),
    );
  return errors;
}
export function worldDiagnostics(
  seed: number,
  worldXU: number,
  sceneries: readonly ChunkScenery[],
  renderedChunks: number,
): WorldDiagnostics {
  const context = contextAt(seed, worldXU);
  const logical = new Set(
    sceneries.flatMap((sc) => sc.features.map((f) => f.id)),
  );
  return {
    generatorVersion: TRACK_GENERATOR_VERSION,
    seed,
    worldXU,
    regionId: context.region.id,
    sceneId: context.scene.id,
    landscape: context.region.landscape,
    subzone: context.subzone,
    season: context.season,
    weather: context.weather,
    transitionProgress: transitionAt(seed, worldXU).progress,
    logicalFeatures: logical.size,
    renderedFragments:
      sceneries.reduce((sum, sc) => sum + sc.features.length, 0) +
      renderedChunks,
    props: sceneries.reduce((sum, sc) => sum + sc.props.length, 0),
    animatedObjects: sceneries.reduce(
      (sum, sc) =>
        sum +
        sc.props.filter(
          (p) =>
            p.motion !== undefined ||
            p.kind.startsWith('tree.') ||
            p.kind.includes('grass') ||
            p.kind.includes('flower'),
        ).length,
      0,
    ),
  };
}

export interface ProminentMotif {
  id: string;
  regionId: string;
  sceneId: string;
  kind: 'mill' | 'lighthouse' | 'pond';
  worldXU: number;
}
export function prominentMotifs(sc: ChunkScenery): ProminentMotif[] {
  const props: ProminentMotif[] = sc.props.flatMap((p) => {
    const kind =
      p.kind === 'back.watermill'
        ? 'mill'
        : p.kind === 'back.lighthouse'
          ? 'lighthouse'
          : p.kind === 'near.pond'
            ? 'pond'
            : undefined;
    return kind
      ? [
          {
            id: p.id,
            regionId: sc.region.id,
            sceneId: sc.scene.id,
            kind,
            worldXU: sc.chunkIndex * 1024 + p.xU,
          },
        ]
      : [];
  });
  return [
    ...props,
    ...sc.water
      .filter((w) => w.kind === 'pond')
      .map((w) => ({
        id: w.id,
        regionId: sc.region.id,
        sceneId: sc.scene.id,
        kind: 'pond' as const,
        worldXU: sc.chunkIndex * 1024 + (w.fromX + w.toX) / 2,
      })),
  ];
}
export function validateMotifSpacing(
  motifs: readonly ProminentMotif[],
): string[] {
  const errors: string[] = [];
  const unique = [...new Map(motifs.map((m) => [m.id, m])).values()].sort(
    (a, b) => a.worldXU - b.worldXU,
  );
  const regions = new Set<string>();
  const last = new Map<ProminentMotif['kind'], ProminentMotif>();
  for (const m of unique) {
    const key = `${m.regionId}/${m.kind}`;
    if (m.kind !== 'pond' && regions.has(key))
      errors.push(`repetition ${m.kind} in ${m.regionId}: ${m.id}`);
    regions.add(key);
    const previous = last.get(m.kind),
      minimum = m.kind === 'mill' ? 8192 : m.kind === 'pond' ? 3072 : 0;
    if (previous && m.worldXU - previous.worldXU < minimum)
      errors.push(
        `spacing ${previous.id}/${m.id}: ${m.worldXU - previous.worldXU} < ${minimum}`,
      );
    last.set(m.kind, m);
  }
  return errors;
}

export interface WorldOwnership {
  chunkIndex: number;
  propIds: readonly string[];
  features: ChunkScenery['features'];
}
export function validateOwnership(frames: readonly WorldOwnership[]): string[] {
  const errors: string[] = [];
  const props = new Set<string>(),
    fragments = new Set<string>(),
    features = new Map<string, string>();
  for (const frame of frames) {
    for (const id of frame.propIds) {
      if (props.has(id))
        errors.push(
          `duplicate logical prop ${id} at chunk ${frame.chunkIndex}`,
        );
      props.add(id);
    }
    for (const feature of frame.features) {
      const fragment = `${feature.id}:fragment:${frame.chunkIndex}`;
      if (fragments.has(fragment))
        errors.push(`duplicate fragment ${fragment}`);
      fragments.add(fragment);
      const identity = JSON.stringify(feature),
        prior = features.get(feature.id);
      if (prior !== undefined && prior !== identity)
        errors.push(
          `conflicting ownership ${feature.id} at chunk ${frame.chunkIndex}`,
        );
      features.set(feature.id, identity);
    }
  }
  return errors;
}

/** Positive witnesses prevent invariant checks from passing after a motif disappears. */
export function worldMotifCoverage(
  cases: readonly { seed: number; scenery: ChunkScenery }[],
  catalog: PlacementCatalog,
): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(
    [
      'back.rowboat',
      'back.sailboat',
      'back.fishing-boat',
      'mill-channel',
      'duck-pond',
      'coastal-station',
      'coastal-neighbours',
      'pier-water',
      'farm-tractor',
      'farm-combine',
      'farm-crops',
      'farm-farmer',
      'forest-edge',
      'forest-harvester',
      'forest-forwarder',
      'forest-truck',
      'forest-footbridge',
      'forest-feeding-rack',
      'forest-woodpecker',
      'forest-owl',
    ].map((k) => [k, 0]),
  );
  const chunks = new Map(
    cases.map((c) => [`${c.seed}/${c.scenery.chunkIndex}`, c.scenery]),
  );
  for (const { seed, scenery: sc } of cases) {
    for (const p of sc.props) {
      const motif =
        p.kind === 'back.tractor-work' && p.layer === 'near'
          ? 'farm-tractor'
          : p.kind === 'back.combine'
            ? 'farm-combine'
            : p.kind.includes('crop-rows')
              ? 'farm-crops'
              : p.kind === 'back.farmer-work'
                ? 'farm-farmer'
                : p.kind.startsWith('near.forest-edge-')
                  ? 'forest-edge'
                  : p.kind === 'back.harvester'
                    ? 'forest-harvester'
                    : p.kind === 'back.forwarder'
                      ? 'forest-forwarder'
                      : p.kind === 'back.log-truck'
                        ? 'forest-truck'
                        : p.kind === 'back.footbridge'
                          ? 'forest-footbridge'
                          : p.kind === 'back.feeding-rack'
                            ? 'forest-feeding-rack'
                            : p.kind === 'animal.woodpecker'
                              ? 'forest-woodpecker'
                              : p.kind === 'animal.owl'
                                ? 'forest-owl'
                                : undefined;
      if (motif) counts[motif] = (counts[motif] ?? 0) + 1;
      if (
        p.kind.includes('boat') &&
        sc.water.some((w) => p.dependencies?.includes(w.id))
      )
        counts[p.kind] = (counts[p.kind] ?? 0) + 1;
      if (
        p.kind === 'back.watermill' &&
        sc.water.some(
          (w) => w.kind === 'channel' && p.dependencies?.includes(w.id),
        )
      )
        counts['mill-channel'] = (counts['mill-channel'] ?? 0) + 1;
      const part = catalog[p.kind];
      if (
        p.kind === 'back.pier' &&
        part &&
        sc.water.some(
          (w) =>
            p.dependencies?.includes(w.id) &&
            boundsHitPolygon(
              projectedBounds(seed, sc.chunkIndex, p, part),
              waterPolygon(seed, sc.chunkIndex, w),
            ),
        )
      )
        counts['pier-water'] = (counts['pier-water'] ?? 0) + 1;
    }
    if (
      sc.animal.kind === 'duck' &&
      sc.props.some((p) => p.kind === 'near.pond')
    )
      counts['duck-pond'] = (counts['duck-pond'] ?? 0) + 1;
    if (
      sc.region.landscape === 'coast' &&
      sc.water.some((w) => w.kind === 'sea')
    ) {
      if (sc.locality === 'station')
        counts['coastal-station'] = (counts['coastal-station'] ?? 0) + 1;
      if (
        chunks
          .get(`${seed}/${sc.chunkIndex + 1}`)
          ?.water.some(
            (next) =>
              next.kind === 'sea' && sc.water.some((w) => w.id === next.id),
          )
      )
        counts['coastal-neighbours'] = (counts['coastal-neighbours'] ?? 0) + 1;
    }
  }
  return counts;
}
export function validateTrackProfile(
  profile: import('./TrackProfile.ts').TrackProfile,
): string[] {
  const failures: string[] = [];
  for (let i = 1; i < profile.vertices.length - 1; i++) {
    const a = profile.vertices[i - 1],
      b = profile.vertices[i],
      c = profile.vertices[i + 1];
    if (!a || !b || !c) continue;
    const before = (b.yU - a.yU) / (b.xU - a.xU),
      after = (c.yU - b.yU) / (c.xU - b.xU);
    if (
      before * after < 0 &&
      Math.max(Math.abs(before), Math.abs(after)) >
        gameConfig.world.pantographMaxReversingGrade + 1e-10
    )
      failures.push(
        `pantograph reversal exceeds ${gameConfig.world.pantographMaxReversingGrade}`,
      );
  }
  return failures;
}

/** Region guarantees concern surviving compositions, including station replacement. */
export function validateFarmForestRegions(
  cases: readonly { seed: number; scenery: ChunkScenery }[],
): string[] {
  const regions = new Map<string, { seed: number; chunks: ChunkScenery[] }>(),
    errors: string[] = [];
  for (const c of cases) {
    if (!['countryside', 'forest'].includes(c.scenery.region.landscape))
      continue;
    const key = `${c.seed}/${c.scenery.region.id}`,
      r = regions.get(key) ?? { seed: c.seed, chunks: [] };
    r.chunks.push(c.scenery);
    regions.set(key, r);
  }
  for (const [id, { chunks }] of regions) {
    const region = chunks[0]?.region;
    if (!region) continue;
    const ordered = [
      ...new Map(chunks.map((c) => [c.chunkIndex, c])).values(),
    ].sort((a, b) => a.chunkIndex - b.chunkIndex);
    if (
      ordered.length !== (region.toXU - region.fromXU) / 1024 ||
      ordered[0]?.chunkIndex !== region.fromXU / 1024 ||
      ordered.at(-1)?.chunkIndex !== region.toXU / 1024 - 1
    )
      continue;
    const fail = (why: string) => errors.push(`region ${id} ${why}`),
      ids = new Set(ordered.map((c) => c.locality));
    if (
      !ordered.some(
        (c) =>
          templateById(c.locality).calm &&
          !c.props.some((p) => p.work && p.work !== 'farmer'),
      )
    )
      fail('quiet-interval');
    if (region.landscape === 'countryside') {
      const work = {
        spring: 'sow',
        summer: 'bale',
        autumn: 'plough',
        winter: 'snow-clear',
      }[region.season];
      if (
        !ordered.some(
          (c) =>
            c.chunkIndex * 1024 - region.fromXU < 12288 &&
            c.props.some(
              (p) =>
                p.kind === 'back.tractor-work' &&
                p.layer === 'near' &&
                p.work === work,
            ),
        )
      )
        fail('tractor-season');
      if (
        ['orchard', 'farm', 'pasture', 'farm-forest-pasture'].filter((i) =>
          ids.has(i),
        ).length < 2
      )
        fail('country-variety');
    } else {
      if (
        !ordered.some(
          (c, i) =>
            c.locality === 'farm-forest-dense' &&
            ordered[i + 1]?.locality === 'farm-forest-dense',
        )
      )
        fail('dense-core-2048');
      if (
        [
          'forest',
          'clearing',
          'forest-work',
          'farm-forest-work',
          'lodge',
          'farm-forest-lodge',
        ].filter((i) => ids.has(i)).length < 2
      )
        fail('forest-variety');
      for (const c of ordered.filter(
        (c) => c.locality === 'farm-forest-dense',
      )) {
        const trees = c.props.filter((p) => p.kind.startsWith('tree.')).length;
        if (
          trees < 12 ||
          trees > 20 ||
          new Set(
            c.props
              .filter((p) => p.kind.startsWith('backdrop.forest-dense-'))
              .map((p) => p.depth),
          ).size < 2 ||
          c.props.filter((p) => p.kind.startsWith('near.forest-edge-')).length <
            3
        )
          fail(`dense-layers chunk=${c.chunkIndex}`);
      }
    }
  }
  return errors;
}
