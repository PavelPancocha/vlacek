import { describe, expect, it } from 'vitest';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import {
  PARTICLE_KINDS,
  kindIndex,
} from '../../../../src/render/particles/particleKinds.ts';
import {
  bubbleAt,
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
