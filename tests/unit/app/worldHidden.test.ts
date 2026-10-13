import { describe, expect, it } from 'vitest';
import { worldHidden, type Screen } from '../../../src/app/AppState.ts';

const screens: Screen[] = [
  { name: 'LOADING' },
  { name: 'HOME' },
  { name: 'SELECT_LOCO', origin: 'new' },
  { name: 'SELECT_LOCO', origin: 'pause' },
  { name: 'BUILD_TRAIN', origin: 'new' },
  { name: 'BUILD_TRAIN', origin: 'pause' },
  { name: 'RIDING' },
  { name: 'PAUSED', reason: 'user' },
  { name: 'PAUSED', reason: 'external' },
  { name: 'PAUSED', reason: 'restore' },
  { name: 'RECOVERABLE_ERROR' },
];

describe('ride visibility behind UI layers (D-006)', () => {
  for (const reason of ['user', 'external', 'restore'] as const) {
    for (const portrait of [false, true]) {
      for (const developerMenuOpen of [false, true]) {
        it(`PAUSED ${reason}: portrait=${portrait}, developerMenuOpen=${developerMenuOpen}`, () => {
          expect(
            worldHidden(
              { name: 'PAUSED', reason },
              portrait,
              developerMenuOpen,
            ),
          ).toBe(portrait || developerMenuOpen);
        });
      }
    }
  }
  for (const screen of screens) {
    const context =
      'origin' in screen
        ? screen.origin
        : 'reason' in screen
          ? screen.reason
          : '';
    it(`${screen.name} ${context}: landscape follows the screen opacity`, () => {
      expect(worldHidden(screen, false, false)).toBe(
        screen.name !== 'LOADING' &&
          screen.name !== 'RIDING' &&
          screen.name !== 'PAUSED',
      );
    });
    it(`${screen.name} ${context}: portrait always hides the world`, () => {
      expect(worldHidden(screen, true, false)).toBe(true);
    });
  }
});
