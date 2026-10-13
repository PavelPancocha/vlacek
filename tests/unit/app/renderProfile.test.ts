import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { renderProfile } from '../../../src/app/renderProfile.ts';

const { quality } = gameConfig;

describe('render profile from the settings (doc 13 quality, doc 07 §9)', () => {
  it('the low profile lowers density, frame rate and effects', () => {
    expect(
      renderProfile({ quality: 'low', reducedEffects: false }, quality),
    ).toEqual({
      maxDpr: quality.low.maxDpr,
      fpsLimit: quality.low.targetFps,
      effects: 'low',
    });
  });

  it('standard and auto keep the display rate; reduced effects lower only the effects', () => {
    for (const setting of ['standard', 'auto'] as const)
      expect(
        renderProfile({ quality: setting, reducedEffects: false }, quality),
      ).toEqual({
        maxDpr: quality.standard.maxDpr,
        fpsLimit: 0,
        effects: 'standard',
      });
    expect(
      renderProfile({ quality: 'auto', reducedEffects: true }, quality),
    ).toEqual({
      maxDpr: quality.standard.maxDpr,
      fpsLimit: 0,
      effects: 'low',
    });
  });
});

it('page quality wins over saved quality without changing the settings', () => {
  const settings = { quality: 'standard', reducedEffects: false } as const;
  expect(renderProfile(settings, quality, 'low')).toEqual({
    maxDpr: 1,
    fpsLimit: 30,
    effects: 'low',
  });
  expect(settings.quality).toBe('standard');
  for (const override of ['auto', 'standard'] as const)
    expect(
      renderProfile(
        { quality: 'low', reducedEffects: false },
        quality,
        override,
      ),
    ).toEqual({ maxDpr: 1.5, fpsLimit: 0, effects: 'standard' });
});
