import { worldDeveloperSections } from './DevWorldMenu.ts';
import { soundManifest } from '../content/soundManifest.ts';
import audioCreditsUrl from '../../assets/audio/credits.txt?url&no-inline';
import { pwaSection } from './PwaSection.ts';
import type { PwaState } from '../platform/PwaController.ts';
import { seedOverride } from '../platform/CapabilityProbe.ts';
import { actionButton, el } from './dom.ts';
import type { DevOptions } from '../platform/DevOptions.ts';
import type { Settings } from '../platform/SaveValidation.ts';

export interface DevMenuValues extends DevOptions {
  quality: Settings['quality'];
  reducedEffects: boolean;
}

/** Form values are untrusted; an empty world releases the pinned seed. */
export function parseDevMenu(
  values: Record<string, unknown>,
): DevMenuValues | undefined {
  const { debug, renderer, quality, reducedEffects, seed, perfGraph } = values;
  if (
    (perfGraph !== undefined && perfGraph !== 'off' && perfGraph !== 'on') ||
    (debug !== 'off' && debug !== 'on') ||
    (renderer !== 'auto' && renderer !== 'canvas') ||
    (quality !== 'auto' && quality !== 'standard' && quality !== 'low') ||
    (reducedEffects !== 'off' && reducedEffects !== 'on') ||
    typeof seed !== 'string'
  )
    return undefined;
  const pinnedSeed = seedOverride(`?seed=${encodeURIComponent(seed)}`);
  if (seed !== '' && pinnedSeed === undefined) return undefined;
  return {
    debug: debug === 'on',
    perfGraph: perfGraph === 'on',
    renderer,
    quality,
    reducedEffects: reducedEffects === 'on',
    seed: pinnedSeed,
  };
}

/** Native fields keep keyboard and tablet text entry in the parent panel. */
export function developerMenu(
  values: DevMenuValues,
  signal: AbortSignal,
  currentSeed: number | undefined,
  pwa: PwaState,
): HTMLElement {
  const select = (
    name: string,
    title: string,
    value: string,
    options: [string, string][],
  ) =>
    el(
      'label',
      {},
      title,
      el(
        'select',
        { name, 'aria-label': title },
        ...options.map(([key, text]) =>
          el('option', { value: key, selected: key === value }, text),
        ),
      ),
    );
  const form = el(
    'form',
    { class: 'dev-fields' },
    select('debug', 'Diagnostika', values.debug ? 'on' : 'off', [
      ['off', 'Vypnuto'],
      ['on', 'Zapnuto'],
    ]),
    select('perfGraph', 'Graf času snímků', values.perfGraph ? 'on' : 'off', [
      ['off', 'Vypnuto'],
      ['on', 'Zapnuto'],
    ]),
    select('renderer', 'Vykreslování', values.renderer, [
      ['auto', 'Auto (WebGL s Canvas fallbackem)'],
      ['canvas', 'Canvas'],
    ]),
    select('quality', 'Kvalita', values.quality, [
      ['auto', 'Auto'],
      ['standard', 'Standard'],
      ['low', 'Nízká'],
    ]),
    select(
      'reducedEffects',
      'Omezené efekty',
      values.reducedEffects ? 'on' : 'off',
      [
        ['off', 'Vypnuto'],
        ['on', 'Zapnuto'],
      ],
    ),
    el(
      'label',
      {},
      'Číslo světa',
      el('input', {
        name: 'seed',
        'aria-label': 'Číslo světa',
        type: 'text',
        inputmode: 'numeric',
        pattern: '[0-9]{1,10}',
        maxlength: '10',
        value: values.seed === undefined ? '' : String(values.seed),
        'aria-describedby': 'dev-world-hint',
      }),
    ),
    el(
      'p',
      { class: 'hint', id: 'dev-world-hint' },
      'Prázdné = náhodný svět; jinak 0–4294967295. Platí pro nové cesty.',
    ),
    el(
      'section',
      { class: 'dev-world-actions' },
      el('h2', { class: 'dev-current-world' }, `Svět ${currentSeed ?? '—'}`),
      actionButton('dev-copy-seed', 'Kopírovat číslo', ['Kopírovat číslo'], {
        disabled: currentSeed === undefined,
      }),
      actionButton('dev-details', 'Diagnostika – podrobnosti', [
        'Diagnostika – podrobnosti',
      ]),
      actionButton(
        'dev-restart',
        'Znovu tento svět od začátku',
        ['Znovu tento svět od začátku'],
        { disabled: currentSeed === undefined },
      ),
      actionButton(
        'dev-random-world',
        'Nový náhodný svět',
        ['Nový náhodný svět'],
        { disabled: currentSeed === undefined },
      ),
      el(
        'p',
        { class: 'hint' },
        'Restart zachová soupravu, uloží novou cestu a vrátí pauzu. Rozpracované volby nepoužije.',
      ),
      el(
        'div',
        { 'data-copy-output': '' },
        el('p', { role: 'status', 'data-copy-status': '' }),
      ),
    ),
  );
  form.append(
    el(
      'details',
      { style: 'grid-column: 1 / -1' },
      el('summary', {}, 'Zvuky'),
      el(
        'p',
        { class: 'hint' },
        'Poslech na zařízení: NEOVĚŘENO. Každé tlačítko přehraje jednu nahrávku; platí nastavení Zvuky.',
      ),
      el(
        'p',
        { class: 'hint' },
        el(
          'a',
          {
            href: audioCreditsUrl,
            target: '_blank',
            rel: 'noopener',
          },
          'O zvucích — autoři a licence',
        ),
      ),
      actionButton('dev-sound-stop', 'Zastavit zvuky', ['Zastavit']),
      el(
        'div',
        { class: 'dev-fields' },
        ...Object.keys(soundManifest).map((id) =>
          actionButton(`dev-sound:${id}`, `Přehrát ${id}`, [id]),
        ),
      ),
    ),
  );
  form.append(worldDeveloperSections());
  form.addEventListener('submit', (event) => event.preventDefault(), {
    signal,
  });
  return el(
    'section',
    {
      class: 'screen dev-menu',
      role: 'region',
      'aria-labelledby': 'dev-menu-title',
    },
    el('h1', { id: 'dev-menu-title' }, 'Vývojářské volby'),
    el(
      'div',
      { class: 'screen-content' },
      el('p', { class: 'hint' }, 'Změny se použijí po opětovném načtení.'),
      form,
      pwaSection(pwa),
      el('p', { class: 'hint', role: 'status', 'data-dev-error': '' }),
    ),
    el(
      'div',
      { class: 'row dev-actions' },
      actionButton(
        'dev-apply',
        'Použít a znovu načíst',
        ['Použít a znovu načíst'],
        { className: 'button primary' },
      ),
      actionButton('dev-defaults', 'Výchozí', ['Výchozí']),
      actionButton('dev-close', 'Zavřít', ['Zavřít']),
    ),
  );
}
