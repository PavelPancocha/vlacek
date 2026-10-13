import type { DebugSnapshot } from '../app/debugSnapshot.ts';

export interface DiagnosticGroup {
  title: string;
  rows: readonly (readonly [string, string])[];
}

function number(value: number | undefined, decimals = 0): string {
  return value === undefined || !Number.isFinite(value)
    ? '—'
    : String(Number(value.toFixed(decimals)));
}

export function hudLines(s: Partial<DebugSnapshot>): string[] {
  return [
    `${number(s.medianFps)} FPS · p95 ${number(s.p95FrameMs, 1)} ms · ${s.renderer ?? '—'} · ${s.renderProfile?.quality ?? '—'}`,
    `Svět ${number(s.seed)} · úsek ${number(s.headChunk)} · ${number(s.speedUPerSec, 1)} u/s · ${number(s.vehicles)} vozů`,
  ];
}

const AUDIO: Record<string, string> = {
  locked: 'Čeká na dotyk',
  running: 'Zapnutý',
  suspended: 'Pozastavený',
  unavailable: 'Nedostupný',
};
const PHASE: Record<string, string> = {
  OPEN: 'Otevřený',
  CLEARING: 'Vyklízení',
  WARNING: 'Výstraha',
  CLOSING: 'Zavírání',
  CLOSED: 'Zavřený',
  OPENING: 'Otevírání',
};

export function diagnosticGroups(s: Partial<DebugSnapshot>): DiagnosticGroup[] {
  const atlas = (value: DebugSnapshot['backdropAtlas']) =>
    value
      ? `${value.width} × ${value.height} px · ${value.frames} snímků · ${value.pxPerU} px/u`
      : 'Není načten';
  return [
    {
      title: 'Výkon',
      rows: [
        ['Build', s.buildId ?? '—'],
        ['Vykreslování', s.renderer ?? '—'],
        ['Kvalita', s.renderProfile?.quality ?? '—'],
        ['Medián FPS', number(s.medianFps)],
        ['Snímek p95', `${number(s.p95FrameMs, 1)} ms`],
        ['Nejhorší snímek', `${number(s.worstFrameMs, 1)} ms`],
        ['Počet vzorků', number(s.frameSamples)],
        [
          'DPR / limit FPS',
          `${number(s.renderProfile?.maxDpr, 1)} / ${number(s.renderProfile?.fpsLimit)}`,
        ],
      ],
    },
    {
      title: 'Svět',
      rows: [
        ['Číslo světa', number(s.seed)],
        ['Verze generátoru', number(s.generatorVersion)],
        ['Úsek', number(s.headChunk)],
        [
          'Úseky živé / vykreslené',
          `${number(s.liveChunks)} / ${number(s.renderedChunks)}`,
        ],
        ['Poloha hlavy po trati', `${number(s.headS, 1)} u`],
        ['Simulační tick', number(s.simulationTick)],
      ],
    },
    {
      title: 'Vlak',
      rows: [
        [
          'Vozidla / vykreslená',
          `${number(s.vehicles)} / ${number(s.renderedVehicles)}`,
        ],
        ['Délka', `${number(s.consistLengthU, 1)} u`],
        ['Rychlost', `${number(s.speedUPerSec, 1)} u/s`],
        [
          'Vstup',
          s.intent === 'THROTTLE'
            ? 'Plyn'
            : s.intent === 'BRAKE'
              ? 'Brzda'
              : s.intent === 'COAST'
                ? 'Dojezd'
                : '—',
        ],
        ['Aktivní dotyky', number(s.pointers)],
      ],
    },
    {
      title: 'Přejezdy',
      rows: s.crossings?.length
        ? s.crossings.map(
            (crossing) =>
              [
                crossing.id,
                `${PHASE[crossing.phase] ?? crossing.phase} · ${crossing.occupied ? 'Obsazený' : 'Volný'} · čekají ${crossing.waiting} · projelo ${crossing.crossed}`,
              ] as const,
          )
        : [['V okolí', 'Žádné']],
    },
    {
      title: 'Atlasy',
      rows: [
        ['Svět', atlas(s.artAtlas)],
        ['Vozidla', atlas(s.vehicleAtlas)],
        ['Pozadí', atlas(s.backdropAtlas)],
        ['Zdrojové textury', number(s.artSourceTextures)],
      ],
    },
    ...(s.audio === undefined
      ? []
      : [
          {
            title: 'Zvuk',
            rows: [['Stav', AUDIO[s.audio] ?? s.audio] as const],
          },
        ]),
  ];
}
