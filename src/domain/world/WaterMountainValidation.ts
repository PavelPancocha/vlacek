import type { ChunkScenery } from './Scenery.ts';
import {
  projectedBounds,
  waterPolygon,
  boundsHitPolygon,
  pointInside,
  railYUpU,
  waterSectionU,
  type PlacementCatalog,
} from './SceneryGeometry.ts';

/** Call with complete scene fragments; an open technical cut always needs its neighbour. */
export function validateWaterMountainScenes(
  seed: number,
  chunks: readonly ChunkScenery[],
): string[] {
  const errors: string[] = [],
    byChunk = new Map(chunks.map((sc) => [sc.chunkIndex, sc]));
  const cableways = new Map<string, number>();
  for (const sc of chunks) {
    cableways.set(
      sc.scene.id,
      (cableways.get(sc.scene.id) ?? 0) +
        sc.props.filter((p) => p.kind === 'back.cableway-tower').length,
    );
    for (const water of sc.water) {
      const span = water.flowSpan;
      if (!span) continue;
      for (const [x, step] of [
        [0, -1],
        [1024, 1],
      ] as const) {
        const worldX = sc.chunkIndex * 1024 + x;
        const section = waterSectionU(seed, sc.chunkIndex, water, x);
        const context = `seed=${seed} generator=2 region=${sc.region.id} scene=${sc.scene.id} chunk=${sc.chunkIndex} river-seam=${worldX}`;
        if (worldX > span.fromXU && worldX < span.toXU) {
          const neighbour = byChunk
            .get(sc.chunkIndex + step)
            ?.water.find((w) => w.id === water.id);
          const other =
            neighbour &&
            waterSectionU(seed, sc.chunkIndex + step, neighbour, 1024 - x);
          if (
            !other ||
            !neighbour?.flowSpan ||
            neighbour.flowSpan.fromXU !== span.fromXU ||
            neighbour.flowSpan.toXU !== span.toXU ||
            section.bottomU - section.topU <= 1e-6 ||
            other.bottomU - other.topU <= 1e-6 ||
            Math.abs(section.topU - other.topU) > 1e-6 ||
            Math.abs(section.bottomU - other.bottomU) > 1e-6
          )
            errors.push(
              `${context} missing, closed or mismatched continuation`,
            );
        } else if (Math.abs(section.bottomU - section.topU) > 1e-6)
          errors.push(`${context} open endpoint`);
      }
    }
  }
  for (const [scene, count] of cableways)
    if (count > 1)
      errors.push(
        `seed=${seed} generator=2 scene=${scene} cableway-owner count=${count}`,
      );
  return errors;
}
/** Check the lane's semantic supports in addition to common reservation/identity checks. */
export function validateWaterMountainComposition(
  seed: number,
  sc: ChunkScenery,
  catalog: PlacementCatalog,
): string[] {
  const errors: string[] = [];
  const fail = (kind: string, id: string) =>
    errors.push(`dependency ${kind} ${id}`);
  for (const p of sc.props) {
    const part = catalog[p.kind];
    if (!part) continue;
    const water = sc.water.find((w) => p.dependencies?.includes(w.id));
    if (
      [
        'near.fisherman',
        'back.fishpond-sluice',
        'near.reed-clump',
        'near.reed-clump-autumn',
        'back.harbour-pier',
        'back.harbour-quay',
      ].includes(p.kind)
    ) {
      if (!water) {
        fail('bank-water', p.id);
        continue;
      }
      const polygon = waterPolygon(seed, sc.chunkIndex, water);
      if (p.kind === 'near.fisherman') {
        const foot = projectedBounds(seed, sc.chunkIndex, p, part, true);
        if (boundsHitPolygon(foot, polygon)) fail('fisherman-wet-bank', p.id);
      } else if (
        !boundsHitPolygon(
          projectedBounds(seed, sc.chunkIndex, p, part),
          polygon,
        )
      )
        fail('shore-contact', p.id);
    }
    if (p.kind === 'back.ferry') {
      if (!water) {
        fail('ferry-water', p.id);
        continue;
      }
      const piers = sc.props.filter(
        (q) =>
          q.kind === 'back.harbour-pier' &&
          p.dependencies?.includes(q.id) &&
          q.dependencies?.includes(water.id),
      );
      if (piers.length !== 2) fail('ferry-landings', p.id);
      const polygon = waterPolygon(seed, sc.chunkIndex, water);
      for (const dx of [-0.5, 0, 0.5]) {
        const foot = projectedBounds(
          seed,
          sc.chunkIndex,
          {
            ...p,
            xU: p.xU + dx * (p.motion?.rangeU ?? 0),
            motion: { rangeU: 0 },
          },
          part,
          true,
        );
        if (
          ![foot.leftU, foot.rightU].every((xU) =>
            [foot.topU, foot.bottomU].every((yU) =>
              pointInside({ xU, yU }, polygon),
            ),
          )
        )
          fail('ferry-envelope', p.id);
      }
    }
    if (p.kind === 'back.excavator') {
      const wall = sc.props.find(
        (q) =>
          q.kind.startsWith('back.quarry-wall') &&
          p.dependencies?.includes(q.id),
      );
      if (!wall) {
        fail('quarry-wall', p.id);
        continue;
      }
      const x = sc.chunkIndex * 1024 + wall.xU;
      if (
        Math.abs((railYUpU(seed, x + 200) - railYUpU(seed, x - 200)) / 400) <
        0.025
      )
        fail('quarry-slope', p.id);
    }
    if (
      p.kind === 'back.water-footbridge' &&
      (!sc.bridge || !p.dependencies?.includes(sc.bridge.id))
    )
      fail('footbridge-stream', p.id);
  }
  return errors;
}
