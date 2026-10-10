import { gameConfig } from '../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../src/content/vehicles.ts';
import { GameSession, type SessionDeps } from '../../src/app/GameSession.ts';
import {
  SaveRepository,
  type StorageLike,
} from '../../src/platform/SaveRepository.ts';
import { saveRules } from '../../src/platform/SaveValidation.ts';

export class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

export function createSession(
  storage: StorageLike = new MemoryStorage(),
  overrides: Partial<SessionDeps> = {},
) {
  let seed = 1000;
  const session = new GameSession({
    config: gameConfig,
    catalog: { locomotives, wagons },
    repository: new SaveRepository(
      storage,
      saveRules(gameConfig, locomotives, wagons),
      gameConfig.save,
    ),
    randomSeed: () => seed++,
    nowIso: () => '2026-10-09T18:00:00.000Z',
    buildId: '0.1.0+test',
    ...overrides,
  });
  session.boot();
  return session;
}

let nextPointer = 1;
export function tap(session: GameSession, action: string): void {
  const id = nextPointer++;
  session.router.pointerDown({
    id,
    clientX: 10,
    clientY: 10,
    timeMs: 0,
    action,
  });
  session.router.pointerUp({ id, action });
}

export function touchWorld(
  session: GameSession,
  x = 700,
  y = 400,
  timeMs = 0,
): number {
  const id = nextPointer++;
  session.router.pointerDown({ id, clientX: x, clientY: y, timeMs });
  return id;
}

export function release(session: GameSession, id: number): void {
  session.router.pointerUp({ id });
}

/** Advances wall-clock time in 60 FPS frames. */
export function runFor(
  session: GameSession,
  seconds: number,
  startMs = 0,
): number {
  let now = startMs;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    now += 1000 / 60;
    session.frame(1 / 60, now);
  }
  return now;
}

export function buildAndDepart(
  session: GameSession,
  wagonIds: string[] = ['cargo_box'],
): void {
  tap(session, 'loco:steam_local');
  tap(session, 'to-depot');
  for (const id of wagonIds) tap(session, `add:${id}`);
  tap(session, 'depart');
}
