# Stav a další kroky

Stav k 2026-10-11. Rozsah a brány milníků vlastní [implementační plán](../vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md) a úpravy po první verzi [dokument 14](../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md). Tento soubor jen shrnuje, co je hotové, co zbývá a v jakém pořadí. Ověření jednotlivých kroků je v [protokolu v0.1](validation/2026-10-09-v0.1.md) a v [protokolu iterace podle dokumentu 14](validation/2026-10-10-iterace-upravy.md).

## Hotovo

| Milník (dokument 10)            | Stav     | Co funguje                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 a M1                         | hotovo   | Verze 0.1: dotykové řízení, dojezd, brzda, depo, pauza, ukládání a obnova ([D-006](decisions/006-runtime-architecture.md)).                                                                                                                                                                                                                                         |
| M2 — nekonečná trať a prostředí | většinou | Generátor v1 ([D-009](decisions/009-track-generator-v1.md)), šest biomů s přechody ([D-013](decisions/013-landscape-localities-and-backdrops.md)), most a tunel s průjezdem po vozidlech ([D-018](decisions/018-bridges-and-tunnels.md)), elektrifikace celé trasy ([D-016](decisions/016-electric-locomotive-and-catenary.md)). Chybí den, noc a počasí.           |
| M3 — živý svět a interakce      | částečně | Přejezdy s automatem a provozem ([D-015](decisions/015-level-crossings.md)), nádraží bez povinného zastavení, druhá kolej s protijedoucím vlakem ([D-017](decisions/017-second-track-and-oncoming-train.md)), zvířata s reakcí na dotyk. Chybí scénky dokumentu 05 a reakce aut a kol na dotyk.                                                                     |
| M4 — obsah a výtvarný základ    | částečně | Detailní vektorová grafika všech současných vozidel ([D-011](decisions/011-vector-vehicle-art-and-atlas.md)), kolej a terén ([D-012](decisions/012-track-tiles-and-terrain.md)), krajina z 18 lokalit, částice a drobné animace ([D-014](decisions/014-particles-and-small-animations.md)). Katalog má 4 z 10 lokomotiv a 7 z 32 druhů vagonků, zvuky jsou dočasné. |
| M5 — PWA a vydání V1            | nezačato | Hra běží jako online web na GitHub Pages ([D-002](decisions/002-github-pages.md)).                                                                                                                                                                                                                                                                                  |

Dokument 14 je splněný v §1–7: pořadí soupravy, celý vlak v obraze s délkovým limitem ([D-008](decisions/008-whole-train-in-view.md)), detailní grafika, částice, bohatší krajina s přejezdy, druhou kolejí, mosty a tunely, svižnější jízda a snímky ze skutečné aplikace.

## Rozhodnutí, která čekají na vlastníka

- **Číslo světa u příliš dlouhé jízdy z 0.1.** Taková jízda nemůže pokračovat; hráč vlak zkrátí v depu a vyjede v novém světě, stejně jako po každé úpravě vlaku. Codex navrhl staré číslo zachovat. Zatím beze změny, rozhodnutí je ve vlákně PR #2.

Rozhodnuto 2026-10-11: PR #2 už nedostane další kód. Nálezy recenze, které zbývají, jsou naplánované níže jako R1–R4 a přijdou v samostatných PR po sloučení.

## Další kroky v pořadí

Cíl je celý katalog dokumentu 06 §2–3: 10 lokomotiv a 32 druhů vagonků. Dnes jsou 4 lokomotivy a 7 druhů vagonků. Všechna vozidla dostanou detailní vektorovou grafiku ve stylu současných vozidel. Světlo svítí zleva shora, vozidla nemají obličeje ani loga a nejsou převzatá z dětských pořadů. Katalog pojede v novém PR z `master` po sloučení PR #2, který už další kód nedostane. Každý krok jde přes red → green a má dokumentaci ve stejném commitu.

### H0 — atlas pro jednu jízdu a sada protijedoucích vlaků (D-019)

