import { particleRadiusU } from './particleRadius.ts';
import { effectiveClimateAt, windAt } from '../../domain/world/Seasons.ts';
import { hash32 } from '../../domain/world/Hash.ts';
import { EmissionClock } from './emission.ts';
import { kindIndex, kindName } from './particleKinds.ts';
import type { ParticleField } from './ParticleField.ts';

export interface SeasonalSource {
  id: string;
  kind: 'deciduous' | 'blossom' | 'freshwater' | 'chimney';
  x: number;
  y: number;
  depth: number;
  radiusU: number;
}
export interface SeasonalEffectsInput {
  seed: number;
  dtSec: number;
  timeSec: number;
  view: { left: number; top: number; width: number; height: number };
  sources: readonly SeasonalSource[];
  frontXU: number;
  speedUPerSec: number;
  rateScale: number;
  weatherBottomAt?: (x: number, depth: number) => number;
  canEmit(point: { x: number; y: number }): boolean;
}
/** Visible sources only; no timers or permanent per-chunk emitters. */
const SNOW_LAYERS = ['snow-far', 'snow-mid', 'snow-near'];
const SNOW_DEPTHS = [3.5, 4.15, 7.55];
const SNOW_RATES = [3, 4, 5];
const SNOW_SHARES = [0.18, 0.2, 0.27];
export class SeasonalEffects {
  readonly #sources = new Map<
    string,
    { clock: EmissionClock; nextEventSec: number }
  >();
  readonly #counts = [0, 0, 0];
  readonly #active = new Set<string>();
  readonly #rain = Array.from({ length: 4 }, () => new EmissionClock());
  readonly #snow = Array.from({ length: 12 }, () => new EmissionClock());
  constructor(
    readonly field: ParticleField,
    readonly random: () => number,
  ) {}
  step(input: SeasonalEffectsInput): void {
    if (input.dtSec <= 0) return;
    const dt = Math.min(input.dtSec, 0.1);
    const wind = windAt(input.seed, input.timeSec);
    const counts = this.#counts;
    counts.fill(0);
    const particles = this.field.particles();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      const name = kindName(p.kind);
      const layer = SNOW_LAYERS.indexOf(name ?? '');
      if (layer < 0 && name !== 'rain') continue;
      const climate = effectiveClimateAt(input.seed, p.x);
      const weight = name === 'rain' ? climate.rainfall : climate.snowfall;
      const radius = particleRadiusU(this.field, p);
      const bottom = input.weatherBottomAt?.(p.x, p.depth ?? 7.55) ?? Infinity;
      if (
        weight <= 0 ||
        p.y + radius > bottom ||
        p.x < input.view.left - 100 ||
        p.x > input.view.left + input.view.width + 100
      )
        this.field.remove(p.id);
      else if (layer >= 0) counts[layer] = (counts[layer] ?? 0) + 1;
    }

