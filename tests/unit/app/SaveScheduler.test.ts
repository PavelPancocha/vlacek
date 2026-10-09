import { describe, expect, it } from 'vitest';
import { SaveScheduler } from '../../../src/app/SaveScheduler.ts';

describe('SaveScheduler', () => {
  it('requests a checkpoint every 5 s of simulated riding', () => {
    const scheduler = new SaveScheduler({
      intervalTicks: 300,
      editDebounceMs: 250,
    });
    const due = Array.from({ length: 901 }, (_, tick) =>
      scheduler.isTickCheckpoint(tick),
    );
    expect(due.flatMap((d, tick) => (d ? [tick] : []))).toEqual([
      300, 600, 900,
    ]);
  });

  it('debounces rapid edits into one write ~250 ms after the last edit', () => {
    const scheduler = new SaveScheduler({
      intervalTicks: 300,
      editDebounceMs: 250,
    });
    scheduler.noteEdit(1000);
    scheduler.noteEdit(1100);
    expect(scheduler.takeDueEdit(1300)).toBe(false);
    expect(scheduler.takeDueEdit(1350)).toBe(true);
    expect(scheduler.takeDueEdit(2000)).toBe(false);
  });

  it('flushes a pending edit immediately on demand', () => {
    const scheduler = new SaveScheduler({
      intervalTicks: 300,
      editDebounceMs: 250,
    });
    scheduler.noteEdit(0);
    expect(scheduler.flushPendingEdit()).toBe(true);
    expect(scheduler.takeDueEdit(1000)).toBe(false);
  });
});
