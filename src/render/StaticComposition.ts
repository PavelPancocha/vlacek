import { frameTexture } from './frameTexture.ts';
import type Phaser from 'phaser';
import type { ArtPart } from '../content/artManifest.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';
import {
  projectedBounds,
  propFootU,
  propScale,
  railYUpU,
  type PointU,
} from '../domain/world/SceneryGeometry.ts';
import { bankHeightU } from '../domain/world/Terrain.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { worldParts } from '../content/worldArt.ts';
import { FRAME_MARGIN_PX } from './atlasPacking.ts';
import type { ChunkArt } from './ChunkView.ts';

let serial = 0;
const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;
/** One immutable, polygon-clipped texture per depth. Canvas pixels work in both renderers. */
export function bakeStaticComposition(
  scene: Phaser.Scene,
  seed: number,
  k: number,
  props: readonly SceneryProp[],
  art: ChunkArt,
  forestArt: ChunkArt | undefined,
  pxPerU: number,
): { image: Phaser.GameObjects.Image; key: string } {
  const bounds = props.map((p) => {
    const part = worldPlacementCatalog[p.kind];
    if (!part) throw new Error(`missing composition footprint ${p.kind}`);
    return projectedBounds(seed, k, p, part);
  });
  const left = Math.floor(Math.min(...bounds.map((b) => b.leftU))),
    top = Math.floor(Math.min(...bounds.map((b) => b.topU))),
    right = Math.ceil(Math.max(...bounds.map((b) => b.rightU))),
    bottom = Math.ceil(Math.max(...bounds.map((b) => b.bottomU)));
  // Ground/composition resolution never exceeds doc 07's 1 px/u.
  const scale = Math.min(1, pxPerU);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil((right - left) * scale));
  canvas.height = Math.max(1, Math.ceil((bottom - top) * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no composition canvas context');
  const scratch = document.createElement('canvas');
  scratch.width = canvas.width;
  scratch.height = canvas.height;
  const paint = scratch.getContext('2d');
  if (!paint) throw new Error('no clipping canvas context');
  const groups = new Map<readonly PointU[], SceneryProp[]>();
  for (const p of props) {
    if (!p.clip) throw new Error('static composition needs a clip');
    const group = groups.get(p.clip);
    if (group) group.push(p);
    else groups.set(p.clip, [p]);
  }
  for (const [clip, group] of groups) {
    paint.clearRect(0, 0, scratch.width, scratch.height);
    paint.save();
    paint.scale(scale, scale);
    paint.translate(-left, -top);
    paint.beginPath();
    clip.forEach((p, i) =>
      i === 0 ? paint.moveTo(p.xU, p.yU) : paint.lineTo(p.xU, p.yU),
    );
    paint.closePath();
    paint.clip();
    for (const prop of group) {
      const source = prop.kind.startsWith('backdrop.') ? forestArt : art;
      const part = parts[prop.kind];
      if (!source || !part)
        throw new Error(`missing composition art ${prop.kind}`);
      const frame = scene.textures
        .get(frameTexture(prop.kind, source.texture))
        .get(prop.kind);
      const image = frame.source.image;
      if (
        !(image instanceof HTMLCanvasElement) &&
        !(image instanceof HTMLImageElement)
      )
        throw new Error('composition atlas is not an image');
      const x = k * 1024 + prop.xU;
      const foot = propFootU(
        prop,
        x,
        railYUpU(seed, x),
        prop.layer === 'near' ? bankHeightU(seed, x) : 0,
      );
      paint.save();
      paint.translate(foot.xU, foot.yU);
      paint.scale(propScale(prop), propScale(prop));
      const margin = FRAME_MARGIN_PX / source.pxPerU;
      paint.drawImage(
        image,
        frame.cutX,
        frame.cutY,
        frame.cutWidth,
        frame.cutHeight,
        -part.pivotU.x - margin,
        -part.pivotU.y - margin,
        frame.cutWidth / source.pxPerU,
        frame.cutHeight / source.pxPerU,
      );
      paint.restore();
    }
    paint.restore();
    const fade = group[0]?.fadeX;
    if (fade) {
      paint.save();
      paint.globalCompositeOperation = 'destination-in';
      const gradient = paint.createLinearGradient(
        (fade.fromU - left) * scale,
        0,
        (fade.toU - left) * scale,
        0,
      );
      const edge = Math.min(0.5, fade.widthU / (fade.toU - fade.fromU));
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(edge, '#fff');
      gradient.addColorStop(1 - edge, '#fff');
      gradient.addColorStop(1, 'transparent');
      paint.fillStyle = gradient;
      paint.fillRect(0, 0, scratch.width, scratch.height);
      paint.restore();
    }
    ctx.drawImage(scratch, 0, 0);
  }
  // The staging canvas is not retained as another decoded texture.
  scratch.width = 0;
  scratch.height = 0;
  const key = `composition:${k}:${++serial}`;
  if (!scene.textures.addCanvas(key, canvas))
    throw new Error('composition texture not created');
  const image = scene.add
    .image(left - k * 1024, top, key)
    .setOrigin(0, 0)
    .setScale(1 / scale);
  return { image, key };
}
