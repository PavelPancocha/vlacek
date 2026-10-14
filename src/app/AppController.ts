import {
  locateTestScene,
  TEST_SCENES,
  type TestSceneLocation,
} from '../domain/world/TestScenes.ts';
import {
  traceChunkPlacement,
  placementQuery,
} from '../domain/world/PlacementTrace.ts';
import type { WorldOverlayOptions } from '../domain/world/WorldDebugGeometry.ts';
import { gameConfig } from '../config/gameConfig.ts';
import type { ShapedVehicle } from '../content/placeholderShapes.ts';
import { locomotives, wagons } from '../content/vehicles.ts';
import type { Consist } from '../domain/types.ts';
import type { RideSimulation } from '../domain/ride/RideSimulation.ts';
import { TRACK_GENERATOR_VERSION } from '../domain/world/TrackProfile.ts';
import { animalSounds } from '../content/soundManifest.ts';
import { biomeAt } from '../domain/world/Biomes.ts';
import { chunkOfEntityId } from '../domain/world/ChunkObjects.ts';
import { chunkScenery } from '../domain/world/Scenery.ts';
import { worldPlacementCatalog } from '../content/worldPlacementCatalog.ts';
import { tunnelSite } from '../domain/world/Structures.ts';
import {
  AudioDirector,
  coveredFraction,
  crossingBellGain,
} from '../platform/audio/AudioDirector.ts';
import { frameLeftX } from '../render/cameraFraming.ts';
import { AudioManager } from '../platform/AudioManager.ts';
import {
  browserStorage,
  isPortrait,
  randomSeed,
} from '../platform/browserEnvironment.ts';
import type { Settings } from '../platform/SaveValidation.ts';
import {
  devReloadUrl,
  type RendererPreference,
} from '../platform/CapabilityProbe.ts';
import {
  clearDevOptions,
  defaultDevOptions,
  writeDevOptions,
} from '../platform/DevOptions.ts';
import { DomInputAdapter } from '../platform/DomInputAdapter.ts';
import { FullscreenController } from '../platform/FullscreenController.ts';
import { FrameStats } from '../platform/FrameStats.ts';
import type { CssRect } from '../platform/InputRouter.ts';
import { createGameHost, type GameHost } from '../render/GameHost.ts';
import { RideScene } from '../render/RideScene.ts';
import { BRAKE_HIT_MARGIN_PX, UiLayer } from '../ui/UiLayer.ts';
import { hudLines } from '../ui/diagnosticsFormat.ts';
import type { DebugSnapshot } from './debugSnapshot.ts';
import { worldHidden } from './AppState.ts';
import { PhaseLog } from './phaseLog.ts';
import { renderProfile } from './renderProfile.ts';
import type { GameSession, SessionEvent } from './GameSession.ts';

