import { expect, it } from 'vitest';
import { settlementAttachmentAngle } from '../../../src/render/settlementMotion.ts';
it('D-024: swing has a bounded local motion, winters stand still, only the designated actor waves', () => {
  expect(
    settlementAttachmentAngle('back.playground-swing', 1, 0, false, false, 1),
  ).not.toBe(0);
  expect(
    settlementAttachmentAngle('back.playground-swing', 1, 0, true, false, 1),
  ).toBe(0);
  for (let t = 0; t < 60; t += 0.2)
    expect(
      Math.abs(
        settlementAttachmentAngle(
          'back.playground-swing',
          t,
          0,
          false,
          false,
          1,
        ),
      ),
    ).toBeLessThanOrEqual(0.055);
  expect(
    settlementAttachmentAngle('back.dispatcher-arm', 0.5, 0, false, true, 1),
  ).toBeLessThan(-2);
  expect(
    Math.abs(
      settlementAttachmentAngle('back.dispatcher-arm', 0.5, 0, false, false, 1),
    ),
  ).toBeLessThan(0.02);
  expect(
    Math.abs(
      settlementAttachmentAngle('back.dispatcher-arm', 5, 0, false, true, 1),
    ),
  ).toBeLessThan(0.02);
});
