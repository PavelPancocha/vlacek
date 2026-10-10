import type { ShapedVehicle } from '../content/placeholderShapes.ts';
import { locomotives, wagons } from '../content/vehicles.ts';
import type { Consist } from '../domain/types.ts';
import { TRACK_GENERATOR_VERSION } from '../domain/world/TrackProfile.ts';
import { AudioManager, type SoundId } from '../platform/AudioManager.ts';
import { isPortrait } from '../platform/browserEnvironment.ts';
import type { RendererPreference } from '../platform/CapabilityProbe.ts';
import { DomInputAdapter } from '../platform/DomInputAdapter.ts';
import { FrameStats } from '../platform/FrameStats.ts';
import type { CssRect } from '../platform/InputRouter.ts';
import { createGameHost, type GameHost } from '../render/GameHost.ts';
import { RideScene } from '../render/RideScene.ts';
import { BRAKE_HIT_MARGIN_PX, UiLayer } from '../ui/UiLayer.ts';
import type { DebugSnapshot } from './debugSnapshot.ts';
import type { GameSession, SessionEvent } from './GameSession.ts';

export interface AppControllerOptions {
  renderer: RendererPreference;
  debug: boolean;
  buildId: string;
}

const HORN_BY_POWER: Record<string, SoundId> = {
  steam: 'horn-steam',
  diesel: 'horn-diesel',
  electric: 'horn-diesel',
  fantasy: 'horn-fantasy',
};

/**
 * Browser shell (doc 08 §8): owns the DOM layers, the Phaser host, the input
 * adapter and audio, and forwards everything to the GameSession. Phaser's
 * animation frame is the only loop; the session runs its fixed steps in it.
 */
/** Free space kept between the train and the HUD controls, CSS px. */
const HUD_GAP_PX = 8;

export class AppController {
  readonly #session: GameSession;
  readonly #options: AppControllerOptions;
  readonly #gameRoot: HTMLElement;
  readonly #uiRoot: HTMLElement;
  readonly #ui: UiLayer;
  readonly #audio = new AudioManager();
  readonly #frames = new FrameStats(600);
  readonly #scene: RideScene;
  readonly #host: GameHost;
  readonly #input: DomInputAdapter;
  #renderer = 'pending';
  #diagnostics: HTMLElement | undefined;
  #lastDiagnosticsMs = 0;
  #portrait = false;
  #brakeRect: CssRect | undefined;
  #journeyVehiclesFor: Consist | undefined;
  #journeyVehicles: readonly ShapedVehicle[] = [];

