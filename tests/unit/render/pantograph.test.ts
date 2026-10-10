import { describe, expect, it } from 'vitest';
import { pantographReachU } from '../../../src/render/pantograph.ts';

/** Contact point (render coordinates, y down) for a reach along "up". */
const contact = (
  base: { x: number; y: number },
  angleRad: number,
  reach: number,
) => ({
  x: base.x - reach * Math.sin(angleRad),
  y: base.y - reach * Math.cos(angleRad),
});

describe('pantographReachU (doc 03 §9)', () => {
  it('reaches straight up to a level wire on level track', () => {
    expect(pantographReachU({ x: 40, y: -86 }, 0, () => 160)).toBeCloseTo(
      74,
      9,
    );
  });

  it('touches a sloping wire from a tilted roof at the point of contact', () => {
    for (const angle of [-0.08, -0.03, 0.03, 0.08]) {
      const wire = (x: number) => 160 + 0.06 * x;
      const base = { x: 300, y: -(86 + 0.06 * 300) };
      const reach = pantographReachU(base, angle, wire);
      const point = contact(base, angle, reach);
      // Render y is down: the wire's render y is minus its height.
      expect(point.y).toBeCloseTo(-wire(point.x), 6);
    }
  });
});
