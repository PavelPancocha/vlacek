import Phaser from 'phaser';
import {
  crossingParts,
  crossingPostAnchors,
  worldParts,
} from '../content/worldArt.ts';
import type { CrossingDepths, CrossingState } from './CrossingView.ts';
import {
  FAR_POST_ROAD_U,
  NEAR_POST_ROAD_U,
  POST_SIDE_GAP_U,
  boomAngle,
  laneOffsetU,
  redLampsLit,
  roadHalfWidthU,
  roadPointY,
  roadScale,
  whiteLampLit,
  type RoadFrame,
} from './crossingLayout.ts';

const POST = 0x4a4f57;
const BOOM_RED = 0xd8342c;
const BOOM_WHITE = 0xf4f1ea;
const LAMP_RED = 0xff3b2f;
const LAMP_WHITE = 0xfff6d8;
const CAR = 0x5d7fa8;
const BIKE = 0x3f8a4a;

/**
 * A level crossing drawn with plain shapes when the art failed to load
 * (PWA-10): the same posts, booms, lamps and traffic as `CrossingView`,
 * in the same places, so its warning still works (doc 05 §4). Two
 * Graphics, redrawn each frame (a handful of shapes).
 */
export class CrossingFallbackView {
  readonly #x: number;
  readonly #frame: RoadFrame;
  readonly #back: Phaser.GameObjects.Graphics;
  readonly #near: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    frame: RoadFrame,
    depths: CrossingDepths,
  ) {
    this.#x = x;
    this.#frame = frame;
    this.#back = scene.add.graphics().setDepth(depths.back);
    this.#near = scene.add.graphics().setDepth(depths.near);
    this.update(undefined, 0);
  }

  /** Nothing to measure: the fallback never adds near art over the train. */
  get nearImages(): Phaser.GameObjects.Image[] {
    return [];
  }

  setX(chunkX: number): void {
    this.#back.setX(chunkX);
    this.#near.setX(chunkX);
  }

  update(state: CrossingState | undefined, timeSec: number): void {
    const barrier = state?.barrier ?? 0;
    const warning = state?.warning ?? false;
    const red = redLampsLit(timeSec);
    const white = whiteLampLit(timeSec);
    this.#back.clear();
    this.#near.clear();
    for (const [g, roadU, side, key] of [
      [this.#back, FAR_POST_ROAD_U, 'left', crossingParts.post],
      [this.#near, NEAR_POST_ROAD_U, 'right', crossingParts.postLow],
    ] as const) {
      const scale = roadScale(roadU);
      const sign = side === 'left' ? -1 : 1;
      const x = this.#x + sign * (roadHalfWidthU(roadU) + POST_SIDE_GAP_U);
      const footY = roadPointY(this.#frame, roadU);
      const post = worldParts[key];
      const anchors = crossingPostAnchors[key];
      const at = (point: { x: number; y: number }) => ({
        x: x + (point.x - post.pivotU.x) * scale,
        y: footY + (point.y - post.pivotU.y) * scale,
      });
      g.fillStyle(POST, 1);
      g.fillRect(
        x - 1.5 * scale,
        footY - post.heightU * scale,
        3 * scale,
        post.heightU * scale,
      );
      // The boom: red and white halves from the hinge.
      const hinge = at(anchors.hinge);
      const angle = boomAngle(barrier, side);
      const length = worldParts[crossingParts.boom].widthU * scale;
      const dx = Math.cos(angle) * length;
      const dy = Math.sin(angle) * length;
      g.lineStyle(3 * scale, BOOM_RED, 1);
      g.lineBetween(hinge.x, hinge.y, hinge.x + dx / 2, hinge.y + dy / 2);
      g.lineStyle(3 * scale, BOOM_WHITE, 1);
      g.lineBetween(
        hinge.x + dx / 2,
        hinge.y + dy / 2,
        hinge.x + dx,
        hinge.y + dy,
      );
      for (const [n, point] of anchors.red.entries()) {
        if (!(warning && red[n === 0 ? 0 : 1])) continue;
        const lamp = at(point);
        g.fillStyle(LAMP_RED, 1);
        g.fillCircle(lamp.x, lamp.y, 3.5 * scale);
      }
      if (!warning && white) {
        const lamp = at(anchors.white);
        g.fillStyle(LAMP_WHITE, 1);
        g.fillCircle(lamp.x, lamp.y, 3 * scale);
      }
    }
    for (const actor of state?.actors ?? []) {
      const r = actor.roadU;
      const g = r < 0 ? this.#back : this.#near;
      const scale = roadScale(r);
      const x = this.#x + laneOffsetU(actor.direction, r);
      const y = roadPointY(this.#frame, r);
      const [w, h] = actor.kind === 'bike' ? [8, 14] : [18, 12];
      g.fillStyle(actor.kind === 'bike' ? BIKE : CAR, 1);
      g.fillRoundedRect(
        x - (w * scale) / 2,
        y - h * scale,
        w * scale,
        h * scale,
        2,
      );
    }
  }

  destroy(): void {
    this.#back.destroy();
    this.#near.destroy();
  }
}
