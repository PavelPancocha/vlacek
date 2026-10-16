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
  const world = s.backdrop?.world;
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
    ...(s.perf
      ? [
          {
            title: 'Načítání',
            rows: [
              [
                'Úvod od navigace',
                `${number(s.perf.startInteractiveMs, 1)} ms`,
              ],
              [
                'Jízda / všechna grafika od požadavku',
                `${number(s.perf.ride?.firstFrameMs, 1)} / ${number(s.perf.ride?.artReadyMs, 1)} ms`,
              ],
              [
                'SVG načtené / zpracované',
                `${s.perf.svg.fetchCount} / ${s.perf.svg.decodeCount}`,
              ],
              [
                'SVG fetch / zpracování (součty)',
                `${number(s.perf.svg.fetchMs, 1)} / ${number(s.perf.svg.decodeMs, 1)} ms`,
              ],
              [
                'Atlas balení a kresba / upload CPU',
                `${number(s.perf.atlas.packRasterMs, 1)} / ${number(s.perf.atlas.uploadMs, 1)} ms`,
              ],
              [
                'Prvních 12 úseků generování / pečení',
                `${number(
                  s.perf.chunks.reduce((sum, c) => sum + c.generationMs, 0),
                  1,
                )} / ${number(
                  s.perf.chunks.reduce((sum, c) => sum + c.bakeMs, 0),
                  1,
                )} ms`,
              ],
              [
                'Dlouhé úlohy >50 ms za prvních 15 s jízdy',
                s.perf.longTasks.supported
                  ? `${s.perf.longTasks.count} / ${number(s.perf.longTasks.totalMs, 1)} ms`
                  : 'Prohlížeč neměří',
              ],
            ] as const,
          },
        ]
      : []),
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
        [
          'Region / scéna',
          `${world?.regionId ?? '—'} / ${world?.sceneId ?? '—'}`,
        ],
        [
          'Krajina / podzóna',
          `${world?.landscape ?? '—'} / ${world?.subzone ?? '—'}`,
        ],
        [
          'Sezóna / počasí',
          `${world?.season ?? '—'} / ${world?.weather ?? '—'}`,
        ],
        ['Přechod', number(world?.transitionProgress, 3)],
        [
          'Prvky / fragmenty / rekvizity / animované',
          `${number(world?.logicalFeatures)} / ${number(world?.renderedFragments)} / ${number(world?.props)} / ${number(world?.animatedObjects)}`,
        ],
        ['Dočasná testovací jízda', s.worldDebug?.temporaryRide ? 'Ano' : 'Ne'],
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
                `${PHASE[crossing.phase] ?? crossing.phase} · ${crossing.occupied ? 'Obsazený' : 'Volný'} · čekají ${crossing.waiting} · projelo ${crossing.crossed} · svět ${number(crossing.worldX, 1)} u · obraz ${number(crossing.screenX, 1)} px · konec vlaku ${number(crossing.tailX, 1)} u · závora ${number(crossing.barrier, 2)} · fáze ${crossing.phases.join(' → ')}`,
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
    ...(s.tunnels === undefined
      ? []
      : [
          {
            title: 'Tunely',
            rows: s.tunnels.length
              ? s.tunnels.map(
                  (tunnel) =>
                    [
                      tunnel.id,
                      `${tunnel.alpha === 1 ? 'Neprůhledný' : `Průhlednost ${number(tunnel.alpha, 2)}`} · ${tunnel.train} · vozidla ${tunnel.vehicles.join(', ')}`,
                    ] as const,
                )
              : [['V okolí', 'Žádné'] as const],
          },
        ]),
    ...(s.catenary === undefined
      ? []
      : [
          {
            title: 'Trolejové vedení',
            rows: [
              ['Elektrifikace', s.catenary.electrified ? 'Ano' : 'Ne'],
              ['Sloupy', number(s.catenary.poles)],
              [
                'Odchylka pantografu',
                `${number(s.catenary.pantographGapU, 3)} u`,
              ],
              ['Mimo dosah (outOfRange)', number(s.catenary.outOfRange)],
            ] as const,
          },
        ]),
    ...(s.audio === undefined
      ? []
      : [
          {
            title: 'Zvuk',
            rows: [
              ['Stav', AUDIO[s.audio] ?? s.audio],
              [
                'Načtené / čekající nahrávky',
                `${number(s.audioDetails?.loaded)} / ${number(s.audioDetails?.pending)}`,
              ],
              ['Čekající vrstvy', number(s.audioDetails?.pendingLayers)],
              [
                'Aktivní hlasy',
                s.audioDetails?.active
                  .map((voice) => `${voice.id} (${voice.kind}, ${voice.key})`)
                  .join(', ') || 'Žádné',
              ],
              ['Poslední zvuky', s.audioDetails?.played.join(', ') || 'Žádné'],
              ['Zakrytí tunelem', number(s.audioDetails?.covered, 3)],
              [
                'Chyby',
                s.audioDetails?.failures
                  .map((failure) => `${failure.file}: ${failure.reason}`)
                  .join(', ') || 'Žádné',
              ],
            ] as const,
          },
        ]),
  ];
}
