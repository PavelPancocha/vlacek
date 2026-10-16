import { expect, it } from 'vitest';
import { AtlasMetrics } from './AtlasMetrics.ts';

it.each(['prepare', 'backdropActivate'] as const)(
  'rejects a delayed %s even without a world swap and retains a same-run baseline',
  (stage) => {
    let time = 0;
    const metrics = new AtlasMetrics(() => time);
    metrics.frame(time);
    for (let i = 0; i < 10; i++) {
      time += 16;
      metrics.frame(time);
    }
    metrics.measure(stage, () => {
      time += 120;
    });
    metrics.frame(time);
    expect(metrics.snapshot.baseline.p95Ms).toBe(16);
    expect(metrics.snapshot.affected.maxMs).toBe(120);
    expect(metrics.snapshot.violations).toEqual(
      expect.arrayContaining([stage]),
    );
    for (let i = 0; i < 1000; i++)
      metrics.measure(stage, () => {
        time += 1;
      });
    expect(metrics.snapshot.stages[stage].maxMs).toBe(120);
    expect(metrics.snapshot.violations).toContain(stage);
  },
);

it('keeps the whole-run baseline when later regions render faster', () => {
  let time = 0;
  const metrics = new AtlasMetrics(() => time);
  metrics.frame(time);
  for (let i = 0; i < 1000; i++) metrics.frame((time += 100));
  for (let i = 0; i < 8000; i++) metrics.frame((time += 20));
  expect(metrics.snapshot.baseline.count).toBe(9000);
  expect(metrics.snapshot.baseline.p95Ms).toBe(100);
  expect(metrics.snapshot.baseline.maxMs).toBe(100);
});
