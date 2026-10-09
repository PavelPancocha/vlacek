import { describe, expect, it } from 'vitest';
import {
  transition,
  type AppEvent,
  type Screen,
} from '../../../src/app/AppState.ts';

type SimpleEvent = Exclude<AppEvent, { type: 'loaded' }>['type'];

function run(start: Screen, ...events: SimpleEvent[]): Screen {
  return events.reduce<Screen>(
    (screen, type) => transition(screen, { type }),
    start,
  );
}

describe('AppState (doc 02 §6)', () => {
  it('UI-01: first run without a save goes straight to locomotive selection', () => {
    expect(
      transition({ name: 'LOADING' }, { type: 'loaded', hasJourney: false }),
    ).toEqual({
      name: 'SELECT_LOCO',
      origin: 'new',
    });
  });

  it('a saved journey offers Pokračovat / Postavit vlak on HOME', () => {
    expect(
      transition({ name: 'LOADING' }, { type: 'loaded', hasJourney: true }),
    ).toEqual({
      name: 'HOME',
    });
    expect(run({ name: 'HOME' }, 'continueJourney')).toEqual({
      name: 'PAUSED',
      reason: 'restore',
    });
    expect(run({ name: 'HOME' }, 'buildNew')).toEqual({
      name: 'SELECT_LOCO',
      origin: 'new',
    });
  });

  it('builds a new train and departs', () => {
    expect(
      run({ name: 'SELECT_LOCO', origin: 'new' }, 'locomotiveChosen', 'depart'),
    ).toEqual({ name: 'RIDING' });
  });

  it('RIDING ↔ PAUSED, and external interruptions pause with their own reason', () => {
    expect(run({ name: 'RIDING' }, 'pause')).toEqual({
      name: 'PAUSED',
      reason: 'user',
    });
    expect(run({ name: 'RIDING' }, 'externalInterruption')).toEqual({
      name: 'PAUSED',
      reason: 'external',
    });
    expect(run({ name: 'PAUSED', reason: 'external' }, 'resume')).toEqual({
      name: 'RIDING',
    });
  });

  it('UI-04: the depot copy from pause returns to the same journey or departs anew', () => {
    const depot = run({ name: 'PAUSED', reason: 'user' }, 'openDepot');
    expect(depot).toEqual({ name: 'BUILD_TRAIN', origin: 'pause' });
    expect(run(depot, 'back')).toEqual({ name: 'PAUSED', reason: 'user' });
    expect(run(depot, 'chooseLocomotive', 'locomotiveChosen')).toEqual(depot);
    expect(run(depot, 'chooseLocomotive', 'back')).toEqual({
      name: 'PAUSED',
      reason: 'user',
    });
    expect(run(depot, 'depart')).toEqual({ name: 'RIDING' });
  });

  it('the new-train depot goes back to locomotive selection', () => {
    expect(run({ name: 'BUILD_TRAIN', origin: 'new' }, 'back')).toEqual({
      name: 'SELECT_LOCO',
      origin: 'new',
    });
  });

  it('ignores events that do not apply (no surprise screen changes)', () => {
    const riding: Screen = { name: 'RIDING' };
    expect(transition(riding, { type: 'resume' })).toBe(riding);
    expect(transition(riding, { type: 'depart' })).toBe(riding);
    const paused: Screen = { name: 'PAUSED', reason: 'user' };
    expect(transition(paused, { type: 'externalInterruption' })).toBe(paused);
  });

  it('any state can enter the recoverable error screen and retry from loading', () => {
    expect(run({ name: 'RIDING' }, 'failed')).toEqual({
      name: 'RECOVERABLE_ERROR',
    });
    expect(run({ name: 'RECOVERABLE_ERROR' }, 'retry')).toEqual({
      name: 'LOADING',
    });
  });
});
