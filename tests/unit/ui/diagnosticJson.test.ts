import { expect, it } from 'vitest';
import { diagnosticJson } from '../../../src/app/debugSnapshot.ts';
it('keeps numeric frame rows compact and round trips the complete snapshot', () => {
  const sample = {
    framePacing: {
      summary: { frames: 2 },
      columns: ['frame', 'time'],
      frames: [
        [0, 16.7, 1e-8],
        [1, 50, 0],
      ],
      events: [[0, 16.7, 2, 3, 4]],
    },
    seed: 20261009,
  };
  const text = diagnosticJson(sample);
  expect(text).toContain('[0,16.7,1e-8]');
  expect(JSON.parse(text)).toEqual(sample);
});
