import type Phaser from 'phaser';
import type { RoadVehicleArt } from '../content/roadVehicleArt.ts';
import type { ArtPart } from '../content/artManifest.ts';

/** One owned drawing, one bounded world-space puff; no timers or frame allocations. */
export class RoadVehicleMotion {
  readonly graphics: Phaser.GameObjects.Graphics;
  wheelAngleRad = 0;
  exhaust = false;
  arrows = false;
  frontX = 1;
  frontY = 0;
  #timeSec = 0;
  #puffAtSec = -Infinity;
  #puffX = 0;
  #puffY = 0;
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
  }
  update(
    image: Phaser.GameObjects.Image,
    part: ArtPart,
    art: RoadVehicleArt,
    vx: number,
    vy: number,
    timeSec: number,
    effects: number,
    arrows: boolean,
    pxPerU: number,
  ): void {
    const dt = Math.max(0, timeSec - this.#timeSec);
    this.#timeSec = timeSec;
    const moving = vx !== 0 || vy !== 0;
    const sign = image.flipX ? -1 : 1,
      c = Math.cos(image.rotation),
      s = Math.sin(image.rotation);
    this.frontX = sign * art.front.xU * c - art.front.yU * s;
    this.frontY = sign * art.front.xU * s + art.front.yU * c;
    this.wheelAngleRad +=
      (((Math.hypot(vx, vy) * dt) / 5) * (vx || vy)) /
      (Math.abs(vx || vy) || 1);
    const g = this.graphics.clear();
    this.arrows = arrows;
    const scaleU = image.scaleX * pxPerU;
    g.setPosition(0, 0).setRotation(0).setScale(1);
    if (art.wheels) {
      g.lineStyle(0.7 * scaleU, 0xe2e3df, 0.8);
      for (const wheel of art.wheels) {
        const wx = sign * (wheel.xU - part.pivotU.x) * scaleU;
        const wy = (wheel.yU - part.pivotU.y) * scaleU;
        const x = image.x + wx * c - wy * s,
          y = image.y + wx * s + wy * c;
        const angle = this.wheelAngleRad + image.rotation,
          r = wheel.radiusU * scaleU;
        g.lineBetween(
          x - r * Math.cos(angle),
          y - r * Math.sin(angle),
          x + r * Math.cos(angle),
          y + r * Math.sin(angle),
        );
      }
    }
    if (
      moving &&
      dt > 0 &&
      art.exhaust &&
      effects > 0 &&
      timeSec - this.#puffAtSec >= 1.4 / effects
    ) {
      const x = sign * (art.exhaust.xU - part.pivotU.x) * scaleU;
      const y = (art.exhaust.yU - part.pivotU.y) * scaleU;
      this.#puffX = image.x + x * c - y * s;
      this.#puffY = image.y + x * s + y * c;
      this.#puffAtSec = timeSec;
    }

    this.exhaust = moving && effects > 0 && timeSec - this.#puffAtSec < 0.8;
    if (this.exhaust) {
      const age = timeSec - this.#puffAtSec;
      g.fillStyle(0xa2a6a2, (1 - age / 0.8) * 0.22 * effects);
      g.fillCircle(
        this.#puffX,
        this.#puffY - age * 7,
        (1.5 + age * 2) * scaleU,
      );
    }
    if (arrows) {
      const length = Math.hypot(vx, vy);
      this.#arrow(
        image.x,
        image.y - 36,
        length ? (vx / length) * 40 : 0,
        length ? (vy / length) * 40 : 0,
        0x33ccff,
      );
      this.#arrow(
        image.x,
        image.y - 20,
        this.frontX * 32,
        this.frontY * 32,
        0xffaa33,
      );
    }
  }
  #arrow(x: number, y: number, dx: number, dy: number, color: number): void {
    if (dx === 0 && dy === 0) return;
    const g = this.graphics,
      angle = Math.atan2(dy, dx);
    g.lineStyle(2, color, 0.9).lineBetween(x, y, x + dx, y + dy);
    g.lineBetween(
      x + dx,
      y + dy,
      x + dx - 7 * Math.cos(angle - 0.6),
      y + dy - 7 * Math.sin(angle - 0.6),
    );
    g.lineBetween(
      x + dx,
      y + dy,
      x + dx - 7 * Math.cos(angle + 0.6),
      y + dy - 7 * Math.sin(angle + 0.6),
    );
  }
  shiftX(deltaU: number): void {
    this.#puffX += deltaU;
  }
  destroy(): void {
    this.graphics.destroy();
  }
}
