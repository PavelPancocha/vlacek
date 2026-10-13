import Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig.ts';
import {
  catenaryAnchors,
  catenaryParts,
  worldParts,
} from '../content/worldArt.ts';
import {
  buildArcLengthTable,
  heightAtX,
} from '../domain/world/ArcLengthTable.ts';
import { catenaryPoleXs, catenarySupport } from '../domain/world/Catenary.ts';
import { chunkCatenary } from './CatenaryView.ts';

// Replace only the platform; retain frame margins and all image transforms.
vi.mock('phaser', () => {
  class Image {
    x = 0;
    y = 0;
    originX = 0;
    originY = 0;
    scaleX = 1;
    scaleY = 1;
    rotation = 0;
    frame: { width: number; height: number; name: string };
    constructor(
      _scene: unknown,
      _x: number,
      _y: number,
      _texture: string,
      key: keyof typeof worldParts,
    ) {
      const part = worldParts[key];
      this.frame = {
        width: part.widthU * 2 + 2,
        height: part.heightU * 2 + 2,
        name: key,
      };
    }
    setOrigin(x: number, y: number) {
      this.originX = x;
      this.originY = y;
      return this;
    }
    setPosition(x: number, y: number) {
      this.x = x;
      this.y = y;
      return this;
    }
    setScale(x: number, y: number) {
      this.scaleX = x;
      this.scaleY = y;
      return this;
    }
    setRotation(angle: number) {
      this.rotation = angle;
      return this;
    }
  }
  class Container {
    list: Image[] = [];
    add(image: Image) {
      this.list.push(image);
      return this;
    }
    setDepth() {
      return this;
    }
  }
  return {
    default: {
      Scene: class {
        add = {
          container: () => new Container(),
          image: (
            x: number,
            y: number,
            texture: string,
            key: keyof typeof worldParts,
          ) => new Image(this, x, y, texture, key),
        };
      },
      GameObjects: { Container, Image },
    },
  };
});

/** Transform an art point through the actual image's frame, pivot and scale. */
function drawnPoint(
  image: Phaser.GameObjects.Image,
  point: { x: number; y: number },
) {
  const x =
    (point.x * 2 + 1 - image.originX * image.frame.width) * image.scaleX;
  const y =
    (point.y * 2 + 1 - image.originY * image.frame.height) * image.scaleY;
  return {
    x: image.x + x * Math.cos(image.rotation) - y * Math.sin(image.rotation),
    y: image.y + x * Math.sin(image.rotation) + y * Math.cos(image.rotation),
  };
}

describe('CatenaryView art geometry (TRN-08)', () => {
  it('renders pole clamps on the contact wire at both ends of every span', () => {
    const { chunkWidthU, catenaryContactHeightU, catenaryPoleSpacingU } =
      gameConfig.world;
    const span = worldParts[catenaryParts.span];
    expect(span.pivotU).toEqual({ x: 0, y: span.heightU - 2 });
    expect(catenaryAnchors.contact.y - catenaryAnchors.messenger.y).toBe(
      span.pivotU.y - 2,
    );
    expect(catenaryAnchors.contact.x).toBe(catenaryAnchors.messenger.x);
    for (const grade of [
      -gameConfig.world.maxTrackGrade,
      0,
      gameConfig.world.maxTrackGrade,
    ]) {
      const chunkIndex = 2;
      const x0 = chunkIndex * chunkWidthU;
      const table = buildArcLengthTable(
        {
          vertices: [
            { xU: 0, yU: 40 },
            { xU: chunkWidthU, yU: 40 + grade * chunkWidthU },
          ],
          transitionU: gameConfig.world.profile.transitionU,
        },
        chunkIndex,
        chunkWidthU,
        gameConfig.world.arcSampleSpacingU,
      );
      const rendered = chunkCatenary(
        new Phaser.Scene(),
        { texture: 'world', pxPerU: 2 },
        table,
        123,
        { poles: 0, wires: 1 },
      );
      const [poles, wires] = rendered.containers;
      if (!poles || !wires) throw new Error('containers missing');
      const xs = catenaryPoleXs(123, x0, x0 + chunkWidthU);
      const masts = xs.filter((x) => catenarySupport(123, x) === 'mast');
      expect(rendered.poles).toBeGreaterThan(0);
      expect(poles.list).toHaveLength(masts.length);
      expect(wires.list).toHaveLength(xs.length);
      for (const [index, object] of poles.list.entries()) {
        if (!(object instanceof Phaser.GameObjects.Image))
          throw new Error('pole image missing');
        const x = masts[index];
        if (x === undefined) throw new Error('mast missing');
        const clamp = drawnPoint(object, catenaryAnchors.contact);
        expect(clamp.x).toBeCloseTo(x - x0, 9);
        expect(clamp.y).toBeCloseTo(
          -heightAtX(table, x) - catenaryContactHeightU,
          9,
        );
      }
      for (const [index, object] of wires.list.entries()) {
        if (!(object instanceof Phaser.GameObjects.Image))
          throw new Error('wire image missing');
        const x = xs[index];
        if (x === undefined) throw new Error('wire support missing');
        const next = catenaryPoleXs(
          123,
          x + 1,
          x + 2 * catenaryPoleSpacingU,
        )[0];
        if (next === undefined) throw new Error('next support missing');
        const start = drawnPoint(object, span.pivotU);
        const end = drawnPoint(object, { x: span.widthU, y: span.pivotU.y });
        expect(start.x).toBeCloseTo(x - x0, 9);
        expect(start.y).toBeCloseTo(
          -heightAtX(table, x) - catenaryContactHeightU,
          9,
        );
        expect(end.x).toBeCloseTo(next - x0, 9);
        expect(end.y).toBeCloseTo(
          -heightAtX(table, next) - catenaryContactHeightU,
          9,
        );
      }
    }
  });
});
