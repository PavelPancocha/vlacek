import Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig.ts';
import { catenaryPoleXs, catenarySupport } from '../domain/world/Catenary.ts';
import { tunnelSite, type TunnelSite } from '../domain/world/Structures.ts';
import { TunnelView } from './TunnelView.ts';

// Replace only the drawing platform; run the real tunnel painting in Node.
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: {
      Vector2: class {
        constructor(
          public x: number,
          public y: number,
        ) {}
      },
    },
    GameObjects: {
      Container: class {
        setDepth() {
          return this;
        }
      },
      Graphics: class {
        fillStyle() {}
        fillPoints() {}
        lineStyle() {}
        lineBetween() {}
        strokePoints() {}
        fillCircle() {}
        fillEllipse() {}
        fillRect() {}
      },
    },
  },
}));

const { chunkWidthU, catenaryContactHeightU } = gameConfig.world;

function drawnHangerXs(seed: number, site: TunnelSite): number[] {
  const x0 = site.chunkIndex * chunkWidthU;
  const poles = catenaryPoleXs(seed, x0, x0 + chunkWidthU);
  const scene = new Phaser.Scene();
  const graphics = new Phaser.GameObjects.Graphics(scene);
  const rectangles = vi.spyOn(graphics, 'fillRect');
  new TunnelView(
    scene,
    undefined,
    site,
    { railY: () => 0, meadowY: () => 20 },
    (paint) => {
      paint(graphics);
      return new Phaser.GameObjects.Container(scene);
    },
    { flanks: 0, interior: 1, shade: 2, cover: 3 },
    poles
      .filter((x) => catenarySupport(seed, x) === 'hanger')
      .map((x) => x - x0),
  );
  // The clamp actually painted at the wire, not just a proposed hanger.
  return rectangles.mock.calls
    .filter(
      ([, y, width, height]) =>
        y === -catenaryContactHeightU - 3 && width === 6 && height === 3,
    )
    .map(([x]) => x + 3 + x0);
}

describe('tunnel catenary supports (TRN-08)', () => {
  it('R6: gives every support a mast or a drawn hanger in world 25, chunk 6', () => {
    const site = tunnelSite(25, 6);
    if (!site) throw new Error('no tunnel in world 25, chunk 6');
    const drawn = drawnHangerXs(25, site);
    for (const x of catenaryPoleXs(25, 6 * chunkWidthU, 7 * chunkWidthU))
      expect(
        catenarySupport(25, x) === 'mast' || drawn.includes(x),
        `world 25 chunk 6 support ${x}`,
      ).toBe(true);
  });

  it('R6: gives every support a mast or a drawn hanger across many tunnel worlds', () => {
    let tunnels = 0;
    let hangers = 0;
    for (let seed = 0; seed < 64; seed++) {
      for (let k = -10; k < 64; k += 8) {
        const site = tunnelSite(seed, k);
        if (!site) continue;
        tunnels += 1;
        const drawn = drawnHangerXs(seed, site);
        hangers += drawn.length;
        for (const x of catenaryPoleXs(
          seed,
          k * chunkWidthU,
          (k + 1) * chunkWidthU,
        ))
          expect(
            catenarySupport(seed, x) === 'mast' || drawn.includes(x),
            `world ${seed} chunk ${k} support ${x}`,
          ).toBe(true);
      }
    }
    expect(tunnels).toBeGreaterThan(100);
    expect(hangers).toBeGreaterThan(100);
  });
});
