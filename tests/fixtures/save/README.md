# Fixtury uložené hry

Malé vzorky formátu `SaveEnvelopeV1` z [dokumentu 08 §6](../../../vlacek-predavaci-balicek/08_ARCHITEKTURA_A_DATA.md). Testy v `tests/unit/platform/Save*.test.ts` z nich ověřují validaci a obnovu.

| Soubor               | Obsah                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `v1-journey.json`    | Rozehraná cesta generátoru v0, dva vagonky, kurzor uvnitř chunku 7. |
| `v1-no-journey.json` | Jen nastavení, poslední sestava a rozpracovaný draft.               |
| `v1-truncated.txt`   | Uříznutý zápis (poškozený JSON).                                    |
| `v99-future.json`    | Save neznámé vyšší verze, který se nesmí přepsat.                   |

Po vydání verze 0.1 se tyto soubory nemění, pouze se přidávají nové. Změna formátu znamená novou `schemaVersion`, migraci a test, který nahrává tyto staré fixtury (dokument 08 §7, DATA-05).
