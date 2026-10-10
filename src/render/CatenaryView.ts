import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig.ts';
import {
  CATENARY_POLE_DEPTH_U,
  catenaryAnchors,
  catenaryParts,
  worldParts,
} from '../content/worldArt.ts';
import {
  heightAtX,
  type ArcLengthTable,
} from '../domain/world/ArcLengthTable.ts';
import { catenaryPoleXs, catenarySupport } from '../domain/world/Catenary.ts';
import { frameOrigin } from './atlasPacking.ts';

const { chunkWidthU, catenaryPoleSpacingU, catenaryContactHeightU } =
  gameConfig.world;

export interface CatenaryArt {
  texture: string;
  pxPerU: number;
}

/** Masts stand behind the train; the wires hang above it (doc 07 §3). */
export interface CatenaryDepths {
  poles: number;
  wires: number;
}

/** A chunk's catenary: its game objects, chunk-local, and its masts. */
export interface ChunkCatenary {
  containers: Phaser.GameObjects.Container[];
  poles: number;
}

/**
 * The catenary of one chunk of an electric journey (doc 03 §9): a mast at
 * each pole of the chunk and the wire span from it to the next pole, which
 * may stand in the next chunk. The wire is attached at the pole's x, where
 * `contactWireHeightU` holds it, so the pantograph touches the drawn wire.
 * In a tunnel the wire hangs from the ceiling: no masts there.
 * Chunk-local coordinates like the ChunkView that owns the containers.
 */
export function chunkCatenary(
  scene: Phaser.Scene,
  art: CatenaryArt,
  table: ArcLengthTable,
  seed: number,
  depths: CatenaryDepths,
): ChunkCatenary {
  const x0 = table.chunkIndex * chunkWidthU;
  const pole = worldParts[catenaryParts.pole];
  const span = worldParts[catenaryParts.span];
  const poles = scene.add.container(0, 0).setDepth(depths.poles);
  const wires = scene.add.container(0, 0).setDepth(depths.wires);
  const image = (
    key: typeof catenaryParts.pole | typeof catenaryParts.span,
  ) => {
    const part = worldParts[key];
    const object = scene.add.image(0, 0, art.texture, key);
    const origin = frameOrigin(part.pivotU, art.pxPerU, object.frame);
    return object.setOrigin(origin.x, origin.y);
  };
  const xs = catenaryPoleXs(seed, x0, x0 + chunkWidthU);
  let masts = 0;
  for (const x of xs) {
    const railY = -heightAtX(table, x);
    const local = x - x0;
    // The mast stands so that its contact clamp is right at the pole's x;
    // at a tunnel its ceiling holds the wire (TunnelView draws the hanger).
    if (catenarySupport(seed, x) === 'mast') {
      masts += 1;
      poles.add(
        image(catenaryParts.pole)
          .setPosition(
            local - (catenaryAnchors.contact.x - pole.pivotU.x),
            railY - CATENARY_POLE_DEPTH_U,
          )
          .setScale(1 / art.pxPerU),
      );
    }
    const next = catenaryPoleXs(seed, x + 1, x + 2 * catenaryPoleSpacingU)[0];
    if (next === undefined) continue;
    const dx = next - x;
    const dy = -heightAtX(table, next) - railY;
    wires.add(
      image(catenaryParts.span)
        .setPosition(x - x0, railY - catenaryContactHeightU)
        .setScale(Math.hypot(dx, dy) / span.widthU / art.pxPerU, 1 / art.pxPerU)
        .setRotation(Math.atan2(dy, dx)),
    );
  }
  return { containers: [poles, wires], poles: masts };
}

/** Paints with Graphics once into a texture (ChunkView's baking). */
type Bake = (
  paint: (g: Phaser.GameObjects.Graphics) => void,
  bounds: { left: number; top: number; right: number; bottom: number },
) => Phaser.GameObjects.Container;

const FALLBACK_MAST = 0x6b7178;
const FALLBACK_WIRE = 0x2f3338;

/**
 * The catenary drawn with plain lines when the art failed to load
 * (PWA-10): masts and the wire at the same poles and contact height, so
 * an electric journey keeps its wire along the whole route (AGENTS.md).
 */
export function chunkCatenaryFallback(
  table: ArcLengthTable,
  seed: number,
  depths: CatenaryDepths,
  bake: Bake,
): ChunkCatenary {
  const x0 = table.chunkIndex * chunkWidthU;
  const poleHeightU = worldParts[catenaryParts.pole].heightU;
  const xs = catenaryPoleXs(seed, x0, x0 + chunkWidthU);
  const next = catenaryPoleXs(
    seed,
    x0 + chunkWidthU,
    x0 + chunkWidthU + 2 * catenaryPoleSpacingU,
  )[0];
  const wirePoints = [...xs, ...(next === undefined ? [] : [next])].map(
    (x) => ({ x: x - x0, y: -heightAtX(table, x) - catenaryContactHeightU }),
  );
  const masts = xs.filter((x) => catenarySupport(seed, x) === 'mast');
  const top = Math.min(
    ...wirePoints.map((point) => point.y),
    ...masts.map(
      (x) => -heightAtX(table, x) - CATENARY_POLE_DEPTH_U - poleHeightU,
    ),
  );
  const bottom = Math.max(...xs.map((x) => -heightAtX(table, x))) + 4;
  const right = (wirePoints.at(-1)?.x ?? chunkWidthU) + 4;
  const poles = bake(
    (g) => {
      g.fillStyle(FALLBACK_MAST, 1);
      for (const x of masts) {
        const foot = -heightAtX(table, x) - CATENARY_POLE_DEPTH_U;
        g.fillRect(x - x0 - 2, foot - poleHeightU, 4, poleHeightU);
        // The arm out to the contact wire.
        const wire = -heightAtX(table, x) - catenaryContactHeightU;
        g.fillRect(x - x0 - 2, wire - 2, 14, 2.5);
      }
    },
    { left: -4, top: top - 4, right, bottom },
  ).setDepth(depths.poles);
  const wires = bake(
    (g) => {
      g.lineStyle(1.6, FALLBACK_WIRE, 1);
      for (let i = 1; i < wirePoints.length; i++) {
        const a = wirePoints[i - 1];
        const b = wirePoints[i];
        if (a && b) g.lineBetween(a.x, a.y, b.x, b.y);
      }
    },
    { left: -4, top: top - 4, right, bottom },
  ).setDepth(depths.wires);
  return { containers: [poles, wires], poles: masts.length };
}
