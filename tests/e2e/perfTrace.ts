export interface TraceMarkers {
  start: string;
  end: string;
}

interface TraceEvent {
  name: string;
  ph: string;
  pid: number;
  tid: number;
  ts: number;
  dur: number;
  threadName: string;
  cat: string;
}

function readEvent(raw: unknown): TraceEvent | undefined {
  if (typeof raw !== 'object' || raw === null) return;
  const name: unknown = Reflect.get(raw, 'name');
  const ph: unknown = Reflect.get(raw, 'ph');
  const pid: unknown = Reflect.get(raw, 'pid');
  const tid: unknown = Reflect.get(raw, 'tid');
  const ts: unknown = Reflect.get(raw, 'ts');
  const dur: unknown = Reflect.get(raw, 'dur');
  const cat: unknown = Reflect.get(raw, 'cat');
  const args: unknown = Reflect.get(raw, 'args');
  const threadName: unknown =
    typeof args === 'object' && args !== null ? Reflect.get(args, 'name') : '';
  if (
    typeof name !== 'string' ||
    typeof ph !== 'string' ||
    typeof pid !== 'number' ||
    typeof tid !== 'number'
  )
    return;
  return {
    name,
    ph,
    pid,
    tid,
    ts: typeof ts === 'number' ? ts : NaN,
    dur: typeof dur === 'number' ? dur : 0,
    cat: typeof cat === 'string' ? cat : '',
    threadName: typeof threadName === 'string' ? threadName : '',
  };
}

function aggregate(
  events: readonly TraceEvent[],
  startUs: number,
  endUs: number,
) {
  let count = 0,
    totalMs = 0,
    maxMs = 0;
  for (const event of events) {
    const overlapUs =
      Math.min(event.ts + event.dur, endUs) - Math.max(event.ts, startUs);
    if (!(overlapUs > 0)) continue;
    const ms = overlapUs / 1000;
    count++;
    totalMs += ms;
    maxMs = Math.max(maxMs, ms);
  }
  return { count, totalMs, maxMs };
}

/** Page-specific UserTiming marks are emitted in the measured page's main context. */
export function summarizeTraceGc(
  raw: readonly unknown[],
  markers: TraceMarkers,
) {
  const events = raw.map(readEvent).filter((e) => e !== undefined);
  const marks = events.filter(
    (e) => e.name === markers.start && e.cat === 'blink.user_timing',
  );
  const start = marks[0];
  if (marks.length !== 1 || !start)
    throw new Error('Missing or ambiguous game page start mark');
  const ends = events.filter(
    (e) => e.name === markers.end && e.cat === 'blink.user_timing',
  );
  const end = ends[0];
  if (
    ends.length !== 1 ||
    !end ||
    end.pid !== start.pid ||
    end.tid !== start.tid ||
    !Number.isFinite(start.ts) ||
    !Number.isFinite(end.ts) ||
    end.ts <= start.ts
  )
    throw new Error('Missing, ambiguous or mismatched game page end mark');
  const threads = events.filter(
    (e) => e.ph === 'M' && e.name === 'thread_name',
  );
  const main = threads.find(
    (e) =>
      e.pid === start.pid &&
      e.tid === start.tid &&
      e.threadName === 'CrRendererMain',
  );
  if (!main) throw new Error('Game page mark is not on CrRendererMain');
  const pauses = events.filter(
    (e) => e.ph === 'X' && (e.name === 'MinorGC' || e.name === 'MajorGC'),
  );
  const workerThreads = threads.filter((e) => /worker/i.test(e.threadName));
  return {
    window: {
      startUs: start.ts,
      endUs: end.ts,
      durationMs: (end.ts - start.ts) / 1000,
    },
    rendererThread: { pid: main.pid, tid: main.tid, name: main.threadName },
    renderer: aggregate(
      pauses.filter((e) => e.pid === main.pid && e.tid === main.tid),
      start.ts,
      end.ts,
    ),
    workers: {
      ...aggregate(
        pauses.filter((e) =>
          workerThreads.some((t) => t.pid === e.pid && t.tid === e.tid),
        ),
        start.ts,
        end.ts,
      ),
      threads: workerThreads.map((t) => ({
        pid: t.pid,
        tid: t.tid,
        name: t.threadName,
      })),
    },
  };
}
