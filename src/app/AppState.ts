/**
 * Application screens (doc 02 §6). `RIDING` includes a standing train; the
 * motion intents THROTTLE/COAST/BRAKE live below this level. STARTING_RIDE,
 * RESTORING_RIDE and PAUSED_EXTERNAL/PAUSED_RESUME are folded into the events
 * `depart`/`continueJourney` and the `PAUSED.reason`.
 */
export type Screen =
  | { name: 'LOADING' }
  | { name: 'HOME' }
  | { name: 'SELECT_LOCO'; origin: 'new' | 'pause' }
  | { name: 'BUILD_TRAIN'; origin: 'new' | 'pause' }
  | { name: 'RIDING' }
  | { name: 'PAUSED'; reason: 'user' | 'external' | 'restore' }
  | { name: 'RECOVERABLE_ERROR' };

export type AppEvent =
  | { type: 'loaded'; hasJourney: boolean }
  | { type: 'continueJourney' }
  | { type: 'buildNew' }
  | { type: 'locomotiveChosen' }
  | { type: 'chooseLocomotive' }
  | { type: 'depart' }
  | { type: 'back' }
  | { type: 'pause' }
  | { type: 'externalInterruption' }
  | { type: 'resume' }
  | { type: 'openDepot' }
  | { type: 'failed' }
  | { type: 'retry' };

/** Pure transition; events that do not apply return the same screen. */
export function transition(screen: Screen, event: AppEvent): Screen {
  if (event.type === 'failed') return { name: 'RECOVERABLE_ERROR' };
  switch (screen.name) {
    case 'LOADING':
      if (event.type === 'loaded') {
        return event.hasJourney
          ? { name: 'HOME' }
          : { name: 'SELECT_LOCO', origin: 'new' };
      }
      return screen;
    case 'HOME':
      if (event.type === 'continueJourney')
        return { name: 'PAUSED', reason: 'restore' };
      if (event.type === 'buildNew')
        return { name: 'SELECT_LOCO', origin: 'new' };
      return screen;
    case 'SELECT_LOCO':
      if (event.type === 'locomotiveChosen')
        return { name: 'BUILD_TRAIN', origin: screen.origin };
      if (event.type === 'back' && screen.origin === 'pause') {
        return { name: 'PAUSED', reason: 'user' };
      }
      return screen;
    case 'BUILD_TRAIN':
      if (event.type === 'depart') return { name: 'RIDING' };
      if (event.type === 'chooseLocomotive')
        return { name: 'SELECT_LOCO', origin: screen.origin };
      if (event.type === 'back') {
        return screen.origin === 'pause'
          ? { name: 'PAUSED', reason: 'user' }
          : { name: 'SELECT_LOCO', origin: 'new' };
      }
      return screen;
    case 'RIDING':
      if (event.type === 'pause') return { name: 'PAUSED', reason: 'user' };
      if (event.type === 'externalInterruption')
        return { name: 'PAUSED', reason: 'external' };
      return screen;
    case 'PAUSED':
      if (event.type === 'resume') return { name: 'RIDING' };
      if (event.type === 'openDepot')
        return { name: 'BUILD_TRAIN', origin: 'pause' };
      return screen;
    case 'RECOVERABLE_ERROR':
      return event.type === 'retry' ? { name: 'LOADING' } : screen;
  }
}
