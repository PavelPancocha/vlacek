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

## R6 — podpěra vedení u portálu tunelu

Klasifikace podpěry (`catenarySupport`) a kreslení závěsu v `TunnelView` sdílejí jednu hranici 60 u od portálu. Sloup na hranici a za ní má stožár na původním místě, sloup blíž portálu závěs ze stropu; nitro tunelu zůstává 64 u za portálem. Polohy podpěr, svět ani `TRACK_GENERATOR_VERSION` se nemění: otisk profilů, objektů, přejezdů, mostů, tunelů, druhých kolejí a podpěr je před a po změně shodný pro 5280 chunků (seedy 0–63, 123 a 4242, chunky −16 až 63; svět 123 má dál přejezd v chunku 3, tunel v chunku 6 a druhou kolej v bloku 1).

| Test                                                                                    | Red                                                          | Green |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----- |
| `R6: gives every support a mast or a drawn hanger in world 25, chunk 6`                 | `world 25 chunk 6 support 6912: expected false to be true`   | PASS  |
| `R6: gives every support a mast or a drawn hanger across many tunnel worlds` (64 světů) | `world 0 chunk -10 support -9984: expected false to be true` | PASS  |

Příkaz: `VITEST_MAX_WORKERS=4 volta run npm test -- src/render/TunnelView.test.ts`. Test kreslení leží u rendereru (`src/render/*.test.ts`), protože typy Phaseru zná jen rendererový TypeScript projekt; Vitest ho pouští v Node a nahrazuje jen kreslicí platformu ([vývojový návod](../development.md)). Dokumentace: dokument 03 §9, [D-016](../decisions/016-electric-locomotive-and-catenary.md), [D-018](../decisions/018-bridges-and-tunnels.md). Recenze lane: LAND.

## R8 — velikost bloku biomu je pevná

Validace konfigurace vyžaduje `world.chunksPerBiomeBlock === 8`, stejně jako u `blocksPerRouteCycle`; rozvržení slotů (přejezd, most, tunel, druhá kolej, přechod) s osmi chunky počítá.

| Test                                                          | Red                                                           | Green |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ----- |
| `R8: rejects a biome block with four chunks instead of eight` | `expected [] to deeply equal [ 'world.chunksPerBiomeBlock' ]` | PASS  |

Příkaz: `VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/config/gameConfig.test.ts` (red 1 FAIL / 16, green 16 PASS). Pevná velikost je zapsaná v dokumentu 13.

## R9 — konečný předstih geometrie

Validace vyžaduje konečné `world.geometryLookAheadU` nejméně 2048 u; `Infinity` by zacyklila `TrackWindow.ensureRange()` při startu i obnově cesty.

| Test                                          | Red                                                          | Green |
| --------------------------------------------- | ------------------------------------------------------------ | ----- |
| `R9: rejects an infinite geometry look-ahead` | `expected [] to deeply equal [ 'world.geometryLookAheadU' ]` | PASS  |

Příkaz: `VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/config/gameConfig.test.ts` (red 1 FAIL / 17, green 17 PASS). Mez je zapsaná v dokumentu 13.

## R7 — souběžná kolej i bez grafiky

Bez atlasu kreslí `ChunkView` souběžnou kolej a portálové kopce jednoduchými tvary na stejných místech jako s grafikou; na obou koncích je tmavé ústí pod protijedoucím vlakem a kopec nad ním. Náhradní siluety tak mizí po vozidlech v označeném portálu. Diagnostika `scenery.secondaryTrackViews` a `scenery.secondaryPortalViews` počítá, co se skutečně vykreslilo.

| Test                                                                                                      | Red                                                                                                                 | Green                               |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `PWA-10: without art the parallel track and portals frame the oncoming train` (svět 123, SVG zablokovaná) | `oncoming.spec.ts:129` — `expect(scenery.secondaryTrackViews).toBeGreaterThan(0)`, `Received: 0` (desktop i tablet) | `oncoming.spec.ts` 4 PASS (1,3 min) |

Red proti produkčnímu buildu před opravou, jen s testem a diagnostikou: `flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- tests/e2e/oncoming.spec.ts tests/e2e/backdrop-reset.spec.ts --grep 'PWA-10|R10:' --workers 2` (4 FAIL). Související E2E (`oncoming`, `landscape`, `art`, `game`): 90 PASS, 4 skipped (vícedotykové testy v desktopovém projektu). Dokumentace: [D-011](../decisions/011-vector-vehicle-art-and-atlas.md) §6, [D-013](../decisions/013-landscape-localities-and-backdrops.md) (diagnostika), [D-017](../decisions/017-second-track-and-oncoming-train.md), [vývojový návod](../development.md). Snímek: kolej a portál bez grafiky (`secondaryTrackViews: 2`, `secondaryPortalViews: 1`). Recenze lane: LAND.

## R10 — pozadí se s novou cestou vrátí na začátek

`Backdrop` má reset stavu jízdy (vrstvy, prolínání, biom), který volá `RideScene.#reset()`. Druhá cesta tak hned v prvním snímku ukáže svůj biom bez staré vrstvy a bez prolínání. Diagnostika `backdrop` hlásí `currentBiome`, `incomingBiome` a průběh prolínání `fade`.

| Test                                                                                                    | Red                                                                                                                                                                | Green                     |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `R10: the first frame of a second journey shows its biome without crossfade` (`backdrop-reset.spec.ts`) | `backdrop-reset.spec.ts:75` — první snímek `currentBiome: "forest"`, `incomingBiome: "countryside"`, `fade: 0` místo `countryside`, bez příchozí vrstvy, `fade: 1` | 2 PASS (desktop i tablet) |

Příkaz: `flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- tests/e2e/backdrop-reset.spec.ts --workers 2`. Dokumentace: [D-013](../decisions/013-landscape-localities-and-backdrops.md), [vývojový návod](../development.md). Recenze lane: LAND.
