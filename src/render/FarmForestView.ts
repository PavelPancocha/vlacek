import { frameTexture } from './frameTexture.ts';
import type Phaser from 'phaser';
import type { SceneryProp } from '../domain/world/Scenery.ts';
import type { Season } from '../domain/world/Regions.ts';
import {
  farmForestParts,
  type FarmForestPart,
} from '../content/world-modules/farm-forest.art.ts';
import { worldParts } from '../content/worldArt.ts';
import type { ArtPart } from '../content/artManifest.ts';
import { setWorldPivot } from './worldImage.ts';
import { vehicleHeading } from '../domain/interaction/VehicleHeading.ts';
import {
  forestWorkPose,
  type ForestWorkPose,
  type FarmForestDiagnostic,
} from './farmForestMotion.ts';

const parts: Readonly<Record<string, ArtPart>> = worldParts;
/** One compound instance, owned/destroyed by its chunk's existing container. */
export class FarmForestView {
  readonly root: Phaser.GameObjects.Container;
  readonly beds: { root: Phaser.GameObjects.Container; offsetXU: number }[] =
    [];
  readonly images: Phaser.GameObjects.Image[] = [];
  readonly #prop: SceneryProp;
  readonly #body: Phaser.GameObjects.Image;
  readonly #wheels: { image: Phaser.GameObjects.Image; radiusU: number }[] = [];
  readonly #joints = new Map<string, Phaser.GameObjects.Container>();
  readonly #gripper: Phaser.GameObjects.Image | undefined;
  readonly #trunk: Phaser.GameObjects.Image | undefined;
  readonly #pickup: Phaser.GameObjects.Image | undefined;
  readonly #stack: Phaser.GameObjects.Image | undefined;
  readonly #pose: ForestWorkPose = {
    patrolRatio: 0,
    travelRatio: 0,
    direction: 1,
    gripXU: 0,
    gripYU: 0,
    trunkAngleRad: 0,
    holding: false,
    open: true,
    stacked: false,
  };
  readonly #front: { xU: number; yU: number };
  readonly #heading = { rotationRad: 0, flipX: false };
  readonly #textureFor: (key: string) => string;
  #wheelAngle = 0;

  constructor(
    scene: Phaser.Scene,
    prop: SceneryProp,
    texture: string,
    pxPerU: number,
    season: Season,
    textureFor?: (key: string) => string | undefined,
  ) {
    this.#prop = prop;
    this.#textureFor = (key) => textureFor?.(key) ?? frameTexture(key, texture);
    this.root = scene.add.container(0, 0).setName(prop.id);
    const machine: FarmForestPart | undefined = farmForestParts[prop.kind];
    if (!machine) throw new Error(`missing compound ${prop.kind}`);
    this.#front = { xU: machine.front === 'left' ? -1 : 1, yU: 0 };
    const image = (key: string, pivot = parts[key]?.pivotU) => {
      const part = parts[key];
      if (!part || !pivot) throw new Error(`missing compound child ${key}`);
      const im = scene.add
        .image(0, 0, this.#textureFor(key), key)
        .setData('world-part', key)
        .setName(`${prop.id}:${key}`);
      // The authored pivot (e.g. the trunk's grip) survives a late page.
      setWorldPivot(im, pivot, pxPerU).setScale(1 / pxPerU);
      this.images.push(im);
      return im;
    };
    const wheel = (
      key: string,
      x: number,
      y: number,
      parent: Phaser.GameObjects.Container,
    ) => {
      const im = image(key).setPosition(x, y);
      parent.add(im);
      this.#wheels.push({
        image: im,
        radiusU: (parts[key]?.heightU ?? 16) / 2,
      });
    };
    this.#body = image(prop.kind);
    this.root.add(this.#body);
    for (const w of machine.wheels ?? [])
      wheel(
        w.part,
        w.atU.x - machine.pivotU.x,
        w.atU.y - machine.pivotU.y,
        this.root,
      );
    let tool =
      prop.work === 'plough' || (prop.work === 'sow' && prop.phase < 0.5)
        ? 'back.plough'
        : prop.work === 'bale'
          ? 'back.baler'
          : prop.work === 'snow-clear'
            ? 'back.snow-blade'
            : undefined;
    if (prop.work === 'seasonal')
      tool =
        season === 'winter'
          ? 'back.snow-blade'
          : season === 'autumn'
            ? 'back.plough'
            : undefined;
    if (tool) {
      const part = farmForestParts[tool];
      const hitch = part?.anchorsU?.['hitch'];
      const anchor =
        machine.anchorsU?.[
          tool === 'back.snow-blade' ? 'frontHitch' : 'rearHitch'
        ];
      if (!part || !hitch || !anchor) throw new Error('missing tool hitch');
      const x = anchor.x - machine.pivotU.x + part.pivotU.x - hitch.x,
        y = anchor.y - machine.pivotU.y + part.pivotU.y - hitch.y;
      this.root.add(image(tool).setPosition(x, y));
      for (const w of part.wheels ?? [])
        wheel(
          w.part,
          x + w.atU.x - part.pivotU.x,
          y + w.atU.y - part.pivotU.y,
          this.root,
        );
    }
    for (const sub of machine.subParts ?? []) {
      const parent = sub.parent ? this.#joints.get(sub.parent) : this.root;
      const parentPart = sub.parent ? parts[sub.parent] : machine;
      if (!parent || !parentPart)
        throw new Error(`missing joint parent ${sub.parent}`);
      const joint = scene.add
        .container(
          sub.atU.x - parentPart.pivotU.x,
          sub.atU.y - parentPart.pivotU.y,
        )
        .setRotation(sub.rotationRad);
      const im = image(sub.part);
      joint.add(im);
      parent.add(joint);
      this.#joints.set(sub.part, joint);
      if (sub.part === 'back.harvester-gripper') this.#gripper = im;
    }
    const gripper = this.#joints.get('back.harvester-gripper');
    if (gripper) {
      const grip = farmForestParts['back.work-trunk']?.anchorsU?.['grip'];
      if (!grip) throw new Error('missing trunk grip');
      this.#trunk = image('back.work-trunk', grip).setPosition(0, 11);
      gripper.addAt(this.#trunk, 0);
      if (prop.work === 'forwarder') {
        const left = scene.add.container(0, 0),
          right = scene.add.container(0, 0);
        this.#pickup = image('back.work-trunk', grip)
          .setPosition(-40, -12)
          .setRotation(Math.PI / 2);
        this.#stack = image('back.work-trunk', grip)
          .setPosition(-40, -12)
          .setRotation(Math.PI / 2);
        left.add(this.#pickup);
        right.add(this.#stack);
        this.beds.push(
          { root: left, offsetXU: -(prop.motion?.rangeU ?? 0) / 2 },
          { root: right, offsetXU: (prop.motion?.rangeU ?? 0) / 2 },
        );
      } else {
        this.#pickup = image('back.work-trunk', grip).setPosition(43, -38);
        this.#stack = image('back.work-trunk', grip)
          .setPosition(40, -12)
          .setRotation(Math.PI / 2);
        this.root.addAt(this.#pickup, 0);
        this.root.addAt(this.#stack, 0);
      }
    }
    this.update(0);
  }
  #setFrame(image: Phaser.GameObjects.Image, key: string): void {
    image.setTexture(this.#textureFor(key), key).setData('world-part', key);
  }
  get diagnostic(): FarmForestDiagnostic {
    return {
      id: this.#prop.id,
      kind: this.#prop.kind,
      xU: this.root.x,
      flip: this.root.scaleX < 0,
      wheelAngles: this.#wheels.map((w) => w.image.rotation),
      armAngleRad: this.#joints.get('back.forest-boom')?.rotation,
      holding: this.#trunk?.visible,
      stacked: this.#stack?.visible,
      gripU: this.#trunk
        ? {
            xU: this.#trunk.getWorldTransformMatrix().tx,
            yU: this.#trunk.getWorldTransformMatrix().ty,
          }
        : undefined,
      bedsU: [this.#pickup, this.#stack].flatMap((p) =>
        p
          ? [
              {
                xU: p.getWorldTransformMatrix().tx,
                yU: p.getWorldTransformMatrix().ty,
              },
            ]
          : [],
      ),
    };
  }
  get patrolRatio(): number {
    return this.#pose.patrolRatio;
  }
  update(timeSec: number): void {
    const p = this.#prop;
    if (p.work === 'harvester' || p.work === 'forwarder')
      forestWorkPose(timeSec, p.phase, p.work === 'forwarder', this.#pose);
    if (p.motion) {
      const legs =
        (timeSec * p.motion.speedUPerSec) / p.motion.rangeU + 2 * p.phase;
      const forward =
        p.work === 'forwarder'
          ? this.#pose.direction > 0
          : legs - 2 * Math.floor(legs / 2) < 1;
      const flip = vehicleHeading(
        this.#front,
        (forward ? 1 : -1) * p.motion.speedUPerSec,
        0,
        this.#heading,
      ).flipX;
      this.root.setScale(
        Math.abs(this.root.scaleX) * (flip ? -1 : 1),
        this.root.scaleY,
      );
      this.#wheelAngle =
        p.work === 'forwarder'
          ? this.#pose.travelRatio * p.motion.rangeU
          : timeSec * p.motion.speedUPerSec;
      for (const w of this.#wheels)
        w.image.setRotation(
          this.#wheelAngle / (w.radiusU * Math.abs(this.root.scaleY)),
        );
    }
    this.#joints
      .get('back.combine-header')
      ?.setRotation(0.025 * Math.sin(timeSec * 0.7 + p.phase * 6));
    if (p.work === 'farmer') {
      const wave = (timeSec + p.phase * 24) % 24 > 21;
      this.#setFrame(
        this.#body,
        wave ? 'back.farmer-wave' : 'back.farmer-work',
      );
    }
    const boom = this.#joints.get('back.forest-boom'),
      stick = this.#joints.get('back.forest-stick'),
      gripper = this.#joints.get('back.harvester-gripper');
    if (!boom || !stick || !gripper) return;
    const pose = this.#pose; // Solve the two authored links; grip orientation lays the trunk gently on its bed.
    const flip = this.root.scaleX < 0;
    const angle =
      pose.trunkAngleRad * (p.work === 'forwarder' && flip ? -1 : 1);
    const endX =
        pose.gripXU * (p.work === 'forwarder' && flip ? -1 : 1) +
        11 * Math.sin(angle) -
        boom.x,
      endY = pose.gripYU - 11 * Math.cos(angle) - boom.y;
    const l1 = Math.hypot(26, -3),
      l2 = 22;
    const elbow = Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          (endX * endX + endY * endY - l1 * l1 - l2 * l2) / (2 * l1 * l2),
        ),
      ),
    );
    const shoulder =
      Math.atan2(endY, endX) -
      Math.atan2(l2 * Math.sin(elbow), l1 + l2 * Math.cos(elbow));
    const first = shoulder - Math.atan2(-3, 26),
      second = elbow + Math.atan2(-3, 26);
    boom.setRotation(first);
    stick.setRotation(second);
    gripper.setRotation(angle - first - second);
    if (this.#gripper)
      this.#setFrame(
        this.#gripper,
        pose.open ? 'back.harvester-gripper-open' : 'back.harvester-gripper',
      );
    this.#trunk?.setVisible(pose.holding);
    this.#pickup?.setVisible(!pose.holding && !pose.stacked);
    this.#stack?.setVisible(!pose.holding && pose.stacked);
  }
}
