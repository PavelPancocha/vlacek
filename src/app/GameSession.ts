import type { GameConfig } from '../config/gameConfig.ts';
import type { CatalogLocomotive, CatalogWagon } from '../content/vehicles.ts';
import {
  addWagon,
  createDraft,
  draftFromConsist,
  isOverLimit,
  moveSelected,
  removeSelected,
  selectLocomotive,
  selectWagon,
  undoLastChange,
  type ConsistDraft,
  type ConsistLengthRules,
} from '../domain/consist/ConsistEditor.ts';
import {
  RideSimulation,
  type RideEvent,
} from '../domain/ride/RideSimulation.ts';
import {
  advanceFixedStep,
  initialFixedStep,
  type FixedStepState,
} from '../domain/sim/FixedStep.ts';
import type { VehicleGeometry } from '../domain/train/TrainGeometry.ts';
import type { Consist } from '../domain/types.ts';
import { TRACK_GENERATOR_VERSION } from '../domain/world/TrackProfile.ts';
import { InputRouter } from '../platform/InputRouter.ts';
import type { SaveNotice, SaveRepository } from '../platform/SaveRepository.ts';
import {
  defaultSettings,
  type SaveEnvelopeV1,
  type Settings,
} from '../platform/SaveValidation.ts';
import { transition, type AppEvent, type Screen } from './AppState.ts';
import { SaveScheduler } from './SaveScheduler.ts';

export interface SessionDeps {
  config: GameConfig;
  catalog: {
    locomotives: readonly CatalogLocomotive[];
    wagons: readonly CatalogWagon[];
  };
  repository: SaveRepository;
  /** Journey seed source (platform: crypto.getRandomValues). */
  randomSeed: () => number;
  /** Diagnostic timestamp only; never used to advance the ride. */
  nowIso: () => string;
  buildId: string;
}

/** Parent-facing notices; shown as plain text outside the child's controls. */
export type SessionNotice =
  | SaveNotice
  | 'storage-limited'
  | 'start-failed'
  | 'journey-unavailable'
  | 'train-too-long'
  | 'track-changed';

/** Session-level events for audio/visual feedback, alongside ride events. */
export type SessionEvent =
  RideEvent | { type: 'locomotivePreview'; id: string } | { type: 'trainFull' };

interface Journey {
  seed: number;
  consist: Consist;
  ride: RideSimulation;
}

const MAX_PENDING_EVENTS = 64;

/**
 * Coordinates screens, the single InputRouter, the depot draft, the journey
 * simulation and saving (doc 08 §3, §8). It has no DOM or Phaser
 * dependency: the browser shell forwards events and renders its state.
 */
export class GameSession {
  readonly router: InputRouter;
  readonly #deps: SessionDeps;
  readonly #scheduler: SaveScheduler;
  #screen: Screen = { name: 'LOADING' };
  #settings: Settings = defaultSettings;
  #lastConsist: Consist;
  #draft: ConsistDraft;
  #journey: Journey | undefined;
  #fixedStep: FixedStepState = initialFixedStep();
  #hitObject: (clientX: number, clientY: number) => string | undefined = () =>
    undefined;
  #unhandledAction: (action: string) => void = () => undefined;
  #events: SessionEvent[] = [];
  #notices = new Set<SessionNotice>();
  #fullSignals = 0;
  /** Depot draft loaded from the save; continued once by the next depot visit. */
  #restoredDraft: ConsistDraft | undefined;
  /** Wall-clock time of the latest frame, for debouncing edits. */
  #nowMs = 0;

