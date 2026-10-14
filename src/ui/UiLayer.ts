import type { Screen } from '../app/AppState.ts';
import type { DebugSnapshot } from '../app/debugSnapshot.ts';
import type { SessionNotice } from '../app/GameSession.ts';
import type { CatalogLocomotive, CatalogWagon } from '../content/vehicles.ts';
import {
  canAddWagon,
  canMoveSelected,
  canUndo,
  consistLengthU,
  isFull,
  isOverLimit,
  type ConsistDraft,
  type ConsistLengthRules,
} from '../domain/consist/ConsistEditor.ts';
import { layoutConsist } from '../domain/train/TrainGeometry.ts';
import type { WagonGroup } from '../domain/types.ts';
import type { Settings } from '../platform/SaveValidation.ts';
import { developerMenu, parseDevMenu, type DevMenuValues } from './DevMenu.ts';
import { devTap, type DevTapState } from './DevTapGate.ts';
import { copyDiagnosticText, diagnosticsView } from './DiagnosticsView.ts';
import { actionButton, el } from './dom.ts';
import { icon } from './icons.ts';
import { vehiclePreview } from './vehiclePreview.ts';

/** Read-only state the DOM screens render. */
export interface UiModel {
  screen: Screen;
  draft: ConsistDraft;
  settings: Settings;
  notices: readonly SessionNotice[];
  fullSignals: number;
  hasJourney: boolean;
  /** World seed of the current journey, shown small on the pause screen. */
  seed: number | undefined;
  portrait: boolean;
  fullscreen: { supported: boolean; active: boolean; failed: boolean };
  buildId: string;
  devActive: boolean;
  locomotives: readonly CatalogLocomotive[];
  wagons: readonly CatalogWagon[];
  /** Length limit and coupler gap shared with every departure (doc 14 §2). */
  lengthRules: ConsistLengthRules;
}

const NOTICE_TEXT: Record<SessionNotice, string> = {
  'restored-from-backup': 'Pokračování bylo obnoveno ze zálohy.',
  'corrupt-save-discarded':
    'Uložené pokračování bylo poškozené, začínáme znovu.',
  'storage-unavailable':
    'Na tomto zařízení se teď nepodařilo uložit pokračování.',
  'storage-limited': 'Na tomto zařízení se teď nepodařilo uložit pokračování.',
  'newer-save-kept':
    'Uložená hra je z novější verze. Hrajeme bez ukládání, aby se nepřepsala.',
  'start-failed': 'Novou cestu se nepodařilo spustit. Původní cesta zůstává.',
  'journey-unavailable': 'Uloženou cestu se nepodařilo obnovit.',
  'track-changed': 'Trať se změnila, vlak vyjede na novou cestu.',
  'train-too-long':
    'Vláček je delší, než se vejde na obrazovku. Všechny vagonky zůstaly v depu; po ubrání může vyjet.',
};

const GROUPS: { group: WagonGroup; label: string }[] = [
  { group: 'passenger', label: 'Osobní' },
  { group: 'cargo', label: 'Nákladní' },
  { group: 'service', label: 'Služební' },
  { group: 'fun', label: 'Hravé' },
];

/** Strip scale: CSS px per world unit for depot previews. */
const STRIP_PX_PER_U = 0.7;
const STRIP_PAD_PX = 8;
/** Extra pixels around the brake button that still count as brake (doc 02 §1). */
export const BRAKE_HIT_MARGIN_PX = 24;

function notices(model: UiModel): HTMLElement | undefined {
  const texts = [
    ...new Set(model.notices.map((notice) => NOTICE_TEXT[notice])),
  ];
  if (texts.length === 0) return undefined;
  return el(
    'div',
    { class: 'notices', role: 'status' },
    ...texts.map((text) => el('p', {}, text)),
  );
}

function label(text: string): HTMLElement {
  return el('span', { class: 'button-label' }, text);
}

/**
 * Renders the DOM screens for the current model. Re-renders only when the
 * visible state changes. Picker cards and visible strip items survive draft
 * edits; screen changes release their nodes, cache and scoped listeners.
 */
