import { expect, it } from 'vitest';
import { secondaryWeatherCoversPoint } from '../../../src/render/tunnelCover.ts';
for (const mirrored of [false, true])
  it(`weather follows bounded secondary rock and open arch, mirrored=${mirrored}`, () => {
    const portal = { x: 1000, y: 100, grade: 0, mirrored };
    const sign = mirrored ? -1 : 1;
    expect(
      secondaryWeatherCoversPoint({ x: 1000 + 46 * sign, y: -15 }, portal),
    ).toBe(true);
    expect(
      secondaryWeatherCoversPoint({ x: 1000 - 120 * sign, y: 10 }, portal),
    ).toBe(true);
    expect(secondaryWeatherCoversPoint({ x: 1000, y: 50 }, portal)).toBe(false);
    expect(
      secondaryWeatherCoversPoint({ x: 1000 - 600 * sign, y: 10 }, portal),
    ).toBe(false);
    expect(
      secondaryWeatherCoversPoint({ x: 1000 + 46 * sign, y: -200 }, portal),
    ).toBe(false);
  });

it('a weather sprite crossing the rock edge is hidden even with its centre outside', () => {
  expect(
    secondaryWeatherCoversPoint(
      { x: 72, y: -120 },
      { x: 0, y: 0, grade: 0, mirrored: false },
      16,
    ),
  ).toBe(true);
});
