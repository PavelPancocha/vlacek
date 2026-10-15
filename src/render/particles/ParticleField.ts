/**
 * How one kind of particle looks and moves (doc 14 §4). Units: u, seconds,
 * degrees; y points down (render coordinates), so −90° is straight up.
 */
export interface ParticleKind {
  /** Atlas frames; animated kinds (wings) cycle through them. */
  frames: readonly string[];
  /** Frame changes per second for animated kinds. */
  frameHz?: number;
  lifeSec: readonly [number, number];
  speedU: readonly [number, number];
  directionDeg: readonly [number, number];
  /** Downward acceleration, u/s². */
  gravityU: number;
  /** Velocity decays by e^(−drag·t). */
  dragPerSec: number;
  /** Constant sideways drift (wind), u/s; negative blows left. */
  windU: number;
  /** Drawn width at birth and at death. */
  sizeU: readonly [number, number];
  /** Peak opacity between the fade in and the fade out. */
  alpha: number;
  spinDegPerSec: readonly [number, number];
  /** Fixed orientation for sprites lit from the upper left. */
  rotationDeg?: number;
  /** Sideways flutter (leaves, butterflies), drawn on top of the motion. */
  wobble?: { ampU: number; hz: number };
  /** Drawn along the direction of motion (sparks) instead of spinning. */
  alignToMotion?: boolean;
}

export interface Particle {
  /** Unique emission identity, stable until death even when the pool is reused. */
  id: number;
  kind: number;
  /** Optional source-track layer; ambient particles use the view default. */
  depth: number | undefined;
  /** World x and render y (down) of the particle, u. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  /** Radians. */
  rotation: number;
  spin: number;
  sizeStart: number;
  sizeEnd: number;
  /** 0 … 1, desynchronises flutter and wing beats. */
  phase: number;
  bounds: EmitOptions['bounds'];
}

export interface EmitOptions {
  /** A local water habitat retained only for the particle's short lifetime. */
  bounds?: { left: number; right: number; top: number; bottom: number };
  /** Keep train particles under the opaque cover of their own track. */
  depth?: number;
  /** Velocity added to every particle (inherited from the emitter), u/s. */
  vxU?: number;
  vyU?: number;
  /** Random offset of the birth point, ± u. */
  jitterU?: number;
  /** Rotates the kind's direction range (emitter tilt), degrees. */
  directionOffsetDeg?: number;
  /** Multiplies the drawn size (stronger puffs). */
  sizeScale?: number;
}

const FADE_IN_SEC = 0.25;
const FADE_OUT_SHARE = 0.35;

function blankParticle(): Particle {
  return {
    id: 0,
    kind: 0,
    depth: undefined,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    life: 0,
    rotation: 0,
    spin: 0,
    sizeStart: 0,
    sizeEnd: 0,
    phase: 0,
    bounds: undefined,
  };
}

const between = (range: readonly [number, number], t: number) =>
  range[0] + (range[1] - range[0]) * t;

/**
 * Decorative particles in world space (doc 14 §4): emitted particles move
 * by their own velocity, never with the emitter. A fixed capacity bounds
 * the count (doc 13 `quality.*.maxDecorativeParticles`), particle records
 * are reused, and time comes in explicitly, so a paused ride (step 0)
 * stands still. Pure: the random source is injected.
 */
export class ParticleField {
  readonly #kinds: readonly ParticleKind[];
  readonly #random: () => number;
  readonly #particles: Particle[] = [];
  readonly #spare: Particle[] = [];
  #capacity: number;
  #nextId = 1;

  constructor(
    kinds: readonly ParticleKind[],
    capacity: number,
    random: () => number,
  ) {
    this.#kinds = kinds;
    this.#capacity = capacity;
    this.#random = random;
  }

  get live(): number {
    return this.#particles.length;
  }

  get capacity(): number {
    return this.#capacity;
  }

  /** New emissions respect a lower capacity; live particles finish. */
  setCapacity(capacity: number): void {
    this.#capacity = capacity;
  }

