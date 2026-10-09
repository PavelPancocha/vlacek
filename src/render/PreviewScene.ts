import Phaser from 'phaser';

/** Design viewport height in world units (doc 13 `camera.referenceHeightU`). */
const REFERENCE_HEIGHT_U = 720;

/**
 * TEMPORARY placeholder scene (M0 bootstrap): a static rail and train shapes
 * that prove the renderer, scaling and camera anchors. Replaced by the ride
 * renderer driven by the domain simulation.
 */
export class PreviewScene extends Phaser.Scene {
  constructor() {
    super('preview');
  }

  create(): void {
    const g = this.add.graphics();
    g.fillStyle(0x8cbf6a).fillRect(-4000, 0, 12000, 2000);
    g.lineStyle(6, 0x5b4a3a).lineBetween(-4000, -4, 8000, -4);
    for (let x = -4000; x < 8000; x += 24) {
      g.fillStyle(0x7a5c3e).fillRect(x, -2, 12, 6);
    }
    let x = 0;
    for (let i = 0; i < 12; i++) {
      const length = i === 0 ? 156 : 140;
      g.fillStyle(i === 0 ? 0xc0392b : 0x2e86c1).fillRect(
        x - length,
        -64,
        length,
        52,
      );
      g.fillStyle(0x222222)
        .fillCircle(x - length * 0.25, -12, 10)
        .fillCircle(x - length * 0.75, -12, 10);
      x -= length + 8;
    }
  }

  update(): void {
    const camera = this.cameras.main;
    camera.setZoom(this.scale.height / REFERENCE_HEIGHT_U);
    const viewW = this.scale.width / camera.zoom;
    const viewH = this.scale.height / camera.zoom;
    // Locomotive front at 30 % of the width, rail at 65 % of the height.
    camera.centerOn(0 + 0.2 * viewW, 0 - 0.15 * viewH);
  }
}
