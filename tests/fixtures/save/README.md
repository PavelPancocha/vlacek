# Fixtury uložené hry

Malé vzorky formátu `SaveEnvelopeV1` z [dokumentu 08 §6](../../../vlacek-predavaci-balicek/08_ARCHITEKTURA_A_DATA.md). Testy v `tests/unit/platform/Save*.test.ts` z nich ověřují validaci a obnovu.

| Soubor                     | Obsah                                                                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1-journey.json`          | Rozehraná cesta generátoru v0, dva vagonky, kurzor uvnitř chunku 7.                                                                                                                                              |
| `v1-no-journey.json`       | Jen nastavení, poslední sestava a rozpracovaný draft.                                                                                                                                                            |
| `v1-truncated.txt`         | Uříznutý zápis (poškozený JSON).                                                                                                                                                                                 |
| `v99-future.json`          | Save neznámé vyšší verze, který se nesmí přepsat.                                                                                                                                                                |
| `v1-future-generator.json` | Cesta z novější verze generátoru (99), která se nesmí přepsat.                                                                                                                                                   |
| `v1-catalog-0.1.json`      | Save sestavení `0.1.0+2563ef4` (generátor v1) se všemi 11 vozidly katalogu 0.1; po doplnění katalogu V1 se načte beze změny.                                                                                     |
| `v1-future-catalog.json`   | Schéma 1, generátor 2 a lokomotiva, kterou tento build nezná: historický test čtečky v1: novější generátor se pozná před katalogem (R1). Pro současnou čtečku v2 už generátor 2 není novější; fixture se nemění. |

Po vydání verze 0.1 se tyto soubory nemění, pouze se přidávají nové. Změna formátu znamená novou `schemaVersion`, migraci a test, který nahrává tyto staré fixtury (dokument 08 §7, DATA-05).

Přidané fixtury pro generátor v2 ([D-023](../../../docs/decisions/023-world-generator-v2.md)):

- `released-v1-journey.json`: vydaná v1, seed 3141592653 a kurzor v chunku 7; restart do v2 zachová vlak/seed a vyžaduje upozornění `track-changed`.
- `v1-generator-3.json`: schéma 1, budoucí generátor 3 a neznámý katalog; současný build v2 jej musí chránit před katalogovou validací i při platné záloze/souběžné kartě.

Existující fixtury zůstávají byte-for-byte beze změny. Testy odlišují historický a současný význam `v1-future-catalog.json` explicitními pravidly čteček.
