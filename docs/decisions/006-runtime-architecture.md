# D-006: Architektura běhu verze 0.1

Datum: 2026-10-09. Stav: přijato.

Dokument 08 požaduje jeden router vstupů, jednu simulační smyčku, jasný pořádek automatů a doménu bez platformy. Verze 0.1 to řeší takto:

- **GameSession** (`src/app/GameSession.ts`) je jediný koordinátor obrazovek, vstupu, depa, jízdy a ukládání. Nemá DOM ani Phaser, takže integrační testy v Node řídí skutečný router, reducer, stavový automat, simulaci a repozitář.
- **InputRouter** (`src/platform/InputRouter.ts`) je jediný vlastník vstupu a nepotřebuje DOM typy. Jediný DOM adaptér (`DomInputAdapter`) mu předává Pointer Events, klávesy, fokus, viditelnost a změny rozměru. Tlačítka mají jen `data-action`; aktivace jde vždy přes router. Phaser vstup je vypnutý ([D-004](004-renderer-and-phaser.md)).
- **Jedna smyčka:** snímek Phaseru volá `AppController` → `GameSession.frame`, které počítá fixní kroky (`FixedStep`). Každý krok: intent z routeru → `RideSimulation.step` (pohyb, streaming trati pro celou soupravu, cooldowny, tick). Renderer jen čte stav a interpoluje polohu hlavy.
- **Renderer:** pozice jsou relativní ke kotvě po 4096 u, aby GPU nedostávalo obří souřadnice. Chunky trati a objekty existují jen v renderovacím okně; vozidla se kreslí jen na obrazovce. Geometrie existuje pro celou soupravu nezávisle na cullingu.
- **Diagnostika:** `?debug=1` zobrazí přehled a zpřístupní `window.__vlacek.snapshot()` pro E2E testy a ruční měření. Bez parametru neexistuje.
- **Ukládání:** `SaveRepository` v `localStorage` s primárním a záložním klíčem. Checkpoint každých 5 s jízdy, při pauze, přerušení, Vyjet a 250 ms po editaci.

Důsledky: nové funkce (M2+) přidávají kroky do `RideSimulation` a stavy do `GameSession`, ne nové posluchače událostí. Opuštění hry (`AppController.dispose`) uvolní adaptér, Phaser, audio i UI. Rebase lokálních souřadnic simulace (TRN-09) zatím neexistuje: `s` je float64 relativní ke kotvě cesty a obnova jede přes `TrackCursor`. Rebase přidá M2 spolu s generátorem V1.
