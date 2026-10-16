import { TEST_SCENES } from '../domain/world/TestScenes.ts';
import { actionButton, el } from './dom.ts';
const titles = {
  tunnel: 'Tunel',
  crossing: 'Přejezd',
  station: 'Stanice',
  halt: 'Malá zastávka',
  'large-station': 'Větší stanice',
  'big-station': 'Velké nádraží',
  village: 'Velká vesnice — náves',
  'village-bus': 'Vesnice — autobus a hřiště',
  suburb: 'Předměstí',
  town: 'Město',
  autumn: 'Podzim',
  winter: 'Zima',
  coast: 'Pobřeží',
  fishponds: 'Rybníky',
  dunes: 'Duny',
  mountains: 'Hory',
  'forest-work': 'Lesní práce',
  fields: 'Pole se stroji',
  'forest-dense': 'Hustý les',
  'parallel-road': 'Okreska u přejezdu',
  highway: 'Dálnice',
  'road-ends': 'Konce silnic',
} as const;
/** Separate world sections so HUD/restart changes can merge independently. */
export function worldDeveloperSections(): HTMLElement {
  return el(
    'div',
    { class: 'dev-world-sections', style: 'grid-column: 1 / -1' },
    el(
      'details',
      {},
      el('summary', {}, 'Svět — překryvy'),
      el(
        'div',
        { class: 'dev-fields' },
        actionButton(
          'dev-world-overlay:areas',
          'Rezervace a půdorysy',
          ['Rezervace a půdorysy'],
          { pressed: false },
        ),
        actionButton(
          'dev-world-overlay:boundaries',
          'Hranice scén a podzón',
          ['Hranice scén a podzón'],
          { pressed: false },
        ),
        actionButton(
          'dev-world-overlay:roads',
          'Silnice — tečny, rychlost a předek',
          ['Silnice — tečny, rychlost a předek'],
          { pressed: false },
        ),
      ),
    ),
    el(
      'details',
      {},
      el('summary', {}, 'Testovací scény'),
      el(
        'p',
        { class: 'hint' },
        'Dočasná jízda ve stejném světě. Běžná cesta se neukládá ani neposouvá.',
      ),
      el(
        'div',
        { class: 'dev-fields' },
        ...TEST_SCENES.map((kind) =>
          actionButton(`dev-world-scene:${kind}`, titles[kind], [titles[kind]]),
        ),
      ),
      actionButton('dev-world-return', 'Vrátit běžnou cestu', [
        'Vrátit běžnou cestu',
      ]),
      el('p', { 'data-world-status': '', role: 'status', class: 'hint' }),
    ),
    el(
      'details',
      {},
      el('summary', {}, 'Umístění — stopa'),
      el(
        'label',
        {},
        'Objekt nebo worldXU',
        el('input', {
          'aria-label': 'Objekt nebo worldXU',
          'data-world-trace-query': '',
          type: 'text',
          maxlength: '160',
        }),
      ),
      el(
        'p',
        { class: 'hint' },
        'Prázdné = aktuální místo. Zadej světové x nebo přesné ID objektu; stopa nemění losování.',
      ),
      actionButton('dev-world-trace', 'Zobrazit stopu', ['Zobrazit stopu']),
      el('pre', { 'data-world-trace': '', role: 'status' }),
    ),
  );
}
