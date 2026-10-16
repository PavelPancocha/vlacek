import { expect, it, vi } from 'vitest';
import { VisibleComposition } from './VisibleComposition.ts';
it('bakes only visible compositions, releases offscreen pixels and owns repeated entry/exit cleanup', () => {
  const release = vi.fn(),
    bake = vi.fn(() => release);
  const composition = new VisibleComposition(bake);
  composition.setVisible(false);
  expect(bake).not.toHaveBeenCalled();
  for (let cycle = 1; cycle <= 10; cycle++) {
    composition.setVisible(true);
    composition.setVisible(true);
    expect(bake).toHaveBeenCalledTimes(cycle);
    composition.setVisible(false);
    composition.setVisible(false);
    expect(release).toHaveBeenCalledTimes(cycle);
  }
  composition.setVisible(true);
  composition.destroy();
  composition.destroy();
  expect(release).toHaveBeenCalledTimes(11);
});
it('defers unavailable atlas frames without hiding them from diagnostics and bakes when published', () => {
  const release = vi.fn(),
    bake = vi.fn(() => release);
  let unavailable = ['backdrop.forest-dense-far-summer'];
  const composition = new VisibleComposition(bake, () => unavailable);
  composition.setVisible(true);
  expect(bake).not.toHaveBeenCalled();
  expect(composition.missingFrames).toEqual(unavailable);
  composition.setVisible(false);
  expect(composition.missingFrames).toEqual([]);
  unavailable = [];
  composition.setVisible(true);
  expect(bake).toHaveBeenCalledOnce();
  expect(composition.missingFrames).toEqual([]);
  composition.destroy();
  expect(release).toHaveBeenCalledOnce();
});
