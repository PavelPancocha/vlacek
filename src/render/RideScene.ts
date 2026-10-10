import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig.ts';
import {
  OBJECT_RADIUS_U,
  OBJECT_SHAPES,
  vehicleBodyHeightU,
  vehicleShapes,
  type Shape,
  type ShapedVehicle,
} from '../content/placeholderShapes.ts';
import type { RideSimulation } from '../domain/ride/RideSimulation.ts';

/** What the scene needs from the application each frame. */
export interface RideSceneHost {
  /** Runs one application frame; returns the render interpolation alpha. */
  frame(deltaSec: number, nowMs: number): number;
  ride(): RideSimulation | undefined;
  /** Vehicle definitions of the current journey, locomotive first. */
  journeyVehicles(): readonly ShapedVehicle[];
  catalogVehicles(): readonly ShapedVehicle[];
}

export interface RenderStats {
  renderedVehicles: number;
  renderedChunks: number;
}

/** Design viewport height in world units (doc 13 `camera.referenceHeightU`). */
const REFERENCE_HEIGHT_U = 720;
const LOCO_ANCHOR_X = 0.3;
const RAIL_ANCHOR_Y = 0.65;
/** Render origin step; keeps GPU coordinates small on endless rides. */
const ORIGIN_STEP_U = 4096;
/** Chunk width shared with the generator and TrackWindow (doc 13). */
const CHUNK_WIDTH_U = gameConfig.world.chunkWidthU;
const GROUND_DEPTH_U = 1200;
/**
 * Each chunk's ground reaches this far into the next one: abutting
 * anti-aliased polygon edges leave a light seam column on Canvas.
 */
const GROUND_OVERLAP_U = 4;
const REACTION_TICKS = 40;
const HILLS_HEIGHT = 560;
/** Width of the repeating background hills texture (not a chunk width). */
const HILLS_WIDTH = 1024;
/**
 * Transparent texture rows under the hills fill. The WebGL tile shader wraps
 * the bottom row onto the sprite's top edge at fractional zoom; a solid
 * bottom row drew a line across the sky. The ground always hides these rows.
 */
const HILLS_CLEAR_BOTTOM = 4;

const DEPTH = { hills: 1, ground: 5, train: 7, objects: 9 } as const;

function hex(color: string): number {
  return Number.parseInt(color.replace('#', ''), 16);
}

function drawShapes(
  g: Phaser.GameObjects.Graphics,
  shapes: readonly Shape[],
  offsetX: number,
  offsetY: number,
): void {
  for (const shape of shapes) {
    g.fillStyle(hex(shape.color), 1);
    g.fillPoints(
      shape.points.map(
        ([x, y]) => new Phaser.Math.Vector2(x + offsetX, offsetY - y),
      ),
      true,
    );
  }
}

interface VehicleSlot {
  container: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  front: Phaser.GameObjects.Image;
  rear: Phaser.GameObjects.Image;
}

/**
 * Side view of the ride (doc 03 §7, doc 07 §3) drawn from the simulation:
 * track chunks and objects only inside the render window, vehicles only when
 * on screen. Every vehicle has its own pose from its two bogie samples.
 */
export class RideScene extends Phaser.Scene {
  readonly #host: RideSceneHost;
  readonly #chunkGraphics = new Map<number, Phaser.GameObjects.Graphics>();
  readonly #objectImages = new Map<string, Phaser.GameObjects.Image>();
  readonly #slots: VehicleSlot[] = [];
  #hills: Phaser.GameObjects.TileSprite | undefined;
  #cameraY: number | undefined;
  #originX = 0;
  #rideRef: RideSimulation | undefined;
  /** Visible world rectangle (render-local units) of the latest frame. */
  #view = { left: 0, top: 0, zoom: 1 };
  #visibleObjects: { id: string; x: number; y: number }[] = [];
  stats: RenderStats = { renderedVehicles: 0, renderedChunks: 0 };

