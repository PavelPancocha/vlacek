import { unitRandom, hash32 } from './Hash.ts';
import { infrastructureReservations } from './Reservations.ts';
import { crossingSite } from './Crossings.ts';
import { bridgeSite, tunnelSite } from './Structures.ts';
import { sceneAt, templateById } from './WorldPlan.ts';
import {
  boundsHitPolygon,
  railYUpU,
  villageRoad,
  roadPolygon,
  type PointU,
} from './SceneryGeometry.ts';

export interface FenceFeature {
  id: string;
  ownerId: string;
  fromXU: number;
  toXU: number;
  style: 'wood' | 'picket';
  /** Authored foreground gardens use the same complete fence renderer. */
  layer?: 'back' | 'near';
  depth: number;
  /** One whole path; posts are sampled by distance, never by fragment. */
  posts: readonly PointU[];
  /** Enclosed plot: the last panel returns to the first post, without a duplicate post. */
  closed?: boolean;
  gatePanel: number | undefined;
}
export const FENCE_PARTS = {
  wood: {
    post: 'fence.wood-post',
    panel: 'fence.wood-panel',
    gate: 'fence.wood-gate',
  },
  picket: {
    post: 'fence.picket-post',
    panel: 'fence.picket-panel',
    gate: 'fence.picket-gate',
  },
} as const;
function planFenceAt(seed: number, sceneXU: number): FenceFeature | undefined {
  const s = sceneAt(seed, sceneXU);
  if (
    !['pasture', 'hill-pasture', 'village', 'hamlet', 'town-village'].includes(
      s.templateId,
    )
  )
    return undefined;
  const style = ['village', 'hamlet', 'town-village'].includes(s.templateId)
    ? 'picket'
    : 'wood';
  const fromXU = s.fromXU + 768,
    limitXU = fromXU + 512;
  for (let attempt = 0; attempt < 8; attempt++) {
    const depth =
      0.2 + (0.65 * (hash32(seed, 'fences-v2', s.id, attempt) % 1000)) / 1000;
    const posts: PointU[] = [
      { xU: fromXU, yU: -railYUpU(seed, fromXU) - depth * 220 },
    ];
    let distance = 0;
    let last: PointU = {
      xU: fromXU,
      yU: -railYUpU(seed, fromXU) - depth * 220,
    };
    for (let x = fromXU + 4; x <= limitXU && posts.length < 9; x += 4) {
      const next = { xU: x, yU: -railYUpU(seed, x) - depth * 220 };
      let segment = Math.hypot(next.xU - last.xU, next.yU - last.yU);
      while (distance + segment >= 64 && posts.length < 9) {
        const t = (64 - distance) / segment;
        const p: PointU = {
          xU: last.xU + (next.xU - last.xU) * t,
          yU: last.yU + (next.yU - last.yU) * t,
        };
        posts.push(p);
        last = p;
        segment = Math.hypot(next.xU - last.xU, next.yU - last.yU);
        distance = 0;
      }
      distance += segment;
      last = next;
    }
    const end = posts.at(-1);
    if (!end || posts.length !== 9) throw new Error('incomplete fence path');
    const toXU = end.xU;
    const top = Math.min(...posts.map((p) => p.yU)) - 26,
      bottom = Math.max(...posts.map((p) => p.yU)) + 2;
    const bounds = {
      leftU: fromXU - 4,
      rightU: toXU + 4,
      topU: top,
      bottomU: bottom,
    };
    let collision = false;
    for (let k = Math.floor(fromXU / 1024); k <= Math.floor(toXU / 1024); k++) {
      const rs = infrastructureReservations(
        seed,
        k,
        crossingSite(seed, k),
        bridgeSite(seed, k),
        tunnelSite(seed, k),
      );
      if (
        rs.some(
          (r) => r.layer !== 'near' && boundsHitPolygon(bounds, r.polygon),
        )
      ) {
        collision = true;
        break;
      }
    }
    // Reserve every bounded car candidate in both scene chunks. A fragment may
    // never accept a path that its neighbouring fragment would reject.
    const carRule = templateById(s.templateId).rules.findIndex((rule) =>
      rule.kinds.includes('back.car'),
    );
    const rule = templateById(s.templateId).rules[carRule];
    if (rule)
      for (let k = Math.floor(s.fromXU / 1024); k < s.toXU / 1024; k++)
        for (let candidate = 0; candidate < 8; candidate++) {
          const roll = (field: string) =>
            unitRandom(seed, 'placement-v2', k, carRule, 0, candidate, field);
          const range = rule.x ?? [16, 1008];
          const prop = {
            kind: 'back.car',
            layer: 'back' as const,
            xU: range[0] + (range[1] - range[0]) * roll('x'),
            depth:
              rule.depth[0] + (rule.depth[1] - rule.depth[0]) * roll('depth'),
            scale: 1,
            flip: false,
            ...(rule.motion ? { motion: rule.motion } : {}),
          };
          if (
            boundsHitPolygon(
              bounds,
              roadPolygon(
                villageRoad(seed, k, prop, `${s.id}:car:${candidate}`),
                4,
              ),
            )
          )
            collision = true;
        }
    if (!collision)
      return {
        id: `${s.id}:fence:0`,
        ownerId: s.id,
        fromXU,
        toXU,
        style,
        depth,
        posts,
        gatePanel:
          style === 'picket' ? Math.floor(posts.length / 2) : undefined,
      };
  }
  return undefined;
}
export function fencesInChunk(seed: number, k: number): FenceFeature[] {
  const from = k * 1024,
    to = from + 1024,
    s = sceneAt(seed, from),
    f = fenceAt(seed, s.fromXU);
  return f && f.fromXU < to && f.toXU > from ? [f] : [];
}
export function fenceFragmentId(f: FenceFeature, k: number): string {
  return `${f.id}:fragment:${k}`;
}

const fenceCache = new Map<string, FenceFeature | undefined>();
export function fenceAt(
  seed: number,
  sceneXU: number,
): FenceFeature | undefined {
  const scene = sceneAt(seed, sceneXU),
    key = `${seed}/${scene.id}`;
  if (fenceCache.has(key)) return fenceCache.get(key);
  const planned = planFenceAt(seed, sceneXU);
  const fence = planned
    ? Object.freeze({
        ...planned,
        posts: Object.freeze(planned.posts.map((post) => Object.freeze(post))),
      })
    : undefined;
  if (fenceCache.size === 64) {
    const first = fenceCache.keys().next().value;
    if (first !== undefined) fenceCache.delete(first);
  }
  fenceCache.set(key, fence);
  return fence;
}

export function fenceChildId(
  fence: FenceFeature,
  role: 'post' | 'panel' | 'gate',
  index: number,
): string {
  return `${fence.id}:${role}:${index}`;
}
