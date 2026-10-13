import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import sources from './sources.json' with { type: 'json' };
let bytes = 0;
for (const source of sources) {
  const file = resolve('assets/audio', source.file);
  bytes += statSync(file).size;
  const pcm = execFileSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      file,
      '-ac',
      '1',
      '-ar',
      '44100',
      '-f',
      'f32le',
      'pipe:1',
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const count = pcm.length / 4;
  const sample = (index: number) => pcm.readFloatLE(index * 4);
  let peak = 0;
  for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(sample(i)));
  assert(
    peak <= 0.54,
    `${source.file}: decoded peak ${peak} exceeds -5.35 dBFS`,
  );
  const loopLengthSec = source.endSec - source.startSec - source.crossfadeSec;
  if (source.crossfadeSec > 0) {
    const start = Math.round(0.12 * 44100);
    const end = Math.round((0.12 + loopLengthSec) * 44100);
    assert(end < count, `${source.file}: loop beyond decoded duration`);
    const jump = Math.abs(sample(end - 1) - sample(start));
    assert(jump < 0.025, `${source.file}: seam step ${jump}`);
    console.log(
      `${source.file}: peak ${(20 * Math.log10(peak)).toFixed(2)} dBFS; seam ${jump.toFixed(6)}`,
    );
  } else
    console.log(
      `${source.file}: peak ${(20 * Math.log10(peak)).toFixed(2)} dBFS`,
    );
}
assert(bytes <= 3 * 1024 * 1024, `Audio budget exceeded: ${bytes}`);
console.log(
  `${sources.length} files, ${bytes} bytes; levels, decoded loop bounds and seam steps PASS`,
);
