import {
  boundsHitPolygon,
  projectedBounds,
  polygonsHit,
  nearDepthScale,
  type BoundsU,
  type PlacementCatalog,
  type ProjectedProp,
} from './SceneryGeometry.ts';
import {
  relationAllows,
  type PlacementRelation,
  type Reservation,
} from './Reservations.ts';
import { contextAt } from './WorldPlan.ts';

export function admissibleKind(
  kind: string,
  seed: number,
  worldXU: number,
  layer: 'back' | 'near' = 'near',
): boolean {
  const context = contextAt(seed, worldXU, layer);
  const seasonal = /-(spring|summer|autumn|winter)$/.exec(kind)?.[1];
  if (seasonal && seasonal !== context.season) return false;
  if (kind === 'near.stubble' && !['summer', 'autumn'].includes(context.season))
    return false;
  if (kind === 'back.combine' && context.season !== 'summer') return false;
  if (kind === 'near.pond' && context.surface === 'sand') return false;
  if (context.season !== 'winter' && kind.includes('snow')) return false;
  if (
    context.surface === 'snow' &&
    (kind.includes('flower') ||
      kind.includes('grass') ||
      kind.includes('fern') ||
      kind.includes('berry'))
  )
    return false;
  if (
    context.region.landscape === 'dunes' &&
    (kind === 'near.shells' ||
      kind === 'near.driftwood' ||
      kind.includes('boat') ||
      kind.includes('reeds'))
  )
    return false;
  return true;
}
export function placementConflict(
  seed: number,
  k: number,
  prop: ProjectedProp,
  catalog: PlacementCatalog,
  reservations: readonly Reservation[],
  relations: readonly PlacementRelation[] = [],
  body?: BoundsU,
): string | undefined {
  const part = catalog[prop.kind];
  if (!part) throw new Error(`missing footprint ${prop.kind}`);
  const contact = projectedBounds(seed, k, prop, part, true);
  const bounds = body ?? projectedBounds(seed, k, prop, part);
  if (
    prop.clip &&
    (contact.leftU >= contact.rightU || contact.topU >= contact.bottomU)
  )
    return undefined;
  for (const r of reservations) {
    if (r.layer !== 'both' && r.layer !== prop.layer) continue;
    if (r.purpose === 'catenary' && prop.depth > 0.1) continue;
    if (
      relations.some(
        (link) =>
          link.reservationId === r.id &&
          relationAllows(r.purpose, link.relation),
      )
    )
      continue;
    const shape =
      r.purpose === 'track' && prop.layer === 'near'
        ? bounds
        : ['crossing-road', 'river'].includes(r.purpose)
          ? { ...contact, leftU: bounds.leftU, rightU: bounds.rightU }
          : contact;
    if (r.purpose === 'river' && prop.layer === 'near') {
      const center =
        (Math.min(...r.polygon.map((p) => p.xU)) +
          Math.max(...r.polygon.map((p) => p.xU))) /
        2;
      const clearance = 96 * nearDepthScale(prop.depth);
      if (
        bounds.leftU < center + clearance &&
        bounds.rightU > center - clearance
      )
        return r.id;
    }
    if (
      prop.clip &&
      prop.kind.startsWith('backdrop.forest-') &&
      r.purpose === 'track' &&
      prop.layer === 'back'
    ) {
      if (polygonsHit(prop.clip, r.polygon)) return r.id;
    } else if (boundsHitPolygon(shape, r.polygon)) return r.id;
  }
  return undefined;
}
export function footprintAdmissible(
  seed: number,
  k: number,
  prop: ProjectedProp,
  catalog: PlacementCatalog,
  body?: BoundsU,
): boolean {
  const part = catalog[prop.kind];
  if (!part) throw new Error(`missing footprint ${prop.kind}`);
  const b = body ?? projectedBounds(seed, k, prop, part);
  // Include both edges and every intermediate scene boundary / narrow subzone.
  for (let x = b.leftU; x <= b.rightU; x += 32)
    if (!admissibleKind(prop.kind, seed, x, prop.layer)) return false;
  return admissibleKind(prop.kind, seed, b.rightU, prop.layer);
}
