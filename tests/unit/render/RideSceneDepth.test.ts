import { expect, it } from 'vitest';
import { DEPTH } from '../../../src/render/RideSceneDepth.ts';

it('keeps particles in front of the train and foreground (doc 07 §3)', () => {
  expect(DEPTH.effects).toBeGreaterThan(
    Math.max(DEPTH.train, DEPTH.wires, DEPTH.nearProps, DEPTH.objects),
  );
});

it('tunnel-1: opaque rock covers vehicle particles pixel by pixel, while ambient life stays outside', () => {
  expect(DEPTH.trainEffects).toBeGreaterThan(DEPTH.wires);
  expect(DEPTH.trainEffects).toBeLessThan(DEPTH.train + 0.6);
  expect(DEPTH.npcEffects).toBeGreaterThan(DEPTH.backProps + 0.3);
  expect(DEPTH.npcEffects).toBeLessThan(DEPTH.backProps + 0.35);
  expect(DEPTH.effects).toBeGreaterThan(DEPTH.train + 0.6);
});
