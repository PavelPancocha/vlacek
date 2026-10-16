import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import sources from './sources.json' with { type: 'json' };
const directory = process.argv[2];
if (!directory)
  throw new Error(
    'Usage: volta run node scripts/audio/contact-sheet.ts OUTPUT_DIRECTORY',
  );
mkdirSync(directory, { recursive: true });
const paths: string[] = [];
for (const source of sources) {
  const file = resolve(directory, source.file.replace('.mp3', '.png'));
  execFileSync('ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    resolve('assets/audio', source.file),
    '-filter_complex',
    `[0:a]asplit[a][b];[a]showspectrumpic=s=600x160:legend=disabled:scale=log[s];[b]showwavespic=s=600x60:colors=white[w];[s][w]vstack,drawtext=text='${source.file}':fontcolor=white:fontsize=18:x=8:y=8[out]`,
    '-map',
    '[out]',
    '-frames:v',
    '1',
    '-threads',
    '1',
    file,
  ]);
  paths.push(file);
}
const layout = paths
  .map((_, i) => `${(i % 4) * 600}_${Math.floor(i / 4) * 220}`)
  .join('|');
execFileSync('ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-y',
  '-filter_complex_threads',
  '1',
  ...paths.flatMap((file) => ['-i', file]),
  '-filter_complex',
  `${paths.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${paths.length}:layout=${layout}[out]`,
  '-map',
  '[out]',
  '-frames:v',
  '1',
  '-threads',
  '1',
  resolve(directory, 'contact-sheet.png'),
]);
console.log(resolve(directory, 'contact-sheet.png'));
