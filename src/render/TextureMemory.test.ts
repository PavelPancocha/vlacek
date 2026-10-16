import { expect, it } from 'vitest';
import { TextureMemory } from './TextureMemory.ts';
it('retains the actual allocation high water even when overlap is released before the next frame', () => {
  const memory = new TextureMemory();
  memory.set('sources', { sources: 12 });
  memory.set('old', { canvas: 16, imageData: 16, gpu: 16 });
  memory.set('new', { canvas: 20, imageData: 20, gpu: 20 });
  memory.remove('old');
  expect(memory.snapshot.highWaterBytes).toBe(120);
  expect(memory.snapshot.bytes).toBe(72);
});

it('models resize and subsequent preparation by lifetime instead of adding unrelated maxima', async () => {
  const { atlasLifetimePeak } = await import('./TextureMemory.ts');
  const plan = {
    sourcesBytes: 7,
    auxiliaryBytes: 3,
    gpu: true,
    vehicle: { oldBytes: 20, newBytes: 30, releaseOldFirst: false },
    ground: { oldBytes: 40, newBytes: 50, largestNewBytes: 12 },
    world: { oldBytes: 60, newBytes: 70, decodeBytes: 0 },
    backdrop: { oldBytes: 80, newBytes: 90, decodeBytes: 0 },
  };
  // Use pixel-sized values so the real 256 KiB upload tile is represented.
  const result = atlasLifetimePeak(plan);
  expect(result.phases.vehicle).toBe(270 + 12);
  expect(result.phases.ground).toBe(252);
  expect(result.phases.world).toBe(290 + 262144 + 12);
  expect(result.phases.backdrop).toBe(330 + 262144 + 12);
  expect(result.phases.cold).toBe(200 + 2 * 262144);
  expect(result.peakBytes).toBe(200 + 2 * 262144);
  expect(
    atlasLifetimePeak({
      ...plan,
      vehicle: { ...plan.vehicle, releaseOldFirst: true },
    }).phases.vehicle,
  ).toBe(250 + 12);
});

it('counts concurrent cold world/backdrop decoders before any chunks exist', async () => {
  const { atlasLifetimePeak } = await import('./TextureMemory.ts');
  const plan = {
    sourcesBytes: 0,
    auxiliaryBytes: 4,
    gpu: false,
    vehicle: {
      oldBytes: 0,
      newBytes: 10,
      releaseOldFirst: false,
      decodeBytes: 0,
    },
    ground: { oldBytes: 0, newBytes: 0, largestNewBytes: 0 },
    world: { oldBytes: 0, newBytes: 20, decodeBytes: 100 },
    backdrop: { oldBytes: 0, newBytes: 30, decodeBytes: 200 },
  };
  expect(atlasLifetimePeak(plan).peakBytes).toBe(664);
});