export class UiLayer {
  readonly #root: HTMLElement;
  #signature = '';
  #viewSignature = '';
  #updateView: ((model: UiModel) => void) | undefined;
  #renderScope: AbortController | undefined;
  readonly #draftRevisions = new WeakMap<ConsistDraft, number>();
  #nextRevision = 1;
  #lastWagonCount = 0;
  #stripScrollLeft = 0;
  #devValues: DevMenuValues | undefined;
  #devGate: DevTapState = { count: 0, startMs: 0 };
  #detailSnapshot: DebugSnapshot | undefined;

  constructor(root: HTMLElement) {
    this.#root = root;
  }

  get developerMenuOpen(): boolean {
    return this.#devValues !== undefined;
  }

  activateDeveloperGate(nowMs: number, values: DevMenuValues): void {
    if (this.#devValues) return;
    const next = devTap(this.#devGate, nowMs);
    this.#devGate = next;
    if (next.open) this.#devValues = values;
  }

  closeDeveloperMenu(): void {
    this.#devValues = undefined;
    this.#detailSnapshot = undefined;
    queueMicrotask(() =>
      this.#root.querySelector<HTMLButtonElement>('.build-id')?.focus(),
    );
  }

  openDiagnostics(snapshot: DebugSnapshot): void {
    const menu = this.#root.querySelector<HTMLElement>('.dev-menu');
    if (!menu || this.#detailSnapshot) return;
    this.#detailSnapshot = snapshot;
    menu.hidden = true;
    this.#root.append(diagnosticsView(snapshot));
    this.#root.querySelector<HTMLElement>('#diagnostics-title')?.focus();
  }

  closeDiagnostics(): void {
    this.#detailSnapshot = undefined;
    this.#root.querySelector('.diagnostics-detail')?.remove();
    const menu = this.#root.querySelector<HTMLElement>('.dev-menu');
    if (menu) menu.hidden = false;
    this.#root
      .querySelector<HTMLElement>('[data-action="dev-details"]')
      ?.focus();
  }

  copyDiagnostics(seed: number | undefined, json: boolean): void {
    const panel = this.#root.querySelector(
      json ? '.diagnostics-detail' : '.dev-menu',
    );
    const output = panel?.querySelector<HTMLElement>('[data-copy-output]');
    const text =
      json && this.#detailSnapshot
        ? JSON.stringify(this.#detailSnapshot, null, 2)
        : seed === undefined
          ? undefined
          : String(seed);
    if (output && text !== undefined) void copyDiagnosticText(text, output);
  }

  developerStartError(): void {
    const status = this.#root.querySelector('[data-dev-error]');
    if (status)
      status.textContent =
        'Novou cestu se nepodařilo spustit. Původní cesta zůstává.';
  }

  developerValues(): DevMenuValues | undefined {
    const form = this.#root.querySelector<HTMLFormElement>('.dev-fields');
    const world = form?.querySelector<HTMLInputElement>('[name="seed"]');
    if (!form || !world) return undefined;
    world.setCustomValidity('');
    const values = parseDevMenu(Object.fromEntries(new FormData(form)));
    if (!values)
      world.setCustomValidity(
        'Zadej celé číslo od 0 do 4294967295, nebo nech pole prázdné.',
      );
    return form.reportValidity() ? values : undefined;
  }

  developerWorldQuery(): string {
    return (
      this.#root
        .querySelector<HTMLInputElement>('[data-world-trace-query]')
        ?.value.trim() ?? ''
    );
  }
  worldDeveloperStatus(message: string, trace = false): void {
    const node = this.#root.querySelector(
      trace ? '[data-world-trace]' : '[data-world-status]',
    );
    if (node) node.textContent = message;
  }
  worldOverlayPressed(name: string, pressed: boolean): void {
    const button = this.#root.querySelector(
        `[data-action="dev-world-overlay:${name}"]`,
      ),
      value = String(pressed);
    if (button && button.getAttribute('aria-pressed') !== value)
      button.setAttribute('aria-pressed', value);
  }

  developerSaveError(part: 'session' | 'dev'): void {
    const status = this.#root.querySelector('[data-dev-error]');
    if (status)
      status.textContent =
        part === 'session'
          ? 'Volby nelze použít, protože hra nyní nemůže uložit cestu a nastavení. Zůstaň na této stránce; cesta je pouze v paměti.'
          : 'Vývojářské volby se nepodařilo uložit. Cesta a nastavení jsou uložené; stránka se znovu nenačetla.';
  }

  #revision(draft: ConsistDraft): number {
    let revision = this.#draftRevisions.get(draft);
    if (revision === undefined) {
      revision = this.#nextRevision++;
      this.#draftRevisions.set(draft, revision);
    }
    return revision;
  }

