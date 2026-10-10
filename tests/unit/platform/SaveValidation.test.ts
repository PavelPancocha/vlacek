import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../../src/config/gameConfig.ts';
import { locomotives, wagons } from '../../../src/content/vehicles.ts';
import {
  parseSave,
  saveRules,
  type SaveRules,
} from '../../../src/platform/SaveValidation.ts';

const fixture = (name: string) =>
  readFileSync(
    resolve(import.meta.dirname, '../../fixtures/save', name),
    'utf8',
  );
const rules: SaveRules = saveRules(gameConfig, locomotives, wagons);

function mutate(
  name: string,
  change: (save: Record<string, unknown>) => void,
): string {
  const save = JSON.parse(fixture(name)) as Record<string, unknown>;
  change(save);
  return JSON.stringify(save);
}

describe('parseSave', () => {
  it('DATA-01: accepts the released v1 journey format unchanged', () => {
    const result = parseSave(fixture('v1-journey.json'), rules);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.save.journey?.seed).toBe(3141592653);
    expect(result.save.journey?.head).toEqual({
      chunkIndex: 7,
      arcOffsetU: 412.5,
    });
    expect(
      result.save.journey?.consist.wagons.map((w) => w.instanceId),
    ).toEqual(['w1', 'w2']);
  });

  it('accepts a save without a journey but with a builder draft', () => {
    const result = parseSave(fixture('v1-no-journey.json'), rules);
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(result.save.journey).toBeUndefined();
    expect(result.save.settings.maxSpeedFactor).toBe(0.65);
    expect(result.save.builderDraft?.locomotiveId).toBe('diesel_mainline');
  });

  it('DATA-02: rejects corrupt JSON without throwing', () => {
    expect(parseSave(fixture('v1-truncated.txt'), rules).status).toBe(
      'invalid',
    );
    expect(parseSave('', rules).status).toBe('invalid');
    expect(parseSave('null', rules).status).toBe('invalid');
  });

  it('DATA-04: reports a newer schema instead of guessing', () => {
    expect(parseSave(fixture('v99-future.json'), rules)).toEqual({
      status: 'newer',
      schemaVersion: 99,
    });
  });

  describe('DATA-06: hostile or broken values', () => {
    const cases: [string, (save: Record<string, unknown>) => void][] = [
      [
        'NaN tick',
        (s) =>
          ((s['journey'] as Record<string, unknown>)['simulationTick'] =
            Number.NaN),
      ],
      [
        'negative tick',
        (s) =>
          ((s['journey'] as Record<string, unknown>)['simulationTick'] = -1),
      ],
      [
        'huge chunk index',
        (s) =>
          ((s['journey'] as Record<string, Record<string, unknown>>)['head']![
            'chunkIndex'
          ] = 1e15),
      ],
      [
        'fractional chunk index',
        (s) =>
          ((s['journey'] as Record<string, Record<string, unknown>>)['head']![
            'chunkIndex'
          ] = 1.5),
      ],
      [
        'negative arc offset',
        (s) =>
          ((s['journey'] as Record<string, Record<string, unknown>>)['head']![
            'arcOffsetU'
          ] = -3),
      ],
      [
        'seed above uint32',
        (s) => ((s['journey'] as Record<string, unknown>)['seed'] = 2 ** 32),
      ],
      [
        // Any known or newer generator is readable; GameSession decides.
        'invalid generator version',
        (s) =>
          ((s['journey'] as Record<string, unknown>)['generatorVersion'] = -1),
      ],
      [
        'unknown locomotive',
        (s) =>
          ((s['lastConsist'] as Record<string, unknown>)['locomotiveId'] =
            'rocket'),
      ],
      [
        'unknown wagon',
        (s) =>
          ((
            s['lastConsist'] as { wagons: Record<string, unknown>[] }
          ).wagons[0]!['definitionId'] = '<img src=x onerror=alert(1)>'),
      ],
      [
        'duplicate instance',
        (s) =>
          ((
            s['lastConsist'] as { wagons: Record<string, unknown>[] }
          ).wagons[1]!['instanceId'] = 'w1'),
      ],
      [
        'bad instance id',
        (s) =>
          ((
            s['lastConsist'] as { wagons: Record<string, unknown>[] }
          ).wagons[0]!['instanceId'] = '<b>x</b>'),
      ],
      [
        '101 wagons',
        (s) =>
          ((s['lastConsist'] as { wagons: unknown[] }).wagons = Array.from(
            { length: 101 },
            (_, i) => ({
              instanceId: `w${i}`,
              definitionId: 'cargo_box',
              visualSeed: i,
            }),
          )),
      ],
      ['long build id', (s) => (s['appBuildId'] = 'x'.repeat(10_000))],
      [
        'bad setting',
        (s) =>
          ((s['settings'] as Record<string, unknown>)['quality'] = 'ultra'),
      ],
      [
        'too many runtime entries',
        (s) =>
          ((s['journey'] as Record<string, unknown>)['activeEntities'] =
            Array.from({ length: 513 }, () => ({}))),
      ],
      ['wrong content version', (s) => (s['contentVersion'] = 2)],
    ];
    for (const [name, change] of cases) {
      it(`rejects ${name}`, () => {
        expect(parseSave(mutate('v1-journey.json', change), rules).status).toBe(
          'invalid',
        );
      });
    }
  });

  it('rejects saves above the 512 KiB hard limit before parsing', () => {
    const padded = mutate(
      'v1-journey.json',
      (s) => (s['padding'] = 'x'.repeat(600 * 1024)),
    );
    expect(parseSave(padded, rules).status).toBe('invalid');
  });

  it('drops unknown fields and runtime components that 0.1 does not restore', () => {
    const result = parseSave(
      mutate('v1-journey.json', (s) => {
        s['extra'] = { __proto__: { polluted: true } };
        (s['journey'] as Record<string, unknown>)['activeEntities'] = [
          { kind: 'balloon', id: 'x' },
        ];
      }),
      rules,
    );
    expect(result.status).toBe('valid');
    if (result.status !== 'valid') return;
    expect(Object.keys(result.save)).not.toContain('extra');
    expect(result.save.journey?.activeEntities).toEqual([]);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
