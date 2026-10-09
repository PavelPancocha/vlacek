import { hash32 } from '../world/Hash.ts';
import type { Consist, WagonInstance } from '../types.ts';

/** Depot editing state (doc 02 §7): one selection and one undoable change. */
export interface ConsistDraft {
  consist: Consist;
  selectedInstanceId?: string;
  /** Next number for `w<n>` instance ids; never reused within a draft. */
  nextInstanceNumber: number;
  /** Snapshot before the last remove or reorder; consumed by undo. */
  undo?: { consist: Consist; selectedInstanceId?: string };
}

export type MoveDirection = 'towardLocomotive' | 'back';

const INSTANCE_ID = /^w(\d+)$/;

export function createDraft(locomotiveId: string): ConsistDraft {
  return { consist: { locomotiveId, wagons: [] }, nextInstanceNumber: 1 };
}

/** Editable copy of an existing consist (e.g. from pause or a save). */
export function draftFromConsist(consist: Consist): ConsistDraft {
  let highest = 0;
  for (const wagon of consist.wagons) {
    const match = INSTANCE_ID.exec(wagon.instanceId);
    if (match?.[1]) highest = Math.max(highest, Number(match[1]));
  }
  return {
    consist: {
      locomotiveId: consist.locomotiveId,
      wagons: [...consist.wagons],
    },
    nextInstanceNumber: highest + 1,
  };
}

export function selectLocomotive(
  draft: ConsistDraft,
  locomotiveId: string,
): ConsistDraft {
  return { ...draft, consist: { ...draft.consist, locomotiveId } };
}

export function isFull(draft: ConsistDraft, maxWagons: number): boolean {
  return draft.consist.wagons.length >= maxWagons;
}

function withoutUndo(draft: ConsistDraft): ConsistDraft {
  const result: ConsistDraft = {
    consist: draft.consist,
    nextInstanceNumber: draft.nextInstanceNumber,
  };
  if (draft.selectedInstanceId !== undefined) {
    result.selectedInstanceId = draft.selectedInstanceId;
  }
  return result;
}

/** One tap adds one wagon behind the last; nothing changes when full. */
export function addWagon(
  draft: ConsistDraft,
  definitionId: string,
  maxWagons: number,
): { draft: ConsistDraft; added: boolean } {
  if (isFull(draft, maxWagons)) return { draft, added: false };
  let number = draft.nextInstanceNumber;
  const taken = new Set(draft.consist.wagons.map((wagon) => wagon.instanceId));
  while (taken.has(`w${number}`)) number++;
  const wagon: WagonInstance = {
    instanceId: `w${number}`,
    definitionId,
    visualSeed: hash32('wagon-visual', definitionId, number),
  };
  return {
    draft: {
      ...withoutUndo(draft),
      consist: { ...draft.consist, wagons: [...draft.consist.wagons, wagon] },
      nextInstanceNumber: number + 1,
    },
    added: true,
  };
}

/** Selecting only marks the wagon; it never removes it. */
export function selectWagon(
  draft: ConsistDraft,
  instanceId: string,
): ConsistDraft {
  if (!draft.consist.wagons.some((wagon) => wagon.instanceId === instanceId))
    return draft;
  return { ...draft, selectedInstanceId: instanceId };
}

function selectedIndex(draft: ConsistDraft): number {
  return draft.consist.wagons.findIndex(
    (wagon) => wagon.instanceId === draft.selectedInstanceId,
  );
}

function snapshot(draft: ConsistDraft): NonNullable<ConsistDraft['undo']> {
  return draft.selectedInstanceId === undefined
    ? { consist: draft.consist }
    : { consist: draft.consist, selectedInstanceId: draft.selectedInstanceId };
}

export function canMoveSelected(
  draft: ConsistDraft,
  direction: MoveDirection,
): boolean {
  const index = selectedIndex(draft);
  if (index < 0) return false;
  return direction === 'towardLocomotive'
    ? index > 0
    : index < draft.consist.wagons.length - 1;
}

export function moveSelected(
  draft: ConsistDraft,
  direction: MoveDirection,
): ConsistDraft {
  if (!canMoveSelected(draft, direction)) return draft;
  const index = selectedIndex(draft);
  const target = direction === 'towardLocomotive' ? index - 1 : index + 1;
  const wagons = [...draft.consist.wagons];
  const moving = wagons[index];
  const other = wagons[target];
  if (!moving || !other) return draft;
  wagons[index] = other;
  wagons[target] = moving;
  return {
    ...draft,
    consist: { ...draft.consist, wagons },
    undo: snapshot(draft),
  };
}

export function removeSelected(draft: ConsistDraft): ConsistDraft {
  const index = selectedIndex(draft);
  if (index < 0) return draft;
  return {
    consist: {
      ...draft.consist,
      wagons: draft.consist.wagons.filter((_, i) => i !== index),
    },
    nextInstanceNumber: draft.nextInstanceNumber,
    undo: snapshot(draft),
  };
}

export function canUndo(draft: ConsistDraft): boolean {
  return draft.undo !== undefined;
}

/** Restores the state before the last remove or reorder, once. */
export function undoLastChange(draft: ConsistDraft): ConsistDraft {
  if (!draft.undo) return draft;
  const restored: ConsistDraft = {
    consist: draft.undo.consist,
    nextInstanceNumber: draft.nextInstanceNumber,
  };
  return draft.undo.selectedInstanceId === undefined
    ? restored
    : { ...restored, selectedInstanceId: draft.undo.selectedInstanceId };
}