export interface AppControllerOptions {
  renderer: RendererPreference;
  debug: boolean;
  qualityOverride?: Settings['quality'] | undefined;
  seedOverride?: number | undefined;
  buildId: string;
}

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
  readonly #curtain: HTMLElement;
  readonly #ui: UiLayer;
  readonly #audio = new AudioManager();
  #audioDirector = new AudioDirector(this.#audio);
  #audioRide: RideSimulation | undefined;
  #audioHeadS = 0;
  readonly #frames = new FrameStats(600);
  /** Every crossing phase of the ride, recorded each frame (debug only). */
  readonly #crossingPhases = new PhaseLog();
  readonly #scene: RideScene;
  readonly #host: GameHost;
  readonly #input: DomInputAdapter;
  readonly #fullscreen: FullscreenController;
  readonly #worldOverlays: WorldOverlayOptions = {
    areas: false,
    boundaries: false,
    roads: false,
  };
  #worldLocation: TestSceneLocation | undefined;
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
    this.#curtain = document.createElement('div');
    this.#curtain.className = 'ride-curtain';
    this.#curtain.setAttribute('aria-hidden', 'true');
    this.#curtain.hidden = true;
    app.append(this.#curtain);
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
      worldOverlays: () => this.#worldOverlays,
      frame: (deltaSec, nowMs) => this.#frame(deltaSec, nowMs),
      ride: () => this.#session.ride,
      worldHidden: () =>
        worldHidden(
          this.#session.screen,
          this.#portrait,
          this.#ui.developerMenuOpen,
        ),
      worldDrawn: () => {
        if (
          !this.#curtain.hidden &&
          !worldHidden(
            this.#session.screen,
            this.#portrait,
            this.#ui.developerMenuOpen,
          )
        )
          this.#curtain.hidden = true;
      },
      journeyVehicles: () => this.#vehiclesOfJourney(),
      journeyNpcFleet: () => this.#session.journeyNpcFleet,
      catalogVehicles: () => [...locomotives, ...wagons],
      // Reduced effects or the low profile halve the particles (doc 07 §9).
      effectsQuality: () =>
        renderProfile(
          this.#session.settings,
          gameConfig.quality,
          options.qualityOverride,
        ).effects,
    });
    const profile = renderProfile(
      session.settings,
      gameConfig.quality,
      options.qualityOverride,
    );
    this.#host = createGameHost({
      parent: gameRoot,
      renderer: options.renderer,
      // The profile of the loaded settings (doc 13); settings that change
      // the profile take effect on the next start.
      maxDpr: profile.maxDpr,
      fpsLimit: profile.fpsLimit,
      scenes: [this.#scene],
      onReady: (renderer) => {
        this.#renderer = renderer;
        gameRoot.dataset['renderer'] = renderer;
      },
    });
    session.setWorldHitTest(
      (x, y) =>
        this.#scene.hitObject(x, y, this.#host.canvas.getBoundingClientRect()),
      (id) => this.#scene.popBubble(id),
    );
    session.setUnhandledActionHandler((action) => {
      if (action.startsWith('dev-world-')) {
        this.#worldDeveloperAction(action);
        return;
      }
      if (action === 'strip-start') {
        // The locomotive is the front of the train, at the strip's right end.
        const strip = this.#uiRoot.querySelector('.strip');
        strip?.scrollTo({ left: strip.scrollWidth });
      }
      if (action === 'dev-build' && session.screen.name === 'PAUSED')
        this.#ui.activateDeveloperGate(performance.now(), {
          debug: options.debug,
          renderer: options.renderer,
          seed: options.seedOverride,
          quality: options.qualityOverride ?? session.settings.quality,
          reducedEffects: session.settings.reducedEffects,
        });
      if (action === 'dev-close') {
        this.#audio.suspend();
        this.#ui.closeDeveloperMenu();
      }
      if (action === 'dev-sound-stop') this.#audio.suspend();
      if (action.startsWith('dev-sound:') && this.#ui.developerMenuOpen) {
        this.#audio.suspend();
        this.#audio.setEnabled(session.settings.sfxEnabled);
        this.#audio.unlock();
        this.#audio.play(action.slice('dev-sound:'.length), 1, 100, Infinity);
      }
      if (this.#ui.developerMenuOpen) {
        if (action === 'dev-details') this.#ui.openDiagnostics(this.snapshot());
        if (action === 'dev-details-close') this.#ui.closeDiagnostics();
        if (action === 'dev-copy-json' || action === 'dev-copy-seed')
          this.#ui.copyDiagnostics(
            session.journeySeed,
            action === 'dev-copy-json',
          );
        if (action === 'dev-restart' || action === 'dev-random-world') {
          const currentSeed = session.journeySeed;
          if (currentSeed === undefined) return;
          const drawnSeed =
            action === 'dev-restart' ? currentSeed : randomSeed();
          // Even a random draw equal to the old seed must produce a new world.
          const seed =
            action === 'dev-random-world' && drawnSeed === currentSeed
              ? (drawnSeed + 1) >>> 0
              : drawnSeed;
          session.endDiagnosticRide();
          this.#worldLocation = undefined;
          const outcome = session.restartJourney(seed);
          if (outcome !== 'saved') {
            if (outcome === 'save-failed')
              this.#ui.developerSaveError('session');
            else this.#ui.developerStartError();
            return;
          }
          this.#audio.stopAll();
          this.#audio.suspend();
          this.#audioDirector = new AudioDirector(this.#audio);
          this.#audioRide = undefined;
          this.#audioHeadS = 0;
          this.#crossingPhases.record([]);
          window.history.replaceState(
            null,
            '',
            devReloadUrl(window.location.href),
          );
          this.#ui.closeDeveloperMenu();
        }
      }
      if (action === 'dev-apply' || action === 'dev-defaults') {
        const values =
          action === 'dev-defaults'
            ? {
                ...defaultDevOptions,
                quality: 'auto' as const,
                reducedEffects: false,
              }
            : this.#ui.developerValues();
        if (!values || !this.#ui.developerMenuOpen) return;
        session.endDiagnosticRide();
        this.#worldLocation = undefined;
        session.setRenderSettings(values);
        if (session.interrupt() !== 'saved') {
          this.#ui.developerSaveError('session');
          return;
        }
        const storage = browserStorage();
        const stored =
          action === 'dev-defaults'
            ? clearDevOptions(storage)
            : writeDevOptions(storage, values);
        if (!stored) {
          this.#ui.developerSaveError('dev');
          return;
        }
        window.history.replaceState(
          null,
          '',
          devReloadUrl(window.location.href),
        );
        window.location.reload();
      }
      if (action === 'fullscreen') void this.#fullscreen.toggle();
      if (action === 'retry') window.location.reload();
    });
    this.#input = new DomInputAdapter({
      root: app,
      router: session.router,
      onGesture: () => {
        // A gesture that leaves the game paused keeps the sound frozen
        // (doc 02 §6); the one that resumes unlocks after routing.
        this.#audio.setEnabled(this.#session.settings.sfxEnabled);
        if (this.#session.screen.name !== 'PAUSED') this.#audio.unlock();
        // Show what the tap changed right away, not a frame later: the
        // screen never offers a button the tap has just disabled.
        this.#refreshUi();
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
    this.#fullscreen = new FullscreenController(document, () => {
      // System exits can leave the viewport unchanged; still clear and pause.
      session.interrupt();
      this.#refreshUi();
    });
    this.#refreshUi();
  }

  #worldDeveloperAction(action: string): void {
    if (!this.#ui.developerMenuOpen) return;
    const seed = this.#session.journeySeed;
    if (seed === undefined) return;
    if (action.startsWith('dev-world-overlay:')) {
      const name = action.slice('dev-world-overlay:'.length);
      if (name === 'areas' || name === 'boundaries' || name === 'roads') {
        this.#worldOverlays[name] = !this.#worldOverlays[name];
        this.#ui.worldOverlayPressed(name, this.#worldOverlays[name]);
      }
    } else if (action.startsWith('dev-world-scene:')) {
      const kind = TEST_SCENES.find(
        (k) => k === action.slice('dev-world-scene:'.length),
      );
      if (!kind) return;
      const location = locateTestScene(seed, kind, worldPlacementCatalog);
      if (!location) {
        this.#ui.worldDeveloperStatus(
          'Scéna v omezeném hledání tohoto světa nenalezena.',
        );
        return;
      }
      // A second selection first releases the previous temporary ride.
      this.#session.endDiagnosticRide();
      if (!this.#session.startDiagnosticRide(location.head)) {
        this.#ui.worldDeveloperStatus('Dočasnou jízdu nelze zahájit.');
        return;
      }
      this.#worldLocation = location;
      this.#ui.closeDeveloperMenu();
    } else if (action === 'dev-world-return') {
      this.#session.endDiagnosticRide();
      this.#worldLocation = undefined;
      this.#ui.closeDeveloperMenu();
    } else if (action === 'dev-world-trace') {
      const input = this.#ui.developerWorldQuery(),
        x = this.#session.ride?.sample(this.#session.ride.headS).x ?? 0;
      const location = placementQuery(input, x);
      if (!location) {
        this.#ui.worldDeveloperStatus(
          'Neplatné ID nebo světová souřadnice.',
          true,
        );
        return;
      }
      this.#ui.worldDeveloperStatus(
        JSON.stringify(
          traceChunkPlacement(
            seed,
            location.chunkIndex,
            worldPlacementCatalog,
            location.query,
          ),
          null,
          2,
        ),
        true,
      );
    }
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
    if (this.#options.debug)
      this.#crossingPhases.record(this.#session.ride?.crossings ?? []);
    this.#updateAudio();
    for (const event of this.#session.drainEvents()) this.#feedback(event);
    this.#refreshUi();
    if (this.#diagnostics && nowMs - this.#lastDiagnosticsMs > 250) {
      this.#lastDiagnosticsMs = nowMs;
      this.#diagnostics.textContent = hudLines(this.snapshot()).join('\n');
    }
    return alpha;
  }

  #updateAudio(): void {
    const session = this.#session;
    this.#audio.setEnabled(session.settings.sfxEnabled);
    const ride = session.ride;
    const seed = session.journeySeed;
    if (!ride || seed === undefined || session.screen.name !== 'RIDING') {
      if (session.screen.name !== 'PAUSED') this.#audio.setLayers([]);
      return;
    }
    const loco = locomotives.find(
      (candidate) => candidate.id === session.journeyConsist?.locomotiveId,
    );
    if (!loco) return;
    const distanceU =
      this.#audioRide === ride ? Math.max(0, ride.headS - this.#audioHeadS) : 0;
    this.#audioRide = ride;
    this.#audioHeadS = ride.headS;
    const frontX = ride.sample(ride.frontS).x;
    const tailX = ride.sample(ride.tailS).x;
    const widthU =
      gameConfig.train.maxConsistLengthU / gameConfig.camera.trainWidthFraction;
    const leftX = frameLeftX(
      frontX,
      ride.layout.frontOffsetU + ride.layout.tailOffsetU,
      { widthPx: 1, heightPx: 1, reservedTopPx: 0, reservedBottomPx: 0 },
      1 / widthU,
      { ...gameConfig.camera, vehicleHeightU: 0 },
    );
    const tunnels: { fromX: number; toX: number }[] = [];
    for (
      let k = ride.track.firstChunkIndex;
      k <= ride.track.lastChunkIndex;
      k++
    ) {
      const tunnel = tunnelSite(seed, k);
      if (tunnel)
        tunnels.push({
          fromX: k * gameConfig.world.chunkWidthU + tunnel.fromX,
          toX: k * gameConfig.world.chunkWidthU + tunnel.toX,
        });
    }
    this.#audioDirector.update({
      power: loco.power,
      speedUPerSec: ride.speedUPerSec,
      distanceU,
      wheelRadiusU: loco.wheelRadiusU,
      throttle: ride.lastIntent === 'THROTTLE',
      biome: biomeAt(seed, ride.headCursor().chunkIndex).biome,
      covered: coveredFraction(tailX, frontX, tunnels),
      bellGain: crossingBellGain(
        ride.crossings,
        leftX + widthU / 2,
        widthU / 2,
      ),
    });
  }

  #feedback(event: SessionEvent): void {
    if (!this.#session.settings.sfxEnabled) return;
    switch (event.type) {
      case 'horn': {
        const loco = locomotives.find(
          (candidate) =>
            candidate.id === this.#session.journeyConsist?.locomotiveId,
        );
        if (loco) this.#audio.play(loco.hornAudio);
        return;
      }
      case 'locomotivePreview': {
        const loco = locomotives.find((candidate) => candidate.id === event.id);
        if (loco) this.#audio.play(loco.hornAudio);
        return;
      }
      case 'npcHorn': {
        // The oncoming train answers with the horn of its own locomotive.
        const train = this.#session.ride?.oncomingTrains.find(
          (candidate) => candidate.id === event.id,
        );
        const loco = locomotives.find(
          (candidate) => candidate.id === train?.vehicles[0]?.id,
        );
        if (loco && train) {
          const frontX =
            this.#session.ride?.sample(this.#session.ride.frontS).x ??
            train.xSpan().minX;
          const gain = 0.35 / (1 + Math.abs(train.xSpan().minX - frontX) / 600);
          this.#audio.play(loco.hornAudio, gain, 80);
        }
        return;
      }
      case 'bubblePopped':
        this.#audio.play('bubble-pop');
        return;
      case 'objectReacted': {
        const chunk = chunkOfEntityId(event.id);
        const seed = this.#session.journeySeed;
        if (chunk !== undefined && seed !== undefined)
          this.#audio.play(
            animalSounds[
              chunkScenery(seed, chunk, worldPlacementCatalog).animal.kind
            ],
            1,
            40,
          );
        return;
      }
      case 'trainFull':
        this.#audio.play('train-full');
        return;
    }
  }

  #refreshUi(): void {
    const session = this.#session;
    if (this.#diagnostics)
      this.#diagnostics.hidden =
        session.screen.name !== 'RIDING' || this.#portrait;
    if (
      worldHidden(session.screen, this.#portrait, this.#ui.developerMenuOpen) &&
      this.#curtain.hidden
    )
      this.#curtain.hidden = false;
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
      fullscreen: {
        supported: this.#fullscreen.supported,
        active: this.#fullscreen.active,
        failed: this.#fullscreen.failed,
      },
      buildId: this.#options.buildId,
      devActive:
        this.#options.debug ||
        this.#options.renderer !== 'auto' ||
        this.#options.seedOverride !== undefined ||
        (this.#options.qualityOverride ?? session.settings.quality) !==
          'auto' ||
        session.settings.reducedEffects,
      locomotives,
      wagons,
      lengthRules: session.lengthRules,
    });
    if (this.#ui.developerMenuOpen)
      for (const name of ['areas', 'boundaries', 'roads'] as const)
        this.#ui.worldOverlayPressed(name, this.#worldOverlays[name]);
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
        // Animals stay clear of the brake's whole touch area (doc 02).
        canvas.bottom - (this.#brakeRect?.top ?? canvas.bottom),
      );
    }
  }

  snapshot(): DebugSnapshot {
    const session = this.#session;
    const ride = session.ride;
    const frames = this.#frames.summary();
    const canvas = this.#host.canvas as HTMLCanvasElement | undefined;
    return {
      worldDebug: {
        temporaryRide: session.diagnosticRide,
        location: session.diagnosticRide ? this.#worldLocation : undefined,
        overlays: { ...this.#worldOverlays },
        overlayPrimitives: this.#scene.worldOverlayCount,
      },
      buildId: this.#options.buildId,
      renderer: this.#renderer,
      renderProfile: {
        quality: this.#options.qualityOverride ?? session.settings.quality,
        ...renderProfile(
          session.settings,
          gameConfig.quality,
          this.#options.qualityOverride,
        ),
      },
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
      vehicleAtlas: this.#scene.vehicleAtlas,
      effects: this.#scene.effectsStats,
      backdropAtlas: this.#scene.backdropAtlas,
      backdrop: this.#scene.stats.backdrop,
      artSourceTextures: this.#scene.artSourceTextures,
      scenery: {
        biome: this.#scene.stats.biome,
        localities: [...this.#scene.stats.localities],
        ...this.#nearPropCheck(),
        crossingViews: this.#scene.stats.crossingViews,
        secondaryTrackViews: this.#scene.stats.secondaryTrackViews,
        secondaryPortalViews: this.#scene.stats.secondaryPortalViews,
      },
      catenary: {
        electrified: ride?.electrified ?? false,
        poles: this.#scene.stats.catenaryPoles,
        pantographGapU: this.#scene.stats.pantographGapU,
        outOfRange: this.#scene.stats.pantographOutOfRange,
      },
      crossings: ride ? this.#crossings(ride) : [],
      backdropMidOffsetU: this.#scene.stats.backdropMidOffsetU,
      tunnels: this.#scene.stats.tunnels.map((tunnel) => ({ ...tunnel })),
      oncoming: {
        trains: (ride?.oncomingTrains ?? []).map((train) => ({
          id: train.id,
          locomotiveId: train.vehicles[0]?.id,
          ...train.xSpan(),
          fromX: train.site.fromX,
          toX: train.site.toX,
          vehicles: train.vehicles.length,
        })),
        drawnInOpen: this.#scene.stats.oncomingVehicles,
      },
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
      rideFramesDrawn: this.#scene.rideFramesDrawn,
      bubbles: canvas
        ? this.#scene.bubbleScreenPositions(canvas.getBoundingClientRect())
        : [],
      objects: canvas
        ? this.#scene.objectScreenPositions(canvas.getBoundingClientRect())
        : [],
      chunkEdges: canvas
        ? this.#scene.chunkEdgesScreenX(canvas.getBoundingClientRect())
        : [],
      trainBox: canvas
        ? this.#scene.trainScreenBox(canvas.getBoundingClientRect())
        : undefined,
      brakeRect: this.#brakeRect,
      audioDetails: this.#audio.diagnostics,
      audio: this.#audio.state,
    };
  }

  #crossings(ride: RideSimulation): DebugSnapshot['crossings'] {
    const train = {
      tailX: ride.sample(ride.tailS).x,
      frontX: ride.sample(ride.frontS).x,
    };
    const canvasRect = this.#host.canvas?.getBoundingClientRect();
    return ride.crossings.map((crossing) => ({
      id: crossing.id,
      worldX: crossing.worldX,
      screenX: canvasRect
        ? this.#scene.worldScreenX(crossing.worldX, canvasRect)
        : 0,
      tailX: train.tailX,
      phase: crossing.phase,
      phases: [...this.#crossingPhases.phases(crossing.id)],
      barrier: crossing.barrier,
      occupied: crossing.trainInConflict(train),
      actors: crossing.actors.length,
      waiting: crossing.waitingCount(),
      crossed: crossing.crossedCount,
    }));
  }

  #nearPropCheck(): {
    nearProps: number;
    nearPropsOverTrain: number;
    nearPropOverlaps: string[];
  } {
    const check = this.#scene.nearPropCheck();
    return {
      nearProps: check.inView,
      nearPropsOverTrain: check.overTrain,
      nearPropOverlaps: check.overlaps,
    };
  }

  dispose(): void {
    this.#input.dispose();
    this.#fullscreen.dispose();
    this.#host.destroy();
    this.#audio.dispose();
    this.#ui.dispose();
    this.#diagnostics?.remove();
    this.#curtain.remove();
    this.#gameRoot.removeAttribute('data-renderer');
  }
}