  constructor(
    app: HTMLElement,
    gameRoot: HTMLElement,
    session: GameSession,
    options: AppControllerOptions,
  ) {
    this.#session = session;
    this.#options = options;
    this.#gameRoot = gameRoot;
    this.#uiRoot = document.createElement('div');
    this.#uiRoot.id = 'ui-layer';
    app.append(this.#uiRoot);
    this.#ui = new UiLayer(this.#uiRoot);
    if (options.debug) {
      this.#diagnostics = document.createElement('pre');
      this.#diagnostics.id = 'diagnostics';
      app.append(this.#diagnostics);
      Object.assign(window, { __vlacek: { snapshot: () => this.snapshot() } });
    }
    this.#portrait = isPortrait();

    this.#scene = new RideScene({
      frame: (deltaSec, nowMs) => this.#frame(deltaSec, nowMs),
      ride: () => this.#session.ride,
      journeyVehicles: () => this.#vehiclesOfJourney(),
      catalogVehicles: () => [...locomotives, ...wagons],
    });
    this.#host = createGameHost({
      parent: gameRoot,
      renderer: options.renderer,
      maxDpr: 1.5,
      scenes: [this.#scene],
      onReady: (renderer) => {
        this.#renderer = renderer;
        gameRoot.dataset['renderer'] = renderer;
      },
    });
    session.setWorldHitTest((x, y) =>
      this.#scene.hitObject(x, y, this.#host.canvas.getBoundingClientRect()),
    );
    session.setUnhandledActionHandler((action) => {
      if (action === 'strip-start') {
        // The locomotive is the front of the train, at the strip's right end.
        const strip = this.#uiRoot.querySelector('.strip');
        strip?.scrollTo({ left: strip.scrollWidth });
      }
      if (action === 'retry') window.location.reload();
    });
    this.#input = new DomInputAdapter({
      root: app,
      router: session.router,
      onGesture: () => {
        // A gesture that leaves the game paused keeps the sound frozen
        // (doc 02 §6); the one that resumes unlocks after routing.
        if (this.#session.screen.name !== 'PAUSED') this.#audio.unlock();
      },
      onInterrupt: () => {
        session.interrupt();
        this.#audio.suspend();
        this.#refreshUi();
      },
      onLayout: () => {
        this.#portrait = isPortrait();
        if (this.#portrait) session.interrupt();
        this.#measureBrake();
        this.#refreshUi();
      },
    });
    this.#refreshUi();
  }

  #vehiclesOfJourney(): readonly ShapedVehicle[] {
    const consist = this.#session.journeyConsist;
    if (consist !== this.#journeyVehiclesFor) {
      this.#journeyVehiclesFor = consist;
      this.#journeyVehicles = consist
        ? [
            ...locomotives.filter((loco) => loco.id === consist.locomotiveId),
            ...consist.wagons.flatMap((instance) =>
              wagons.filter((wagon) => wagon.id === instance.definitionId),
            ),
          ]
        : [];
    }
    return this.#journeyVehicles;
  }

  #frame(deltaSec: number, nowMs: number): number {
    this.#frames.add(deltaSec * 1000);
    const alpha = this.#session.frame(deltaSec, nowMs);
    for (const event of this.#session.drainEvents()) this.#feedback(event);
    this.#refreshUi();
    if (this.#diagnostics && nowMs - this.#lastDiagnosticsMs > 250) {
      this.#lastDiagnosticsMs = nowMs;
      this.#diagnostics.textContent = JSON.stringify(
        this.snapshot(),
        (key, value: unknown) =>
          key === 'objects'
            ? undefined
            : typeof value === 'number'
              ? Math.round(value * 10) / 10
              : value,
        1,
      );
    }
    return alpha;
  }

  #feedback(event: SessionEvent): void {
    if (!this.#session.settings.sfxEnabled) return;
    switch (event.type) {
      case 'horn': {
        const loco = locomotives.find(
          (candidate) =>
            candidate.id === this.#session.journeyConsist?.locomotiveId,
        );
        this.#audio.play(HORN_BY_POWER[loco?.power ?? 'steam'] ?? 'horn-steam');
        return;
      }
      case 'locomotivePreview': {
        const loco = locomotives.find((candidate) => candidate.id === event.id);
        this.#audio.play(HORN_BY_POWER[loco?.power ?? 'steam'] ?? 'horn-steam');
        return;
      }
      case 'objectReacted':
        this.#audio.play('reaction');
        return;
      case 'trainFull':
        this.#audio.play('train-full');
        return;
    }
  }

  #refreshUi(): void {
    const session = this.#session;
    const before = this.#uiRoot.dataset['screen'];
    this.#ui.update({
      screen: session.screen,
      draft: session.draft,
      settings: session.settings,
      notices: session.notices,
      fullSignals: session.fullSignals,
      hasJourney: session.ride !== undefined,
      seed: session.journeySeed,
      portrait: this.#portrait,
      buildId: this.#options.buildId,
      locomotives,
      wagons,
      lengthRules: session.lengthRules,
    });
    const now = this.#uiRoot.dataset['screen'];
    if (now !== before) {
      this.#measureBrake();
      // Pause freezes sounds too (doc 02 §6); the resume tap unlocks again.
      if (now === 'PAUSED') this.#audio.suspend();
    }
  }

  #measureBrake(): void {
    const brake = this.#uiRoot.querySelector('[data-action="brake"]');
    if (!brake) {
      this.#brakeRect = undefined;
    } else {
      const rect = brake.getBoundingClientRect();
      this.#brakeRect = {
        left: rect.left - BRAKE_HIT_MARGIN_PX,
        top: rect.top - BRAKE_HIT_MARGIN_PX,
        width: rect.width + 2 * BRAKE_HIT_MARGIN_PX,
        height: rect.height + 2 * BRAKE_HIT_MARGIN_PX,
      };
    }
    this.#session.router.setBrakeHitArea(this.#brakeRect);
    // The camera keeps the whole train between the corner buttons and the
    // brake (doc 14 §2). Without a HUD (pause) the last strips stay.
    const corner = this.#uiRoot.querySelector('.corner');
    if (brake && corner) {
      const canvas = this.#gameRoot.getBoundingClientRect();
      this.#scene.setReservedInsets(
        corner.getBoundingClientRect().bottom - canvas.top + HUD_GAP_PX,
        canvas.bottom - brake.getBoundingClientRect().top + HUD_GAP_PX,
      );
    }
  }

  snapshot(): DebugSnapshot {
    const session = this.#session;
    const ride = session.ride;
    const frames = this.#frames.summary();
    const canvas = this.#host.canvas as HTMLCanvasElement | undefined;
    return {
      buildId: this.#options.buildId,
      renderer: this.#renderer,
      screen: session.screen.name,
      seed: session.journeySeed,
      generatorVersion: TRACK_GENERATOR_VERSION,
      headChunk: ride?.headCursor().chunkIndex,
      liveChunks: ride?.track.chunkCount ?? 0,
      renderedChunks: this.#scene.stats.renderedChunks,
      vehicles: ride?.vehicleCount ?? 0,
      renderedVehicles: this.#scene.stats.renderedVehicles,
      artVehicles: this.#scene.stats.artVehicles,
      artAtlas: this.#scene.artAtlas,
      consistLengthU: ride
        ? ride.layout.frontOffsetU + ride.layout.tailOffsetU
        : 0,
      intent: session.router.intent(),
      speedUPerSec: ride?.speedUPerSec ?? 0,
      headS: ride?.headS ?? 0,
      tailS: ride?.tailS ?? 0,
      frontS: ride?.frontS ?? 0,
      trackStartS: ride?.track.startS ?? 0,
      trackEndS: ride?.track.endS ?? 0,
      simulationTick: ride?.simulationTick ?? 0,
      pointers: session.router.activePointerCount,
      draftWagons: session.draft.consist.wagons.length,
      notices: [...session.notices],
      medianFps: frames.medianFps,
      p95FrameMs: frames.p95FrameMs,
      worstFrameMs: frames.worstFrameMs,
      frameSamples: frames.samples,
      objects: canvas
        ? this.#scene.objectScreenPositions(canvas.getBoundingClientRect())
        : [],
      trainBox: canvas
        ? this.#scene.trainScreenBox(canvas.getBoundingClientRect())
        : undefined,
      brakeRect: this.#brakeRect,
      audio: this.#audio.state,
    };
  }

  dispose(): void {
    this.#input.dispose();
    this.#host.destroy();
    this.#audio.dispose();
    this.#ui.dispose();
    this.#gameRoot.removeAttribute('data-renderer');
  }
}
