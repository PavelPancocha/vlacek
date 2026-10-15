import { expect, it } from 'vitest';
import { ParticleField } from '../../../../src/render/particles/ParticleField.ts';
import {
  PARTICLE_KINDS,
  kindIndex,
} from '../../../../src/render/particles/particleKinds.ts';
import { particleRadiusU } from '../../../../src/render/particles/particleRadius.ts';
it('rain occlusion covers the height of its rendered frame, not only its narrow width', () => {
  const field = new ParticleField(PARTICLE_KINDS, 2, () => 0.5);
  field.emit(kindIndex('rain'), 0, 0, 1);
  const p = field.particles()[0];
  if (!p) throw new Error('rain missing');
  expect(particleRadiusU(field, p)).toBeGreaterThan(4.6);
});
