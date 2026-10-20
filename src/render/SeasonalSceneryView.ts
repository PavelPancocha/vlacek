import type { WaterMountainDiagnostic } from './waterMountainMotion.ts';
import { frameTexture } from './frameTexture.ts';
import Phaser from 'phaser';
import type { ArtPart } from '../content/artManifest.ts';
import { roofSnowPlanes } from '../content/roofSnowPlanes.ts';
import { roofOutlines } from '../content/seasonalAnchors.ts';
import { effectiveClimateAt, windAt } from '../domain/world/Seasons.ts';
import { hash32 } from '../domain/world/Hash.ts';
import type { SceneryProp } from '../domain/world/Scenery.ts';
import { DECIDUOUS, opaqueSeasonalFrame } from './seasonalArt.ts';
import { setWorldPivot } from './worldImage.ts';
import type { SeasonalSource } from './particles/SeasonalEffects.ts';

interface LifeSprite {
  image: Phaser.GameObjects.Image;
  kind: 'duck' | 'ripple' | 'wave' | 'wheel' | 'flag';
  x: number;
  y: number;
  phase: number;
  scale: number;
  frames?: readonly string[];
  timeSec?: number;
  frame?: string;
  id?: string;
  flowing?: boolean;
}
/** Images belong to their chunk containers; this owner retains only visible-source data. */
export class SeasonalSceneryView {
  readonly sources: SeasonalSource[] = [];
  readonly #life: LifeSprite[] = [];
  #lastTimeSec: number | undefined;
  constructor(
    readonly scene: Phaser.Scene,
    readonly seed: number,
    readonly worldXU: number,
    readonly texture: string,
    readonly pxPerU: number,
    readonly parts: Readonly<Record<string, ArtPart | undefined>>,
  ) {}

