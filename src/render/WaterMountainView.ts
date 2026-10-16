import type Phaser from 'phaser';
import type { SceneryProp } from '../domain/world/Scenery.ts';
import type { Season } from '../domain/world/Regions.ts';
import { waterMountainParts as parts } from '../content/world-modules/water-mountains.art.ts';
import { frameTexture } from './frameTexture.ts';
import { frameOrigin } from './atlasPacking.ts';
import {
  ferryPose,
  boatFlip,
  type FerryPose,
  type WaterMountainDiagnostic,
} from './waterMountainMotion.ts';

export const waterMountainCompound = (kind: string): boolean =>
  [
    'back.ferry',
    'near.fisherman',
    'back.excavator',
    'back.cableway-tower',
  ].includes(kind);
/** Chunk-owned compound: all images, joints and cable die with the root container. */
export class WaterMountainView {
  readonly root: Phaser.GameObjects.Container;
  readonly images: Phaser.GameObjects.Image[] = [];
  readonly pose: FerryPose = { ratio: 0, direction: 1, moored: true };
  readonly #prop: SceneryProp;
  readonly #season: Season;
  readonly #arm: Phaser.GameObjects.Container | undefined;
  readonly #cabin: Phaser.GameObjects.Image | undefined;
  readonly #cableRiseU: number;
  readonly #cableYU: number;
  readonly #boatFront: 'left' | 'right';
  constructor(
    scene: Phaser.Scene,
    prop: SceneryProp,
    texture: string,
    pxPerU: number,
    season: Season,
    supportHeights: {
      leftStationYU: number;
      rightTowerYU: number;
      rightStationYU: number;
    },
  ) {
    this.#prop = prop;
    this.#season = season;
    const cableRiseU = supportHeights.rightTowerYU;
    this.#cableRiseU = cableRiseU;
    const cable = parts['back.cableway-tower'];
    this.#cableYU =
      (cable?.anchorsU?.['cable']?.y ?? 0) - (cable?.pivotU.y ?? 0);
    this.root = scene.add.container(0, 0).setName(prop.id);
    const image = (key: string, x = 0, y = 0, parent = this.root) => {
      const part = parts[key];
      if (!part) throw new Error(`missing compound art ${key}`);
      const im = scene.add
          .image(x, y, frameTexture(key, texture), key)
          .setData('world-part', key),
        origin = frameOrigin(part.pivotU, pxPerU, im.frame);
      im.setOrigin(origin.x, origin.y).setScale(1 / pxPerU);
      parent.add(im);
      this.images.push(im);
      return im;
    };
    const joint = (x: number, y: number, parent = this.root) => {
      const root = scene.add.container(x, y);
      parent.add(root);
      return root;
    };
    const anchor = (key: string, name: string) => {
      const part = parts[key],
        at = part?.anchorsU?.[name];
      if (!part || !at)
        throw new Error(`missing compound anchor ${key}/${name}`);
      return { x: at.x - part.pivotU.x, y: at.y - part.pivotU.y };
    };
    const bow = anchor('back.ferry', 'bow'),
      stern = anchor('back.ferry', 'stern');
    this.#boatFront = bow.x >= stern.x ? 'right' : 'left';
    if (prop.kind === 'near.fisherman') {
      image(prop.kind);
      const at = anchor(prop.kind, 'rod');
      this.#arm = joint(at.x, at.y);
      image('near.fishing-rod', 0, 0, this.#arm);
    } else if (prop.kind === 'back.ferry') {
      image(prop.kind);
      const at = anchor(prop.kind, 'arm');
      this.#arm = joint(at.x, at.y);
      image('back.ferryman-arm', 0, 0, this.#arm);
    } else if (prop.kind === 'back.excavator') {
      image(prop.kind);
      const body = parts[prop.kind];
      if (!body) throw new Error('missing excavator art');
      for (const wheel of body.wheels ?? [])
        image(
          wheel.part,
          wheel.atU.x - body.pivotU.x,
          wheel.atU.y - body.pivotU.y,
        );
      const at = anchor(prop.kind, 'armJoint');
      const arm = joint(at.x, at.y);
      this.#arm = arm;
      image('back.excavator-boom', 0, 0, arm);
      const boom = parts['back.excavator-boom'],
        stickPart = parts['back.excavator-stick'];
      if (!boom?.endU || !stickPart?.endU)
        throw new Error('missing excavator joints');
      const stick = joint(
        boom.endU.x - boom.pivotU.x,
        boom.endU.y - boom.pivotU.y,
        arm,
      );
      stick.setRotation(1.65);
      image('back.excavator-stick', 0, 0, stick);
      const bucket = joint(
        stickPart.endU.x - stickPart.pivotU.x,
        stickPart.endU.y - stickPart.pivotU.y,
        stick,
      );
      bucket.setRotation(-0.8);
      image('back.excavator-bucket', 0, 0, bucket);
    } else if (prop.kind === 'back.cableway-tower') {
      image(prop.kind);
      image(prop.kind, 320, cableRiseU);
      image('back.cableway-station', -35, supportHeights.leftStationYU);
      image('back.cableway-station', 365, supportHeights.rightStationYU);
      const tower = anchor(prop.kind, 'cable'),
        station = anchor('back.cableway-station', 'cable');
      const wire = scene.add
        .graphics()
        .lineStyle(6, 0x34474b)
        .beginPath()
        .moveTo(-35 + station.x, supportHeights.leftStationYU + station.y)
        .lineTo(tower.x, tower.y)
        .lineTo(320 + tower.x, cableRiseU + tower.y)
        .lineTo(365 + station.x, supportHeights.rightStationYU + station.y)
        .strokePath();
      this.root.add(wire);
      this.#cabin = image('back.cableway-cabin', tower.x, tower.y);
    }
    this.update(0);
  }
  get diagnostic(): WaterMountainDiagnostic {
    return {
      id: this.#prop.id,
      kind: this.#prop.kind,
      xU: this.root.x,
      yU: this.root.y,
      wheelAngleRad: null,
      armAngleRad: this.#arm?.rotation ?? null,
      cabinXU: this.#cabin?.x ?? null,
      ferryRatio: this.#prop.kind === 'back.ferry' ? this.pose.ratio : null,
      moored: this.#prop.kind === 'back.ferry' ? this.pose.moored : null,
      direction: this.#prop.kind === 'back.ferry' ? this.pose.direction : null,
      frames: this.images.map((im) => String(im.frame.name)),
    };
  }
  update(timeSec: number): void {
    const p = this.#prop;
    if (p.kind === 'back.ferry') {
      ferryPose(timeSec, p.phase, this.pose, this.#season);
      this.root.setScale(
        Math.abs(this.root.scaleY) *
          (boatFlip(this.pose.direction, this.#boatFront) ? -1 : 1),
        this.root.scaleY,
      );
      const t = (timeSec + p.phase * 20) % 20;
      this.#arm?.setRotation(t < 2 ? 0.5 * Math.sin(t * Math.PI * 2) : 0);
    } else if (p.kind === 'near.fisherman') {
      const t = (timeSec + p.phase * 35) % 35;
      this.#arm?.setRotation(
        t < 3 ? -0.08 + 0.2 * Math.sin((t * Math.PI) / 3) : 0,
      );
    } else if (p.kind === 'back.excavator')
      this.#arm?.setRotation(
        -0.85 +
          0.1 * Math.sin((timeSec * Math.PI) / 12 + p.phase * 2 * Math.PI),
      );
    else if (this.#cabin) {
      const t = (timeSec / 40 + p.phase) % 2,
        r = t < 1 ? t : 2 - t;
      this.#cabin.setPosition(320 * r, this.#cableYU + this.#cableRiseU * r);
    }
  }
}