Podmínka z [D-011](decisions/011-vector-vehicle-art-and-atlas.md): celý katalog se do jednoho atlasu při 2,5 px/u nevejde. Dnes navíc protijedoucí vlak bere vagonky z celého katalogu (`GameSession` → `npcFleet.wagons = catalog.wagons`).

- **Doména:** čistá funkce `npcFleetFor(seed, catalog)` u `src/domain/interaction/OncomingTrain.ts`.
  - Seedem (klíč `npc-fleet`) vybere sadu jízdy: 2 parní nebo naftové lokomotivy a 6 druhů vagonků.
  - `GameSession.#createRide` ji předá místo celého katalogu. `OncomingTrain` dál volí pro každé místo z této sady.
  - Unit testy (nejdřív red): stabilita pro stejný seed, jen parní a naftový pohon, velikost sady, žádná elektrická.
- **Vykreslování:** `journeyArtKeys(vehicles, fleet)` v `src/render/atlasPacking.ts` vrátí díly vozidel jízdy a sady protijedoucích vlaků.
  - `RideScene` z nich a z dílů světa sestaví `ArtAtlas`. Při změně jízdy (výjezd z depa, obnova) ho přestaví.
  - Zdroje SVG se dál načtou jednou při startu, zhruba 1 MB. Ověří to `report:budgets`.
- **Test rozpočtu:** `atlasPacking` místo „všech vozidel“ zabalí nejhorší jízdu při `ART_MAX_PX_PER_U`, tedy 8 největších různých vozidel a největší sadu protijedoucích vlaků.
- **Depo** zůstává u SVG vrstev (`<image>`), beze změny.
- **E2E:** jízda s vozidly z různých skupin má `artVehicles === vehicles`. Po změně v depu a novém výjezdu má atlas nová vozidla.
- **Dokumentace:** D-019 (rozhodnutí, důsledky; kompatibilita: nic se neukládá). V D-011 se podmínka označí jako splněná.

### H1 — šest chybějících lokomotiv

Délky jsou z dokumentu 06 §2. Každá lokomotiva dostane:

- záznam v `src/content/vehicles.ts`;
- karoserii a překryv v `assets/vehicles/`;
- záznam v `src/content/artManifest.ts`;
- emitory částic;
- vlastní výšku houkání. Zvuky zůstávají dočasně syntetizované, ale každý typ zní jinak a velká parní má hlubší píšťalu.

| ID                        | Zvláštnosti                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `steam_express` 216 u     | Dlouhý kotel, velká spřažená hnací kola (nový díl `wheel-steam-driver-large`), rozvod přes `steamGear`, uhlí v zadní části, kouř |
| `diesel_shunter` 148 u    | Kapota, kabina a ochoz, sdílená naftová kola, emitor výfuku                                                                      |
| `electric_modern` 204 u   | Zaoblená čela, hladké boky; sdílí díly pantografu s `electric_retro` (manifest pak jmenuje sdílené klíče)                        |
| `electric_mountain` 160 u | Krátká robustní skříň, vlastní tvar kabiny, pantograf                                                                            |
| `magic_bubbles` 164 u     | Zaoblená karoserie; nový druh částic `bubble`                                                                                    |
| `magic_rainbow` 176 u     | Vlastní silueta, barevné díly; nový druh částic `rainbow-puff`                                                                   |

- **Výběr lokomotivy:** všech 10 se musí vejít a jít ťuknout. E2E telefonů 844 × 390, 667 × 375 a 568 × 320 se rozšíří i na výběr: poslední karta klikatelná, nic se nepřekrývá.
- **Testy:**
  - `validateVehicleArt` hlídá geometrii a vlastní kresbu;
  - test katalogu ověří tabulku lokomotiv dokumentu 06: ID, pohon, délky, `requiresCatenary`;
  - testy `TrainEffects` pokryjí nové emitory;
  - jízdy s novými elektrickými lokomotivami projdou E2E TRN-08 se sběračem na drátu.

### H2 — 25 chybějících druhů vagonků, ve čtyřech dávkách (commit na dávku)