  /** Emits up to `count` particles at (x, y); returns how many fitted. */
  emit(
    kindIndex: number,
    x: number,
    y: number,
    count: number,
    options: EmitOptions = {},
  ): number {
    const kind = this.#kinds[kindIndex];
    if (!kind) return 0;
    const room = Math.max(0, this.#capacity - this.#particles.length);
    const emitted = Math.max(0, Math.min(Math.floor(count), room));
    const jitter = options.jitterU ?? 0;
    const scale = options.sizeScale ?? 1;
    for (let i = 0; i < emitted; i++) {
      const r = this.#random;
      const direction =
        ((between(kind.directionDeg, r()) + (options.directionOffsetDeg ?? 0)) *
          Math.PI) /
        180;
      const speed = between(kind.speedU, r());
      const particle = this.#spare.pop() ?? blankParticle();
      particle.id = this.#nextId++;
      particle.kind = kindIndex;
      particle.depth = options.depth;
      particle.bounds = options.bounds;
      particle.x = x + (r() * 2 - 1) * jitter;
      particle.y = y + (r() * 2 - 1) * jitter;
      particle.vx = Math.cos(direction) * speed + (options.vxU ?? 0);
      particle.vy = Math.sin(direction) * speed + (options.vyU ?? 0);
      particle.age = 0;
      particle.life = between(kind.lifeSec, r());
      const rotation = r() * Math.PI * 2;
      particle.rotation =
        kind.rotationDeg === undefined
          ? rotation
          : (kind.rotationDeg * Math.PI) / 180;
      particle.spin = (between(kind.spinDegPerSec, r()) * Math.PI) / 180;
      particle.sizeStart = kind.sizeU[0] * scale;
      particle.sizeEnd = kind.sizeU[1] * scale;
      particle.phase = r();
      this.#particles.push(particle);
    }
    return emitted;
  }

  /** Advances every particle by `dtSec` of simulation time. */
  step(dtSec: number): void {
    if (dtSec <= 0) return;
    const particles = this.#particles;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.age += dtSec;
      if (p.age >= p.life) {
        this.#removeAt(i);
        continue;
      }
      const kind = this.#kinds[p.kind];
      if (!kind) continue;
      p.x += (p.vx + kind.windU) * dtSec;
      p.y += p.vy * dtSec + 0.5 * kind.gravityU * dtSec * dtSec;
      p.vy += kind.gravityU * dtSec;
      if (kind.dragPerSec > 0) {
        const keep = Math.exp(-kind.dragPerSec * dtSec);
        p.vx *= keep;
        p.vy *= keep;
      }
      if (p.bounds) {
        if (p.x < p.bounds.left || p.x > p.bounds.right) p.vx = -p.vx;
        if (p.y < p.bounds.top || p.y > p.bounds.bottom) p.vy = -p.vy;
        p.x = Math.max(p.bounds.left, Math.min(p.bounds.right, p.x));
        p.y = Math.max(p.bounds.top, Math.min(p.bounds.bottom, p.y));
      }
      p.rotation += p.spin * dtSec;
    }
  }

  /** Removes one emission by stable identity; stale ids never remove a reused record. */
  remove(id: number): boolean {
    const index = this.#particles.findIndex((p) => p.id === id);
    if (index < 0) return false;
    this.#removeAt(index);
    return true;
  }

  #removeAt(index: number): void {
    const p = this.#particles[index];
    if (!p) return;
    const last = this.#particles.pop();
    if (last && last !== p) this.#particles[index] = last;
    this.#spare.push(p);
  }

  particles(): readonly Particle[] {
    return this.#particles;
  }

  kindOf(particle: Particle): ParticleKind | undefined {
    return this.#kinds[particle.kind];
  }

  /** Opacity now: fades in briefly, holds, fades out over the last third. */
  alphaOf(particle: Particle): number {
    const kind = this.#kinds[particle.kind];
    if (!kind) return 0;
    const fadeIn = Math.min(FADE_IN_SEC, particle.life * 0.2);
    const fadeOut = particle.life * FADE_OUT_SHARE;
    const rise = fadeIn > 0 ? particle.age / fadeIn : 1;
    const fall = (particle.life - particle.age) / fadeOut;
    return kind.alpha * Math.max(0, Math.min(1, rise, fall));
  }

  /** Drawn width now, u. */
  sizeOf(particle: Particle): number {
    const t = Math.min(1, particle.age / particle.life);
    return particle.sizeStart + (particle.sizeEnd - particle.sizeStart) * t;
  }

  /** Drawn position now, with the kind's flutter. */
  positionOf(particle: Particle): { x: number; y: number } {
    const wobble = this.#kinds[particle.kind]?.wobble;
    if (!wobble) return { x: particle.x, y: particle.y };
    const angle = 2 * Math.PI * (wobble.hz * particle.age + particle.phase);
    return {
      x: particle.bounds
        ? Math.max(
            particle.bounds.left,
            Math.min(
              particle.bounds.right,
              particle.x + Math.sin(angle) * wobble.ampU,
            ),
          )
        : particle.x + Math.sin(angle) * wobble.ampU,
      y: particle.bounds
        ? Math.max(
            particle.bounds.top,
            Math.min(
              particle.bounds.bottom,
              particle.y + Math.sin(angle * 2) * wobble.ampU * 0.3,
            ),
          )
        : particle.y + Math.sin(angle * 2) * wobble.ampU * 0.3,
    };
  }

  /** Atlas frame now (wing beats cycle the frames). */
  frameOf(particle: Particle): string | undefined {
    const kind = this.#kinds[particle.kind];
    if (!kind) return undefined;
    const frames = kind.frames;
    const index =
      kind.frameHz === undefined
        ? Math.floor(particle.phase * frames.length)
        : Math.floor(
            kind.frameHz * particle.age + particle.phase * frames.length,
          );
    return frames[index % frames.length];
  }

  clear(): void {
    this.#spare.push(...this.#particles);
    this.#particles.length = 0;
  }
}
