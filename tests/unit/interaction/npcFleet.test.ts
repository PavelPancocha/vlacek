import { describe, expect, it } from 'vitest';
import { npcFleetFor } from '../../../src/domain/interaction/npcFleet.ts';
import type {
  LocomotiveDefinition,
  Power,
  WagonDefinition,
} from '../../../src/domain/types.ts';

function locomotive(id: string, power: Power): LocomotiveDefinition {
  return {
    id,
    power,
    kind: 'locomotive',
    labelCs: id,
    lengthU: 156,
    bogieOffsetU: 46,
    wheelRadiusU: 15,
    bodyAsset: id,
    previewAsset: id,
    requiresCatenary: power === 'electric',
    hornAudio: id,
    effect: 'none',
  };
}
function wagon(id: string): WagonDefinition {
  return {
    id,
    kind: 'wagon',
    group: 'cargo',
    labelCs: id,
    lengthU: 164,
    bogieOffsetU: 51,
    wheelRadiusU: 12,
    bodyAsset: id,
    previewAsset: id,
  };
}
const catalog = {
  locomotives: [
    locomotive('steam-a', 'steam'),
    locomotive('steam-b', 'steam'),
    locomotive('diesel-a', 'diesel'),
    locomotive('diesel-b', 'diesel'),
    locomotive('electric', 'electric'),
    locomotive('magic', 'fantasy'),
    { ...locomotive('pending-loco', 'steam'), placeholder: true as const },
  ],
  wagons: [
    ...Array.from({ length: 12 }, (_, i) => wagon(`wagon-${i}`)),
    { ...wagon('pending-wagon'), placeholder: true as const },
  ],
};

describe('npcFleetFor (H0, D-019)', () => {
  it('returns the same fleet for the same seed without mutating the catalog', () => {
    const before = structuredClone(catalog);
    expect(npcFleetFor(123, catalog)).toEqual(npcFleetFor(123, catalog));
    expect(catalog).toEqual(before);
  });
  it('selects two distinct steam/diesel locomotives and six distinct wagon types with art', () => {
    for (let seed = 0; seed < 40; seed++) {
      const fleet = npcFleetFor(seed, catalog);
      expect(fleet.locomotives).toHaveLength(2);
      expect(fleet.wagons).toHaveLength(6);
      expect(new Set(fleet.locomotives.map((v) => v.id)).size).toBe(2);
      expect(new Set(fleet.wagons.map((v) => v.id)).size).toBe(6);
      for (const v of fleet.locomotives) {
        const definition = catalog.locomotives.find(
          (candidate) => candidate.id === v.id,
        );
        expect(['steam', 'diesel']).toContain(definition?.power);
        expect(definition?.placeholder).toBeUndefined();
      }
      for (const v of fleet.wagons)
        expect(
          catalog.wagons.find((candidate) => candidate.id === v.id)
            ?.placeholder,
        ).toBeUndefined();
    }
  });
  it('returns all eligible vehicles when fewer than 2/6 have art, including an empty catalog', () => {
    const loco = locomotive('only-steam', 'steam');
    const coach = wagon('only-wagon');
    expect(
      npcFleetFor(3, {
        locomotives: [loco, locomotive('electric', 'electric')],
        wagons: [coach],
      }),
    ).toEqual({ locomotives: [loco], wagons: [coach] });
    expect(npcFleetFor(3, { locomotives: [], wagons: [] })).toEqual({
      locomotives: [],
      wagons: [],
    });
  });
  it('can choose different fleets for different seeds', () => {
    const fleets = new Set(
      Array.from({ length: 40 }, (_, seed) =>
        JSON.stringify(npcFleetFor(seed, catalog)),
      ),
    );
    expect(fleets.size).toBeGreaterThan(1);
  });
});
