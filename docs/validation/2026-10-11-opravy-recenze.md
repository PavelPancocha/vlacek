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

## R2 — konečná nejvyšší rychlost protijedoucího vlaku

Validace konfigurace vyžaduje, aby minimum i maximum `interaction.npcTrainSpeedUPerSec` byla konečná kladná čísla a minimum nejvýš maximum.

| Test                                                        | Red                                                                  | Green |
| ----------------------------------------------------------- | -------------------------------------------------------------------- | ----- |
| `R2: rejects an infinite maximum speed for oncoming trains` | `expected [] to deeply equal [ 'interaction.npcTrainSpeedUPerSec' ]` | PASS  |

Příkaz: `VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/config/gameConfig.test.ts` (red 1 FAIL / 15, green 15 PASS). Meze jsou zapsané v dokumentu 13 („Odvozené hodnoty a pravidla“).

## R5 — přejezd za koncem vlaku se nevytváří znovu

`RideSimulation.#updateCrossings` přeskočí místa, jejichž `crossingWorldX` je už za `behindX`, dřív než vytvoří automat. `behindX` leží 1024 u za koncem soupravy a konfliktní zóna přejezdu má poloviční šířku 62 u, takže filtr nikdy nevynechá přejezd, na kterém ještě stojí konec vlaku (dokument 05 §4).

| Test                                                                                                                      | Red                                                                                   | Green                 |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| `R5: keeps live crossing instances and does not recreate a crossing behind the stopped train` (svět 4242, 60 ticků stání) | `expected "LevelCrossing" to not be called at all, but actually been called 60 times` | PASS (soubor 20 PASS) |

Příkaz: `VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/ride/RideSimulation.test.ts -t 'R5:'`. Pravidla přejezdu ani save se nemění, proto [D-015](../decisions/015-level-crossings.md) zůstává beze změny.
