import { workRoadSupports } from './WorkGeometry.ts';
import { streamBendU, streamHalfWidthU } from './StreamGeometry.ts';
import { propScale, propFootU } from './SceneryGeometry.ts';
import { stationSite } from './Scenery.ts';
import { gameConfig } from '../../config/gameConfig.ts';
import { catenaryPoleXs, catenarySupport } from './Catenary.ts';
import { templateById } from './WorldPlan.ts';
import { contextAt, sceneAt } from './WorldPlan.ts';
import {
  roadBridgeDeck,
  settlementFootpathChunk,
  settlementStreetPlan,
} from './SettlementScenery.ts';
import { settlementSpanAt } from './RoadStretches.ts';
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
/** Ends of a settlement's own foreground footpath that lie on the settlement's outer edge. */
function footpathEdgeEnds(seed: number, sc: ChunkScenery) {
  const span = sc.scene.templateId.startsWith('settlements-')
    ? settlementStreetPlan(seed, sc.chunkIndex * 1024 + 512)
    : undefined;
  if (!span) return [];
  return sc.roads
    .filter(
      (road) =>
        road.layer === 'near' &&
        road.style === 'path' &&
        road.ownerId === sc.scene.id,
    )
    .flatMap((road) =>
      [road.points[0], road.points.at(-1)].flatMap((end) =>
        end && (end.xU <= span.fromXU || end.xU >= span.toXU)
          ? [{ road, end }]
          : [],
      ),
    );
}
/**
 * Ends of foreground (near) paths that stop with width but join nothing: no
 * neighbouring chunk that keeps the footpath, no other path, no own plot and
 * no entrance they serve.
 */
