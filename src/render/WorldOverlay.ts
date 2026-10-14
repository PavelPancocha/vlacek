import type Phaser from 'phaser';
import {
  worldOverlayGeometry,
  type WorldOverlayOptions,
} from '../domain/world/WorldDebugGeometry.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
/** One overlay owner; redraw only when the logical window/options change. */
export class WorldOverlay {
  readonly #graphics: Phaser.GameObjects.Graphics;
  #signature = '';
  count = 0;
  constructor(scene: Phaser.Scene, depth: number) {
    this.#graphics = scene.add.graphics().setDepth(depth);
  }
  draw(
    seed: number,
    first: number,
    last: number,
    originX: number,
    zoom: number,
    options: WorldOverlayOptions,
  ): void {
    this.#graphics.setPosition(-originX, 0);
    const signature = `${seed}/${first}/${last}/${zoom}/${options.areas}/${options.boundaries}/${options.roads}`;
    if (signature === this.#signature) return;
    this.#signature = signature;
    this.#graphics.clear();
    this.count = 0;
    const seen = new Set<string>();
    for (let k = first; k <= last; k++)
      for (const p of worldOverlayGeometry(
        seed,
        k,
        worldPlacementCatalog,
        options,
      )) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        const colors = {
          reservation: 0xff9933,
          footprint: 0x33ccff,
          scene: 0xff44aa,
          subzone: 0xaa44ff,
          'road-tangent': 0xffffff,
        };
        this.#graphics.lineStyle(1.5 / zoom, colors[p.kind], 0.85);
        this.#graphics.beginPath();
        const start = p.points[0];
        if (!start) continue;
        this.#graphics.moveTo(start.xU, start.yU);
        for (const at of p.points.slice(1)) this.#graphics.lineTo(at.xU, at.yU);
        if (p.kind === 'reservation' || p.kind === 'footprint')
          this.#graphics.closePath();
        this.#graphics.strokePath();
        this.count++;
        if (p.kind === 'road-tangent') {
          const end = p.points.at(-1);
          if (!end) continue;
          const angle = Math.atan2(end.yU - start.yU, end.xU - start.xU);
          for (const turn of [-0.6, 0.6]) {
            this.#graphics.beginPath();
            this.#graphics.moveTo(end.xU, end.yU);
            this.#graphics.lineTo(
              end.xU - 8 * Math.cos(angle + turn),
              end.yU - 8 * Math.sin(angle + turn),
            );
            this.#graphics.strokePath();
          }
        }
      }
  }
  clear(): void {
    this.#signature = '';
    this.count = 0;
    this.#graphics.clear();
  }
  destroy(): void {
    this.#graphics.destroy();
  }
}
