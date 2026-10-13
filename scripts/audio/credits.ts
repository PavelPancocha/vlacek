import { writeFileSync } from 'node:fs';
import sources from './sources.json' with { type: 'json' };

/** Generated alongside the recordings; the manifest test rejects stale credits. */
export const audioCredits =
  'Nahrané zvuky — licence a autoři\n\n' +
  sources
    .map((source) => {
      const licence =
        source.licence === 'CC-BY-4.0'
          ? 'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/'
          : 'CC0 1.0 — https://creativecommons.org/publicdomain/zero/1.0/';
      return `${source.file}\n${source.title}\nAutor: ${source.author}\nZdroj: ${source.url}\nLicence: ${licence}\nZměny: výřez ${source.startSec}–${source.endSec} s, mono, EQ 70 Hz–6 kHz, normalizace ${source.lufs} LUFS / ${source.truePeakDb} dBTP, jemné fades${source.crossfadeSec ? `, crossfade ${source.crossfadeSec} s a smyčkové okraje` : ''}, MP3.\nPůvodní soubor: ${source.original}\nSHA-256: ${source.sha256}`;
    })
    .join('\n\n') +
  '\n';

if (import.meta.main)
  writeFileSync(
    new URL('../../assets/audio/credits.txt', import.meta.url),
    audioCredits,
  );
