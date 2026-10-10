import { describe, expect, it } from 'vitest';
import {
  addWagon,
  canAddWagon,
  canMoveSelected,
  canUndo,
  consistLengthU,
  createDraft,
  draftFromConsist,
  isFull,
  isOverLimit,
  moveSelected,
  removeSelected,
  selectLocomotive,
  selectWagon,
  undoLastChange,
  type ConsistDraft,
  type ConsistLengthRules,
} from '../../../src/domain/consist/ConsistEditor.ts';
import { layoutConsist } from '../../../src/domain/train/TrainGeometry.ts';

/** Vehicle lengths in world units, independent of the shipped catalog. */
const LENGTHS_U: Record<string, number> = {
  steam_local: 156,
  magic_stars: 164,
  cargo_box: 164,
  cargo_coal: 152,
  fun_balloons: 164,
  passenger_open: 144,
};

function rules(maxLengthU: number): ConsistLengthRules {
  return {
    maxLengthU,
    couplerGapU: 8,
    geometryOf: (id) => {
      const lengthU = LENGTHS_U[id];
      return lengthU === undefined
        ? undefined
        : { lengthU, bogieOffsetU: Math.round(lengthU * 0.31) };
    },
  };
}

/** Large enough that editing tests never meet the limit. */
const RULES = rules(1_000_000);

function withWagons(...ids: string[]): ConsistDraft {
  return ids.reduce(
    (draft, id) => addWagon(draft, id, RULES).draft,
    createDraft('steam_local'),
  );
}

const order = (draft: ConsistDraft) =>
  draft.consist.wagons.map((w) => w.definitionId);

