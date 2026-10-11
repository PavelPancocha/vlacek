import Phaser from 'phaser';
import type { ArtPart } from '../content/artManifest.ts';
import {
  crossingParts,
  crossingPostAnchors,
  roadActorParts,
  worldParts,
} from '../content/worldArt.ts';
import {
  ROAD_CONFLICT_U,
  ROAD_FAR_END_U,
  type RoadActor,
} from '../domain/interaction/LevelCrossing.ts';
import { hash32 } from '../domain/world/Hash.ts';
import { frameOrigin } from './atlasPacking.ts';
import {
  FAR_POST_ROAD_U,
  NEAR_POST_ROAD_U,
  POST_SIDE_GAP_U,
  ROAD_ACTOR_SCALE,
  boomAngle,
  laneOffsetU,
  redLampsLit,
  roadActorAlpha,
  roadHalfWidthU,
  roadPointY,
  roadScale,
  whiteLampLit,
  type RoadFrame,
} from './crossingLayout.ts';

/** What the view shows of a crossing; `LevelCrossing` provides it. */
export interface CrossingState {
  readonly barrier: number;
  readonly warning: boolean;
  readonly actors: readonly RoadActor[];
}

export interface CrossingArt {
  texture: string;
  pxPerU: number;
}

/** Layers of the crossing: behind the track, on the deck, in front. */
export interface CrossingDepths {
  back: number;
  deck: number;
  near: number;
}

/** Depth steps by road position keep nearer traffic on top. */
const DEPTH_PER_ROAD_U = 1 / 10_000;

const parts: Readonly<Record<string, ArtPart | undefined>> = worldParts;

interface Barrier {
  post: Phaser.GameObjects.Image;
  boom: Phaser.GameObjects.Image;
  red: readonly [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  white: Phaser.GameObjects.Image;
  side: 'left' | 'right';
}

/**
 * The barriers, lamps and road traffic of one level crossing (doc 05 §4),
 * in chunk-local coordinates like its ChunkView, which owns it. Reads the
 * crossing state each frame and draws it; it never decides anything.
 * Without a state (the simulation does not hold the crossing) the barriers
 * stand open with no traffic. `destroy` releases every game object.
 */
export class CrossingView {
  readonly #scene: Phaser.Scene;
  readonly #art: CrossingArt;
  readonly #x: number;
  readonly #frame: RoadFrame;
  readonly #depths: CrossingDepths;
  readonly #barriers: Barrier[];
  readonly #actors = new Map<string, Phaser.GameObjects.Image>();
  /** Every image with its chunk-local x (actors move, see #placeActor). */
  readonly #placed = new Map<Phaser.GameObjects.Image, number>();
  #chunkX = 0;

  constructor(
    scene: Phaser.Scene,
    art: CrossingArt,
    x: number,
    frame: RoadFrame,
    depths: CrossingDepths,
  ) {
    this.#scene = scene;
    this.#art = art;
    this.#x = x;
    this.#frame = frame;
    this.#depths = depths;
    // Behind the track the tall post on the left of the road closes the
    // lane coming towards the viewer; in front, the low one on the right
    // closes the lane going away (each lane's right-hand side).
    this.#barriers = [
      this.#barrier(FAR_POST_ROAD_U, 'left', crossingParts.post),
      this.#barrier(NEAR_POST_ROAD_U, 'right', crossingParts.postLow),
    ];
    this.update(undefined, 0);
  }

  /** The low post, its boom and the traffic in front of the track. */
  get nearImages(): Phaser.GameObjects.Image[] {
    const near = this.#barriers.find((b) => b.side === 'right');
    return [
      ...(near ? [near.post, near.boom] : []),
      ...[...this.#actors.values()].filter(
        (image) => image.depth >= this.#depths.near,
      ),
    ];
  }

