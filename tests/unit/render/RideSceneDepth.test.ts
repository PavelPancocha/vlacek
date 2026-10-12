import { expect, it } from 'vitest';
import { DEPTH } from '../../../src/render/RideSceneDepth.ts';

it('keeps particles in front of the train and foreground (doc 07 §3)', () => {
  expect(DEPTH.effects).toBeGreaterThan(
    Math.max(DEPTH.train, DEPTH.wires, DEPTH.nearProps, DEPTH.objects),
  );
});
