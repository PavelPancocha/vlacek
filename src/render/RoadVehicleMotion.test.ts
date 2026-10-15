import type Phaser from 'phaser';
import { expect, it, vi } from 'vitest';
import { RoadVehicleMotion } from './RoadVehicleMotion.ts';
import { roadVehicleArt } from '../content/roadVehicleArt.ts';

it('SCN-RD03/07: moving wheels/puff, stationary heading, pause, world-space exhaust and owned cleanup', () => {
  const circles: number[][] = [];
  const graphics = {
    clear() {
      circles.length = 0;
      return this;
    },
    setPosition() {
      return this;
    },
    setScale() {
      return this;
    },
    setRotation() {
      return this;
    },
    lineStyle() {
      return this;
    },
    lineBetween() {
      return this;
    },
    fillStyle() {
      return this;
    },
    fillCircle(x: number, y: number, r: number) {
      circles.push([x, y, r]);
      return this;
    },
    destroy: vi.fn(),
  };
  // Only the Phaser drawing boundary is replaced; motion logic is real.
  const scene = {
    add: { graphics: () => graphics },
  } as unknown as Phaser.Scene;
  const image = {
    x: 100,
    y: 50,
    rotation: 0,
    flipX: false,
    scaleX: 0.8,
  } as Phaser.GameObjects.Image;
  const part = {
    file: 'back.car.svg',
    widthU: 60,
    heightU: 28,
    pivotU: { x: 30, y: 28 },
  };
  const art = roadVehicleArt['back.car'];
  if (!art) throw new Error('car metadata missing');
  const view = new RoadVehicleMotion(scene);
  view.update(image, part, art, 70, 0, 1, 1, true, 1);
  expect(view.wheelAngleRad).toBeGreaterThan(0);
  expect(view.exhaust).toBe(true);
  expect(view.frontX).toBe(1);
  expect(view.arrows).toBe(true);
  const x = circles[0]?.[0],
    wheel = view.wheelAngleRad;
  image.x = 120;
  view.update(image, part, art, 70, 0, 1.1, 1, true, 1);
  expect(circles[0]?.[0]).toBe(x);
  view.shiftX(100);
  image.x += 100;
  view.update(image, part, art, 70, 0, 1.1, 1, true, 1);
  expect(circles[0]?.[0]).toBe((x ?? 0) + 100);
  const paused = view.wheelAngleRad;
  view.update(image, part, art, 70, 0, 1.1, 1, true, 1);
  expect(view.wheelAngleRad).toBe(paused);
  view.update(image, part, art, 0, 0, 1.2, 1, true, 1);
  expect(view.wheelAngleRad).toBe(paused);
  expect(view.exhaust).toBe(false);
  expect(view.frontX).toBe(1);
  image.flipX = true;
  view.update(image, part, art, -70, 0, 1.3, 1, true, 1);
  expect(view.wheelAngleRad).toBeLessThan(paused);
  expect(view.frontX).toBe(-1);
  expect(wheel).toBeGreaterThan(0);
  view.destroy();
  expect(graphics.destroy).toHaveBeenCalledOnce();
});
