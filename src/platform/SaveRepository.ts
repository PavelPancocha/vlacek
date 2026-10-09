import type { SaveConfig } from '../config/gameConfig.ts';
import {
  parseSave,
  type SaveEnvelopeV1,
  type SaveRules,
} from './SaveValidation.ts';

export const PRIMARY_KEY = 'vlacek.save.v1';
export const BACKUP_KEY = 'vlacek.save.backup.v1';

/** The subset of Web Storage used here; injected so tests run in Node. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Parent-facing notices (shown as text, never HTML). */
export type SaveNotice =
  | 'restored-from-backup'
  | 'corrupt-save-discarded'
  | 'storage-unavailable'
  | 'newer-save-kept';

export type LoadResult =
  | { source: 'primary'; save: SaveEnvelopeV1 }
  | { source: 'backup'; save: SaveEnvelopeV1; notice: 'restored-from-backup' }
  | { source: 'none'; notice?: Exclude<SaveNotice, 'restored-from-backup'> };

export type SaveOutcome = 'saved' | 'memory-only' | 'too-large';

/**
 * Small versioned JSON save in localStorage with a backup of the previous
 * valid primary (doc 08 §6). Every access is wrapped; failures switch to
 * memory-only so the game stays playable. A save written by a newer build is
 * never overwritten. The two writes are not treated as a transaction.
 */
export class SaveRepository {
  readonly #storage: StorageLike | undefined;
  readonly #rules: SaveRules;
  readonly #config: SaveConfig;
  #status: 'ok' | 'memory-only' = 'ok';
  #lastSaved: SaveEnvelopeV1 | undefined;

  constructor(
    storage: StorageLike | undefined,
    rules: SaveRules,
    config: SaveConfig,
  ) {
    this.#storage = storage;
    this.#rules = rules;
    this.#config = config;
    if (!storage) this.#status = 'memory-only';
  }

  get status(): 'ok' | 'memory-only' {
    return this.#status;
  }

  /** The newest snapshot of this session, persisted or not. */
  get lastSaved(): SaveEnvelopeV1 | undefined {
    return this.#lastSaved;
  }

  #read(key: string): string | null {
    if (!this.#storage) throw new Error('no storage');
    return this.#storage.getItem(key);
  }

  load(): LoadResult {
    let primary: string | null;
    let backup: string | null;
    try {
      primary = this.#read(PRIMARY_KEY);
      backup = this.#read(BACKUP_KEY);
    } catch {
      this.#status = 'memory-only';
      return { source: 'none', notice: 'storage-unavailable' };
    }
    const first =
      primary === null ? undefined : parseSave(primary, this.#rules);
    if (first?.status === 'valid')
      return { source: 'primary', save: first.save };
    const second = backup === null ? undefined : parseSave(backup, this.#rules);
    if (first?.status === 'newer' || second?.status === 'newer') {
      // Keep the newer build's data untouched; this session plays in memory.
      this.#status = 'memory-only';
      return { source: 'none', notice: 'newer-save-kept' };
    }
    if (second?.status === 'valid') {
      return {
        source: 'backup',
        save: second.save,
        notice: 'restored-from-backup',
      };
    }
    return primary === null && backup === null
      ? { source: 'none' }
      : { source: 'none', notice: 'corrupt-save-discarded' };
  }

  save(envelope: SaveEnvelopeV1): SaveOutcome {
    const json = JSON.stringify(envelope);
    if (json.length > this.#config.maxBytes) return 'too-large';
    // Round-trip validation guards against writing something we cannot load.
    if (parseSave(json, this.#rules).status !== 'valid') {
      throw new Error('Refusing to write an invalid save snapshot');
    }
    this.#lastSaved = envelope;
    if (this.#status === 'memory-only' || !this.#storage) return 'memory-only';
    const storage = this.#storage;
    try {
      const current = storage.getItem(PRIMARY_KEY);
      if (
        current !== null &&
        parseSave(current, this.#rules).status === 'valid'
      ) {
        storage.setItem(BACKUP_KEY, current);
      }
    } catch {
      // A failed backup write still leaves the previous primary in place.
    }
    try {
      storage.setItem(PRIMARY_KEY, json);
      return 'saved';
    } catch {
      this.#status = 'memory-only';
      return 'memory-only';
    }
  }
}
