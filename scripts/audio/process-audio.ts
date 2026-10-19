import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sources from './sources.json' with { type: 'json' };
import { audioCredits } from './credits.ts';
import { soundManifest } from '../../src/content/soundManifest.ts';

const originals = process.argv[2];
if (!originals)
  throw new Error(
    'Usage: volta run node scripts/audio/process-audio.ts ORIGINALS_DIRECTORY',
  );
const output = resolve('assets/audio');
const temporary = mkdtempSync(resolve(tmpdir(), 'vlacek-audio-'));
try {
  mkdirSync(output, { recursive: true });
  for (const source of sources) {
    const input = resolve(originals, source.original);
    const hash = createHash('sha256').update(readFileSync(input)).digest('hex');
    if (hash !== source.sha256)
      throw new Error(`SHA-256 mismatch: ${source.original}`);
    const duration = source.endSec - source.startSec;
    const lowpassHz = source.animalLowpassHz ?? 6000;
    if (
      source.animalLowpassHz !== undefined &&
      !Object.values(soundManifest).some(
        (clip) =>
          clip.file === source.file &&
          clip.category === 'animal' &&
          source.crossfadeSec === 0,
      )
    )
      throw new Error(`Animal-only low-pass exception: ${source.file}`);
    const common = `atrim=start=${source.startSec}:end=${source.endSec},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,highpass=f=70,lowpass=f=${lowpassHz},loudnorm=I=${source.lufs}:TP=${source.truePeakDb}:LRA=7,aresample=44100,alimiter=limit=0.5:level=false:latency=true,asetpts=N/SR/TB`;
    const normalized = resolve(temporary, 'normalized.wav');
    execFileSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      '-af',
      common,
      '-ar',
      '44100',
      '-ac',
      '1',
      '-c:a',
      'pcm_f32le',
      normalized,
    ]);
    const cross = source.crossfadeSec;
    let filter: string;
    if (cross > 0) {
      // Put the tail/head blend inside the loop, then pad outside its explicit points.
      const loopLength = duration - cross;
      const sampleCount = Math.round(duration * 44100);
      const seamSamples = Math.round(cross * 44100);
      const loopSamples = sampleCount - seamSamples;
      const padSamples = 5292;
      filter = `[0:a]asplit=3[h][m][t];[h]atrim=end_sample=${seamSamples},asetpts=N/SR/TB,afade=t=in:d=${cross}[head];[m]atrim=start_sample=${seamSamples}:end_sample=${sampleCount - seamSamples},asetpts=N/SR/TB[mid];[t]atrim=start_sample=${sampleCount - seamSamples},asetpts=N/SR/TB,afade=t=out:st=0:d=${cross}[tail];[tail][head]amix=inputs=2:duration=longest:normalize=0[seam];[mid][seam]concat=n=2:v=0:a=1,asetpts=N/SR/TB,afade=t=in:d=0.01,afade=t=out:st=${loopLength - 0.01}:d=0.01,asplit=3[p][l][s];[p]atrim=start_sample=${loopSamples - padSamples},asetpts=N/SR/TB[prefix];[s]atrim=end_sample=${padSamples},asetpts=N/SR/TB[suffix];[prefix][l][suffix]concat=n=3:v=0:a=1[out]`;
    } else {
      const fade = Math.min(0.025, duration / 8);
      filter = `[0:a]afade=t=in:d=${fade},afade=t=out:st=${duration - fade}:d=${fade}[out]`;
    }
    execFileSync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        normalized,
        '-filter_complex',
        filter,
        '-map',
        '[out]',
        '-ar',
        '44100',
        '-ac',
        '1',
        '-c:a',
        'libmp3lame',
        '-q:a',
        '5',
        '-map_metadata',
        '-1',
        resolve(output, source.file),
      ],
      { stdio: 'inherit' },
    );
    console.log(
      `${source.file}: ${duration.toFixed(3)} s, ${source.lufs} LUFS, loop ${cross > 0 ? `.12–${(0.12 + duration - cross).toFixed(3)}` : 'none'}`,
    );
  }
  writeFileSync(resolve(output, 'credits.txt'), audioCredits);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
