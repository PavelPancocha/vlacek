import { describe, expect, it } from 'vitest';
import {
  ambientSound,
  ChuffDistance,
  coveredFraction,
  crossingBellGain,
  wheelSound,
} from '../../../src/platform/audio/AudioDirector.ts';

describe('recorded audio layer mapping', () => {
  it('wheels are silent at rest and increase rate and gain with speed', () => {
    expect(wheelSound(0).gain).toBe(0);
    expect(wheelSound(200).rate).toBeGreaterThan(wheelSound(50).rate);
    expect(wheelSound(200).gain).toBeGreaterThan(wheelSound(50).gain);
    expect(wheelSound(480).rate).toBeGreaterThan(wheelSound(200).rate);
    expect(wheelSound(480).gain).toBeGreaterThan(wheelSound(200).gain);
  });
  it('selects biome beds, with summer crickets as a single bed', () => {
    expect(ambientSound('forest')).toBe('forest');
    expect(ambientSound('lakes')).toBe('brook');
    expect(ambientSound('coast')).toBe('sea');
    expect(ambientSound('countryside', 'summer')).toBe('crickets');
    expect(ambientSound('forest', 'winter')).toBe('wind');
  });
  it('schedules four chuffs per driving-wheel revolution by travelled distance', () => {
    const chuffs = new ChuffDistance();
    const strokeU = (2 * Math.PI * 15) / 4;
    expect(chuffs.advance(strokeU - 0.01, 15)).toBe(false);
    expect(chuffs.advance(0.02, 15)).toBe(true);
    expect(chuffs.advance(0, 15)).toBe(false);
    expect(chuffs.advance(strokeU * 10, 15)).toBe(true);
    expect(chuffs.advance(0, 15)).toBe(false);
  });
  it('one nearest warning bell fades with distance and stops when opening', () => {
    expect(crossingBellGain([{ phase: 'WARNING', worldX: 0 }], 0, 500)).toBe(1);
    expect(
      crossingBellGain(
        [
          { phase: 'CLOSING', worldX: 250 },
          { phase: 'CLOSED', worldX: 400 },
        ],
        0,
        500,
      ),
    ).toBe(0.5);
    expect(crossingBellGain([{ phase: 'OPENING', worldX: 0 }], 0, 500)).toBe(0);
    expect(crossingBellGain([{ phase: 'CLOSED', worldX: 600 }], 0, 500)).toBe(
      0,
    );
  });
  it('muffles proportionally to actual train span intersecting tunnels', () => {
    expect(coveredFraction(0, 200, [{ fromX: 100, toX: 300 }])).toBe(0.5);
    expect(coveredFraction(120, 200, [{ fromX: 100, toX: 300 }])).toBe(1);
    expect(coveredFraction(0, 90, [{ fromX: 100, toX: 300 }])).toBe(0);
  });
});
