# Ověření oprav recenze R1, R2 a R5–R10

Protokol PR s opravami nálezů, které Codex našel při recenzi PR #2 a které [stav a další kroky](../roadmap.md) plánuje jako R1–R10. Každý nález má vlastní commit s testem a dokumentací. Výchozí stav je build `0.1.0+2563ef4` (`master` po sloučení PR #2). Lokální běhy na pracovní stanici s Linuxem; Vitest se 4 workery (`VITEST_MAX_WORKERS=4`), protože s výchozími 16 workery na sdíleném stroji překračuje dlouhý test `GEN-10` limit 5000 ms i na `master` (v CI prochází). Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## R1 — novější save se pozná dřív, než se ověří jeho obsah

`parseSave` nejdřív přečte surové verze: `schemaVersion` nad 1, `contentVersion` nad podporovanou a `journey.generatorVersion` nad verzí buildu dají `newer` dřív, než se `lastConsist`, `builderDraft` a cesta ověří proti katalogu. `SaveRepository` při každém ukládání znovu přečte primár; je-li novější (například ho mezitím zapsala jiná karta s novějším buildem), přepne relaci do `memory-only` a nezapíše nic.

| Test                                                                                                     | Red                                            | Green |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----- |
| `DATA-04 R1: detects a newer generator before validating catalog IDs` (fixture `v1-future-catalog.json`) | `invalid`: „lastConsist: unknown locomotive“   | PASS  |
| `DATA-04 R1: detects newer content before validating catalog IDs`                                        | `invalid`: „contentVersion: unsupported“       | PASS  |
| `DATA-04 R1: keeps a newer primary with unknown catalog IDs despite a valid backup`                      | `restored-from-backup` místo `newer-save-kept` | PASS  |
| `DATA-04 R1: keeps a newer primary written after load across repeated saves` (nález recenze lane)        | `expected 'saved' to be 'memory-only'`         | PASS  |

Příkaz: `VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/platform/SaveValidation.test.ts tests/unit/platform/SaveRepository.test.ts` (red 3 FAIL / 35, potom 1 FAIL / 13; green 38 a 13 PASS). Dokumentace: dokument 08 §7, [D-009](../decisions/009-track-generator-v1.md), [fixtury](../../tests/fixtures/save/README.md). Atomická transakce `localStorage` mezi kartami se nezavádí; souběh skutečných karet prohlížeče je NEOVĚŘENO.
