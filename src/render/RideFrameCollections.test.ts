import { expect, it } from 'vitest';
import { RideFrameCollections } from './RideFrameCollections.ts';

it('reuses scene scratch collections, clears expired crossings, and keeps nearest-first stable chunk order', () => {
  const scratch = new RideFrameCollections<{ id: string; phase: string }>();
  const map = scratch.crossings,
    indices = scratch.chunks;
  const chunks = new Map([
    [0, {}],
    [1, {}],
    [2, {}],
    [3, {}],
  ]);
  for (let i = 0; i < 60; i++) {
    scratch.prepare([{ id: 'a', phase: 'OPEN' }], chunks, 1.5);
    expect(scratch.crossings === map && scratch.chunks === indices).toBe(true);
    expect(scratch.chunks).toEqual([1, 2, 0, 3]);
  }
  chunks.delete(0);
  scratch.prepare([{ id: 'b', phase: 'CLOSED' }], chunks, 2);
  expect([...scratch.crossings.values()]).toEqual([
    { id: 'b', phase: 'CLOSED' },
  ]);
  expect(scratch.chunks).toEqual([2, 1, 3]);
});
