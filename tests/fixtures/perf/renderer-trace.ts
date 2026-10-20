/** Page-specific marks are emitted by page.evaluate in the measured page. */
export const markers = { start: 'game-frame:start', end: 'game-frame:end' };
export const rendererTrace = [
  {
    ph: 'M',
    name: 'thread_name',
    pid: 9,
    tid: 90,
    args: { name: 'CrRendererMain' },
  },
  {
    ph: 'M',
    name: 'thread_name',
    pid: 1,
    tid: 10,
    args: { name: 'CrRendererMain' },
  },
  {
    ph: 'M',
    name: 'thread_name',
    pid: 1,
    tid: 11,
    args: { name: 'ServiceWorker thread' },
  },
  {
    ph: 'M',
    name: 'thread_name',
    pid: 2,
    tid: 20,
    args: { name: 'DedicatedWorker thread' },
  },
  {
    ph: 'I',
    cat: 'blink.user_timing',
    name: markers.start,
    pid: 1,
    tid: 10,
    ts: 10_000,
  },
  {
    ph: 'I',
    cat: 'blink.user_timing',
    name: markers.end,
    pid: 1,
    tid: 10,
    ts: 30_000,
  },
  { ph: 'X', name: 'MinorGC', pid: 1, tid: 10, ts: 12_000, dur: 2_000 },
  { ph: 'X', name: 'MajorGC', pid: 1, tid: 10, ts: 20_000, dur: 3_000 },
  { ph: 'X', name: 'MinorGC', pid: 1, tid: 11, ts: 15_000, dur: 4_000 },
  { ph: 'X', name: 'MinorGC', pid: 2, tid: 20, ts: 16_000, dur: 1_000 },
  { ph: 'X', name: 'MajorGC', pid: 9, tid: 90, ts: 17_000, dur: 8_000 },
  { ph: 'X', name: 'V8.GC_MINOR', pid: 1, tid: 10, ts: 12_000, dur: 1_000 },
];
