import { expect, it, vi } from 'vitest';
import { uiModelEqual, type UiModel } from '../../../src/ui/UiLayer.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import { GameSession } from '../../../src/app/GameSession.ts';
import { createSession } from '../../integration/helpers.ts';

it('compares equal UI values without serialization and detects each displayed change', () => {
  const session: GameSession = createSession();
  const model: UiModel = {
    screen: { name: 'RIDING' },
    draft: session.draft,
    settings: session.settings,
    notices: [],
    fullSignals: 0,
    hasJourney: true,
    seed: 1,
    portrait: false,
    fullscreen: { supported: true, active: false, failed: false },
    buildId: 'test',
    devActive: false,
    locomotives,
    wagons,
    lengthRules: session.lengthRules,
  };
  const stringify = vi.spyOn(JSON, 'stringify');
  for (let i = 0; i < 60; i++)
    expect(
      uiModelEqual(model, {
        ...model,
        screen: { ...model.screen },
        fullscreen: { ...model.fullscreen },
        notices: [],
      }),
    ).toBe(true);
  expect(stringify).not.toHaveBeenCalled();
  stringify.mockRestore();
  for (const changed of [
    { seed: 2 },
    { portrait: true },
    { fullSignals: 1 },
    { hasJourney: false },
    { devActive: true },
    { notices: ['storage-limited'] as const },
    { screen: { name: 'PAUSED', reason: 'user' } as const },
    { settings: { ...model.settings, sfxEnabled: !model.settings.sfxEnabled } },
    { fullscreen: { ...model.fullscreen, failed: true } },
  ])
    expect(uiModelEqual(model, { ...model, ...changed })).toBe(false);
});