describe('ConsistEditor', () => {
  it('starts with the chosen locomotive and no wagons (Vyjet works with zero)', () => {
    const draft = createDraft('steam_local');
    expect(draft.consist).toEqual({ locomotiveId: 'steam_local', wagons: [] });
    expect(canUndo(draft)).toBe(false);
  });

  it('changes the locomotive without touching wagons', () => {
    const draft = selectLocomotive(withWagons('cargo_box'), 'magic_stars');
    expect(draft.consist.locomotiveId).toBe('magic_stars');
    expect(order(draft)).toEqual(['cargo_box']);
  });

  it('adds exactly one wagon per tap behind the last; types may repeat', () => {
    const draft = withWagons('cargo_box', 'cargo_box', 'fun_balloons');
    expect(order(draft)).toEqual(['cargo_box', 'cargo_box', 'fun_balloons']);
  });

  it('TRN-02: 100 wagons of one type get unique instance ids and visual seeds', () => {
    const draft = withWagons(
      ...Array.from({ length: 100 }, () => 'cargo_coal'),
    );
    const ids = new Set(draft.consist.wagons.map((w) => w.instanceId));
    expect(ids.size).toBe(100);
    for (const wagon of draft.consist.wagons) {
      expect(Number.isSafeInteger(wagon.visualSeed)).toBe(true);
    }
  });

  describe('doc 14 §2: length limit', () => {
    it('measures front to tail with couplers, like the ride layout', () => {
      const draft = withWagons('cargo_box', 'fun_balloons');
      const layout = layoutConsist(
        [156, 164, 164].map((lengthU) => ({ lengthU, bogieOffsetU: 0 })),
        8,
      );
      expect(consistLengthU(draft.consist, RULES)).toBe(
        layout.frontOffsetU + layout.tailOffsetU,
      );
      expect(consistLengthU(draft.consist, RULES)).toBe(
        156 + 8 + 164 + 8 + 164,
      );
    });

    it('accepts a wagon that exactly fits and refuses the next one unchanged', () => {
      const limit = rules(156 + 8 + 164);
      const one = addWagon(createDraft('steam_local'), 'cargo_box', limit);
      expect(one.added).toBe(true);
      const refused = addWagon(one.draft, 'cargo_coal', limit);
      expect(refused.added).toBe(false);
      expect(refused.draft).toBe(one.draft);
      expect(isFull(one.draft, ['cargo_box', 'cargo_coal'], limit)).toBe(true);
    });

    it('a shorter wagon may still fit when a longer one does not', () => {
      const limit = rules(156 + 8 + 164 + 8 + 144);
      const draft = addWagon(
        createDraft('steam_local'),
        'cargo_box',
        limit,
      ).draft;
      expect(canAddWagon(draft, 'cargo_box', limit)).toBe(false);
      expect(canAddWagon(draft, 'passenger_open', limit)).toBe(true);
      expect(isFull(draft, ['cargo_box', 'passenger_open'], limit)).toBe(false);
    });

    it('refuses wagons it cannot measure', () => {
      expect(canAddWagon(createDraft('steam_local'), 'unknown', RULES)).toBe(
        false,
      );
    });

    it('keeps every wagon of a legacy over-limit consist; removing brings it back', () => {
      const legacy = withWagons(
        ...Array.from({ length: 10 }, () => 'cargo_coal'),
      );
      const limit = rules(1000);
      expect(isOverLimit(legacy, limit)).toBe(true);
      expect(addWagon(legacy, 'passenger_open', limit).added).toBe(false);
      let draft = legacy;
      while (isOverLimit(draft, limit)) {
        const last = draft.consist.wagons.at(-1)?.instanceId ?? 'none';
        draft = removeSelected(selectWagon(draft, last));
      }
      expect(draft.consist.wagons.length).toBe(5);
      expect(consistLengthU(draft.consist, limit)).toBeLessThanOrEqual(1000);
    });
  });

  describe('UI-02: select, move, remove and undo', () => {
    function fixture() {
      const draft = withWagons('cargo_box', 'cargo_coal', 'fun_balloons');
      const [first, second, third] = draft.consist.wagons;
      return {
        draft,
        first: first?.instanceId ?? 'missing-1',
        second: second?.instanceId ?? 'missing-2',
        third: third?.instanceId ?? 'missing-3',
      };
    }

    it('selecting a wagon never removes it', () => {
      const { draft, second } = fixture();
      const selected = selectWagon(draft, second);
      expect(selected.selectedInstanceId).toBe(second);
      expect(order(selected)).toEqual(order(draft));
    });

    it('moves the selected wagon and keeps it selected; ends are disabled', () => {
      const { draft, second, third } = fixture();
      const selected = selectWagon(draft, second);
      const moved = moveSelected(selected, 'towardLocomotive');
      expect(order(moved)).toEqual(['cargo_coal', 'cargo_box', 'fun_balloons']);
      expect(moved.selectedInstanceId).toBe(second);
      expect(canMoveSelected(moved, 'towardLocomotive')).toBe(false);
      expect(moveSelected(moved, 'towardLocomotive')).toBe(moved);
      const last = selectWagon(draft, third);
      expect(canMoveSelected(last, 'back')).toBe(false);
      expect(moveSelected(last, 'back')).toBe(last);
    });

    it('removes only the selected wagon and undoes it exactly once', () => {
      const { draft, second } = fixture();
      const removed = removeSelected(selectWagon(draft, second));
      expect(order(removed)).toEqual(['cargo_box', 'fun_balloons']);
      expect(removed.selectedInstanceId).toBeUndefined();
      expect(canUndo(removed)).toBe(true);
      const restored = undoLastChange(removed);
      expect(restored.consist).toEqual(draft.consist);
      expect(canUndo(restored)).toBe(false);
      expect(undoLastChange(restored)).toBe(restored);
    });

    it('undoes a reorder', () => {
      const { draft, third } = fixture();
      const moved = moveSelected(selectWagon(draft, third), 'towardLocomotive');
      expect(undoLastChange(moved).consist).toEqual(draft.consist);
    });

    it('a new addition clears the pending undo', () => {
      const { draft, first } = fixture();
      const removed = removeSelected(selectWagon(draft, first));
      expect(canUndo(addWagon(removed, 'cargo_box', RULES).draft)).toBe(false);
    });

    it('does nothing without a selection or for unknown ids', () => {
      const { draft } = fixture();
      expect(removeSelected(draft)).toBe(draft);
      expect(selectWagon(draft, 'nope').selectedInstanceId).toBeUndefined();
    });
  });

  it('undo after a locomotive change keeps the new locomotive', () => {
    const draft = withWagons('cargo_box', 'cargo_coal');
    const second = draft.consist.wagons[1]?.instanceId ?? 'missing';
    const removed = removeSelected(selectWagon(draft, second));
    const switched = selectLocomotive(removed, 'magic_stars');
    const restored = undoLastChange(switched);
    expect(restored.consist.locomotiveId).toBe('magic_stars');
    expect(order(restored)).toEqual(['cargo_box', 'cargo_coal']);
  });

  it('continues instance numbering for a restored consist without collisions', () => {
    const original = withWagons('cargo_box', 'cargo_coal');
    const restored = draftFromConsist(original.consist);
    const next = addWagon(restored, 'cargo_box', RULES).draft;
    const ids = next.consist.wagons.map((w) => w.instanceId);
    expect(new Set(ids).size).toBe(3);
  });
});
