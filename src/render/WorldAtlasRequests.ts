/** The part of an atlas owner the D-030 window drives (ArtAtlas). */
export interface PreparedAtlas {
  prepare(keys: readonly string[], pxPerU: number): Promise<void>;
  cancelPreparation(): void;
  readonly ready: boolean;
  /** A build, possibly a cancelled one, still owns decoder or page allocations. */
  readonly settling: boolean;
  readonly textureKey: string | undefined;
}

/** A vehicle raster of the journey (generation and scale). */
export interface VehicleRequest {
  id: string;
  prepare(): Promise<void>;
}

/** Allocation state of the vehicle atlas owner (ArtAtlas). */
export interface AtlasState {
  readonly ready: boolean;
  readonly settling: boolean;
}

export interface WindowRequest {
  /** Identity of the window: raster scales and keys. */
  id: string;
  world: { keys: readonly string[]; pxPerU: number };
  backdrop: { keys: readonly string[]; pxPerU: number };
}

/**
 * World and backdrop preparation of the D-030 window (D-030 § lifetimes).
 * The newest request waits while the other owner still settles cancelled
 * work, so the two never allocate at the same time; the displayed pages stay
 * meanwhile. Only the first load runs both under the curtain (`cold` phase).
 */
export class WorldAtlasRequests {
  readonly #world: PreparedAtlas | undefined;
  readonly #backdrop: PreparedAtlas | undefined;
  readonly #report: (error: unknown) => void;
  readonly #vehicles: AtlasState | undefined;
  #wantedVehicles: VehicleRequest | undefined;
  #vehicleToken = 0;
  #vehiclesStarted = false;
  #id: string | undefined;
  #queuedWorld: WindowRequest | undefined;
  #queuedBackdrop: WindowRequest | undefined;
  #worldPrepared = false;
  #backdropPrepared = false;
  #pending = false;
  #failure: string | undefined;

  constructor(
    world: PreparedAtlas | undefined,
    backdrop: PreparedAtlas | undefined,
    report: (error: unknown) => void = console.error,
    vehicles?: AtlasState,
  ) {
    this.#world = world;
    this.#backdrop = backdrop;
    this.#report = report;
    this.#vehicles = vehicles;
  }

  get pending(): boolean {
    return this.#pending;
  }
  get failure(): string | undefined {
    return this.#failure;
  }
  /** World or backdrop work is requested, unpublished or still settling. */
  get busy(): boolean {
    return (
      this.#pending ||
      !!this.#world?.ready ||
      !!this.#backdrop?.ready ||
      !!this.#world?.settling ||
      !!this.#backdrop?.settling
    );
  }

  /** Forget the request after the owners were invalidated (context restore). */
  reset(): void {
    this.#id = undefined;
    this.#queuedWorld = undefined;
    this.#queuedBackdrop = undefined;
    this.#wantedVehicles = undefined;
    this.#vehiclesStarted = false;
    this.#vehicleToken++;
  }

  /** World or backdrop pages or decoders are allocated beyond the displayed set. */
  get #allocating(): boolean {
    return (
      !!this.#world?.ready ||
      !!this.#backdrop?.ready ||
      !!this.#world?.settling ||
      !!this.#backdrop?.settling
    );
  }

  /** The child's train goes first: no new world/backdrop work meanwhile. */
  get #heldForVehicles(): boolean {
    return (
      !!this.#wantedVehicles ||
      this.#vehiclesStarted ||
      !!this.#vehicles?.settling ||
      !!this.#vehicles?.ready
    );
  }

  /**
   * The journey's vehicle raster changed (journey, depot exit, scale). It
   * starts as soon as no world or backdrop work allocates, and new world or
   * backdrop work waits until it is published (vehicles, world, backdrop).
   */
  requestVehicles(request: VehicleRequest): void {
    this.#wantedVehicles = request;
    this.#startVehicles();
  }

  #startVehicles(): void {
    const wanted = this.#wantedVehicles;
    if (!wanted || this.#allocating) return;
    this.#wantedVehicles = undefined;
    const token = ++this.#vehicleToken;
    this.#vehiclesStarted = true;
    const done = () => {
      if (this.#vehicleToken === token) this.#vehiclesStarted = false;
    };
    void wanted.prepare().then(done, (error: unknown) => {
      done();
      this.#report(error);
    });
  }

  /**
   * Called once per frame with the window's current request. `activate`
   * publishes a ready owner at this frame boundary.
   */
  update(request: WindowRequest, activate: (backdrop: boolean) => void): void {
    if (request.id !== this.#id) {
      this.#id = request.id;
      this.#worldPrepared = !this.#world;
      this.#backdropPrepared = !this.#backdrop;
      this.#pending = !this.#worldPrepared || !this.#backdropPrepared;
      this.#failure = undefined;
      this.#backdrop?.cancelPreparation();
      this.#queuedWorld = request;
      this.#queuedBackdrop = request;
    }
    // A cancelled backdrop may still be decoding natively; its allocations
    // must be gone before the world allocates (the reverse holds because the
    // backdrop starts only after the world, see below).
    const held = this.#heldForVehicles;
    const queuedWorld = this.#queuedWorld;
    if (queuedWorld && !held && !this.#backdrop?.settling) {
      this.#queuedWorld = undefined;
      this.#start(this.#world, queuedWorld, false);
    }
    if (this.#world?.ready) activate(false);
    const queuedBackdrop = this.#queuedBackdrop;
    if (
      queuedBackdrop &&
      !held &&
      !this.#queuedWorld &&
      // After the world has been published, or concurrently on the first
      // load when nothing is displayed yet.
      (this.#worldPrepared || !this.#world?.textureKey) &&
      !this.#world?.ready
    ) {
      this.#queuedBackdrop = undefined;
      this.#start(this.#backdrop, queuedBackdrop, true);
    }
    if (this.#backdrop?.ready) activate(true);
    this.#startVehicles();
  }

  #start(
    atlas: PreparedAtlas | undefined,
    request: WindowRequest,
    backdrop: boolean,
  ): void {
    if (!atlas) return;
    const { keys, pxPerU } = backdrop ? request.backdrop : request.world;
    const done = (failure?: string) => {
      if (this.#id !== request.id) return;
      if (failure !== undefined) this.#failure = failure;
      if (backdrop) this.#backdropPrepared = true;
      else this.#worldPrepared = true;
      this.#pending = !this.#worldPrepared || !this.#backdropPrepared;
    };
    void atlas.prepare(keys, pxPerU).then(
      () => done(),
      (error: unknown) => {
        done(String(error));
        this.#report(error);
      },
    );
  }
}
