import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../../src/config/gameConfig.ts';
import { trainZoom } from '../../../../src/render/cameraFraming.ts';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import {
  PARTICLE_KINDS,
  kindIndex,
} from '../../../../src/render/particles/particleKinds.ts';
import {
  bubbleAt,
  bubbleRadiusU,
  popBubble,
  visibleBubbles,
} from '../../../../src/render/particles/bubbleInteraction.ts';

function setup(capacity = 96) {
  const field = new ParticleField(PARTICLE_KINDS, capacity, () => 0.5);
  field.emit(kindIndex('bubble'), 100, 50, 1);
  field.step(0.5);
  const bubble = field.particles()[0];
  if (!bubble) throw new Error('bubble did not spawn');
  return { field, bubble, id: bubble.id };
}

describe('bubble touch (doc 06 §2, INP-05)', () => {
  it.each([false, true])(
    'camera-3: overlapping 64px targets pick the nearest centre in either insertion order (reverse=%s)',
    (reverse) => {
      const unitsPerCss =
        1 /
        trainZoom(
          {
            widthPx: 568,
            heightPx: 320,
            reservedTopPx: 0,
            reservedBottomPx: 0,
          },
          2000,
          { ...gameConfig.camera, vehicleHeightU: 0 },
        );
      const field = new ParticleField(PARTICLE_KINDS, 2, () => 0.5);
      for (const x of reverse ? [120, 100] : [100, 120])
        field.emit(kindIndex('bubble'), x * unitsPerCss, 50, 1);
      field.step(0.5);
      const bubbles = visibleBubbles(field);
      expect(bubbles).toHaveLength(2);
      for (const bubble of bubbles) {
        const at = field.positionOf(bubble);
        expect(bubbleRadiusU(field, bubble, unitsPerCss) / unitsPerCss).toBe(6);
        expect(bubbleAt(field, at.x, at.y, undefined, 32 * unitsPerCss)).toBe(
          bubble.id,
        );
      }
    },
  );

  it('camera-3: drawing order breaks exact distance ties', () => {
    const field = new ParticleField(PARTICLE_KINDS, 2, () => 0.5);
    field.emit(kindIndex('bubble'), 100, 50, 1);
    field.emit(kindIndex('bubble'), 100, 50, 1);
    field.step(0.5);
    const last = visibleBubbles(field).at(-1);
    if (!last) throw new Error('bubble missing');
    const at = field.positionOf(last);
    expect(bubbleAt(field, at.x, at.y, undefined, 32)).toBe(last.id);
  });

  it('camera-1: bubbles retain a 64 CSS px hit diameter at every target viewport', () => {
    const { field, bubble, id } = setup();
    const at = field.positionOf(bubble);
    for (const width of [1280, 1140, 844, 568]) {
      const unitsPerCss = 2000 / (0.6 * width);
      expect(
        bubbleAt(
          field,
          at.x + 31 * unitsPerCss,
          at.y,
          undefined,
          32 * unitsPerCss,
        ),
      ).toBe(id);
      expect(
        bubbleAt(
          field,
          at.x + 33 * unitsPerCss,
          at.y,
          undefined,
          32 * unitsPerCss,
        ),
      ).toBeUndefined();
    }
  });

  it('camera-1: even the smallest viewport draws a bubble circle at least 12 CSS px across', () => {
    const { field, bubble } = setup();
    for (const width of [1280, 1140, 844, 568]) {
      const unitsPerCss = 2000 / (0.6 * width);
      expect(
        bubbleRadiusU(field, bubble, unitsPerCss) / unitsPerCss,
      ).toBeCloseTo(6, 9);
    }
  });

  it('spawns, rises and drifts, then expires without a pop', () => {
    const { field, bubble, id } = setup();
    const at = field.positionOf(bubble);
    expect(at.x).toBeLessThan(100);
    expect(at.y).toBeLessThan(50);
    expect(bubbleAt(field, at.x, at.y)).toBe(id);
    field.step(5);
    expect(field.live).toBe(0);
    expect(popBubble(field, id, 1)).toBe(false);
  });

  it('hits exactly one visible bubble at its drawn position; a miss and an invisible birth hit nothing', () => {
    const { field, bubble, id } = setup();
    field.emit(kindIndex('bubble'), 200, 50, 1);
    const second = field.particles()[1];
    if (!second) throw new Error('second bubble did not spawn');
    expect(bubbleAt(field, second.x, second.y)).toBeUndefined();
    field.step(0.5);
    const at = field.positionOf(bubble);
    expect(bubbleAt(field, at.x, at.y)).toBe(id);
    expect(bubbleAt(field, at.x + field.sizeOf(bubble), at.y)).toBeUndefined();
    expect(bubbleAt(field, 999, 999)).toBeUndefined();
    expect(visibleBubbles(field).map((p) => p.id)).toEqual([id, second.id]);
    expect(field.live).toBe(2);
  });

  it('removes only the addressed bubble, emits one pop at its current position and rejects a duplicate or a non-bubble', () => {
    const { field, bubble, id } = setup();
    field.emit(kindIndex('bubble'), 200, 50, 1);
    const secondId = field.particles()[1]?.id;
    const at = field.positionOf(bubble);
    expect(popBubble(field, id, 1)).toBe(true);
    expect(visibleBubbles(field).map((p) => p.id)).not.toContain(id);
    const remaining = field.particles().find((p) => p.id === secondId);
    expect(remaining?.kind).toBe(kindIndex('bubble'));
    const pops = field
      .particles()
      .filter((p) => p.kind === kindIndex('bubble-pop'));
    expect(pops).toHaveLength(1);
    expect(pops[0]?.x).toBe(at.x);
    expect(pops[0]?.y).toBe(at.y);
    expect(popBubble(field, id, 1)).toBe(false);
    expect(popBubble(field, pops[0]?.id ?? -1, 1)).toBe(false);
    expect(field.live).toBe(2);
  });

  it('keeps one small pop within a full decorative cap, smaller with reduced effects, and cleans it up', () => {
    const standard = setup(1);
    const low = setup(1);
    expect(popBubble(standard.field, standard.id, 1)).toBe(true);
    expect(popBubble(low.field, low.id, 0.5)).toBe(true);
    expect(standard.field.live).toBe(1);
    expect(low.field.live).toBe(1);
    const fullPop = standard.field.particles()[0];
    const lowPop = low.field.particles()[0];
    if (!fullPop || !lowPop) throw new Error('missing pop');
    expect(low.field.sizeOf(lowPop)).toBeLessThan(
      standard.field.sizeOf(fullPop),
    );
    standard.field.step(1);
    low.field.step(1);
    expect(standard.field.live).toBe(0);
    expect(low.field.live).toBe(0);
  });
});