  update(model: UiModel): void {
    if (model.screen.name !== 'PAUSED') {
      this.#devValues = undefined;
      this.#detailSnapshot = undefined;
      this.#devGate = { count: 0, startMs: 0 };
    }
    const signature = JSON.stringify([
      model.screen,
      this.#revision(model.draft),
      model.settings.sfxEnabled,
      model.notices,
      model.fullSignals,
      model.hasJourney,
      model.seed,
      model.portrait,
      model.fullscreen,
      model.devActive,
      this.#devValues !== undefined,
    ]);
    if (signature === this.#signature) return;
    this.#signature = signature;
    // Keep unsaved native fields through layout and interruption updates.
    if (this.#devValues && this.#root.querySelector('.dev-menu')) return;
    const fullscreenFocused =
      this.#root.querySelector('[data-action="fullscreen"]') ===
      document.activeElement;
    const viewSignature = JSON.stringify([
      model.screen,
      model.portrait,
      model.fullscreen,
      model.devActive,
      this.#devValues !== undefined,
    ]);
    if (viewSignature === this.#viewSignature && this.#updateView) {
      this.#updateView(model);
      return;
    }
    this.#viewSignature = viewSignature;
    this.#updateView = undefined;
    const strip = this.#root.querySelector('.strip');
    if (strip) this.#stripScrollLeft = strip.scrollLeft;
    const scrollPositions = ['.cards', '.catalog'].map((selector) => ({
      selector,
      left: this.#root.querySelector(selector)?.scrollLeft,
    }));
    const focused = document.activeElement;
    const focusedAction =
      focused instanceof HTMLElement && this.#root.contains(focused)
        ? focused.dataset['action']
        : undefined;
    this.#renderScope?.abort();
    this.#renderScope = new AbortController();
    const signal = this.#renderScope.signal;
    this.#root.replaceChildren(...this.#render(model, signal));
    for (const { selector, left } of scrollPositions) {
      const row = this.#root.querySelector(selector);
      if (row && left !== undefined) row.scrollLeft = left;
    }
    if (focusedAction !== undefined) {
      // The strip creates its visible buttons in a microtask too.
      queueMicrotask(() => {
        if (signal.aborted) return;
        [...this.#root.querySelectorAll<HTMLElement>('[data-action]')]
          .find((node) => node.dataset['action'] === focusedAction)
          ?.focus({ preventScroll: true });
      });
    }
    this.#root.dataset['screen'] = model.screen.name;
    if (this.#devValues)
      queueMicrotask(() => {
        if (!signal.aborted)
          this.#root
            .querySelector<HTMLSelectElement>('.dev-menu select')
            ?.focus();
      });
    if (fullscreenFocused)
      this.#root
        .querySelector<HTMLButtonElement>('[data-action="fullscreen"]')
        ?.focus({ preventScroll: true });
  }

  dispose(): void {
    this.#updateView = undefined;
    this.#detailSnapshot = undefined;
    this.#renderScope?.abort();
    this.#root.replaceChildren();
  }

  #render(model: UiModel, signal: AbortSignal): HTMLElement[] {
    const views: HTMLElement[] = [];
    switch (model.screen.name) {
      case 'LOADING':
        break;
      case 'HOME':
        views.push(this.#home(model));
        break;
      case 'SELECT_LOCO':
        views.push(this.#selectLoco(model, signal));
        break;
      case 'BUILD_TRAIN':
        views.push(this.#builder(model, signal));
        break;
      case 'RIDING':
        views.push(this.#hud(model));
        break;
      case 'PAUSED':
        views.push(
          this.#devValues
            ? developerMenu(this.#devValues, signal, model.seed)
            : this.#pause(model),
        );
        break;
      case 'RECOVERABLE_ERROR':
        views.push(
          el(
            'section',
            { class: 'screen center' },
            el(
              'div',
              { class: 'screen-content' },
              el('p', {}, 'Vláček se teď nepodařilo spustit.'),
            ),
            actionButton('retry', 'Zkusit znovu', [label('Zkusit znovu')], {
              className: 'button big',
            }),
          ),
        );
        break;
    }
    // Parent fields remain accessible after rotation (doc 02 §9).
    if (model.portrait && !this.#devValues) {
      views.push(
        el(
          'section',
          { class: 'overlay rotate', role: 'alert' },
          icon('rotate', 96),
          el('p', {}, 'Otoč zařízení'),
        ),
      );
    }
    return views;
  }

  #fullscreenNotice(model: UiModel): HTMLElement | undefined {
    if (!model.fullscreen.failed) return undefined;
    return el(
      'p',
      { class: 'hint', role: 'status' },
      model.fullscreen.active
        ? 'Režim celé obrazovky teď nelze změnit.'
        : 'Celá obrazovka teď není dostupná. Hra pokračuje v okně.',
    );
  }

  #fullscreen(model: UiModel): HTMLElement | undefined {
    const state = model.fullscreen;
    if (!state.supported) return undefined;
    const text = state.active ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
    return actionButton(
      'fullscreen',
      text,
      [icon(state.active ? 'fullscreenExit' : 'fullscreen', 40), label(text)],
      {
        className: 'button fullscreen',
        pressed: state.active,
        disabled: state.failed,
      },
    );
  }

  #home(model: UiModel): HTMLElement {
    return el(
      'section',
      { class: 'screen center home' },
      el(
        'div',
        { class: 'row' },
        actionButton(
          'continue',
          'Pokračovat',
          [icon('play', 72), label('Pokračovat')],
          {
            className: 'button huge primary',
          },
        ),
        actionButton(
          'build-new',
          'Postavit vlak',
          [icon('build', 72), label('Postavit vlak')],
          {
            className: 'button huge',
          },
        ),
      ),
      this.#fullscreen(model),
      el(
        'div',
        { class: 'screen-content' },
        this.#fullscreenNotice(model),
        notices(model),
      ),
    );
  }

  #selectLoco(model: UiModel, signal: AbortSignal): HTMLElement {
    const selected = model.draft.consist.locomotiveId;
    const origin =
      model.screen.name === 'SELECT_LOCO' ? model.screen.origin : 'new';
    const section = el(
      'section',
      { class: 'screen select' },
      el('h1', {}, 'Vyber mašinku'),
      el(
        'div',
        { class: 'cards' },
        ...model.locomotives.map((loco) =>
          actionButton(
            `loco:${loco.id}`,
            loco.labelCs,
            [
              vehiclePreview(loco, 1),
              label(loco.labelCs),
              loco.id === selected
                ? el('span', { class: 'selected-mark' }, icon('check', 32))
                : undefined,
            ],
            { className: 'card', pressed: loco.id === selected },
          ),
        ),
      ),
      el(
        'div',
        { class: 'row bottom' },
        this.#fullscreen(model),
        origin === 'pause'
          ? actionButton('back', 'Zpět', [icon('back', 48), label('Zpět')], {
              className: 'button big',
            })
          : undefined,
        actionButton(
          'to-depot',
          'Přidej vagonky',
          [icon('next', 56), label('Přidej vagonky')],
          {
            className: 'button big primary',
          },
        ),
      ),
      this.#fullscreenNotice(model),
      notices(model),
    );
    const content = el('div', { class: 'screen-content' });
    for (const node of section.querySelectorAll('.cards, .hint, .notices'))
      content.append(node);
    section.querySelector('.row.bottom')?.before(content);
    const cue = el(
      'span',
      {
        class: 'scroll-cue',
        role: 'img',
        'aria-label': 'Další mašinky dole',
        hidden: true,
      },
      icon('towardLocomotive', 24),
    );
    section.querySelector('.row.bottom')?.append(cue);
    const updateCue = () => {
      cue.hidden =
        content.scrollTop + content.clientHeight >= content.scrollHeight - 1;
    };
    content.addEventListener('scroll', updateCue, { signal, passive: true });
    const observer = new ResizeObserver(updateCue);
    observer.observe(content);
    const cards = content.querySelector('.cards');
    if (cards) observer.observe(cards);
    signal.addEventListener('abort', () => observer.disconnect(), {
      once: true,
    });
    this.#updateView = (next) => {
      for (const card of section.querySelectorAll<HTMLElement>('.card')) {
        const selected =
          card.dataset['action'] === `loco:${next.draft.consist.locomotiveId}`;
        card.setAttribute('aria-pressed', String(selected));
        const mark = card.querySelector('.selected-mark');
        if (selected && !mark)
          card.append(
            el('span', { class: 'selected-mark' }, icon('check', 32)),
          );
        else if (!selected) mark?.remove();
      }
      this.#updateNotices(section, next);
      updateCue();
    };
    return section;
  }

  #consistStrip(model: UiModel, signal: AbortSignal) {
    const strip = el('div', { class: 'strip', 'aria-label': 'Souprava' });
    const track = el('div', { class: 'strip-track' });
    strip.append(track);
    const nodesByKey = new Map<string, HTMLElement>();
    const renderVisible = () => {
      const focused = document.activeElement;
      const draft = model.draft;
      const rules = model.lengthRules;
      const loco = model.locomotives.find(
        (candidate) => candidate.id === draft.consist.locomotiveId,
      );
      // Window the strip: only previews near the visible area exist in the DOM.
      const items = [
        ...(loco
          ? [
              {
                key: `loco:${loco.id}`,
                vehicle: loco,
                instanceId: undefined as string | undefined,
              },
            ]
          : []),
        ...draft.consist.wagons.flatMap((instance) => {
          const vehicle = model.wagons.find(
            (wagon) => wagon.id === instance.definitionId,
          );
          return vehicle
            ? [
                {
                  key: instance.instanceId,
                  vehicle,
                  instanceId: instance.instanceId,
                },
              ]
            : [];
        }),
      ];
      // One consist layout for depot and ride (doc 14 §1): the locomotive is
      // the front on the right, wagons follow to the left in consist order.
      const layout = layoutConsist(
        items.map((item) => item.vehicle),
        rules.couplerGapU,
      );
      const positions = items.map((item, index) =>
        Math.round(
          STRIP_PAD_PX +
            (layout.tailOffsetU -
              (layout.centerOffsetsU[index] ?? 0) -
              item.vehicle.lengthU / 2) *
              STRIP_PX_PER_U,
        ),
      );
      const width = Math.round(
        2 * STRIP_PAD_PX +
          (layout.frontOffsetU + layout.tailOffsetU) * STRIP_PX_PER_U,
      );
      track.style.width = `${width}px`;
      const from = strip.scrollLeft - 300;
      const to = strip.scrollLeft + strip.clientWidth + 300;
      const visibleKeys = new Set<string>();
      let visibleIndex = 0;
      items.forEach((item, index) => {
        const left = positions[index] ?? 0;
        const itemWidth = Math.round(item.vehicle.lengthU * STRIP_PX_PER_U);
        if (left + itemWidth < from || left > to) return;
        const selected =
          item.instanceId !== undefined &&
          item.instanceId === draft.selectedInstanceId;
        visibleKeys.add(item.key);
        let node = nodesByKey.get(item.key);
        if (!node) {
          const content = [vehiclePreview(item.vehicle, STRIP_PX_PER_U)];
          node =
            item.instanceId === undefined
              ? el('div', { class: 'strip-item loco' }, ...content)
              : actionButton(
                  `wagon:${item.instanceId}`,
                  item.vehicle.labelCs,
                  content,
                  {
                    className: selected ? 'strip-item selected' : 'strip-item',
                    pressed: selected,
                  },
                );
          nodesByKey.set(item.key, node);
          track.append(node);
        }
        if (item.instanceId !== undefined) {
          node.classList.toggle('selected', selected);
          node.setAttribute('aria-pressed', String(selected));
        }
        node.style.left = `${left}px`;
        node.style.width = `${itemWidth}px`;
        // DOM order follows the consist too, for keyboard navigation.
        if (track.children[visibleIndex] !== node)
          track.insertBefore(node, track.children[visibleIndex] ?? null);
        visibleIndex += 1;
      });
      for (const [key, node] of nodesByKey) {
        if (visibleKeys.has(key)) continue;
        node.remove();
        nodesByKey.delete(key);
      }
      if (
        focused instanceof HTMLElement &&
        track.contains(focused) &&
        document.activeElement !== focused
      )
        focused.focus({ preventScroll: true });
    };
    strip.addEventListener('scroll', renderVisible, { signal, passive: true });
    let initialized = false;
    const update = (next: UiModel) => {
      model = next;
      queueMicrotask(() => {
        if (signal.aborted) return;
        const count = model.draft.consist.wagons.length;
        const grew = count > this.#lastWagonCount;
        this.#lastWagonCount = count;
        const left = grew
          ? 0
          : initialized
            ? strip.scrollLeft
            : this.#stripScrollLeft;
        renderVisible();
        if (strip.scrollLeft !== left) {
          strip.scrollLeft = left;
          renderVisible();
        }
        initialized = true;
      });
    };
    update(model);
    return { strip, update };
  }

  #builder(model: UiModel, signal: AbortSignal): HTMLElement {
    const draft = model.draft;
    const { strip, update } = this.#consistStrip(model, signal);
    const origin =
      model.screen.name === 'BUILD_TRAIN' ? model.screen.origin : 'new';
    const section = el(
      'section',
      {
        class: 'screen builder',
        'data-full-signals': String(model.fullSignals),
      },
      el(
        'div',
        { class: 'row top' },
        actionButton('back', 'Zpět', [icon('back', 40)], {
          className: 'button',
        }),
        actionButton(
          'strip-start',
          'Na začátek k mašince',
          [icon('locomotive', 40)],
          { className: 'button' },
        ),
        actionButton(
          'change-loco',
          'Vyměnit mašinku',
          [icon('build', 40), label('Mašinka')],
          { className: 'button' },
        ),
        el(
          'span',
          { class: 'count', 'aria-live': 'polite' },
          String(draft.consist.wagons.length),
        ),
        // How much of the longest train is used; no numbers to read.
        el(
          'div',
          {
            class: 'length-meter',
            role: 'meter',
            'aria-label': 'Délka vláčku',
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            'aria-valuenow': '0',
          },
          el('div', {
            class: 'length-fill',
            style: 'width: 0%',
          }),
        ),
      ),
      strip,
      el('span', { class: 'full-text', role: 'status', hidden: true }),
      el(
        'div',
        { class: 'row actions' },
        actionButton('move-back', 'Posunout dozadu', [icon('towardTail', 40)], {
          className: 'button',
          disabled: true,
        }),
        actionButton(
          'move-forward',
          'Posunout blíž k mašince',
          [icon('towardLocomotive', 40)],
          {
            className: 'button',
            disabled: true,
          },
        ),
        actionButton('remove', 'Odebrat vagónek', [icon('remove', 40)], {
          className: 'button danger',
          disabled: true,
        }),
        actionButton('undo', 'Vrátit poslední změnu', [icon('undo', 40)], {
          className: 'button',
          disabled: true,
        }),
      ),
      el(
        'div',
        { class: 'catalog' },
        ...GROUPS.map(({ group, label: groupLabel }) =>
          el(
            'div',
            { class: 'group', 'aria-label': groupLabel },
            ...model.wagons
              .filter((wagon) => wagon.group === group)
              .map((wagon) =>
                actionButton(
                  `add:${wagon.id}`,
                  `Přidat: ${wagon.labelCs}`,
                  [vehiclePreview(wagon, 0.55)],
                  {
                    className: 'card small',
                    disabled: false,
                  },
                ),
              ),
          ),
        ),
      ),
      el(
        'div',
        { class: 'row bottom' },
        actionButton('depart', 'Vyjet', [icon('depart', 56), label('Vyjet')], {
          className: 'button big primary',
          disabled: false,
        }),
      ),
      origin === 'pause'
        ? el(
            'p',
            { class: 'hint' },
            'Vyjet založí novou cestu, Zpět vrátí původní.',
          )
        : undefined,
      notices(model),
    );
    const content = el('div', { class: 'screen-content builder-content' });
    for (const node of [...section.children]) {
      if (!node.matches('.row')) content.append(node);
    }
    section.querySelector('.row.bottom')?.before(content);
    this.#updateView = (next) => {
      this.#updateBuilder(section, next);
      update(next);
    };
    this.#updateBuilder(section, model);
    return section;
  }