1. Osobní: `passenger_double`, `passenger_sleeper`, `passenger_dining`, `passenger_panorama`.
2. Služební: `service_tools`, `service_snowplow` (pluh složený v obrysu vozu).
3. Nákladní: `cargo_logs`, `cargo_sand`, `cargo_gravel`, `cargo_tank`, `cargo_milk`, `cargo_grain`, `cargo_hay`, `cargo_apples`, `cargo_cars`, `cargo_tractor`, `cargo_excavator`, `cargo_mail`, `cargo_refrigerated`.
   - Náklad je pevně ukotvený (dokument 06 §4).
   - Žádná skutečná loga ani dopravci.
4. Hravé: `fun_stars`, `fun_garden`, `fun_aquarium`, `fun_windmill`, `fun_lights`, `fun_toyblocks`.

- **Data:** délky, skupiny a české názvy jsou z dokumentu 06 §3. Dvounápravový nebo podvozkový pojezd určuje manifest u každého vagonku.
- **Depo:** katalog si nechá čtyři skupiny. E2E telefonů ověří, že je dosažitelná i poslední z 32 karet.
- **Testy a kontroly:**
  - test katalogu ověří přesně 32 ID vagonků s délkami a skupinami dokumentu 06 a zmizí komentář „Temporary subset“;
  - `validate:assets --release` projde bez placeholderů;
  - E2E vyfotí kontaktní list všech 42 vozidel ze skutečné aplikace.

### H3 — bubliny a duha (dokument 06 §2)

- **Bubliny:** viditelné bubliny bublinkové mašinky jde prasknout dotykem.
  - Zásah hledá stávající `GameSession.setWorldHitTest`. Dotyk funguje souběžně s plynem, stejně jako reakce zvířat.
  - Prasknutí má malou částici a zvuk.
- **Duha:** duhová mašinka pouští měkké barevné obláčky.
- **Testy:** unit pro životnost bubliny a prasknutí; E2E: ťuknutí na bublinu ji odstraní a vlak jede dál.

### Postup a ověření pro H0–H3

- **TDD:** red a green se zapíšou do [protokolu iterace](validation/2026-10-10-iterace-upravy.md). U E2E se red pouští proti předchozímu buildu.
- **Dokumentace ve stejném commitu:** poznámky k implementaci ve specifikaci 06, README (katalog kompletní), řádky v `assets/SOURCES.md`, D-019.
- **Kompatibilita (dokument 08):** katalogová ID se jen přidávají. Staré savy obsahují existující ID, takže migrace není potřeba. Test s fixture ověří, že se starý save dál načte.
- **Brána:**
  - `npm run check` včetně `validate:assets` a jeho režimu `--release` bez placeholderů;
  - celé `npm run test:e2e`;
  - `report:budgets` (počáteční přenos do 10 MiB);
  - `PERF_SECONDS=30 npm run measure:perf` s nejdelší soupravou z největších vozidel, tedy `steam_express` a dlouhé vagonky. Skript na to dostane volbu `PERF_WAGON`.
- **Snímky ze skutečné aplikace:**
  - kontaktní list všech 42 vozidel;
  - výběr deseti lokomotiv;
  - depo se všemi skupinami;
  - jízda s každou novou lokomotivou;
  - prasknutí bubliny.
- **Fyzická zařízení:** NEOVĚŘENO, dokud je někdo neotestuje.

### Nálezy recenze odložené po sloučení PR #2 (R1–R10)

Codex je našel při recenzi PR #2 (`f5cde58` a dřív). Všechny jsou ověřené v kódu a podle vlastníka nepatří do PR #2. Každý půjde přes red → green jako samostatný PR z `master`: nejdřív malé opravy R1, R2 a R5–R10 (lze je spojit do jednoho PR), potom R3 jako jeden PR s migrací a R4 samostatně.

Generátor v1 i veškerý obsah světa zatím existují jen v PR #2 (`master` má generátor 0). Po sloučení se v1 vydá, takže každá oprava, která mění svět v1 (R3), už potřebuje generátor v2 a migraci uložených cest.

