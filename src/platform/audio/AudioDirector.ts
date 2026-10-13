import { gameConfig } from '../../config/gameConfig.ts';
import type { AudioLayer, AudioManager } from '../AudioManager.ts';
import type { Biome } from '../../domain/world/Biomes.ts';
import type { CrossingPhase } from '../../domain/interaction/LevelCrossing.ts';

export interface CrossingAudioState {
  phase: CrossingPhase;
  worldX: number;
}
export function wheelSound(speedUPerSec: number) {
  const speed = Math.max(
    0,
    Math.min(1, speedUPerSec / gameConfig.train.maxSpeedUPerSec),
  );
  return {
    rate: 0.65 + speed * 1.05,
    gain: speed === 0 ? 0 : 0.15 + 0.55 * speed,
  };
}
/** World-core can provide season here; until then the current biome owns the bed. */
export function ambientSound(biome: Biome, season?: string): string {
  if (season === 'winter' || biome === 'mountains') return 'wind';
  if (season === 'summer' && biome === 'countryside') return 'crickets';
  switch (biome) {
    case 'forest':
      return 'forest';
    case 'lakes':
      return 'brook';
    case 'coast':
      return 'sea';
    default:
      return 'meadow';
  }
}
export function crossingBellGain(
  crossings: readonly CrossingAudioState[],
  viewCentreXU: number,
  halfWidthU: number,
): number {
  return crossings.reduce((gain, crossing) => {
    if (!['WARNING', 'CLOSING', 'CLOSED'].includes(crossing.phase)) return gain;
    return Math.max(
      gain,
      Math.max(0, 1 - Math.abs(crossing.worldX - viewCentreXU) / halfWidthU),
    );
  }, 0);
}
/** Main-track tunnel intervals and train span use the same world-x units. */
export function coveredFraction(
  tailXU: number,
  frontXU: number,
  tunnels: readonly { fromX: number; toX: number }[],
): number {
  const lengthU = frontXU - tailXU;
  if (lengthU <= 0) return 0;
  const overlapU = tunnels.reduce(
    (sum, tunnel) =>
      sum +
      Math.max(
        0,
        Math.min(frontXU, tunnel.toX) - Math.max(tailXU, tunnel.fromX),
      ),
    0,
  );
  return Math.min(1, overlapU / lengthU);
}
export class ChuffDistance {
  #remainderU = 0;
  advance(distanceU: number, wheelRadiusU: number): boolean {
    const intervalU = (2 * Math.PI * wheelRadiusU) / 4;
    this.#remainderU += Math.max(0, distanceU);
    if (this.#remainderU < intervalU) return false;
    this.#remainderU %= intervalU;
    return true;
  }
}
export interface AudioFrame {
  power: 'steam' | 'diesel' | 'electric' | 'fantasy';
  speedUPerSec: number;
  distanceU: number;
  wheelRadiusU: number;
  throttle: boolean;
  biome: Biome;
  covered: number;
  bellGain: number;
}
export class AudioDirector {
  readonly #chuffs = new ChuffDistance();
  constructor(readonly audio: AudioManager) {}
  update(frame: AudioFrame): void {
    this.audio.setCovered(frame.covered);
    const wheel = wheelSound(frame.speedUPerSec);
    const layers: AudioLayer[] = [
      { key: 'wheels', id: 'wheels', ...wheel, priority: 60 },
      {
        key: 'ambient',
        id: ambientSound(frame.biome),
        gain: 0.6,
        rate: 1,
        priority: 10,
      },
      {
        key: 'bell',
        id: 'crossing-bell',
        gain: frame.bellGain,
        rate: 1,
        priority: 90,
      },
    ];
    if (frame.power === 'steam' && frame.speedUPerSec > 0)
      layers.push({
        key: 'engine',
        id: 'steam-chuff',
        gain: frame.throttle ? 0.9 : 0.35,
        rate: 1,
        priority: 70,
        pulsed: true,
      });
    if (frame.power === 'diesel')
      layers.push({
        key: 'engine',
        id: frame.speedUPerSec > 20 ? 'diesel-running' : 'diesel-idle',
        gain: 0.5 + wheel.gain * 0.3,
        rate: 0.9 + wheel.gain * 0.25,
        priority: 70,
      });
    if (frame.power === 'electric')
      layers.push({
        key: 'engine',
        id: 'electric-hum',
        gain: 0.35 + wheel.gain * 0.5,
        rate: 0.85 + wheel.gain * 0.5,
        priority: 70,
      });
    // Three-loop ceiling: nearby functional warning displaces the ambient bed.
    this.audio.setLayers(
      layers
        .filter((layer) => layer.gain > 0)
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 3),
    );
    if (
      frame.power === 'steam' &&
      this.#chuffs.advance(frame.distanceU, frame.wheelRadiusU)
    )
      this.audio.chuff(
        Math.min(
          0.58,
          (2 * Math.PI * frame.wheelRadiusU) /
            4 /
            Math.max(1, frame.speedUPerSec),
        ),
      );
  }
}