  constructor(host: RideSceneHost) {
    super('ride');
    this.#host = host;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#bfe3f2');
    for (const vehicle of this.#host.catalogVehicles()) {
      const height = vehicleBodyHeightU(vehicle);
      const g = this.make.graphics({}, false);
      drawShapes(g, vehicleShapes(vehicle), 0, height);
      g.generateTexture(
        `vehicle-${vehicle.id}`,
        Math.ceil(vehicle.lengthU),
        Math.ceil(height),
      );
      g.destroy();
    }
    const wheel = this.make.graphics({}, false);
    wheel.fillStyle(0x222222, 1).fillCircle(16, 16, 16);
    wheel.fillStyle(0x7f8c8d, 1).fillCircle(16, 16, 6);
    wheel
      .lineStyle(3, 0x7f8c8d, 1)
      .lineBetween(16, 2, 16, 30)
      .lineBetween(2, 16, 30, 16);
    wheel.generateTexture('wheel', 32, 32);
    wheel.destroy();
    const object = this.make.graphics({}, false);
    drawShapes(object, OBJECT_SHAPES, 32, 44);
    object.generateTexture('object-sheep', 64, 48);
    object.destroy();
    // Seamless tile: the outline starts and ends at the same height and the
    // fill reaches below the ground line, so no sky shows under the hills.
    const outline = [
      0,
      170,
      120,
      140,
      260,
      220,
      420,
      90,
      600,
      200,
      760,
      120,
      900,
      210,
      HILLS_WIDTH,
      170,
    ];
    const hills = this.make.graphics({}, false);
    hills.fillStyle(0xa9d18e, 1);
    const points: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < outline.length; i += 2) {
      points.push(
        new Phaser.Math.Vector2(outline[i] ?? 0, outline[i + 1] ?? 0),
      );
    }
    points.push(
      new Phaser.Math.Vector2(HILLS_WIDTH, HILLS_HEIGHT - HILLS_CLEAR_BOTTOM),
      new Phaser.Math.Vector2(0, HILLS_HEIGHT - HILLS_CLEAR_BOTTOM),
    );
    hills.fillPoints(points, true);
    hills.generateTexture('hills', HILLS_WIDTH, HILLS_HEIGHT);
    hills.destroy();
    this.#hills = this.add
      .tileSprite(0, 0, HILLS_WIDTH, HILLS_HEIGHT, 'hills')
      .setDepth(DEPTH.hills)
      .setOrigin(0, 1);
  }

  /** CSS px → render-local world point for the latest drawn frame. */
  #toWorld(cssX: number, cssY: number, canvasRect: DOMRect) {
    const gamePerCss = this.scale.width / Math.max(1, canvasRect.width);
    return {
      x:
        this.#view.left +
        ((cssX - canvasRect.left) * gamePerCss) / this.#view.zoom,
      y:
        this.#view.top +
        ((cssY - canvasRect.top) * gamePerCss) / this.#view.zoom,
      unitsPerCss: gamePerCss / this.#view.zoom,
    };
  }

  /** CSS px → interactive object id under the finger (doc 02 §3). */
  hitObject(
    cssX: number,
    cssY: number,
    canvasRect: DOMRect,
  ): string | undefined {
    const world = this.#toWorld(cssX, cssY, canvasRect);
    // At least ~40 CSS px around the object, larger than the drawing itself.
    const radius = Math.max(OBJECT_RADIUS_U * 1.4, 40 * world.unitsPerCss);
    let best: { id: string; distance: number } | undefined;
    for (const object of this.#visibleObjects) {
      const distance = Math.hypot(
        world.x - object.x,
        world.y - (object.y - OBJECT_RADIUS_U),
      );
      if (distance <= radius && (!best || distance < best.distance)) {
        best = { id: object.id, distance };
      }
    }
    return best?.id;
  }

  /** Screen positions (CSS px) of visible objects, for diagnostics and E2E. */
  objectScreenPositions(
    canvasRect: DOMRect,
  ): { id: string; x: number; y: number }[] {
    const cssPerGame = Math.max(1, canvasRect.width) / this.scale.width;
    return this.#visibleObjects.map((object) => ({
      id: object.id,
      x:
        canvasRect.left +
        (object.x - this.#view.left) * this.#view.zoom * cssPerGame,
      y:
        canvasRect.top +
        (object.y - OBJECT_RADIUS_U - this.#view.top) *
          this.#view.zoom *
          cssPerGame,
    }));
  }

  #reset(): void {
    for (const graphics of this.#chunkGraphics.values()) graphics.destroy();
    this.#chunkGraphics.clear();
    for (const image of this.#objectImages.values()) image.destroy();
    this.#objectImages.clear();
    for (const slot of this.#slots) slot.container.destroy();
    this.#slots.length = 0;
    this.#cameraY = undefined;
    this.#visibleObjects = [];
  }

  override update(time: number, delta: number): void {
    const alpha = this.#host.frame(delta / 1000, time);
    const ride = this.#host.ride();
    if (ride !== this.#rideRef) {
      this.#reset();
      this.#rideRef = ride;
    }
    if (!ride) {
      this.stats = { renderedVehicles: 0, renderedChunks: 0 };
      return;
    }
    const camera = this.cameras.main;
    camera.setZoom(this.scale.height / REFERENCE_HEIGHT_U);
    const viewW = this.scale.width / camera.zoom;
    const viewH = this.scale.height / camera.zoom;

    const headS =
      ride.previousHeadS + (ride.headS - ride.previousHeadS) * alpha;
    const head = ride.sample(headS);
    this.#originX = Math.floor(head.x / ORIGIN_STEP_U) * ORIGIN_STEP_U;
    // Gentle vertical follow; horizontal follow is exact (doc 03 §7).
    const smoothing = Math.min(1, (delta / 1000) * 4);
    this.#cameraY =
      this.#cameraY === undefined
        ? head.y
        : this.#cameraY + (head.y - this.#cameraY) * smoothing;
    const centerX = head.x - this.#originX + (0.5 - LOCO_ANCHOR_X) * viewW;
    const centerY = -this.#cameraY - (RAIL_ANCHOR_Y - 0.5) * viewH;
    camera.centerOn(centerX, centerY);
    this.#view = {
      left: centerX - viewW / 2,
      top: centerY - viewH / 2,
      zoom: camera.zoom,
    };
    if (this.#hills) {
      // Distant hills scroll slower than the track (parallax, doc 07 §3).
      this.#hills.setPosition(this.#view.left, this.#view.top + viewH);
      this.#hills.setSize(viewW + 2, HILLS_HEIGHT);
      this.#hills.tilePositionX = (head.x * 0.3) % HILLS_WIDTH;
    }

    const leftX = head.x - LOCO_ANCHOR_X * viewW - 64;
    const rightX = head.x + (1 - LOCO_ANCHOR_X) * viewW + 64;
    this.#drawTrack(ride, leftX, rightX);
    this.#drawObjects(ride, leftX, rightX);
    this.#drawTrain(ride, headS, leftX, rightX);
  }

  #drawTrack(ride: RideSimulation, leftX: number, rightX: number): void {
    const first = Math.max(
      ride.track.firstChunkIndex,
      Math.floor(leftX / CHUNK_WIDTH_U) - 1,
    );
    const last = Math.min(
      ride.track.lastChunkIndex,
      Math.floor(rightX / CHUNK_WIDTH_U) + 1,
    );
    for (const [index, graphics] of this.#chunkGraphics) {
      if (index < first || index > last) {
        graphics.destroy();
        this.#chunkGraphics.delete(index);
      }
    }
    for (let k = first; k <= last; k++) {
      let graphics = this.#chunkGraphics.get(k);
      if (!graphics) {
        graphics = this.add.graphics().setDepth(DEPTH.ground);
        const table = ride.track.chunkTable(k);
        const x0 = k * CHUNK_WIDTH_U;
        const ground = table.xs.map(
          (x, i) => new Phaser.Math.Vector2(x - x0, -(table.ys[i] ?? 0) + 4),
        );
        const endY = -(table.ys[table.ys.length - 1] ?? 0) + 4;
        ground.push(
          new Phaser.Math.Vector2(CHUNK_WIDTH_U + GROUND_OVERLAP_U, endY),
          new Phaser.Math.Vector2(
            CHUNK_WIDTH_U + GROUND_OVERLAP_U,
            GROUND_DEPTH_U,
          ),
          new Phaser.Math.Vector2(0, GROUND_DEPTH_U),
        );
        graphics.fillStyle(0x8cbf6a, 1).fillPoints(ground, true);
        graphics.fillStyle(0x7a5c3e, 1);
        for (let i = 0; i < table.xs.length; i += 3) {
          graphics.fillRect(
            (table.xs[i] ?? 0) - x0 - 5,
            -(table.ys[i] ?? 0) - 1,
            10,
            6,
          );
        }
        graphics.lineStyle(4, 0x5b4a3a, 1);
        graphics.strokePoints(
          table.xs.map(
            (x, i) => new Phaser.Math.Vector2(x - x0, -(table.ys[i] ?? 0) - 2),
          ),
          false,
          false,
        );
        this.#chunkGraphics.set(k, graphics);
      }
      graphics.setPosition(k * CHUNK_WIDTH_U - this.#originX, 0);
    }
    this.stats.renderedChunks = this.#chunkGraphics.size;
  }

  #drawObjects(ride: RideSimulation, leftX: number, rightX: number): void {
    const visible = new Set<string>();
    this.#visibleObjects = [];
    for (const object of ride.objectsBetween(
      ride.track.startS,
      ride.track.endS,
    )) {
      const point = ride.sample(object.s);
      if (point.x < leftX || point.x > rightX) continue;
      visible.add(object.id);
      let image = this.#objectImages.get(object.id);
      if (!image) {
        image = this.add
          .image(0, 0, 'object-sheep')
          .setOrigin(0.5, 1)
          .setDepth(DEPTH.objects);
        this.#objectImages.set(object.id, image);
      }
      const age = ride.reactionAge(object.id);
      const hop =
        age !== undefined && age < REACTION_TICKS
          ? Math.sin((age / REACTION_TICKS) * Math.PI) * 24
          : 0;
      const x = point.x - this.#originX;
      // Objects stand on the ground in front of the track (lower on screen).
      const y = -point.y + 30;
      image.setPosition(x, y - hop);
      this.#visibleObjects.push({ id: object.id, x, y });
    }
    for (const [id, image] of this.#objectImages) {
      if (!visible.has(id)) {
        image.destroy();
        this.#objectImages.delete(id);
      }
    }
  }

  #slot(index: number): VehicleSlot {
    let slot = this.#slots[index];
    if (!slot) {
      const body = this.add.image(0, 0, 'wheel');
      const front = this.add.image(0, 0, 'wheel');
      const rear = this.add.image(0, 0, 'wheel');
      const container = this.add
        .container(0, 0, [body, front, rear])
        .setDepth(DEPTH.train);
      slot = { container, body, front, rear };
      this.#slots[index] = slot;
    }
    return slot;
  }

  #drawTrain(
    ride: RideSimulation,
    headS: number,
    leftX: number,
    rightX: number,
  ): void {
    const vehicles = this.#host.journeyVehicles();
    let rendered = 0;
    for (let i = 0; i < vehicles.length; i++) {
      const vehicle = vehicles[i];
      if (!vehicle) break;
      const pose = ride.vehiclePose(i, headS);
      if (pose.centerX - vehicle.lengthU > rightX) continue;
      // Later vehicles are further left; stop once one is off screen.
      if (pose.centerX + vehicle.lengthU < leftX) break;
      const slot = this.#slot(rendered);
      rendered += 1;
      const wheelScale = (vehicle.wheelRadiusU * 2) / 32;
      const lift = vehicle.wheelRadiusU * 1.3;
      slot.container.setVisible(true);
      slot.container.setPosition(pose.centerX - this.#originX, -pose.centerY);
      slot.container.setRotation(-pose.angleRad);
      slot.body
        .setTexture(`vehicle-${vehicle.id}`)
        .setOrigin(0.5, 1)
        .setPosition(0, -lift);
      const centerS = headS - (ride.layout.centerOffsetsU[i] ?? 0);
      // Wheels turn with travelled distance, not with time (doc 03 §3).
      const spin = -centerS / vehicle.wheelRadiusU;
      for (const [wheel, x] of [
        [slot.front, vehicle.bogieOffsetU],
        [slot.rear, -vehicle.bogieOffsetU],
      ] as const) {
        wheel
          .setPosition(x, -vehicle.wheelRadiusU)
          .setScale(wheelScale)
          .setRotation(-spin);
      }
    }
    for (let i = rendered; i < this.#slots.length; i++)
      this.#slots[i]?.container.setVisible(false);
    this.stats.renderedVehicles = rendered;
  }
}