R1, R2 a R5–R10 opravuje jeden PR (větev `codex/review-fixes`), commit na nález; red a green jsou v [protokolu oprav recenze](validation/2026-10-11-opravy-recenze.md). R3 a R4 zůstávají otevřené.

#### R1 — novější save se pozná dřív, než se ověří jeho obsah

- **Problém:** `parseSave` (`src/platform/SaveValidation.ts`) porovná `journey.generatorVersion` s verzí buildu až po ověření `lastConsist`, `builderDraft` a cesty proti současnému katalogu. Save z novějšího buildu s novou lokomotivou nebo vagonkem tak skončí jako `invalid`, ne `newer`. `SaveRepository` pak může obnovit starší zálohu a příští uložení novější primární save přepíše (AGENTS.md: neznámou novější verzi nepřepisuj).
- **Oprava:** před ověřením polí, která závisí na katalogu, se přečtou surové údaje. `newer` vrátí `schemaVersion` nad 1, `contentVersion` nad podporovanou (dokument 08: změna obsahu mapuje ID) i `journey.generatorVersion` nad verzí buildu.
- **Test:** fixture se schématem 1, generátorem 2 a neznámou lokomotivou dá `newer`. `SaveRepository` nechá primární save beze změny i při platné záloze a oznámí `newer-save-kept`.
- **Dokumentace:** poznámka v dokumentu 08 a v [D-009](decisions/009-track-generator-v1.md), řádek v README fixtures.
- **Stav:** hotovo. Verze se kontrolují před katalogovými ID; při každém dalším ukládání se primární save znovu přečte. Novější save, který mezitím zapsala jiná karta, přepne relaci do `memory-only` dřív, než se cokoli zapíše; primár i platná záloha zůstanou beze změny.

#### R2 — konečná nejvyšší rychlost protijedoucího vlaku

- **Problém:** kontrola `interaction.npcTrainSpeedUPerSec` v `src/config/gameConfig.ts` ověří konečnost jen u minima. S maximem `Infinity` projde, protijedoucí vlak pak skočí na `headS = -Infinity` a `SecondaryLine.sample()` vyhodí výjimku v aktualizaci jízdy.
- **Oprava:** minimum i maximum musí být konečná kladná čísla a minimum nejvýš maximum.
- **Test:** unit test validace s `Infinity` (červený před opravou).
- **Stav:** hotovo. Obě meze jsou konečná kladná čísla a minimum nejvýš maximum; maximum `Infinity` validace odmítne (dokument 13).

#### R3 — generátor v2: dvě opravy světa v jedné změně kompatibility

- **a) První blok má vždy přejezd.**
  - Problém: `crossingSite` (`src/domain/world/Crossings.ts`) vyřadí každé místo blíž než 120 u ke zvířeti chunku. Když zvíře stojí uprostřed jediné rovné části, přejezd v chunku 3 chybí. Ve světě 1226 a v 16 z 20 000 světů (Codex: 71 ze 100 000).
  - Oprava: nejdřív se rezervuje přejezd, zvíře se mu vyhne (posune se v chunku, nebo se vynechá). Vlastníci: `Crossings.ts`, umístění zvířete v `ChunkObjects.ts` a `Scenery.ts`.
  - Test: průchod mnoha seedy, regresní seed 1226.
- **b) Nádraží ve slotu 1 prvního bloku (dokument 04).**
  - Problém: nádraží dnes stojí ve slotu 1 nebo 2 jen tam, kde trať v1 má rovinu aspoň 448 u. V 1056 z 2000 světů (Codex: asi 55 % ze 100 000) první blok nádraží nemá.
  - Oprava: `blockPlan` (`src/domain/world/TrackProfile.ts`) dá prvnímu bloku ve slotu 1 rovinu aspoň 448 u.
  - Test: průchod seedy, všude `stationSlot(seed, 0) === 1`.
- **c) Kompatibilita:**
  - `TRACK_GENERATOR_VERSION` 2;
  - cesta v1 se migruje jako v0: vlak a číslo světa zůstanou, hráč dostane upozornění a vyjede na novou cestu ze startu;
  - fixture uloženého v1 a test migrace;
  - nové rozhodnutí D-0xx a poznámka v [D-009](decisions/009-track-generator-v1.md);
  - volitelně (rozhodne D-0xx) oddělit klíče náhodnosti od čísla verze (dnes 36 míst), aby se svět mimo první blok nezměnil.