  frame(kind: string, xU: number): string {
    if (kind === 'back.dispatcher') return 'life.dispatcher-wave';
    if (kind === 'back.watermill') return 'life.watermill-body';
    const tagged = ['spring', 'autumn', 'winter', 'snow', 'winter-snow'].some(
      (season) =>
        this.parts[`${kind}-${season}`]?.atlasGroup?.seasons !== undefined,
    );
    return opaqueSeasonalFrame(
      kind,
      effectiveClimateAt(this.seed, this.worldXU + xU),
      (key) => this.parts[key] !== undefined,
      (hash32('season-mix', this.seed, this.worldXU, kind, String(xU)) %
        10000) /
        10000,
      tagged,
    );
  }
  add(
    prop: SceneryProp,
    base: Phaser.GameObjects.Image,
    container: Phaser.GameObjects.Container,
    depth: number,
    flowing = false,
  ): void {
    const climate = effectiveClimateAt(this.seed, this.worldXU + prop.xU);
    const original = this.parts[prop.kind];
    if (!original) return;
    const scale = base.scaleX * this.pxPerU;
    const id = prop.id;
    if (DECIDUOUS.includes(prop.kind)) {
      this.sources.push({
        id,
        kind: ['tree.apple', 'tree.plum'].includes(prop.kind)
          ? 'blossom'
          : 'deciduous',
        x: this.worldXU + base.x,
        y: base.y - original.heightU * scale * 0.68,
        depth: depth + 0.05,
        radiusU: original.widthU * scale * 0.3,
      });
      if (climate.autumn > 0)
        container.add(
          this.#image(
            'near.leaf-litter',
            base.x,
            base.y,
            base.scaleX * 1.1,
            prop.flip,
          )
            .setAlpha(climate.autumn * 0.95)
            .setDepth(base.depth + 0.002),
        );
    }
    const roofs: Readonly<
      Record<
        string,
        readonly (readonly { x: number; y: number }[])[] | undefined
      >
    > = roofOutlines;
    const planes = roofSnowPlanes[prop.kind];
    if (climate.winter > 0 && planes) {
      const snow = this.scene.add
        .graphics()
        .setPosition(base.x, base.y)
        .setScale((prop.flip ? -1 : 1) * scale, base.scaleY * this.pxPerU)
        .setRotation(base.rotation)
        .setAlpha(climate.winter)
        .setDepth(base.depth + 0.003);
      for (const plane of planes) {
        const points = plane.map(
          ([x, y]) =>
            new Phaser.Math.Vector2(
              x - original.pivotU.x,
              y - original.pivotU.y,
            ),
        );
        snow.fillStyle(0xf4f9fc, 1).fillPoints(points, true);
        // The flat hip ridge has only a few phone pixels: keep the snow's outline
        // narrower there so it cannot replace the white upper slope.
        snow
          .lineStyle(prop.kind === 'back.house-hip' ? 0.35 : 0.9, 0xb7cddc, 1)
          .strokePoints(points, true);
      }
      container.add(snow);
    }
    if (climate.winter > 0 && !planes)
      for (const outline of roofs[prop.kind] ?? []) {
        for (let i = 1; i < outline.length; i++) {
          const first = outline[i - 1],
            last = outline[i];
          if (!first || !last) continue;
          const sign = prop.flip ? -1 : 1;
          const [a, b] =
            sign * (last.x - first.x) < 0 ? [last, first] : [first, last];
          const dx = b.x - a.x,
            dy = b.y - a.y;
          const cap = this.#image(
            'snow.roof-64',
            base.x + sign * (a.x - original.pivotU.x) * scale,
            base.y + (a.y - original.pivotU.y) * scale,
            base.scaleX,
            false,
          );
          cap
            .setScale(
              (Math.hypot(dx, dy) * scale) / 64 / this.pxPerU,
              base.scaleY * 1.8,
            )
            .setRotation(Math.atan2(dy, sign * dx))
            .setAlpha(climate.winter)
            .setDepth(base.depth + 0.003);
          container.add(cap);
        }
      }
    if (prop.kind === 'back.church' && climate.winter > 0)
      container.add(
        this.#image(
          'snow.roof-dome',
          base.x,
          base.y - original.heightU * scale + 5 * scale,
          base.scaleX,
          false,
        )
          .setAlpha(climate.winter)
          .setDepth(base.depth + 0.004),
      );
    if (prop.kind === 'near.pond' && climate.winter < 0.5) {
      const x = base.x,
        y = base.y - original.heightU * scale * 0.4;
      this.sources.push({
        id: `${id}:water`,
        kind: 'freshwater',
        x: this.worldXU + x,
        y,
        depth: depth + 0.05,
        radiusU: original.widthU * scale * 0.17,
      });
      for (const [i, key] of [
        'animal.duck-swim-male',
        'animal.duck-swim-female',
      ].entries()) {
        const dx = (i === 0 ? -1 : 1) * 12 * scale;
        const duck = this.#image(
          key,
          x + dx,
          y,
          base.scaleX * 0.6,
          i === 1,
        ).setDepth(base.depth + 0.005);
        const ripple = this.#image(
          'fx.duck-ripple-a',
          x + dx,
          y,
          base.scaleX * 1.1,
          false,
        ).setDepth(base.depth + 0.004);
        container.add([ripple, duck]);
        const phase = (hash32(id, i) % 1000) / 1000;
        this.#life.push(
          {
            image: duck,
            kind: 'duck',
            x: x + dx,
            y,
            phase,
            scale: base.scaleX * 0.6,
            frames:
              i === 0
                ? ['animal.duck-swim-male', 'animal.duck-swim-male-alert']
                : ['animal.duck-swim-female'],
          },
          {
            image: ripple,
            kind: 'ripple',
            x: x + dx,
            y,
            phase,
            scale: base.scaleX * 1.1,
            frames: ['fx.duck-ripple-a', 'fx.duck-ripple-b'],
          },
        );
      }
    }
    if (prop.kind === 'back.dispatcher') {
      const arm = this.#image(
        'life.dispatcher-arm',
        base.x + (11 - original.pivotU.x) * scale,
        base.y + (15 - original.pivotU.y) * scale,
        base.scaleX,
        prop.flip,
      ).setDepth(base.depth + 0.01);
      container.add(arm);
      this.#life.push({
        image: arm,
        kind: 'wave',
        x: base.x,
        y: base.y,
        phase: (hash32(id) % 1000) / 1000,
        scale: base.scaleX,
      });
      const flag = this.#image(
        'life.station-flag-a',
        base.x + 24 * scale,
        base.y,
        base.scaleX,
        windAt(this.seed, 0) < 0,
      ).setDepth(base.depth + 0.01);
      container.add(flag);
      this.#life.push({
        image: flag,
        kind: 'flag',
        x: flag.x,
        y: flag.y,
        phase: (hash32('flag', id) % 1000) / 1000,
        scale: base.scaleX,
        frames: ['life.station-flag-a', 'life.station-flag-b'],
      });
    }
    if (prop.kind === 'back.watermill')
      this.#assembleWatermill(
        prop,
        base,
        container,
        flowing && climate.winter < 0.5,
      );
    if (prop.kind === 'back.farmhouse')
      this.sources.push({
        id: `${id}:chimney`,
        kind: 'chimney',
        x: this.worldXU + base.x + (33.7 - original.pivotU.x) * scale,
        y: base.y + (0.4 - original.pivotU.y) * scale,
        depth: depth + 0.05,
        radiusU: 0,
      });
  }
  /** The placed life body and its only wheel share this owner and the D-027 clock. */
  #assembleWatermill(
    prop: SceneryProp,
    base: Phaser.GameObjects.Image,
    container: Phaser.GameObjects.Container,
    flowing: boolean,
  ): void {
    const body = this.parts['life.watermill-body'];
    if (!body) throw new Error('missing canonical mill body');
    const scale = base.scaleX * this.pxPerU;
    const wheel = this.#image(
      'life.watermill-wheel',
      base.x + (98 - body.pivotU.x) * scale,
      base.y + (66 - body.pivotU.y) * scale,
      base.scaleX,
      false,
    ).setDepth(base.depth + 0.01);
    container.add(wheel);
    this.#life.push({
      image: wheel,
      kind: 'wheel',
      id: prop.id,
      flowing,
      x: wheel.x,
      y: wheel.y,
      phase: (hash32(prop.id) % 1000) / 1000,
      scale: base.scaleX,
    });
  }
  get watermillDiagnostics(): WaterMountainDiagnostic[] {
    return this.#life
      .filter((i) => i.kind === 'wheel')
      .map((i) => ({
        id: i.id ?? '',
        kind: 'back.watermill',
        xU: this.worldXU + i.x,
        yU: i.y,
        wheelAngleRad: i.image.rotation,
        armAngleRad: null,
        cabinXU: null,
        ferryRatio: null,
        moored: null,
        direction: null,
        frames: ['life.watermill-body', 'life.watermill-wheel'],
      }));
  }
  addWaterSource(id: string, x: number, y: number, depth: number): void {
    this.sources.push({
      id,
      kind: 'freshwater',
      x: this.worldXU + x,
      y,
      depth,
      radiusU: 8,
    });
  }
  update(
    timeSec: number,
    motion: number,
    frontXU: number,
    budget: number,
    view = { left: -Infinity, right: Infinity },
  ): number {
    const dt =
      this.#lastTimeSec === undefined
        ? 0
        : Math.min(0.1, Math.max(0, timeSec - this.#lastTimeSec));
    this.#lastTimeSec = timeSec;
    const wind = windAt(this.seed, timeSec);
    let animated = 0;
    for (const item of this.#life) {
      if (item.kind === 'wheel' && !item.flowing) continue;
      if (item.x < view.left - 40 || item.x > view.right + 40) continue;
      if (animated >= budget) break;
      animated++;
      item.timeSec = (item.timeSec ?? 0) + dt;
      const localTime = item.timeSec;
      if (item.kind === 'duck' || item.kind === 'ripple') {
        const dx = Math.sin(localTime * 0.25 + item.phase * Math.PI * 2) * 4;
        item.image.setPosition(
          item.x + dx,
          item.y + Math.sin(localTime * 0.8 + item.phase * 6) * 0.5,
        );
        if (item.kind === 'duck') {
          const alert =
            Math.abs(frontXU - (this.worldXU + item.x)) < 220 &&
            (localTime + item.phase * 20) % 20 < 3;
          const frame = item.frames?.[alert && item.frames.length > 1 ? 1 : 0];
          if (frame) this.#setLifeFrame(item, frame);
        }
        if (item.kind === 'ripple') {
          const frame =
            item.frames?.[Math.floor(localTime * 1.5 + item.phase * 2) % 2];
          if (frame) this.#setLifeFrame(item, frame);
          item.image.setAlpha(
            (0.3 + 0.15 * Math.sin(localTime * 1.7 + item.phase * 6)) * motion,
          );
        }
      } else if (item.kind === 'wave') {
        const near = Math.abs(frontXU - (this.worldXU + item.x)) < 300;
        const event = (localTime + item.phase * 24) % 24;
        item.image.setRotation(
          near && event < 3 ? (-1.7 + Math.sin(event * 5) * 0.2) * motion : 0,
        );
      } else if (item.kind === 'wheel')
        item.image.setRotation(localTime * 0.7 + item.phase * 6);
      else {
        const frame =
          item.frames?.[Math.floor(localTime * 2 + item.phase * 2) % 2];
        if (frame) this.#setLifeFrame(item, frame);
        item.image.setRotation(
          wind * 0.001 * Math.sin(localTime * 2 + item.phase * 6) * motion,
        );
      }
    }
    return animated;
  }
  #setLifeFrame(item: LifeSprite, frame: string): void {
    const texture = frameTexture(frame, this.texture);
    if (item.frame !== frame || item.image.texture.key !== texture) {
      item.image.setTexture(texture, frame);
      if (item.frame !== frame) item.image.setData('world-part', frame);
      item.frame = frame;
    }
  }
  get animatedObjects(): number {
    return this.#life.length;
  }
  #image(
    key: string,
    x: number,
    y: number,
    scale: number,
    flip: boolean,
  ): Phaser.GameObjects.Image {
    const part = this.parts[key];
    if (!part) throw new Error(`missing seasonal art ${key}`);
    // Tagged so a D-030 page swap rebinds it (RideScene rebindWorldImage).
    const image = this.scene.add
      .image(x, y, frameTexture(key, this.texture), key)
      .setData('world-part', key);
    const pivot = flip
      ? { x: part.widthU - part.pivotU.x, y: part.pivotU.y }
      : part.pivotU;
    return setWorldPivot(image, pivot, this.pxPerU)
      .setScale(scale)
      .setFlipX(flip);
  }
}
