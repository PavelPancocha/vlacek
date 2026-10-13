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
  const { debug, renderer, quality, reducedEffects, seed } = values;
  if (
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
  );
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