- **d) E2E:** znovu ověřit pozice, na které testy spoléhají: svět 123 (přejezd v chunku 3, tunel v chunku 6, druhá kolej v bloku 1) a svět 7.

#### R4 — adaptivní kvalita `auto`

- **Problém:** dokument 08 chce, aby `auto` začínala konzervativně a při dlouhodobém zpomalení omezila dekorativní částice, hustotu pozadí a rozlišení. Dnes `renderProfile` (`src/app/renderProfile.ts`) bere `auto` jako `standard` a nic ji za běhu nemění. Ruční volba `low` zatím nemá v UI ovládání.
- **Oprava:**
  - čistý řadič `AutoQuality` v `src/app/` krmený z `FrameStats`;
  - začne konzervativně, po dlouhodobě pomalých snímcích sníží úroveň a s hysterezí ji zase zvýší;
  - za běhu přepíná strop dekorativních částic, hustotu pozadí a hustotu vykreslování (`GameHost` dostane setter hustoty přes stávající cestu změny velikosti), případně i limit snímků, pokud ho Phaser 4.2.1 dovolí měnit za běhu;
  - nikdy se nedotkne brzdění, přejezdů ani soupravy.
- **Test:** unit testy se syntetickými časy snímků; E2E při zpomaleném CPU ukáže snížení úrovně.
- **Mez:** prahy zůstanou NEOVĚŘENO, dokud se nezměří na skutečných zařízeních.
- **Dokumentace:** nové rozhodnutí a úprava [D-014](decisions/014-particles-and-small-animations.md).

#### R5 — přejezd za koncem vlaku se nevytváří znovu

- **Problém:** `#updateCrossings` (`src/domain/ride/RideSimulation.ts`) prochází chunky od `behindX`. Když vlak stojí kousek za přejezdem, ale `behindX` je pořád v jeho chunku, vytvoří se v každém ticku nový `LevelCrossing` a hned se smaže. Při 60 Hz je to zbytečná alokace a riziko zadrhávání GC na slabém zařízení.
- **Oprava:** přeskočit místa, jejichž `crossingWorldX` je už za `behindX`, ještě před vytvořením automatu.
- **Test:** unit test zastaví vlak za přejezdem a ověří, že se instance automatu mezi ticky nemění a nevzniká nová.

#### R6 — podpěra vedení u portálu tunelu

- **Problém:** `catenarySupport` (`src/domain/world/Catenary.ts`) označí sloup do 72 u od portálu jako závěs ze stropu, takže stožár zmizí. `TunnelView` ale kreslí závěsy jen uvnitř zapečeného nitra (64 u za portálem, zkrácené o 4 u). Sloup 64–72 u za portálem nemá stožár ani závěs a drát se lomí ve vzduchu (například svět 25, chunk 6).
- **Oprava:** jedna společná hranice pro obojí: buď závěs kreslit až do hranice klasifikace, nebo sloupu mimo nitro vrátit stožár.
- **Test:** unit průchod tunely mnoha světů: každý sloup má buď stožár, nebo kreslený závěs; regresní svět 25.

#### R7 — souběžná kolej i bez grafiky

- **Problém:** bez atlasu `ChunkView` skončí v `#addPlainInfrastructure` dřív, než zavolá `chunkSecondaryTrack`. Protijedoucí vlak se kreslí jako silueta (oprava `d90534b`), ale jede bez kolejí a bez portálových kopců a mizí na neoznačené hranici.
- **Oprava:** jednoduchá souběžná kolej a portálové kopce v náhradním kreslení, na stejných místech jako s grafikou.
- **Test:** E2E PWA-10 s nenačteným SVG u druhé koleje světa 123: kolej je vidět (nová diagnostika) a vlak mizí v portálu.

#### R8 — velikost bloku biomu je pevná

