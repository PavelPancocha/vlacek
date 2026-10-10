import { describe, expect, it } from 'vitest';
import {
  addWagon,
  canMoveSelected,
  canUndo,
  createDraft,
  draftFromConsist,
  isFull,
  moveSelected,
  removeSelected,
  selectLocomotive,
  selectWagon,
  undoLastChange,
  type ConsistDraft,
} from '../../../src/domain/consist/ConsistEditor.ts';

const MAX = 100;

function withWagons(...ids: string[]): ConsistDraft {
  return ids.reduce(
    (draft, id) => addWagon(draft, id, MAX).draft,
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

  it('UI-03: the 101st wagon is refused and the first 100 stay unchanged', () => {
    const full = withWagons(
      ...Array.from({ length: 100 }, (_, i) =>
        i % 2 ? 'cargo_box' : 'cargo_coal',
      ),
    );
    expect(isFull(full, MAX)).toBe(true);
    const result = addWagon(full, 'fun_balloons', MAX);
    expect(result.added).toBe(false);
    expect(result.draft).toBe(full);
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
      expect(canUndo(addWagon(removed, 'cargo_box', MAX).draft)).toBe(false);
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
    const next = addWagon(restored, 'cargo_box', MAX).draft;
    const ids = next.consist.wagons.map((w) => w.instanceId);
    expect(new Set(ids).size).toBe(3);
  });
});