    const cap = input.rateScale < 1 ? 12 : 32;
    const active = this.#active;
    active.clear();
    for (const source of input.sources) {
      if (active.size >= cap) break;
      if (
        source.x < input.view.left - 60 ||
        source.x > input.view.left + input.view.width + 60 ||
        !input.canEmit(source)
      )
        continue;
      active.add(source.id);
      let state = this.#sources.get(source.id);
      if (!state) {
        state = {
          clock: new EmissionClock(),
          nextEventSec: input.timeSec + 4 + (hash32('life', source.id) % 17),
        };
        this.#sources.set(source.id, state);
      }
      const climate = effectiveClimateAt(input.seed, source.x);
      const leaf = source.kind === 'deciduous' || source.kind === 'blossom';
      if (leaf) {
        const weight =
          climate.autumn +
          (source.kind === 'blossom' ? climate.spring * 0.5 : 0);
        const n = state.clock.tick(0.8 * weight * input.rateScale, dt, 2);
        const x = source.x + (this.random() * 2 - 1) * source.radiusU;
        if (input.canEmit({ x, y: source.y }))
          this.field.emit(
            kindIndex(climate.autumn > climate.spring ? 'leaf-fall' : 'petal'),
            x,
            source.y,
            n,
            { depth: source.depth, vxU: wind },
          );
      }
      if (input.timeSec < state.nextEventSec) continue;
      if (
        leaf &&
        input.speedUPerSec > 40 &&
        Math.abs(input.frontXU - source.x) < 220
      ) {
        this.field.emit(kindIndex('songbird'), source.x, source.y - 8, 1, {
          depth: source.depth,
          vxU: wind * 0.2,
        });
        state.nextEventSec =
          input.timeSec + 20 + (hash32('bird', source.id) % 13);
      } else if (source.kind === 'freshwater' && climate.summer > 0.5) {
        this.field.emit(kindIndex('dragonfly'), source.x, source.y - 12, 1, {
          depth: source.depth,
          bounds: {
            left: source.x - source.radiusU,
            right: source.x + source.radiusU,
            top: source.y - 32,
            bottom: source.y - 4,
          },
        });
        state.nextEventSec =
          input.timeSec + 14 + (hash32('dragonfly', source.id) % 17);
      } else if (source.kind === 'chimney' && climate.summer < 0.5) {
        this.field.emit(kindIndex('smoke'), source.x, source.y, 1, {
          depth: source.depth,
          sizeScale: 0.35,
          vxU: wind,
        });
        state.nextEventSec = input.timeSec + 2.5 + this.random() * 2;
      }
    }
    for (const id of this.#sources.keys())
      if (!active.has(id)) this.#sources.delete(id);
    // Four spatial cells avoid applying one region's weather to the whole viewport.
    const layers = SNOW_LAYERS;
    const depths = SNOW_DEPTHS;
    for (let cell = 0; cell < 4; cell++) {
      const x = input.view.left + (input.view.width * (cell + 0.5)) / 4;
      const climate = effectiveClimateAt(input.seed, x);
      const drops =
        this.#rain[cell]?.tick(
          (climate.rainfall * input.rateScale * 10 * input.view.width) / 1400,
          dt,
          2,
        ) ?? 0;
      for (let i = 0; i < drops; i++) {
        const sx = x + ((this.random() - 0.5) * input.view.width) / 4;
        const bottom = Math.min(
          input.view.top + input.view.height,
          input.weatherBottomAt?.(sx, 7.55) ?? Infinity,
        );
        const y =
          input.view.top +
          this.random() * Math.max(0, bottom - input.view.top - 16);
        if (
          this.field.live < this.field.capacity * 0.65 &&
          input.canEmit({ x: sx, y })
        )
          this.field.emit(kindIndex('rain'), sx, y, 1, {
            depth: 7.55,
            vxU: wind,
          });
      }
      // Near flakes get first use of freed slots; chimney/spray do not count
      // against the weather allowance. Each layer still has its own hard cap.
      for (let layer = 2; layer >= 0; layer--) {
        const n =
          this.#snow[cell * 3 + layer]?.tick(
            (climate.snowfall *
              input.rateScale *
              (SNOW_RATES[layer] ?? 0) *
              input.view.width) /
              1400,
            dt,
            2,
          ) ?? 0;
        for (let i = 0; i < n; i++) {
          const sx = x + ((this.random() - 0.5) * input.view.width) / 4;
          const bottom = Math.min(
            input.view.top + input.view.height,
            input.weatherBottomAt?.(sx, depths[layer] ?? 7.55) ?? Infinity,
          );
          const y =
            input.view.top +
            this.random() * Math.max(0, bottom - input.view.top - 16);
          if (
            this.field.live < this.field.capacity &&
            (counts[layer] ?? 0) <
              this.field.capacity * (SNOW_SHARES[layer] ?? 0) &&
            input.canEmit({ x: sx, y })
          ) {
            counts[layer] = (counts[layer] ?? 0) + 1;
            this.field.emit(kindIndex(layers[layer] ?? ''), sx, y, 1, {
              depth: depths[layer] ?? 7.55,
              vxU: wind,
            });
          }
        }
      }
    }
  }
  get sourceCount(): number {
    return this.#sources.size;
  }
  clear(): void {
    this.#sources.clear();
  }
}

/** Effective winter or the snowy edge of a climate transition can frost the wire. */
export function frostyWireAt(seed: number, worldXU: number): boolean {
  const climate = effectiveClimateAt(seed, worldXU);
  return climate.season === 'winter' || climate.snowfall > 0;
}
