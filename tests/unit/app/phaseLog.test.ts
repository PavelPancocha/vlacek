import { describe, expect, it } from 'vitest';
import { PhaseLog } from '../../../src/app/phaseLog.ts';

describe('crossing phase log (debug diagnostics)', () => {
  it('keeps each distinct phase once, in order, even when it lasts one frame', () => {
    const log = new PhaseLog();
    for (const phase of [
      'OPEN',
      'OPEN',
      'WARNING',
      'CLOSED',
      'OPENING',
      'OPEN',
    ])
      log.record([{ id: 'a', phase }]);
    expect(log.phases('a')).toEqual([
      'OPEN',
      'WARNING',
      'CLOSED',
      'OPENING',
      'OPEN',
    ]);
  });

  it('stays bounded and forgets crossings that left the ride', () => {
    const log = new PhaseLog(3);
    for (let i = 0; i < 10; i++)
      log.record([
        { id: 'a', phase: i % 2 ? 'OPEN' : 'CLOSED' },
        { id: 'b', phase: 'OPEN' },
      ]);
    expect(log.phases('a')).toHaveLength(3);
    log.record([{ id: 'b', phase: 'WARNING' }]);
    expect(log.phases('a')).toEqual([]);
    expect(log.phases('b')).toEqual(['OPEN', 'WARNING']);
  });
});
