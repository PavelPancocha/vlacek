import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import {
  BACKUP_KEY,
  PRIMARY_KEY,
  SaveRepository,
  type StorageLike,
} from '../../../src/platform/SaveRepository.ts';
import {
  parseSave,
  saveRules,
  type SaveEnvelopeV1,
} from '../../../src/platform/SaveValidation.ts';

const rules = saveRules(gameConfig, locomotives, wagons);
const fixture = (name: string) =>
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/save', name),
    'utf8',
  );
const valid = (name: string): SaveEnvelopeV1 => {
  const result = parseSave(fixture(name), rules);
  if (result.status !== 'valid') throw new Error(`fixture ${name} invalid`);
  return result.save;
};

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  failOn: ((key: string) => boolean) | undefined;
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    if (this.failOn?.(key))
      throw new DOMException('quota', 'QuotaExceededError');
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  removeItem: () => undefined,
};

describe('SaveRepository', () => {
  it('starts fresh without any save', () => {
    const repo = new SaveRepository(
      new MemoryStorage(),
      rules,
      gameConfig.save,
    );
    expect(repo.load()).toEqual({ source: 'none' });
    expect(repo.status).toBe('ok');
  });

  it('DATA-01: saves and loads the same envelope', () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    const save = valid('v1-journey.json');
    expect(repo.save(save)).toBe('saved');
    const loaded = new SaveRepository(storage, rules, gameConfig.save).load();
    expect(loaded).toEqual({ source: 'primary', save });
  });

  it('keeps the previous valid primary as backup before overwriting', () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    const first = valid('v1-no-journey.json');
    const second = valid('v1-journey.json');
    repo.save(first);
    repo.save(second);
    expect(parseSave(storage.getItem(BACKUP_KEY) ?? '', rules)).toEqual({
      status: 'valid',
      save: first,
    });
  });

  it('DATA-02: a corrupt primary falls back to the valid backup with a notice', () => {
    const storage = new MemoryStorage();
    storage.data.set(PRIMARY_KEY, fixture('v1-truncated.txt'));
    storage.data.set(BACKUP_KEY, fixture('v1-journey.json'));
    const result = new SaveRepository(storage, rules, gameConfig.save).load();
    expect(result).toEqual({
      source: 'backup',
      save: valid('v1-journey.json'),
      notice: 'restored-from-backup',
    });
  });

  it('DATA-02: corrupt primary and backup give a safe new game', () => {
    const storage = new MemoryStorage();
    storage.data.set(PRIMARY_KEY, '{');
    storage.data.set(BACKUP_KEY, '[]');
    expect(new SaveRepository(storage, rules, gameConfig.save).load()).toEqual({
      source: 'none',
      notice: 'corrupt-save-discarded',
    });
  });

  it('DATA-03: unavailable storage keeps the game playable in memory', () => {
    const repo = new SaveRepository(throwingStorage, rules, gameConfig.save);
    expect(repo.load()).toEqual({
      source: 'none',
      notice: 'storage-unavailable',
    });
    expect(repo.save(valid('v1-journey.json'))).toBe('memory-only');
    expect(repo.status).toBe('memory-only');
  });

  it('DATA-03: a quota error switches to memory-only with a parent notice', () => {
    const storage = new MemoryStorage();
    storage.failOn = (key) => key === PRIMARY_KEY;
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    expect(repo.save(valid('v1-journey.json'))).toBe('memory-only');
    expect(repo.status).toBe('memory-only');
    expect(repo.lastSaved).toEqual(valid('v1-journey.json'));
  });

  it('DATA-04: a newer schema is never overwritten', () => {
    const storage = new MemoryStorage();
    storage.data.set(PRIMARY_KEY, fixture('v99-future.json'));
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    expect(repo.load()).toEqual({ source: 'none', notice: 'newer-save-kept' });
    expect(repo.save(valid('v1-journey.json'))).toBe('memory-only');
    expect(storage.getItem(PRIMARY_KEY)).toBe(fixture('v99-future.json'));
    expect(storage.getItem(BACKUP_KEY)).toBeNull();
  });

  it('DATA-04: a journey from a newer track generator is never overwritten', () => {
    const storage = new MemoryStorage();
    storage.data.set(PRIMARY_KEY, fixture('v1-future-generator.json'));
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    expect(repo.load()).toEqual({ source: 'none', notice: 'newer-save-kept' });
    expect(repo.save(valid('v1-journey.json'))).toBe('memory-only');
    expect(storage.getItem(PRIMARY_KEY)).toBe(
      fixture('v1-future-generator.json'),
    );
    expect(storage.getItem(BACKUP_KEY)).toBeNull();
  });

  it('DATA-04 R1: keeps a newer primary with unknown catalog IDs despite a valid backup', () => {
    const storage = new MemoryStorage();
    const primary = fixture('v1-generator-3.json');
    const backup = fixture('v1-journey.json');
    storage.data.set(PRIMARY_KEY, primary);
    storage.data.set(BACKUP_KEY, backup);
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    expect(repo.load()).toEqual({ source: 'none', notice: 'newer-save-kept' });
    expect(repo.status).toBe('memory-only');
    expect(repo.save(valid('v1-no-journey.json'))).toBe('memory-only');
    expect(storage.getItem(PRIMARY_KEY)).toBe(primary);
    expect(storage.getItem(BACKUP_KEY)).toBe(backup);
  });

  it('DATA-04 R1: keeps a newer primary written after load across repeated saves', () => {
    const storage = new MemoryStorage();
    const older = valid('v1-journey.json');
    const newer = fixture('v1-generator-3.json');
    const backup = fixture('v1-no-journey.json');
    storage.data.set(PRIMARY_KEY, fixture('v1-journey.json'));
    storage.data.set(BACKUP_KEY, backup);
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    expect(repo.load()).toEqual({ source: 'primary', save: older });
    expect(repo.status).toBe('ok');
    storage.data.set(PRIMARY_KEY, newer);
    for (const save of [valid('v1-no-journey.json'), older]) {
      expect(repo.save(save)).toBe('memory-only');
      expect(repo.status).toBe('memory-only');
      expect(repo.lastSaved).toEqual(save);
      expect(storage.getItem(PRIMARY_KEY)).toBe(newer);
      expect(storage.getItem(BACKUP_KEY)).toBe(backup);
    }
  });

  it('DATA-04 PWA: an old tab preserves a newer backup written after its load', () => {
    const storage = new MemoryStorage();
    storage.data.set(PRIMARY_KEY, fixture('v1-journey.json'));
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    repo.load();
    const newer = fixture('v1-future-generator.json');
    storage.data.set(BACKUP_KEY, newer);
    expect(repo.save(valid('v1-no-journey.json'))).toBe('memory-only');
    expect(storage.getItem(BACKUP_KEY)).toBe(newer);
    expect(storage.getItem(PRIMARY_KEY)).toBe(fixture('v1-journey.json'));
  });

  it('DATA-04 PWA: unreadable current storage cannot bypass the version guard', () => {
    const memory = new MemoryStorage();
    const original = fixture('v1-journey.json');
    memory.data.set(PRIMARY_KEY, original);
    let denyReads = false;
    const storage: StorageLike = {
      getItem: (key) => {
        if (denyReads) throw new Error('denied');
        return memory.getItem(key);
      },
      setItem: (key, value) => memory.setItem(key, value),
      removeItem: (key) => memory.removeItem(key),
    };
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    repo.load();
    denyReads = true;
    expect(repo.save(valid('v1-no-journey.json'))).toBe('memory-only');
    expect(memory.getItem(PRIMARY_KEY)).toBe(original);
  });

  it('DATA-07: a failed primary write after the backup keeps a valid restore point', () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage, rules, gameConfig.save);
    repo.save(valid('v1-no-journey.json'));
    storage.failOn = (key) => key === PRIMARY_KEY;
    repo.save(valid('v1-journey.json'));
    const reloaded = new SaveRepository(storage, rules, gameConfig.save).load();
    expect(reloaded).toEqual({
      source: 'primary',
      save: valid('v1-no-journey.json'),
    });
  });

  it('refuses an oversized snapshot without touching stored data', () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage, rules, {
      ...gameConfig.save,
      maxBytes: 200,
    });
    expect(repo.save(valid('v1-journey.json'))).toBe('too-large');
    expect(storage.data.size).toBe(0);
  });
});
