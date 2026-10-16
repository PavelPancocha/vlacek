import { expect, it } from 'vitest';
import {
  MemoryStorage,
  createSession,
  buildAndDepart,
  tap,
  runFor,
  touchWorld,
} from './helpers.ts';
it('DEV-03: temporary diagnostic ride never writes either save and returns the exact ordinary ride', () => {
  const storage = new MemoryStorage(),
    session = createSession(storage);
  buildAndDepart(session);
  touchWorld(session);
  runFor(session, 2);
  tap(session, 'pause');
  const ordinary = session.ride,
    head = ordinary?.headS,
    before = [...storage.data.entries()];
  expect(
    session.startDiagnosticRide({ chunkIndex: 300, arcOffsetU: 512 }),
  ).toBe(true);
  expect(session.diagnosticRide).toBe(true);
  expect(session.ride).not.toBe(ordinary);
  expect(session.screen.name).toBe('RIDING');
  touchWorld(session);
  runFor(session, 10);
  session.interrupt();
  tap(session, 'resume');
  tap(session, 'pause');
  expect([...storage.data.entries()]).toEqual(before);
  session.endDiagnosticRide();
  expect(session.ride).toBe(ordinary);
  expect(session.ride?.headS).toBe(head);
  expect(session.screen.name).toBe('PAUSED');
  expect(session.diagnosticRide).toBe(false);
  expect([...storage.data.entries()]).toEqual(before);
});
it('DEV-03: rejected diagnostic start preserves state; diagnostic depot exits before ordinary edits', () => {
  const session = createSession();
  expect(session.startDiagnosticRide({ chunkIndex: 0, arcOffsetU: 0 })).toBe(
    false,
  );
  buildAndDepart(session);
  tap(session, 'pause');
  const ordinary = session.ride;
  expect(session.startDiagnosticRide({ chunkIndex: 3, arcOffsetU: 300 })).toBe(
    true,
  );
  tap(session, 'pause');
  tap(session, 'open-depot');
  expect(session.diagnosticRide).toBe(false);
  expect(session.ride).toBe(ordinary);
});
it('DEV-03: validates arc coordinates against the actual LUT, not the horizontal chunk width', () => {
  const session = createSession(undefined, { randomSeed: () => 2 });
  buildAndDepart(session);
  tap(session, 'pause');
  expect(
    session.startDiagnosticRide({ chunkIndex: 121, arcOffsetU: 1026 }),
  ).toBe(true);
  session.endDiagnosticRide();
  expect(
    session.startDiagnosticRide({ chunkIndex: 121, arcOffsetU: 1035 }),
  ).toBe(false);
});