function unconnectedPathEnds(seed: number, sc: ChunkScenery) {
  const x0 = sc.chunkIndex * 1024,
    near = sc.roads.filter((road) => road.layer === 'near');
  return near.flatMap((road) =>
    [road.points[0], road.points.at(-1)].flatMap((end) => {
      if (!end || end.halfWidthU === 0) return [];
      // The neighbour's matching end is checked pairwise by validateFootpathJoin.
      const join =
        road.ownerId === sc.scene.id &&
        ((end.xU === x0 && settlementFootpathChunk(seed, sc.chunkIndex - 1)) ||
          (end.xU === x0 + 1024 &&
            settlementFootpathChunk(seed, sc.chunkIndex + 1)));
      const onPath = near.some(
        (other) => other !== road && pointInside(end, roadPolygon(other)),
      );
      const onPlot = sc.reservations.some(
        (r) =>
          r.purpose === 'parcel' &&
          r.ownerId === road.ownerId &&
          pointInside(end, r.polygon),
      );
      // An access ends at the object whose entrance it serves (e.g. a bed).
      const atEntrance = sc.props.some(
        (p) =>
          Math.abs(x0 + p.xU - end.xU) < 1 &&
          p.relations?.some(
            (link) =>
              link.relation === 'entrance-on-path' &&
              link.reservationId === `${road.id}:reserve:village-road`,
          ),
      );
      return join || onPath || onPlot || atEntrance ? [] : [{ road, end }];
    }),
  );
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
  const ownedRoad = (id: string) =>
    id.includes(':parallel-road') || id.includes(':highway');
  const roadShapes = [
    ...sc.roads
      .filter((road) => ownedRoad(road.id))
      .map((road) => ({ id: road.id, polygon: roadPolygon(road) })),
    ...sc.reservations.filter((r) => ownedRoad(r.id)),
  ];
  for (const shape of roadShapes) {
    const from = Math.min(...shape.polygon.map((p) => p.xU)),
      to = Math.max(...shape.polygon.map((p) => p.xU));
    for (let k = Math.floor(from / 1024); k <= Math.floor(to / 1024); k++) {
      const span = settlementSpanAt(seed, k);
      if (span && from < span.toXU && to > span.fromXU)
        fail(`settlement-road ${shape.id} enters ${span.id}`);
    }
  }
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
  for (const road of sc.roads)
    for (const r of sc.reservations) {
      if (r.layer !== 'both' && r.layer !== (road.layer ?? 'back')) continue;
      if (r.purpose === 'water' && polygonsHit(roadPolygon(road), r.polygon))
        fail(`road-water ${road.id} water=${r.id}`);
      // A street may cross a stream only on its own road bridge.
      const bridge = sc.features.find(
        (f) =>
          f.kind === 'road-bridge' &&
          f.dependencies[0] === road.id &&
          f.dependencies[1] === r.ownerId,
      );
      const dry = bridge
        ? [
            clipPolygonX(roadPolygon(road), -Infinity, bridge.fromXU),
            clipPolygonX(roadPolygon(road), bridge.toXU, Infinity),
          ]
        : [roadPolygon(road)];
      if (
        (road.style !== undefined ||
          road.id.includes(':station:') ||
          road.id.includes(':street:') ||
          road.id.endsWith(':bus-bay')) &&
        ['river', 'tunnel-hill', 'secondary-hill', 'secondary-track'].includes(
          r.purpose,
        ) &&
        dry.some((part) => part.length > 2 && polygonsHit(part, r.polygon))
      )
        fail(`road-infrastructure ${road.id} reserve=${r.id}`);
      if (
        road.style === 'path' &&
        r.purpose === 'parcel' &&
        r.ownerId !== road.ownerId &&
        !sc.props.some(
          (p) =>
            p.id === r.ownerId &&
            p.dependencies?.includes(road.id) &&
            p.relations?.some(
              (link) =>
                link.reservationId === `${road.id}:reserve:village-road` &&
                link.relation === 'entrance-on-path',
            ),
        ) &&
        polygonsHit(roadPolygon(road), r.polygon)
      )
        fail(`access-through-parcel ${road.id} parcel=${r.ownerId}`);
    }
  // D-024: a foreground path ends in a point, a join, another path or its
  // own plot; a flat cap fails anywhere, settlement edges included.
  for (const { road, end } of unconnectedPathEnds(seed, sc))
    fail(`footpath-end ${road.id} x=${end.xU}`);
  // A road bridge deck reaches dry ground on both banks and is reserved as drawn.
  for (const bridge of sc.features.filter((f) => f.kind === 'road-bridge')) {
    const road = sc.roads.find((r) => r.id === bridge.dependencies[0]),
      river = sc.reservations.find(
        (r) => r.purpose === 'river' && r.ownerId === bridge.dependencies[1],
      ),
      deck = sc.reservations.find((r) => r.ownerId === bridge.id),
      xs = river?.polygon.map((p) => p.xU) ?? [];
    if (
      !road ||
      !river ||
      !deck ||
      bridge.fromXU >= Math.min(...xs) ||
      bridge.toXU <= Math.max(...xs) ||
      JSON.stringify(deck.polygon) !==
        JSON.stringify(roadBridgeDeck(road, bridge.fromXU, bridge.toXU))
    )
      fail(`road-bridge-deck ${bridge.id}`);
  }
  // A road or street never stops with width where water lies within 96 u (a
  // stream's reserved half-width) straight ahead: it crosses on a bridge,
  // joins another road or runs off into the horizon. Access paths end at
  // the house, gate or bed they serve; near paths obey footpath-end.
  for (const road of sc.roads.filter((r) => r.style !== 'path'))
    for (const [end, before] of [
      [road.points[0], road.points[1]],
      [road.points.at(-1), road.points.at(-2)],
    ] as const) {
      if (!end || !before || end.halfWidthU === 0) continue;
      if (end.yU <= -railYUpU(seed, end.xU) - 216) continue;
      const dx = end.xU - before.xU,
        dy = end.yU - before.yU,
        length = Math.hypot(dx, dy) || 1;
      const ahead = roadPolygon({
        id: `${road.id}:ahead`,
        ownerId: road.ownerId,
        fromXU: end.xU,
        toXU: end.xU,
        points: [
          end,
          {
            xU: end.xU + (dx / length) * 96,
            yU: end.yU + (dy / length) * 96,
            halfWidthU: end.halfWidthU,
          },
        ],
      });
      const water = sc.reservations.find(
        (r) =>
          (r.purpose === 'river' || r.purpose === 'water') &&
          (r.layer === 'both' || r.layer === (road.layer ?? 'back')) &&
          polygonsHit(ahead, r.polygon),
      );
      if (
        water &&
        !sc.roads.some(
          (other) => other !== road && pointInside(end, roadPolygon(other)),
        )
      )
        fail(`road-water-end ${road.id} x=${end.xU} water=${water.id}`);
    }
  return errors;
}
/** Foreground footpaths of two neighbouring chunks meet at the same full-width points. */
export function validateFootpathJoin(
  seed: number,
  left: ChunkScenery,
  right: ChunkScenery,
): string[] {
  const x = right.chunkIndex * 1024;
  const joins = (sc: ChunkScenery) =>
    sc.roads
      .filter((road) => road.layer === 'near' && road.ownerId === sc.scene.id)
      .flatMap((road) => [road.points[0], road.points.at(-1)])
      .flatMap((p) =>
        p && p.xU === x && p.halfWidthU > 0 ? [`${p.yU}/${p.halfWidthU}`] : [],
      )
      .sort();
  const a = joins(left),
    b = joins(right);
  return a.join() === b.join()
    ? []
    : [
        `seed=${seed} generator=${TRACK_GENERATOR_VERSION} chunk=${left.chunkIndex}/${right.chunkIndex} footpath-join x=${x} left=${a.length} right=${b.length}`,
      ];
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
  for (const station of sc.features.filter((f) => f.kind === 'station')) {
    const site = stationSite(seed, sc.chunkIndex);
    if (
      !site ||
      site.id !== station.id ||
      site.fromXU !== station.fromXU ||
      site.toXU !== station.toXU
    )
      fail(`platform-extent ${station.id}`);
    // Include ramps and both ends, across every chunk, rather than testing a centre.
    for (let x = station.fromXU; x <= station.toXU; x += 8) {
      const k = Math.floor(x / 1024);
      if (
        Math.abs(profileGrade(generateTrackProfile(seed, k), x - k * 1024)) >
        1e-12
      ) {
        fail(`platform-grade ${station.id} x=${x}`);
        break;
      }
    }
    const platform = sc.reservations.find(
      (r) => r.purpose === 'platform' && r.ownerId === station.id,
    );
    if (!platform) fail(`platform-reservation ${station.id}`);
    for (const p of sc.props.filter(
      (p) =>
        p.dependencies?.includes(station.id) &&
        (p.kind.startsWith('back.passenger-') ||
          p.kind === 'back.dispatcher-wave'),
    )) {
      const part = catalog[p.kind];
      if (
        part &&
        (!platform ||
          !rectPolygon(
            projectedBounds(seed, sc.chunkIndex, p, part, true),
          ).every((v) => pointInside(v, platform.polygon)))
      )
        fail(`platform-person ${p.id}`);
    }
  }
  for (const bus of sc.props.filter((p) => p.kind === 'back.bus')) {
    const part = catalog[bus.kind],
      road = sc.roads.find((r) => bus.dependencies?.includes(r.id));
    if (
      !part ||
      !road ||
      !rectPolygon(projectedBounds(seed, sc.chunkIndex, bus, part, true)).every(
        (v) => pointInside(v, roadPolygon(road)),
      )
    )
      fail(`bus-off-road ${bus.id}`);
  }
  for (const group of sc.features.filter((f) => f.kind === 'allotments')) {
    const fence = sc.fences.find((f) => f.ownerId === group.id);
    if (!fence?.closed || fence.gatePanel === undefined) {
      fail(`allotment-boundary ${group.id}`);
      continue;
    }
    const beds = sc.props.filter((p) => p.dependencies?.includes(group.id));
    if (beds.length < 2 || beds.length > 4) fail(`allotment-beds ${group.id}`);
    for (const bed of beds) {
      const part = catalog[bed.kind];
      if (
        !part ||
        !rectPolygon(projectedBounds(seed, sc.chunkIndex, bed, part)).every(
          (p) => pointInside(p, fence.posts),
        )
      )
        fail(`allotment-envelope ${bed.id}`);
    }
    const a = fence.posts[fence.gatePanel],
      b = fence.posts[fence.gatePanel + 1];
    if (
      !a ||
      !b ||
      !sc.roads.some(
        (r) =>
          r.ownerId === group.id &&
          pointInside(
            { xU: (a.xU + b.xU) / 2, yU: (a.yU + b.yU) / 2 },
            roadPolygon(r),
          ),
      )
    )
      fail(`allotment-access ${group.id}`);
    // Bed paths leave the gate path inside the fence and stay inside it.
    const trunk = sc.roads.find((r) => r.id === `${group.id}:entrance`);
    for (const road of sc.roads.filter(
      (r) => r.ownerId === group.id && r.id.endsWith(':bed-access'),
    )) {
      const start = road.points[0];
      if (
        !trunk ||
        !start ||
        !pointInside(start, roadPolygon(trunk)) ||
        !roadPolygon(road).every((p) => pointInside(p, fence.posts))
      )
        fail(`allotment-path-outside ${road.id}`);
    }
  }
  for (const f of sc.features.filter((f) => f.kind === 'house-garden')) {
    const house = sc.props.find((p) => p.id === f.ownerId),
      garden = sc.props.find((p) => p.dependencies?.includes(f.id));
    const h = house && catalog[house.kind],
      g = garden && catalog[garden.kind];
    if (
      !house ||
      !garden ||
      !h ||
      !g ||
      house.layer !== 'back' ||
      garden.layer !== 'back'
    ) {
      fail(`garden-parcel ${f.id}`);
      continue;
    }
    const hb = projectedBounds(seed, sc.chunkIndex, house, h, true),
      gb = projectedBounds(seed, sc.chunkIndex, garden, g, true);
    if (
      !sc.reservations.some(
        (r) =>
          r.purpose === 'parcel' &&
          r.ownerId === house.id &&
          rectPolygon(gb).every((v) => pointInside(v, r.polygon)),
      )
    )
      fail(`garden-parcel-envelope ${f.id}`);
    if (
      Math.abs((hb.leftU + hb.rightU - gb.leftU - gb.rightU) / 2) > 170 ||
      Math.abs(hb.bottomU - gb.bottomU) > 40
    )
      fail(`garden-parcel ${f.id}`);
  }
  for (const p of sc.props) {
    const yard = sc.reservations.find(
      (r) =>
        r.purpose === 'working-yard' &&
        p.relations?.some((link) => link.reservationId === r.id),
    );
    const part = catalog[p.kind];
    if (
      yard &&
      part &&
      !rectPolygon(projectedBounds(seed, sc.chunkIndex, p, part)).every((v) =>
        pointInside(v, yard.polygon),
      )
    )
      fail(`yard-envelope ${p.id}`);
  }
  const supports = new Set([...seen, ...features]);
  for (const p of sc.props)
    for (const id of p.dependencies ?? [])
      if (!supports.has(id)) fail(`dependency ${p.id} missing ${id}`);
  if (
    sc.locality === 'village' ||
    sc.locality === 'town-village' ||
    sc.scene.templateId.startsWith('settlements-')
  )
    for (const p of sc.props.filter((p) => p.kind.startsWith('back.house-')))
      if (
        !sc.roads.some(
          (road) => !road.medianHalfWidthU && p.dependencies?.includes(road.id),
        )
      )
        fail(`house-access ${p.id} has no local road`);
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
      (f.closed ? Math.min(...f.posts.map((p) => p.xU)) : f.posts[0]?.xU) !==
        f.fromXU ||
      (f.closed
        ? Math.max(...f.posts.map((p) => p.xU))
        : f.posts.at(-1)?.xU) !== f.toXU
    )
      fail(`fence endpoints ${f.id}`);
    for (let i = 1; i < f.posts.length + (f.closed ? 1 : 0); i++) {
      const a = f.posts[i - 1],
        b = f.posts[i % f.posts.length];
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
      'settlements-village',
      'settlements-suburb',
      'settlements-street',
      'settlements-yard',
      'settlements-park',
      'settlements-bus',
      'settlements-playground',
      'settlements-allotments',
      'settlements-footpath-end',
      'settlements-footpath-yard',
      'settlements-road-bridge',
      'settlements-footpath-split',
      'station-service-end',
      'station-halt',
      'station-medium',
      'station-big',
      'parallel-road',
      'highway',
    ].map((k) => [k, 0]),
  );
  const chunks = new Map(
    cases.map((c) => [`${c.seed}/${c.scenery.chunkIndex}`, c.scenery]),
  );
  for (const { seed, scenery: sc } of cases) {
    if (
      sc.scene.templateId.startsWith('settlements-') &&
      sc.props.some((p) => p.id.includes(':settlement:'))
    ) {
      const role = sc.scene.templateId.includes('village')
        ? 'village'
        : sc.scene.templateId.slice(12);
      counts[`settlements-${role}`] = (counts[`settlements-${role}`] ?? 0) + 1;
    }
    counts['settlements-allotments'] =
      (counts['settlements-allotments'] ?? 0) +
      sc.features.filter((f) => f.kind === 'allotments').length;
    counts['settlements-road-bridge'] =
      (counts['settlements-road-bridge'] ?? 0) +
      sc.features.filter((f) => f.kind === 'road-bridge').length;
    counts['settlements-footpath-end'] =
      (counts['settlements-footpath-end'] ?? 0) +
      footpathEdgeEnds(seed, sc).filter(({ end }) => end.halfWidthU === 0)
        .length;
    const x0 = sc.chunkIndex * 1024;
    for (const road of sc.roads.filter((r) => r.layer === 'near'))
      for (const end of [road.points[0], road.points.at(-1)]) {
        if (end?.halfWidthU !== 0) continue;
        const motif = road.id.endsWith(':service')
          ? 'station-service-end'
          : road.ownerId !== sc.scene.id
            ? undefined
            : end.xU !== x0 && end.xU !== x0 + 1024
              ? 'settlements-footpath-split'
              : sceneAt(seed, end.xU === x0 ? x0 - 1024 : x0 + 1024)
                    .templateId === 'settlements-yard'
                ? 'settlements-footpath-yard'
                : undefined;
        if (motif) counts[motif] = (counts[motif] ?? 0) + 1;
      }
    for (const station of sc.features.filter((f) => f.kind === 'station')) {
      const motif =
        station.toXU - station.fromXU === 480
          ? 'station-halt'
          : station.toXU - station.fromXU === 1216
            ? 'station-medium'
            : 'station-big';
      counts[motif] = (counts[motif] ?? 0) + 1;
    }
    for (const feature of sc.features)
      if (feature.kind === 'parallel-road' || feature.kind === 'highway')
        counts[feature.kind] = (counts[feature.kind] ?? 0) + 1;
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
      if (p.kind === 'back.bus' && p.dependencies?.length)
        counts['settlements-bus'] = (counts['settlements-bus'] ?? 0) + 1;
      if (p.kind === 'back.playground')
        counts['settlements-playground'] =
          (counts['settlements-playground'] ?? 0) + 1;
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
