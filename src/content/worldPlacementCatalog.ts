import { swayAmplitudeRad } from '../render/ambientMotion.ts';
import { farmForestParts } from './world-modules/farm-forest.art.ts';
import { worldParts } from './worldArt.ts';
import type {
  BoundsU,
  PlacementCatalog,
  PlacementPart,
} from '../domain/world/SceneryGeometry.ts';

/** Numerical trust boundary: domain receives validated dimensions, never content imports. */
export function placementCatalog(
  parts: Readonly<
    Record<
      string,
      {
        widthU: number;
        heightU: number;
        pivotU: { x: number; y: number };
        workBoundsU?: BoundsU;
        motionBoundsU?: BoundsU;
      }
    >
  >,
): PlacementCatalog {
  const result: Record<string, PlacementPart> = {};
  for (const [key, part] of Object.entries(parts)) {
    const { widthU, heightU, pivotU } = part;
    if (
      ![widthU, heightU, pivotU.x, pivotU.y].every(Number.isFinite) ||
      widthU <= 0 ||
      heightU <= 0 ||
      pivotU.x < 0 ||
      pivotU.x > widthU ||
      pivotU.y < 0 ||
      pivotU.y > heightU
    )
      throw new Error(`invalid placement art ${key}`);
    if (part.workBoundsU) {
      const b = part.workBoundsU;
      if (
        ![b.leftU, b.rightU, b.topU, b.bottomU].every(Number.isFinite) ||
        b.leftU >= b.rightU ||
        b.topU >= b.bottomU ||
        b.leftU > -pivotU.x ||
        b.rightU < widthU - pivotU.x ||
        b.topU > -pivotU.y ||
        b.bottomU < heightU - pivotU.y
      )
        throw new Error(`invalid work envelope ${key}`);
    }
    const machine = farmForestParts[key];
    const contacts =
      machine?.wheels?.map((w) => ({
        xU: w.atU.x - pivotU.x,
        yU: w.atU.y - pivotU.y + (farmForestParts[w.part]?.heightU ?? 0) / 2,
      })) ?? [];
    if (key === 'back.tractor-work')
      for (const toolKey of ['back.plough', 'back.baler', 'back.snow-blade']) {
        const tool = farmForestParts[toolKey],
          hitch = tool?.anchorsU?.['hitch'],
          anchor =
            machine?.anchorsU?.[
              toolKey === 'back.snow-blade' ? 'frontHitch' : 'rearHitch'
            ];
        if (tool && hitch && anchor)
          for (const x of [0, tool.widthU])
            contacts.push({
              xU: anchor.x - pivotU.x + x - hitch.x,
              yU: anchor.y - pivotU.y + tool.heightU - hitch.y,
            });
      }
    if (key === 'back.combine') contacts.push({ xU: 62, yU: 0 });
    const envelope = part.motionBoundsU;
    if (
      envelope !== undefined &&
      (![
        envelope.leftU,
        envelope.rightU,
        envelope.topU,
        envelope.bottomU,
      ].every(Number.isFinite) ||
        envelope.leftU > -pivotU.x ||
        envelope.rightU < widthU - pivotU.x ||
        envelope.topU > -pivotU.y ||
        envelope.bottomU < heightU - pivotU.y)
    )
      throw new Error(`invalid motion envelope ${key}`);
    result[key] = Object.freeze({
      widthU,
      heightU,
      pivotU: Object.freeze({ xU: pivotU.x, yU: pivotU.y }),
      swayRad: swayAmplitudeRad(key),
      ...(part.workBoundsU
        ? { workBoundsU: Object.freeze({ ...part.workBoundsU }) }
        : {}),
      ...(contacts.length
        ? {
            workContactsU: Object.freeze(contacts.map((c) => Object.freeze(c))),
          }
        : {}),
      ...(machine?.anchorsU?.['leftBank'] && machine.anchorsU['rightBank']
        ? {
            bankAnchorsU: Object.freeze(
              [machine.anchorsU['leftBank'], machine.anchorsU['rightBank']].map(
                (c) => {
                  if (![c.x, c.y].every(Number.isFinite))
                    throw new Error(`invalid bank anchor ${key}`);
                  return Object.freeze({
                    xU: c.x - pivotU.x,
                    yU: c.y - pivotU.y,
                  });
                },
              ),
            ),
          }
        : {}),
      ...(envelope ? { motionBoundsU: Object.freeze({ ...envelope }) } : {}),
      contactWidth:
        key.startsWith('tree.') || key.startsWith('backdrop.forest-')
          ? 0.18
          : 1,
    });
  }
  return Object.freeze(result);
}
export const worldPlacementCatalog = placementCatalog(worldParts);