  constructor(deps: SessionDeps) {
    this.#deps = deps;
    const defaultLocomotive = deps.catalog.locomotives[0]?.id;
    if (!defaultLocomotive) throw new Error('The catalog has no locomotive');
    this.#lastConsist = { locomotiveId: defaultLocomotive, wagons: [] };
    this.#draft = createDraft(defaultLocomotive);
    this.#scheduler = new SaveScheduler({
      intervalTicks: Math.round(
        deps.config.save.intervalSeconds * deps.config.simulation.fixedHz,
      ),
      editDebounceMs: deps.config.save.editDebounceMs,
    });
    const vehicles = new Map<string, VehicleGeometry>(
      [...deps.catalog.locomotives, ...deps.catalog.wagons].map((vehicle) => [
        vehicle.id,
        vehicle,
      ]),
    );
    this.lengthRules = {
      maxLengthU: deps.config.train.maxConsistLengthU,
      couplerGapU: deps.config.train.couplerGapU,
      geometryOf: (id) => vehicles.get(id),
    };
    this.router = new InputRouter(deps.config.input, {
      hitObject: (x, y) => this.#hitObject(x, y),
      onObjectTouched: (id) => this.#journey?.ride.activateObject(id),
      onAction: (action) => this.#onAction(action),
    });
  }

  /** The length limit the depot and every departure respect (doc 14 §2). */
  readonly lengthRules: ConsistLengthRules;

  get screen(): Screen {
    return this.#screen;
  }

  get settings(): Settings {
    return this.#settings;
  }

  get draft(): ConsistDraft {
    return this.#draft;
  }

  get ride(): RideSimulation | undefined {
    return this.#journey?.ride;
  }

  get journeySeed(): number | undefined {
    return this.#journey?.seed;
  }

  get journeyConsist(): Consist | undefined {
    return this.#journey?.consist;
  }

  get notices(): readonly SessionNotice[] {
    return [...this.#notices];
  }

  /** Increments whenever an addition was refused because the train is full. */
  get fullSignals(): number {
    return this.#fullSignals;
  }

  /** Render layer: CSS px → interactive object id under the finger. */
  setWorldHitTest(
    hitTest: (clientX: number, clientY: number) => string | undefined,
  ): void {
    this.#hitObject = hitTest;
  }

  /** Shell-only actions (e.g. scrolling the depot strip) go here. */
  setUnhandledActionHandler(handler: (action: string) => void): void {
    this.#unhandledAction = handler;
  }

  boot(): void {
    const loaded = this.#deps.repository.load();
    if (loaded.source === 'none') {
      if (loaded.notice) this.#notices.add(loaded.notice);
    } else {
      if (loaded.source === 'backup') this.#notices.add(loaded.notice);
      const save = loaded.save;
      this.#settings = save.settings;
      this.#lastConsist = save.lastConsist;
      this.#draft = draftFromConsist(save.builderDraft ?? save.lastConsist);
      // With a journey the app opens HOME; the draft waits for the next depot
      // visit. Without one it is already the selection screen's draft.
      if (save.builderDraft && save.journey) this.#restoredDraft = this.#draft;
      const tooLong =
        save.journey !== undefined &&
        isOverLimit(draftFromConsist(save.journey.consist), this.lengthRules);
      if (save.journey && tooLong) {
        // A 0.1 save may hold a train longer than the screen (doc 14 §2).
        // Keep every wagon in the depot instead of riding an unseen train.
        this.#draft = draftFromConsist(
          save.builderDraft ?? save.journey.consist,
        );
        this.#restoredDraft = undefined;
        this.#notices.add('train-too-long');
      } else if (save.journey) {
        // Another generator would put the train on different track (D-005):
        // keep the train and world number, start fresh and say so.
        const sameTrack =
          save.journey.generatorVersion === TRACK_GENERATOR_VERSION;
        if (!sameTrack) this.#notices.add('track-changed');
        try {
          this.#journey = {
            seed: save.journey.seed,
            consist: save.journey.consist,
            ride: this.#createRide(
              save.journey.seed,
              save.journey.consist,
              sameTrack
                ? {
                    head: save.journey.head,
                    simulationTick: save.journey.simulationTick,
                  }
                : undefined,
            ),
          };
        } catch {
          this.#notices.add('journey-unavailable');
        }
      }
    }
    this.#apply({ type: 'loaded', hasJourney: this.#journey !== undefined });
  }

  #vehicles(consist: Consist): VehicleGeometry[] {
    const { locomotives, wagons } = this.#deps.catalog;
    const loco = locomotives.find(
      (candidate) => candidate.id === consist.locomotiveId,
    );
    if (!loco) throw new Error(`Unknown locomotive ${consist.locomotiveId}`);
    return [
      loco,
      ...consist.wagons.map((instance) => {
        const wagon = wagons.find(
          (candidate) => candidate.id === instance.definitionId,
        );
        if (!wagon) throw new Error(`Unknown wagon ${instance.definitionId}`);
        return wagon;
      }),
    ];
  }

  #createRide(
    seed: number,
    consist: Consist,
    restore?: {
      head: { chunkIndex: number; arcOffsetU: number };
      simulationTick: number;
    },
  ): RideSimulation {
    const locomotive = this.#deps.catalog.locomotives.find(
      (candidate) => candidate.id === consist.locomotiveId,
    );
    return new RideSimulation({
      seed,
      vehicles: this.#vehicles(consist),
      // Changing the locomotive starts a new journey (doc 03 §9).
      electrified: locomotive?.requiresCatenary === true,
      // Oncoming trains: steam or diesel locomotives (doc 03 §9).
      npcFleet: {
        locomotives: this.#deps.catalog.locomotives.filter(
          (candidate) =>
            candidate.power === 'steam' || candidate.power === 'diesel',
        ),
        wagons: this.#deps.catalog.wagons,
      },
      speedFactor: this.#settings.maxSpeedFactor,
      config: this.#deps.config,
      ...(restore
        ? { head: restore.head, simulationTick: restore.simulationTick }
        : {}),
    });
  }

  #apply(event: AppEvent): void {
    this.#screen = transition(this.#screen, event);
    this.router.setMode(this.#screen.name === 'RIDING' ? 'ride' : 'menu');
  }

  #emit(event: SessionEvent): void {
    this.#events.push(event);
    if (this.#events.length > MAX_PENDING_EVENTS) this.#events.shift();
  }

  drainEvents(): SessionEvent[] {
    const rideEvents = this.#journey?.ride.drainEvents() ?? [];
    const events = [...this.#events, ...rideEvents];
    this.#events = [];
    return events;
  }

  /**
   * One rendered frame. Simulation runs only while RIDING; returns the
   * interpolation fraction for the renderer.
   */
  frame(frameSec: number, nowMs: number): number {
    this.#nowMs = nowMs;
    let alpha = 0;
    const ride = this.#journey?.ride;
    if (this.#screen.name === 'RIDING' && ride) {
      const result = advanceFixedStep(this.#fixedStep, frameSec, {
        stepSec: 1 / this.#deps.config.simulation.fixedHz,
        maxStepsPerFrame: this.#deps.config.simulation.maxCatchUpSteps,
      });
      this.#fixedStep = result.state;
      alpha = result.alpha;
      for (let i = 0; i < result.steps; i++) {
        // Input is evaluated before motion in every step (doc 03 §2).
        ride.step(this.router.intent());
        if (this.#scheduler.isTickCheckpoint(ride.simulationTick))
          this.#persist();
      }
    }
    if (this.#scheduler.takeDueEdit(nowMs)) this.#persist();
    return alpha;
  }

  /** Focus loss, hidden page, resize or rotation (doc 02 §9, doc 09 §6). */
  interrupt(): void {
    this.router.clearAll();
    if (this.#screen.name === 'RIDING') {
      this.#apply({ type: 'externalInterruption' });
      this.#journey?.ride.resetMotion();
    }
    this.#scheduler.flushPendingEdit();
    this.#persist();
  }

  #pause(): void {
    if (this.#screen.name !== 'RIDING') return;
    this.#apply({ type: 'pause' });
    this.router.clearAll();
    this.#journey?.ride.resetMotion();
    this.#persist();
  }

  #resume(): void {
    if (this.#screen.name !== 'PAUSED' || !this.#journey) return;
    this.#apply({ type: 'resume' });
    // The confirming touch and anything still held never drives (INP-11).
    this.router.resumeLock();
    this.#journey.ride.resetMotion();
    this.#fixedStep = initialFixedStep();
  }

  #depart(): void {
    if (isOverLimit(this.#draft, this.lengthRules)) {
      this.#notices.add('train-too-long');
      this.#fullSignals += 1;
      this.#emit({ type: 'trainFull' });
      return;
    }
    let journey: Journey;
    try {
      const seed = this.#deps.randomSeed();
      const consist = this.#draft.consist;
      journey = { seed, consist, ride: this.#createRide(seed, consist) };
    } catch {
      // Keep the previous journey and its save restorable (DATA-10).
      this.#notices.add('start-failed');
      return;
    }
    this.#notices.delete('start-failed');
    this.#notices.delete('train-too-long');
    this.#notices.delete('track-changed');
    this.#restoredDraft = undefined;
    this.#journey = journey;
    this.#lastConsist = journey.consist;
    this.#apply({ type: 'depart' });
    this.router.resumeLock();
    this.#fixedStep = initialFixedStep();
    this.#scheduler.flushPendingEdit();
    this.#persist();
  }

  #edit(draft: ConsistDraft): void {
    if (draft === this.#draft) return;
    this.#draft = draft;
    this.#scheduler.noteEdit(this.#nowMs);
  }

  #takeRestoredDraft(): ConsistDraft | undefined {
    const draft = this.#restoredDraft;
    this.#restoredDraft = undefined;
    return draft;
  }

  #onAction(action: string): void {
    const separator = action.indexOf(':');
    const name = separator < 0 ? action : action.slice(0, separator);
    const argument = separator < 0 ? undefined : action.slice(separator + 1);
    switch (name) {
      case 'horn':
        this.#journey?.ride.requestHorn();
        return;
      case 'pause':
        this.#pause();
        return;
      case 'resume':
        this.#resume();
        return;
      case 'sound':
        this.#settings = {
          ...this.#settings,
          sfxEnabled: !this.#settings.sfxEnabled,
        };
        this.#scheduler.noteEdit(this.#nowMs);
        return;
      case 'continue':
        this.#apply({ type: 'continueJourney' });
        return;
      case 'build-new':
        this.#draft =
          this.#takeRestoredDraft() ?? draftFromConsist(this.#lastConsist);
        this.#apply({ type: 'buildNew' });
        return;
      case 'open-depot':
        if (this.#journey) {
          this.#draft =
            this.#takeRestoredDraft() ??
            draftFromConsist(this.#journey.consist);
          this.#apply({ type: 'openDepot' });
        }
        return;
      case 'loco':
        if (
          argument &&
          this.#deps.catalog.locomotives.some((loco) => loco.id === argument)
        ) {
          this.#edit(selectLocomotive(this.#draft, argument));
          this.#emit({ type: 'locomotivePreview', id: argument });
        }
        return;
      case 'to-depot':
        this.#apply({ type: 'locomotiveChosen' });
        return;
      case 'change-loco':
        this.#apply({ type: 'chooseLocomotive' });
        return;
      case 'add':
        if (
          argument &&
          this.#deps.catalog.wagons.some((wagon) => wagon.id === argument)
        ) {
          const result = addWagon(this.#draft, argument, this.lengthRules);
          if (result.added) this.#edit(result.draft);
          else {
            this.#fullSignals += 1;
            this.#emit({ type: 'trainFull' });
          }
        }
        return;
      case 'wagon':
        if (argument) this.#draft = selectWagon(this.#draft, argument);
        return;
      case 'remove':
        this.#edit(removeSelected(this.#draft));
        return;
      case 'move-forward':
        this.#edit(moveSelected(this.#draft, 'towardLocomotive'));
        return;
      case 'move-back':
        this.#edit(moveSelected(this.#draft, 'back'));
        return;
      case 'undo':
        this.#edit(undoLastChange(this.#draft));
        return;
      case 'back':
        this.#apply({ type: 'back' });
        return;
      case 'depart':
        this.#depart();
        return;
      default:
        this.#unhandledAction(action);
    }
  }

  #envelope(): SaveEnvelopeV1 {
    const envelope: SaveEnvelopeV1 = {
      schemaVersion: 1,
      contentVersion: 1,
      savedAtIso: this.#deps.nowIso(),
      appBuildId: this.#deps.buildId.slice(0, 64),
      settings: this.#settings,
      lastConsist: this.#lastConsist,
    };
    const screen = this.#screen.name;
    if (screen === 'SELECT_LOCO' || screen === 'BUILD_TRAIN') {
      envelope.builderDraft = this.#draft.consist;
    } else if (this.#restoredDraft) {
      // Not yet used by the depot: keep it across ride checkpoints.
      envelope.builderDraft = this.#restoredDraft.consist;
    }
    const journey = this.#journey;
    if (journey) {
      envelope.journey = {
        seed: journey.seed,
        generatorVersion: TRACK_GENERATOR_VERSION,
        consist: journey.consist,
        head: journey.ride.headCursor(),
        simulationTick: journey.ride.simulationTick,
        activeEntities: [],
      };
    }
    return envelope;
  }

  #persist(): void {
    const outcome = this.#deps.repository.save(this.#envelope());
    if (outcome === 'memory-only') this.#notices.add('storage-limited');
  }
}