  setX(chunkX: number): void {
    this.#chunkX = chunkX;
    for (const [image, localX] of this.#placed) image.setX(chunkX + localX);
  }

  update(state: CrossingState | undefined, timeSec: number): void {
    const barrier = state?.barrier ?? 0;
    const warning = state?.warning ?? false;
    const red = redLampsLit(timeSec);
    const white = whiteLampLit(timeSec);
    for (const b of this.#barriers) {
      b.boom.setRotation(boomAngle(barrier, b.side));
      b.red[0].setVisible(warning && red[0]);
      b.red[1].setVisible(warning && red[1]);
      b.white.setVisible(!warning && white);
    }
    const alive = new Set<string>();
    for (const actor of state?.actors ?? []) {
      alive.add(actor.id);
      this.#placeActor(actor);
    }
    for (const [id, image] of this.#actors) {
      if (alive.has(id)) continue;
      this.#placed.delete(image);
      image.destroy();
      this.#actors.delete(id);
    }
  }

  destroy(): void {
    for (const image of this.#placed.keys()) image.destroy();
    this.#placed.clear();
    this.#actors.clear();
    this.#barriers.length = 0;
  }

  #barrier(
    roadU: number,
    side: 'left' | 'right',
    postKey: typeof crossingParts.post | typeof crossingParts.postLow,
  ): Barrier {
    const scale = roadScale(roadU);
    const sign = side === 'left' ? -1 : 1;
    const x = this.#x + sign * (roadHalfWidthU(roadU) + POST_SIDE_GAP_U);
    const footY = roadPointY(this.#frame, roadU);
    const post = worldParts[postKey];
    const anchors = crossingPostAnchors[postKey];
    const at = (point: { x: number; y: number }) => ({
      x: x + (point.x - post.pivotU.x) * scale,
      y: footY + (point.y - post.pivotU.y) * scale,
    });
    const base =
      roadU < 0
        ? this.#depths.back + (roadU - ROAD_FAR_END_U) * DEPTH_PER_ROAD_U
        : this.#depths.near + roadU * DEPTH_PER_ROAD_U;
    const image = (key: string, point: { x: number; y: number }, z: number) =>
      this.#image(key, point.x, point.y, scale, base + z * DEPTH_PER_ROAD_U);
    const hinge = at(anchors.hinge);
    return {
      post: image(postKey, { x, y: footY }, 0),
      // Booms in front of their posts; the right one flipped so that its
      // light edge stays on top when turned round.
      boom: image(crossingParts.boom, hinge, 0.2).setFlipY(side === 'right'),
      red: [
        image(crossingParts.glowRed, at(anchors.red[0]), 0.1),
        image(crossingParts.glowRed, at(anchors.red[1]), 0.1),
      ],
      white: image(crossingParts.glowWhite, at(anchors.white), 0.1),
      side,
    };
  }

  #placeActor(actor: RoadActor): void {
    const key = this.#actorKey(actor);
    let image = this.#actors.get(actor.id);
    if (!image) {
      image = this.#image(key, 0, 0, 1, 0);
      this.#actors.set(actor.id, image);
    }
    const r = actor.roadU;
    const x = this.#x + laneOffsetU(actor.direction, r);
    const depth =
      r <= -ROAD_CONFLICT_U
        ? this.#depths.back + (r - ROAD_FAR_END_U) * DEPTH_PER_ROAD_U
        : r < ROAD_CONFLICT_U
          ? this.#depths.deck
          : this.#depths.near + r * DEPTH_PER_ROAD_U;
    this.#placed.set(image, x);
    image
      .setPosition(this.#chunkX + x, roadPointY(this.#frame, r))
      .setScale((ROAD_ACTOR_SCALE * roadScale(r)) / this.#art.pxPerU)
      .setAlpha(roadActorAlpha(r))
      .setDepth(depth);
  }

  /** Art of a road actor: seen from the front when it comes closer. */
  #actorKey(actor: RoadActor): string {
    const view = actor.direction === 1 ? 'front' : 'back';
    if (actor.kind === 'bike') return roadActorParts.bike[view];
    const car = hash32('car-colour', actor.id) % 2 === 0 ? 'car-a' : 'car-b';
    return roadActorParts[car][view];
  }

  #image(
    key: string,
    x: number,
    y: number,
    scale: number,
    depth: number,
  ): Phaser.GameObjects.Image {
    const image = this.#scene.add.image(
      this.#chunkX + x,
      y,
      this.#art.texture,
      key,
    );
    const part = parts[key];
    if (part) {
      const origin = frameOrigin(part.pivotU, this.#art.pxPerU, image.frame);
      image.setOrigin(origin.x, origin.y);
    }
    image.setScale(scale / this.#art.pxPerU).setDepth(depth);
    this.#placed.set(image, x);
    return image;
  }
}
