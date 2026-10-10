# Stav a další kroky

Stav k 2026-10-10. Rozsah a brány milníků vlastní [implementační plán](../vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md) a úpravy po první verzi [dokument 14](../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md). Tento soubor jen shrnuje, co je hotové, co zbývá a v jakém pořadí. Ověření jednotlivých kroků je v [protokolu v0.1](validation/2026-10-09-v0.1.md) a v [protokolu iterace podle dokumentu 14](validation/2026-10-10-iterace-upravy.md).

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

## Další kroky v pořadí

Cíl je celý katalog dokumentu 06 §2–3: 10 lokomotiv a 32 druhů vagonků. Dnes jsou 4 lokomotivy a 7 druhů vagonků. Všechna vozidla dostanou detailní vektorovou grafiku ve stylu současných vozidel. Světlo svítí zleva shora, vozidla nemají obličeje ani loga a nejsou převzatá z dětských pořadů. Katalog pojede ve stejném PR jako grafika, tedy v PR #2. Když už bude sloučený, pojede v novém PR z `master`. Každý krok jde přes red → green a má dokumentaci ve stejném commitu.

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
- **WebGL dávky s jednou texturou** obcházejí chybu Phaseru 4.2.1 ([D-010](decisions/010-webgl-single-texture-batches.md)).
- **Fyzický tablet, telefon a Tesla:** NEOVĚŘENO ([matice zařízení](device-tests/v0.1.md)).
