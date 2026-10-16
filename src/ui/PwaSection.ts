import type { PwaState } from '../platform/PwaController.ts';
import { actionButton, el } from './dom.ts';

export function updatePwaSection(root: HTMLElement, state: PwaState): void {
  const status = root.querySelector('[data-pwa-state]');
  const build = root.querySelector('[data-pwa-build]');
  const update = root.querySelector<HTMLElement>('[data-pwa-update]');
  const install = root.querySelector<HTMLButtonElement>(
    '[data-action="pwa-install"]',
  );
  if (status) status.textContent = state.offline;
  if (build) build.textContent = `Balík: ${state.buildId ?? '—'}`;
  if (update) update.hidden = !state.updateWaiting;
  if (!state.installAvailable) install?.remove();
  else if (!install)
    root
      .querySelector('[data-pwa-install-slot]')
      ?.append(
        actionButton('pwa-install', 'Instalovat aplikaci', [
          'Instalovat aplikaci',
        ]),
      );
}

export function pwaSection(state: PwaState): HTMLElement {
  const section = el(
    'section',
    { class: 'pwa-section', 'aria-labelledby': 'pwa-title' },
    el('h2', { id: 'pwa-title' }, 'Aplikace a offline'),
    el('p', { role: 'status', 'data-pwa-state': '' }),
    el('p', { class: 'hint', 'data-pwa-build': '' }),
    el(
      'p',
      { class: 'hint', 'data-pwa-update': '' },
      'Nová verze je připravená. Zavři všechna okna hry a znovu ji otevři.',
    ),
    el('div', { 'data-pwa-install-slot': '' }),
    el(
      'p',
      { class: 'hint' },
      'Na iPhonu nebo iPadu otevři nabídku Sdílet v Safari a zvol „Přidat na plochu“. Instalace ani offline režim na iOS, Androidu a Tesle zatím nejsou ověřené.',
    ),
    el(
      'p',
      { class: 'hint' },
      'Počkej na „offline připraveno“. Prohlížeč může uložený balík později odstranit.',
    ),
  );
  updatePwaSection(section, state);
  return section;
}
