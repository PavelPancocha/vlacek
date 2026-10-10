# D-015: Přejezdy se skutečným automatem, silnicí a provozem

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §5 chce přejezdy s blikající výstrahou a závorami, které zůstanou zavřené, dokud neprojede poslední vagon. Dokument 05 §4 k tomu dává pravidla:

- závory jsou skutečný stavový automat, ne dekorace;
- obsazení počítá celý interval soupravy `[tailS, frontS]`;
- předstih Dclose se odvozuje z nejvyšší rychlosti;
- silniční provoz s frontou nejvýš šesti aut a dvou kol;
- invariant: vlak a silniční aktér nikdy nejsou v konfliktní zóně zároveň;
- obnova se zavřeným přejezdem před prvním snímkem.

Dokument 04 §6 přejezdu dává slot 3 bloku biomu.

## Rozhodnutí

1. **Umístění** (`src/domain/world/Crossings.ts`). `crossingSite(seed, k)` vybere přejezd jen ve slotu 3 bloku.
   - Silnice potřebuje rovnou kolej: stálý sklon aspoň 96 u na obě strany.
   - Od interaktivního zvířete zůstává aspoň 120 u.
   - Z vhodných míst vybírá seed. ID je `g1:chunk:k:crossing:0`.
   - Výpočet potřebuje jen seed a index chunku, takže simulace o přejezdu ví dřív, než se načte jeho kolej.
   - `chunkScenery` si rezervuje pruh silnice ±64 u: voda se kolem něj rozdělí a rekvizity ani jejich trasy do něj nezasahují.
2. **Automat** (`src/domain/interaction/LevelCrossing.ts`). Fáze `OPEN`, `CLEARING`, `WARNING`, `CLOSING`, `CLOSED` a `OPENING` jdou podle tabulky dokumentu 05 §4.
   - Konfliktní zóna podél koleje je ±30 u, tedy polovina šířky silnice, s rezervou obsazení 32 u.
   - Dclose se měří od okraje rozšířené zóny. Při 480 u/s vychází `480 × (2 + 1,2 + 0,8 + 0,5) + 80 = 2 240 u`; 890 u v dokumentu 05 platí pro starých 180 u/s.
   - Když se při otevírání blíží vlak, závory se vrátí do zavírání a silnice dál čeká.
   - `RideSimulation` drží přejezdy od 1 024 u za koncem vlaku po Dclose + 512 u před čelem a krokuje je v každém pevném kroku simulace, nezávisle na kameře.
   - Přejezd pod vlakem nebo v jeho předstihu vznikne rovnou zavřený, i po obnově ze save.
3. **Silniční provoz.**
   - Silnice má dva pruhy: auta (70 u/s, 26 u) a kola (56 u/s, 14 u).
   - Aktéři přijíždějí podle seedu každé 3–8 s, střídavě z obou stran.
   - Každá strana má frontu s rozestupem 8 u a stropem z dokumentu 13.
   - Stop čára je za tratí 40 u od koleje. Před tratí je 56 u od koleje, u paty náspu: tam musí stát nízké zařízení, aby nezakrylo vlak.
   - `worstClearingSeconds()` vrací nejdelší dobu, za kterou aktér za stop čárou opustí zónu, i za nejpomalejším aktérem: `(56 + 30 + 26) / 56 = 2,0 s`. Test hlídá, že nepřekročí `crossing.roadClearanceSeconds`. Proto mají kola 56 u/s místo původních 46.
4. **Kresba.**
   - **Silnice** je zapečená do země chunku: za tratí stoupá k obzoru a zužuje se, před tratí se dolů rozšiřuje. Má asfalt na štěrkové krajnici, postranní čáry, přerušovanou osu a stop čáry; pod pásy louky pokračuje obdélníky. Přes kolej vedou betonové panely `crossing.deck` v kontejneru koleje.
   - **`CrossingView`** (vlastní ho `ChunkView` a ruší se s ním) jen čte stav přejezdu. Rozměry počítá čistý modul `crossingLayout.ts`, body světel a kloubů jsou v `crossingPostAnchors`.
     - Za tratí stojí vlevo od silnice vysoký výstražník.
     - Před tratí stojí vpravo nízký. Rozměry jsou spočítané tak, aby i se zvednutým břevnem zůstal pod vlakem.
     - Břevna (38 u) zavírají vždy pravý pruh přijíždějících, jako polovinové závory.
     - Dvě červená světla se střídají po půl sekundě, dokud přejezd varuje. Bílé pomalu bliká, když je volno. Blikání běží v simulačním čase.
     - Auta a kola se kreslí zepředu nebo zezadu podle směru, se zmenšením podle hloubky. Na koncích silnice se plynule objeví a zmizí.
5. **Diagnostika.** Snímek `?debug=1` hlásí `crossings`: fázi, závory, obsazení vlakem, počet aktérů, čekajících a projetých.

## Důsledky

- Dclose je delší než výhled před vlakem. Přejezd před jedoucím vlakem je proto vždy už zavřený, dítě vidí čekající auta a blikající světla. Otevírání a odjezd fronty uvidí za vlakem.
- Přejezd je v každém bloku, kde je vhodná rovná kolej, tedy zhruba jednou za osm chunků.
- E2E ověřuje:
  - Před příjezdem vlaku jsou závory dole a nahoru jdou až za posledním vagonem.
  - Ve stání vlaku na přejezdu čekají auta. Po odjezdu přejedou.
  - Nic z přejezdu před tratí vlak nezakrývá.

## Kompatibilita

- Save, trať ani verze generátoru (`TRACK_GENERATOR_VERSION` 1) se nemění. Stav přejezdů se neukládá. Dokument 04 §9 ho po obnově odvozuje z obsazení tratě.
- U stejného seedu ubyly rekvizity v pruhu silnice a voda se kolem ní rozdělila. Krajina se neukládá, takže rozehraná cesta jen jinak vypadá.

## Dočasná omezení a podmínky odstranění

- **Protijedoucí vlak** ([D-017](017-second-track-and-oncoming-train.md)) přejezdem neprojíždí. Druhá kolej vede ve slotech 4–6 a přejezd ve slotu 3 se drží mimo její portálový kopec. Až souběh povede přes přejezd, přidá se jeho souprava do obsazení podle dokumentu 05 §4.
- **Výstražné zvonění** zatím chybí; hra má jen dočasné syntetizované zvuky. Přidá se s finálními zvuky.
- **Dotyk na auto nebo kolo** (zamávání, klakson) zatím nic nedělá. Přijde se scénkami dokumentu 05 §5 a nesmí aktéra zastavit v zóně.
- **Fyzická zařízení:** NEOVĚŘENO.
