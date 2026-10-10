import type { Screen } from '../app/AppState.ts';
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
import { actionButton, el } from './dom.ts';
import { icon } from './icons.ts';
import { vehicleSvg } from './placeholderArt.ts';

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
  buildId: string;
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
 * visible state changes; listeners of a render are released with it.
 */
export class UiLayer {
  readonly #root: HTMLElement;
  #signature = '';
  #renderScope: AbortController | undefined;
  readonly #draftRevisions = new WeakMap<ConsistDraft, number>();
  #nextRevision = 1;
  #lastWagonCount = 0;
  #stripScrollLeft = 0;

  constructor(root: HTMLElement) {
    this.#root = root;
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
    const signature = JSON.stringify([
      model.screen,
      this.#revision(model.draft),
      model.settings.sfxEnabled,
      model.notices,
      model.fullSignals,
      model.hasJourney,
      model.seed,
      model.portrait,
    ]);
    if (signature === this.#signature) return;
    this.#signature = signature;
    const strip = this.#root.querySelector('.strip');
    if (strip) this.#stripScrollLeft = strip.scrollLeft;
    this.#renderScope?.abort();
    this.#renderScope = new AbortController();
    this.#root.replaceChildren(
      ...this.#render(model, this.#renderScope.signal),
    );
    this.#root.dataset['screen'] = model.screen.name;
  }

  dispose(): void {
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
        views.push(this.#selectLoco(model));
        break;
      case 'BUILD_TRAIN':
        views.push(this.#builder(model, signal));
        break;
      case 'RIDING':
        views.push(this.#hud(model));
        break;
      case 'PAUSED':
        views.push(this.#pause(model));
        break;
      case 'RECOVERABLE_ERROR':
        views.push(
          el(
            'section',
            { class: 'screen center' },
            el('p', {}, 'Vláček se teď nepodařilo spustit.'),
            actionButton('retry', 'Zkusit znovu', [label('Zkusit znovu')], {
              className: 'button big',
            }),
          ),
        );
        break;
    }
    if (model.portrait) {
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
      notices(model),
    );
  }

  #selectLoco(model: UiModel): HTMLElement {
    const selected = model.draft.consist.locomotiveId;
    const origin =
      model.screen.name === 'SELECT_LOCO' ? model.screen.origin : 'new';
    return el(
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
              vehicleSvg(loco, 1),
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
      notices(model),
    );
  }

  #builder(model: UiModel, signal: AbortSignal): HTMLElement {
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
    const loco = model.locomotives.find(
      (candidate) => candidate.id === draft.consist.locomotiveId,
    );
    const strip = el('div', { class: 'strip', 'aria-label': 'Souprava' });
    const track = el('div', { class: 'strip-track' });
    strip.append(track);

    // Window the strip: only previews near the visible area exist in the DOM.
    const items = [
      ...(loco
        ? [
            {
              key: 'loco',
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
    const renderVisible = () => {
      const from = strip.scrollLeft - 300;
      const to = strip.scrollLeft + strip.clientWidth + 300;
      const nodes: HTMLElement[] = [];
      items.forEach((item, index) => {
        const left = positions[index] ?? 0;
        const itemWidth = Math.round(item.vehicle.lengthU * STRIP_PX_PER_U);
        if (left + itemWidth < from || left > to) return;
        const selected =
          item.instanceId !== undefined &&
          item.instanceId === draft.selectedInstanceId;
        const content = [vehicleSvg(item.vehicle, STRIP_PX_PER_U)];
        const node =
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
        node.style.left = `${left}px`;
        node.style.width = `${itemWidth}px`;
        nodes.push(node);
      });
      track.replaceChildren(...nodes);
    };
    strip.addEventListener('scroll', renderVisible, { signal, passive: true });
    queueMicrotask(() => {
      if (signal.aborted) return;
      // A new wagon joins the tail at the left end: show it.
      const grew = draft.consist.wagons.length > this.#lastWagonCount;
      this.#lastWagonCount = draft.consist.wagons.length;
      strip.scrollLeft = grew ? 0 : this.#stripScrollLeft;
      renderVisible();
    });

    const selection = draft.selectedInstanceId !== undefined;
    const origin =
      model.screen.name === 'BUILD_TRAIN' ? model.screen.origin : 'new';
    return el(
      'section',
      {
        class: `screen builder${full ? ' full' : ''}`,
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
            class: tooLong ? 'length-meter over' : 'length-meter',
            role: 'meter',
            'aria-label': 'Délka vláčku',
            'aria-valuemin': '0',
            'aria-valuemax': '100',
            'aria-valuenow': String(usedPercent),
          },
          el('div', {
            class: 'length-fill',
            style: `width: ${Math.min(100, usedPercent)}%`,
          }),
        ),
        tooLong
          ? el('span', { class: 'full-text' }, 'Vláček je moc dlouhý')
          : full
            ? el('span', { class: 'full-text' }, 'Vláček je plný')
            : undefined,
      ),
      strip,
      el(
        'div',
        { class: 'row actions' },
        actionButton('move-back', 'Posunout dozadu', [icon('towardTail', 40)], {
          className: 'button',
          disabled: !canMoveSelected(draft, 'back'),
        }),
        actionButton(
          'move-forward',
          'Posunout blíž k mašince',
          [icon('towardLocomotive', 40)],
          {
            className: 'button',
            disabled: !canMoveSelected(draft, 'towardLocomotive'),
          },
        ),
        actionButton('remove', 'Odebrat vagónek', [icon('remove', 40)], {
          className: 'button danger',
          disabled: !selection,
        }),
        actionButton('undo', 'Vrátit poslední změnu', [icon('undo', 40)], {
          className: 'button',
          disabled: !canUndo(draft),
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
                  [vehicleSvg(wagon, 0.55)],
                  {
                    className: 'card small',
                    disabled: !canAddWagon(draft, wagon.id, rules),
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
          disabled: tooLong,
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
      ),
      notices(model),
      model.seed === undefined
        ? undefined
        : el('p', { class: 'world-id' }, `Svět ${model.seed}`),
      el('p', { class: 'build-id' }, `Build ${model.buildId}`),
    );
  }
}