  #updateNotices(section: HTMLElement, model: UiModel): void {
    section.querySelector('.notices')?.remove();
    const notice = notices(model);
    if (notice)
      (section.querySelector('.screen-content') ?? section).append(notice);
  }

  #updateBuilder(section: HTMLElement, model: UiModel): void {
    const draft = model.draft;
    const rules = model.lengthRules;
    const full = isFull(
      draft,
      model.wagons.map((wagon) => wagon.id),
      rules,
    );
    const tooLong = isOverLimit(draft, rules);
    const usedPercent = Math.round(
      (100 * consistLengthU(draft.consist, rules)) / rules.maxLengthU,
    );
    section.classList.toggle('full', full);
    section.dataset['fullSignals'] = String(model.fullSignals);
    const count = section.querySelector('.count');
    if (count) count.textContent = String(draft.consist.wagons.length);
    const meter = section.querySelector('.length-meter');
    meter?.classList.toggle('over', tooLong);
    meter?.setAttribute('aria-valuenow', String(usedPercent));
    const fill = section.querySelector<HTMLElement>('.length-fill');
    if (fill) fill.style.width = `${Math.min(100, usedPercent)}%`;
    const text = section.querySelector<HTMLElement>('.full-text');
    if (text) {
      text.hidden = !full && !tooLong;
      text.textContent = tooLong ? 'Vláček je moc dlouhý' : 'Vláček je plný';
    }
    const disabled = new Map([
      ['move-back', !canMoveSelected(draft, 'back')],
      ['move-forward', !canMoveSelected(draft, 'towardLocomotive')],
      ['remove', draft.selectedInstanceId === undefined],
      ['undo', !canUndo(draft)],
      ['depart', tooLong],
      ...model.wagons.map((wagon): [string, boolean] => [
        `add:${wagon.id}`,
        !canAddWagon(draft, wagon.id, rules),
      ]),
    ]);
    for (const button of section.querySelectorAll<HTMLButtonElement>(
      'button[data-action]',
    )) {
      const value = disabled.get(button.dataset['action'] ?? '');
      if (value !== undefined) button.disabled = value;
    }
    this.#updateNotices(section, model);
  }

  #hud(model: UiModel): HTMLElement {
    return el(
      'section',
      { class: 'hud' },
      actionButton('brake', 'Brzda', [icon('brake', 64)], {
        className: 'control brake',
      }),
      actionButton('horn', 'Píšťala', [icon('horn', 56)], {
        className: 'control horn',
      }),
      el(
        'div',
        { class: 'corner' },
        actionButton(
          'sound',
          model.settings.sfxEnabled ? 'Vypnout zvuky' : 'Zapnout zvuky',
          [icon(model.settings.sfxEnabled ? 'soundOn' : 'soundOff', 36)],
          { className: 'control small', pressed: model.settings.sfxEnabled },
        ),
        actionButton('pause', 'Pauza', [icon('pause', 36)], {
          className: 'control small',
        }),
      ),
    );
  }

  #pause(model: UiModel): HTMLElement {
    return el(
      'section',
      { class: 'overlay pause' },
      el('h1', {}, 'Pauza'),
      el(
        'div',
        { class: 'row' },
        actionButton(
          'resume',
          'Pokračovat',
          [icon('play', 72), label('Pokračovat')],
          {
            className: 'button huge primary',
          },
        ),
        actionButton(
          'open-depot',
          'Postavit vlak',
          [icon('build', 48), label('Postavit vlak')],
          {
            className: 'button big',
          },
        ),
        this.#fullscreen(model),
      ),
      el(
        'div',
        { class: 'screen-content' },
        this.#fullscreenNotice(model),
        notices(model),
        model.seed === undefined
          ? undefined
          : el('p', { class: 'world-id' }, `Svět ${model.seed}`),
      ),
      actionButton(
        'dev-build',
        `Build ${model.buildId}${model.devActive ? ' · dev' : ''}`,
        [`Build ${model.buildId}${model.devActive ? ' · dev' : ''}`],
        { className: 'build-id' },
      ),
    );
  }
}
