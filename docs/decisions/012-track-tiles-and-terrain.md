# D-012: Kolej z dlaždic podél profilu a seedovaný násep

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §3 chce čitelnou kolej s detaily a §6 terén kolem tratě členitější než kolejové těleso. Dokument 07 §3 určuje vrstvy:

- 5: terén u trati;
- 6: hráčova kolej s pražci;
- 7: vlak.

Do té doby se kolej kreslila jako hnědé obdélníky a čára v `Graphics` a zem jako jeden zelený mnohoúhelník.

**Rozhodnutí.**

1. **Kolej z dlaždic.** Kolej tvoří vektorové dlaždice 66 × 24 u ve třech variantách v `assets/world/`, ve stejném atlasu jako vozidla ([D-011](011-vector-vehicle-art-and-atlas.md)).
   - Obsah dlaždice: kolejnice s lesklou hlavou, upevnění, konce dřevěných pražců po 16 u, štěrkové lože a travnatý okraj.
   - `trackTilePlacements` je pokládá od začátku chunku po 64 u v ose x. Každou otočí podle tětivy k začátku další dlaždice; 2 u přesahu zakryjí spoj.
   - Odchylka tětivy od oblouku je při sklonech do 0,08 a přechodech 192 u ([D-009](009-track-generator-v1.md)) pod 0,2 u.
   - Pivot dlaždice je horní hrana kolejnice, tedy přesně čára, na které stojí kola.
2. **Terén.** `embankmentU(seed, x)` v `src/domain/world/Terrain.ts` je výška kolejového tělesa nad loukou: hodnotový šum s uzly po `world.terrain.latticeU` (512 u) do `maxEmbankmentU` (40 u), prolnutý smoothstepem.
   - Je spojitý se spojitým sklonem a počítá se jen z x.
   - Klíč obsahuje verzi generátoru.
   - Pod dlaždicemi je svah náspu a pod ním louka v sedmi pásech, které k divákovi tmavnou.
3. **Vlastník.** `ChunkView` vlastní zem i dlaždice jednoho chunku a uvolní je spolu. Po překreslení atlasu se chunky postaví znovu z nového atlasu dřív, než se stará textura odstraní.
4. **Výkon.** Phaser trianguluje cesty `Graphics` v každém snímku. Obrysy země proto berou každý čtvrtý vzorek tratě (32 u); dlaždice přesahují horní hranu svahu víc, než je chyba tětivy.
   - Měření s nejdelší soupravou: obrysy po 8 u dávaly medián 15 FPS, po 32 u 20 FPS, jako před touto změnou.
   - Dlaždice samy cenu nezvyšovaly.
5. **Fallback.** Bez atlasu (PWA-10) se kreslí jednoduchá kolejnice a pražce.

**Důsledky.**

- `src/content/worldArt.ts` je manifest světových dílů. `validate:assets` kontroluje soubory, rozměry, použití dílů a překryv dlaždic.
- Interaktivní objekty stojí na louce pod náspem.
- E2E test švů na Canvasu nově hledá jednopixelový sloupec odlišný od dvou shodných sousedů, nezávisle na barvě země. S nulovým přesahem chunků selže, s přesahem 4 u projde.

**Kompatibilita.** Geometrie koleje, generátor tratě a save se nemění. Násep je dekorace odvozená ze seedu, neukládá se a polohy interaktivních objektů na trati zůstávají stejné.