it('tunnel-1: a bubble pop keeps its source layer under rock', () => {
  const { field, bubble, id } = setup();
  bubble.depth = 7.55;
  expect(popBubble(field, id, 1)).toBe(true);
  expect(field.particles()[0]?.depth).toBe(7.55);
});

it('tunnel-3: already-emitted bubbles behind rock have no hit, visible entry or pop', () => {
  const { field, bubble, id } = setup();
  const canSee = (point: { x: number; y: number }) => point.x < 50;
  const hidden = field.positionOf(bubble);
  expect(visibleBubbles(field, canSee)).toEqual([]);
  expect(bubbleAt(field, hidden.x, hidden.y, canSee)).toBeUndefined();
  expect(popBubble(field, id, 1, canSee)).toBe(false);
  expect(
    field.particles().filter((p) => p.kind === kindIndex('bubble-pop')),
  ).toHaveLength(0);
  expect(field.live).toBe(1);
  bubble.x = 10;
  const exposed = field.positionOf(bubble);
  expect(visibleBubbles(field, canSee).map((p) => p.id)).toEqual([id]);
  expect(bubbleAt(field, exposed.x, exposed.y, canSee)).toBe(id);
  expect(popBubble(field, id, 1, canSee)).toBe(true);
});

it('tunnel-3: an exposed bubble cannot be hit through the covered part of its circle', () => {
  const { field, bubble, id } = setup();
  bubble.x = 14;
  const at = field.positionOf(bubble);
  const canSee = (point: { x: number; y: number }) => point.x < 15;
  expect(visibleBubbles(field, canSee).map((p) => p.id)).toEqual([id]);
  expect(bubbleAt(field, 16, at.y, canSee)).toBeUndefined();
  expect(bubbleAt(field, 13, at.y, canSee)).toBe(id);
});

it('camera-2: an expanded touch target still rejects covered touches and covered bubble centres', () => {
  const { field, bubble, id } = setup();
  bubble.x = 14;
  const at = field.positionOf(bubble);
  const canSee = (point: { x: number; y: number }) => point.x < 15;
  expect(bubbleAt(field, 20, at.y, canSee, 32)).toBeUndefined();
  expect(bubbleAt(field, -10, at.y, canSee, 32)).toBe(id);
  bubble.x = 20;
  expect(bubbleAt(field, 0, at.y, canSee, 32)).toBeUndefined();
});