- **Problém:** validace přijme jakékoli kladné `world.chunksPerBiomeBlock`, ale rozvržení slotů (přejezd ve slotu 3, most 4, tunel 6, druhá kolej 4–6, přechod 7) počítá s osmi chunky. Při hodnotě 4 by simulace pustila protijedoucí vlak tam, kde se koleje nekreslí.
- **Oprava:** validace vyžaduje 8, stejně jako u `blocksPerRouteCycle`. Odvození slotů z konfigurace se odkládá, dokud pro něj nebude konkrétní důvod.
- **Test:** unit test validace s hodnotou 4.

#### R9 — konečný předstih geometrie

- **Problém:** validace `world.geometryLookAheadU` (`src/config/gameConfig.ts`) hlídá jen dolní mez 2048, takže `Infinity` projde. `RideSimulation.#streamTrack()` pak předá `TrackWindow.ensureRange()` nekonečnou mez a smyčka `while (endS < toS)` neskončí: start i obnova cesty zamrznou.
- **Oprava:** hodnota musí být konečná a aspoň 2048.
- **Test:** unit test validace s `Infinity`.

#### R10 — pozadí se s novou cestou vrátí na začátek

- **Problém:** `RideScene.#reset()` vyčistí chunky, částice i ticky, ale ne stav `Backdrop` (vrstvy, prolínání, biom). Když nová cesta začíná v jiném biomu, první snímek ukáže pozadí staré cesty a 1,2 s se prolíná.
- **Oprava:** `Backdrop` dostane reset stavu jízdy, který zavolá `RideScene.#reset()`.
- **Test:** E2E druhé cesty, jejíž první biom se liší: hned první snímek ukáže nový biom bez prolínání.

### Potom (M3–M5)

- scénky dokumentu 05;
- varianty infrastruktury dokumentu 06 §5 (ocelový most, viadukt, skalní tunel, další nádraží);
- chybějící zvířata dokumentu 06 §6 (datel, ryba, sova);
- porovnání 18 lokalit se sestavami dokumentu 06 §7;
- den, noc a počasí;
- finální zvuky;
- PWA a offline (M5);
- test na skutečných zařízeních.

Volitelné místní reakce vagonků (dokument 06 §3) zůstávají mimo tento plán, dokud je vlastník nevyžádá.

## Známá omezení

Každé omezení má podmínku odstranění v uvedeném rozhodnutí.

- **Zvuky** jsou syntetizované tóny. Zvonění přejezdu i zvuk lokomotivy v tunelu přijdou s finálními zvuky ([D-015](decisions/015-level-crossings.md), [D-018](decisions/018-bridges-and-tunnels.md)).
- **Světla lokomotiv** chybí. Přijdou se dnem a nocí ([D-017](decisions/017-second-track-and-oncoming-train.md), [D-018](decisions/018-bridges-and-tunnels.md)).
- **Souběžná kolej** zatím nemá vedení a protijedoucí vlak je parní nebo naftový. Doplní se s další elektrickou lokomotivou ([D-016](decisions/016-electric-locomotive-and-catenary.md), [D-017](decisions/017-second-track-and-oncoming-train.md)).
- **Portálové podpěry vedení ve stanici** chybí. Přijdou s vícekolejnými nádražími ([D-016](decisions/016-electric-locomotive-and-catenary.md)).
- **Zem se kreslí nejvýše 1 px/u.** Zvýší se, pokud test zařízení ukáže rušivou neostrost ([D-013](decisions/013-landscape-localities-and-backdrops.md)).
- **Kvalita `auto`** je zatím totéž co `standard`. Odstraní ji R4.
- **Přejezd a nádraží prvního bloku** nejsou zaručené (přejezd chybí v 0,08 % světů, nádraží v 53 %). Odstraní je R3.
- **WebGL dávky s jednou texturou** obcházejí chybu Phaseru 4.2.1 ([D-010](decisions/010-webgl-single-texture-batches.md)).
- **Fyzický tablet, telefon a Tesla:** NEOVĚŘENO ([matice zařízení](device-tests/v0.1.md)).
