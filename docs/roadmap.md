# Stav a další kroky

Stav k 2026-10-16. Rozsah a brány milníků vlastní [implementační plán](../vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md) a úpravy po první verzi [dokument 14](../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md). Tento soubor jen shrnuje, co je hotové, co zbývá a v jakém pořadí. Ověření jednotlivých kroků je v [protokolu v0.1](validation/2026-10-09-v0.1.md) a v [protokolu iterace podle dokumentu 14](validation/2026-10-10-iterace-upravy.md).

## Hotovo

| Milník (dokument 10)            | Stav     | Co funguje                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 a M1                         | hotovo   | Verze 0.1: dotykové řízení, dojezd, brzda, depo, pauza, ukládání a obnova ([D-006](decisions/006-runtime-architecture.md)).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| M2 — nekonečná trať a prostředí | většinou | Generátor v2 s regiony ([D-023](decisions/023-world-generator-v2.md)), dlouhé skalní tunely, viadukty a ocelové mosty ([D-026](decisions/026-long-tunnels-and-bridges.md)), voda, hory a Moravská Sahara ([D-025](decisions/025-farm-forest-content.md)), sezóny a počasí ([D-027](decisions/027-seasons-and-life.md)), elektrifikace celé trasy ([D-016](decisions/016-electric-locomotive-and-catenary.md)). Chybí den a noc.                                                                                                                                                    |
| M3 — živý svět a interakce      | částečně | Přejezdy s provozem ([D-021](decisions/021-crossing-closes-in-view.md)), sídla a tři velikosti stanic bez povinného zastavení ([D-024](decisions/024-settlements-and-long-stations.md)), protijedoucí vlaky ([D-017](decisions/017-second-track-and-oncoming-train.md)), sezónní práce na polích a v lese, přívoz, mlýn a lanovka ([D-025](decisions/025-farm-forest-content.md)), zvířata s reakcí na dotyk. Zbývá část scén dokumentu 05 a reakce aut a kol na dotyk.                                                                                                            |
| M4 — obsah a výtvarný základ    | většinou | Vlastní grafika všech 10 lokomotiv a 32 druhů vagonků ([D-011](decisions/011-vector-vehicle-art-and-atlas.md)), sezónní krajina a život ([D-027](decisions/027-seasons-and-life.md)), 379 světových dílů v regionálních atlasech ([D-030](decisions/030-world-atlas-region-window.md)), nahrané zvuky ([D-022](decisions/022-recorded-sounds.md)). Poslech a kalibrace na zařízení NEOVĚŘENO.                                                                                                                                                                                      |
| M5 — PWA a vydání V1            | částečně | Online web na GitHub Pages ([D-002](decisions/002-github-pages.md)), volitelný fullscreen a [instalovatelná PWA s offline balíkem](decisions/031-installable-offline-pwa.md). Inventář vzniká z reálného buildu včetně nových SVG/MP3; rodič vidí připravenost a build balíku. Produkční Chromium testuje offline reload, výběr/depo/jízdu, čekající update se dvěma kartami, neúplné stahování, vymazání cache a chybějící SW API. Nový worker nepřepíná rozehranou kartu. Instalace/offline na fyzickém Androidu, iOS a Tesle a finální matice zařízení zůstávají **NEOVĚŘENO**. |

Dokument 14 je splněný v §1–7: pořadí soupravy, celý vlak v obraze s délkovým limitem 2 000 u, středem na 46 % a nejdelší soupravou na 60 % šířky ([D-008](decisions/008-whole-train-in-view.md), [D-028](decisions/028-longer-consist.md)), detailní grafika, částice, bohatší krajina s přejezdy, druhou kolejí, mosty a tunely, svižnější jízda a snímky ze skutečné aplikace.

Iterace světa v2 podle zadání vlastníka z 2026-10-13 (dokončeno v PR #13 z větve `feat/r3-world-v2`; ověření je v [protokolu světa v2](validation/2026-10-16-svet-v2.md)):

Opravy po hraní na tabletu z 2026-10-19 (větev `fix/tablet-playtest-feedback`): modré auto už nevypadá, že couvá ([D-029](decisions/029-roads-and-vehicle-heading.md)), dělené portály a 50% kryt tunelů ([D-033](decisions/033-tunnel-see-through-and-split-portals.md)), vlastní zvuky lesních zvířat a zvuk bez seknutí ([D-022](decisions/022-recorded-sounds.md)) a první kolo měření a omezení škubání ([D-034](decisions/034-ride-frame-pacing-instrumentation.md)). Ověření je v [protokolu oprav po hraní](validation/2026-10-20-playtest.md).

- **Pole a hustý pracovní les před vlakem i za ním:** sezónní pole s řádky a souvratí, stroje s otáčivými koly na skutečném příjezdu, harvestor a vyvážečka na pasece, souvislé husté jádro lesa a nízký přední okraj. Statické vrstvy se zapékají do ořezaných textur se zachovaným pořadím hloubek, stejně v Canvasu i WebGL ([D-025](decisions/025-farm-forest-content.md)).
- **Sídla a delší stanice:** česká vesnice 6 144 u s jedinou návsí, kaplí, zahradami, autobusem a hřištěm, město s předměstím (běžně 6–10 domů), parcely a přístupy bez překryvů, přednádraží, suché pracovní dvory, společný plot zahrádek a modulární stanice 480 / 1 216 / 2 368 u na rovné trati pro celý 2 000u vlak s volným odjezdem. Ulice v sídle vlastní sídlo, pěšiny se zužují uvnitř obce a přes potok vedou silniční mosty. Zbývá: příjezdy autobusu, jeřáb a dopravní činnosti a pozdrav v prohlížeči; přijatý viditelný konec ulice uvádí Známá omezení ([D-024](decisions/024-settlements-and-long-stations.md)).
- **Roční období a život:** sezóna a počasí podle polohy s plynulými přechody; zimní a podzimní vzdálené pásy venkova, vsi, podhůří i města; sněhové plochy širokých střech v autorských kotvách včetně domů sídel a stříšek nástupišť; holé zimní keře; kontrastní sněžení a víření u podvozků se stopou i na profilu low a se soupravou 2 000 u; podzimní listí z listnáčů; kachny, vážky, mlýnské kolo, vlajka a výpravčí; sezónní pole a lesní pásy farm-forest. Rozpočet 240/96 částic, 160/64 animací a 32/12 zdrojů (standard/low). Poslech a fyzická zařízení zůstávají NEOVĚŘENO ([D-027](decisions/027-seasons-and-life.md)).
- **Jiskření u troleje (přání vlastníka 2026-10-14):** modrobílé čárky a měkký svit s velikostí v CSS pixelech podle kamery, četnost podle rychlosti a trakce, v zimě o 25 % vyšší podle `effectiveClimateAt`, větší skupinka při rozjezdu a na podpěrách a spojích rozpětí; svit drží na aktuálně kresleném kontaktu. Pixelová regrese hlídá jas, polohu do 1,25 CSS px a zakrytí skálou ([D-016](decisions/016-electric-locomotive-and-catenary.md)).
- **Silnice podél trati:** souběžná okreska v suchém venkově, městě a podhůří a vzácnější vzdálená dálnice (nejvýše jedna příležitost s pravděpodobností 1/4 ve třetím bloku venkovského regionu; v seedech 0–19 je v 7 z 240 regionů), společné čelo vozidel `vehicleHeading` a diagnostika vlastní rychlosti. Okreska ani dálnice nevstupují do sídel ani na nádraží (dodatek 13); konce mizí 96 u za hranicí osady za terénem a sdílejí ID a hranice osad. Přejezdy D-021 zůstávají ([D-029](decisions/029-roads-and-vehicle-heading.md)).
- **Generátor světa v2:** regiony po 3–7 blocích s plynulými přechody podle polohy, scénky s geometrickými rezervacemi a stopami (nic na koleji, silnice jen na přejezdech, sloupy vedení nikdy ve vodě), souvislé moře bez jezírek na pláži, celé ploty, kontrola opakování, profily tratě podle krajiny, přední pole a lesní okraj, validátor v `check` a skryté vývojářské překryvy, stopa umístění a testovací scény ([D-023](decisions/023-world-generator-v2.md)).
- **Vlak uprostřed obrazu:** střed soupravy je na 46 % šířky, nejdelší souprava 2 000 u zabírá 60 % a zbytek obrazu ukazuje trať před čelem i za koncem; měřítko je pevné pro jízdu a viewport, zadní geometrická rezerva 1 600 u, bubliny mají dotykový průměr aspoň 64 CSS px a dotyk vybírá nejbližší střed ([D-028](decisions/028-longer-consist.md)).
- **Nahrané zvuky:** Nahrané zvuky doplněny ([D-022](decisions/022-recorded-sounds.md)): 35 MP3 / 1,86 MiB, kola, pára, diesel, electric hum, deset horn ID, přejezd, ambient, reakce a tlumení v tunelu. Po hlášení majitele z 2026-10-19 mají jelenovité, veverka a ježek vlastní CC0 nahrávky místo výřezu větru; liška má přiznaný fallback lidských kroků v suchém listí. Změny vrstev a převzetí slotu mají 150ms rampu (zvonek už neusekne ambient), doznívání je omezené na 2 zdroje a strop všech zdrojů je 10 (11 se dvěma parními rázy); ambient po zvonku navazuje v rámci nepřerušeného přehrávání, pauza nebo nová jízda ho resetuje. Seznam Zvuky ve skrytých vývojářských volbách umožňuje poslech všech nahrávek; kredity CC BY jsou v buildu. Po hlášení majitele z 2026-10-20 („šššh šššh šh“ se při rychlosti mění v „trrr“) mají parní rázy koleno 4 rázy/s a plynulý strop 6 rázů/s s délkou 0,25 s; cílem je, aby se při plné rychlosti nezlily v bzučení. Jízda, která zůstane pod kolenem, má časování přesně jako dřív; po návratu z vyšší rychlosti zůstává kadence i délka, ale fáze vůči kolům je posunutá ([D-035](decisions/035-steam-chuff-rhythm.md)). Poslech na tabletu NEOVĚŘENO.
- **Nižší trolej a kompaktní sběrače:** kontakt 160 → 128 u, ramena 56 × 34 u a menší hlava, pracovní dosah 34–59,4 u; nedosažitelný drát se omezí a nahlásí, nikdy nevyhodí výjimku. Obálky všech 42 vozidel mají na rovině nejméně 20 u rezervy, na sklonu nejméně 12 u. Sběrač zvládne zlom rovina–svah do 12 % a přímý obrat sklonu do 9,8 % při přechodu 192 u ([D-016](decisions/016-electric-locomotive-and-catenary.md)).
- **Dělené portály a 50% kryt (hlášení majitele 2026-10-19):** vnější pilíř a ústí jsou za vlakem, vnitřní pilíř a klenák v krytu; druhý portál je zrcadlený. Hráčova souprava při přiblížení do 80 u a uvnitř mění kryt všech tunelů včetně skalních a zimních na 50 %, rychlostí 6 s⁻¹ v simulačním čase. Hřbet zůstává neprůhledný; horní tvář má pod sebou obraz téže textury za tmavým vnitřkem, bez další pixelové alokace. Obnova nastaví cíl okamžitě, přechod se při odchylce ≤ 0,002 přichytí přesně k cíli a pauza drží stav. Sousední průhledné fragmenty vlastní nepřekrývající se úseky 0–1 024 u; zimní přílohy obou krátkých portálů sledují místní sklon. Viditelné bubliny jsou dotykové; emise uvnitř horniny zůstává potlačená, pořadí částic a zvukové tlumení se nemění. NPC dál používají vlastní neprůhledné portály. Canvas, WebGL i fallback; save a generátor beze změny ([D-033](decisions/033-tunnel-see-through-and-split-portals.md)).
- **Přejezdy na dohled:** přejezdy řídí nejčasnější příjezd celé soupravy: nejprve čekají auta a blikají světla, potom se sklápějí závory. Krátká souprava vidí sklápění při plném plynu i kolem 240 u/s; při širším rámování vidí i souprava 2 000 u začátek sklápění ve viewportu ([D-028](decisions/028-longer-consist.md)). Souvislá vozovka přes násep, dráhy aut i paty výstražníků používají společnou výšku a sklon koleje, v art i fallback cestě. Fronta v E2E skutečně dokončí průjezd po posledním vagónu ([D-021](decisions/021-crossing-closes-in-view.md)).
- **Dlouhé tunely a velké mosty:** souvislé skalní tunely 3 072/3 328 u pojmou celou 2 000u soupravu, viadukty překlenují údolí a ocelové mosty řeky; malé kamenné mosty zůstávají. Portály, podpěry i vedení sledují skutečnou kolej, krátké kopce hostitelskou krajinu a efektivní sezónu ([D-026](decisions/026-long-tunnels-and-bridges.md)).
- **Voda, Moravská Sahara a hory:** rybniční a říční břehy, přívoz, pobřeží a přístav, duny s borovicemi a vřesem, lom a lanovka. Mlýn má jedinou sestavu a animačního vlastníka; kolo vyžaduje tekoucí náhon mimo efektivní zimu ([D-025](decisions/025-farm-forest-content.md)).
- **Regionální a sezónní atlasy:** 379 registrovaných světových dílů bez placeholderů, svět a pozadí nejvýše po dvou stránkách ≤2048², předstih 8 192 u a postupná příprava mimo kreslení. Vlak se připravuje první, zrušená nativní práce doběhne před náhradou a autorské pivoty přežijí pozdní publikaci. Modelovaná RGBA mez je low **93,414 MiB** a standard **140,578 MiB** při limitech 96/192 MiB; low má rezervu 2,586 MiB. Low omezuje svět i vozidla na 1,25 px/u a pozadí na 0,75 px/u, standard na 2 a 1 px/u. Start dekóduje první okno, v integračním vzorku 222 SVG místo 422; seed, geometrie a save se nemění ([D-030](decisions/030-world-atlas-region-window.md), [D-032](decisions/032-startup-and-ride-performance.md)).
- **Škubání na tabletu, první kolo (hlášení majitele 2026-10-19):** diagnostika plynulosti s omezeným kruhem snímků, graf přes `?perfgraph=1` i skryté menu, kopírovatelný JSON `framePacing`, seřazené lab měření s CPU throttle a GC trace a bezpečné alokační opravy atlasového okna (dříve ~0,3 ms a ~420 kB odpadu na snímek), UI, sezónních animací, audio cache tunelů a kolekcí scény ([D-034](decisions/034-ride-frame-pacing-instrumentation.md)). Desktop ×4 CPU: GC hlavního vlákna 291–378 → 215–251 ms za minutu, nejdelší GC pauza 86 → 7 ms. Fyzický tablet NEOVĚŘENO; druhé kolo (konstrukce chunků, readPixels, limiter) začne podle majitelových záznamů, D-032 hotspot #2 se nerozděluje naslepo.
- **Měření a výkon:** diagnostická sonda startu, SVG, CPU fází atlasů, prvních 12 chunků a dlouhých úloh za prvních 15 s jízdy; stabilní samostatný chunk Phaseru včetně PWA precache a HUD bez pravidelného plného geometrického snapshotu. Nezměněný atlasový požadavek nečte timing hodiny, nové okno ve stejném měřítku se měří. Starší benchmarky nedokládají FPS ani start finální integrace na zařízení ([D-032](decisions/032-startup-and-ride-performance.md)).

## Rozhodnutí, která čekají na vlastníka

- **Číslo světa u příliš dlouhé jízdy z 0.1.** Taková jízda nemůže pokračovat; hráč vlak zkrátí v depu a vyjede v novém světě, stejně jako po každé úpravě vlaku. Codex navrhl staré číslo zachovat. Zatím beze změny, rozhodnutí je ve vlákně PR #2.

Rozhodnuto 2026-10-11: PR #2 už nedostane další kód. Nálezy recenze, které zbývají, jsou naplánované níže jako R1–R4 a přijdou v samostatných PR po sloučení.

## Další kroky v pořadí

Cíl je celý katalog dokumentu 06 §2–3: 10 lokomotiv a 32 druhů vagonků. Všech 42 vozidel má vlastní kresbu (H1–H2). Všechna vozidla dostanou detailní vektorovou grafiku ve stylu současných vozidel. Světlo svítí zleva shora, vozidla nemají obličeje ani loga a nejsou převzatá z dětských pořadů. Katalog pojede v novém PR z `master` po sloučení PR #2, který už další kód nedostane. Každý krok jde přes red → green a má dokumentaci ve stejném commitu.

### H0 — atlas pro jednu jízdu a sada protijedoucích vlaků (D-019)

**Stav: hotovo** ([D-019](decisions/019-journey-atlas-and-npc-fleet.md)). Podmínka z [D-011](decisions/011-vector-vehicle-art-and-atlas.md) je splněna: společný atlas nejhorší jízdy a světa se do 2048 × 2048 nevejde ani při autoritativních 2 px/u (údaj 2,5 px/u byl zastaralý). Selhala i povolená souprava s jednou lokomotivou.

- `npcFleetFor(seed, catalog)` (`src/domain/interaction/npcFleet.ts`) klíčem `npc-fleet` vybere dva parní nebo naftové typy lokomotiv a šest typů vagonků bez `placeholder: true`; při menším počtu vrátí všechny způsobilé. Doména neimportuje manifest.
- `journeyArtKeys(vehicles, fleet)` sbírá unikátní díly hráče a seedované NPC sady. Vozidla mají jednu stránku ≤2048², svět a pozadí samostatné regionální/sezónní stránky podle D-030. Výjezd z depa a obnova znovu vyberou vozidlové díly; SVG pro depo zůstávají lokální. Dekódovaný katalog se trvale nedrží, jen text SVG a dočasné bitmapy přípravy.
- Atlasový a paměťový rozpočet vlastní [D-030](decisions/030-world-atlas-region-window.md); původní rozměry jednoho globálního světového atlasu již nejsou aktuální. D-010 `maxTextures: 1`, vrstvy, geometrie soupravy a formát save zůstávají.
- E2E kontroluje `artVehicles === vehicles`, přestavbu vozidel po výjezdu z depa a obnově, regionální publikaci a samostatný fallback. `vehicleAtlas` uvádí i ID a klíč textury, `artAtlas` je stručný údaj první stránky světa; úplný stav je v `worldAtlases`. Testy čekají na skutečnou publikaci přes `waitForWorldAtlases`.

### H1 — šest chybějících lokomotiv

Délky jsou z dokumentu 06 §2. Každá lokomotiva dostane:

- záznam v `src/content/vehicles.ts`;
- karoserii a překryv v `assets/vehicles/`;
- záznam v `src/content/artManifest.ts`;
- emitory částic;
- vlastní výšku houkání. Každý typ má vlastní nahranou píšťalu; elektrické typy používají přiznaný nahraný fallback ([D-022](decisions/022-recorded-sounds.md)).

| ID                        | Zvláštnosti                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `steam_express` 216 u     | Dlouhý kotel, velká spřažená hnací kola (nový díl `wheel-steam-driver-large`), rozvod přes `steamGear`, uhlí v zadní části, kouř |
| `diesel_shunter` 148 u    | Kapota, kabina a ochoz, sdílená naftová kola, emitor výfuku                                                                      |
| `electric_modern` 204 u   | Zaoblená čela, hladké boky; sdílí díly pantografu s `electric_retro` (manifest pak jmenuje sdílené klíče)                        |
| `electric_mountain` 160 u | Krátká robustní skříň, vlastní tvar kabiny, pantograf                                                                            |
| `magic_bubbles` 164 u     | Zaoblená karoserie; nový druh částic `bubble`                                                                                    |
| `magic_rainbow` 176 u     | Vlastní silueta, barevné díly; nový druh částic `rainbow-puff`                                                                   |

- **Stav fantazijních:** hotovo. `magic_bubbles` pouští bubliny a `magic_rainbow` barevné obláčky (nové druhy částic `bubble` a `rainbow-puff`).
- **Stav velké parní a posunovače:** hotovo. `steam_express` (nová velká hnací kola, parní rozvod, uhlí v zadní části, kouř) a `diesel_shunter` (kapota, kabina, ochoz, výfuk) mají vlastní kresbu; `measure:perf` umí `PERF_WAGON`.
- **Stav elektrických:** hotovo. `electric_modern` a `electric_mountain` mají vlastní kresbu a sdílený pantograf; TRN-08 prošel se všemi třemi elektrickými lokomotivami.
- **Stav píšťal:** hotovo. Všech 10 lokomotiv má vlastní tón (velká parní o oktávu níž než malá, hranatá elektrická už nezní jako naftová); hráčova píšťala, náhled při výběru i odpověď protijedoucího vlaku používají identitu lokomotivy (E2E `horns.spec.ts`).
- **Stav výběru a depa:** hotovo. Všech 10 lokomotiv a 32 druhů vagonků je dosažitelných tahem, kolečkem i klávesou na telefonech 844 × 390, 667 × 375, 568 × 320, na tabletu i desktopu (E2E `picker.spec.ts`).
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

- **Stav dávky 4 (hravé):** hotovo. Šest hravých vozů má vlastní statickou kresbu; katalog má grafiku u všech 42 vozidel.
- **Kontroly celého katalogu:** test grafiky, emitorů a sběračů i `validate:assets --release` zahrnují všech 42 vozidel bez placeholderů; E2E `catalog-contact-sheet.spec.ts` vyfotí kontaktní list všech 42 vozidel ze skutečné aplikace.
- **Stav dávky 3 (nákladní):** hotovo. Všech 13 nákladních druhů má vlastní kresbu s pevně ukotveným nákladem.
- **Stav dávky 2 (služební):** hotovo. Dílenský vůz a vůz s pluhem (radlice v obrysu vozu) mají vlastní kresbu.
- **Stav dávky 1 (osobní):** hotovo. Patrový, lůžkový, jídelní a vyhlídkový vůz mají vlastní kresbu.
- **Data:** délky, skupiny a české názvy jsou z dokumentu 06 §3. Dvounápravový nebo podvozkový pojezd určuje manifest u každého vagonku.
- **Depo:** katalog si nechá čtyři skupiny. E2E telefonů ověří, že je dosažitelná i poslední z 32 karet.
- **Testy a kontroly:**
  - test katalogu ověří přesně 32 ID vagonků s délkami a skupinami dokumentu 06 a zmizí komentář „Temporary subset“;
  - `validate:assets --release` projde bez placeholderů;
  - E2E vyfotí kontaktní list všech 42 vozidel ze skutečné aplikace.

### H3 — bubliny a duha (dokument 06 §2)

**Stav: hotovo.** Ťuknutí na bublinu ji přes `GameSession.setWorldHitTest` odstraní s malou částicí a krátkým zvukem (se ztišením i hlasovým limitem); tentýž dotyk současně pohání vlak a brzda má přednost. Duhová mašinka pouští měkké barevné obláčky. Unit, integrační i E2E testy na obou projektech; fyzická zařízení NEOVĚŘENO.

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

R1, R2 a R5–R10 opravuje jeden PR (větev `codex/review-fixes`), commit na nález; red a green jsou v [protokolu oprav recenze](validation/2026-10-11-opravy-recenze.md). R3 je hotové v generátoru v2 ([D-023](decisions/023-world-generator-v2.md)); otevřené zůstává R4.

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

**Stav: hotovo v generátoru v2 ([D-023](decisions/023-world-generator-v2.md)).** První blok vždy rezervuje stanici ve slotu 1 s použitelnou rovinou alespoň 448 u a přejezd ve slotu 3; zvíře ustupuje přejezdu (regresní seed 1226). Cesty vydaného generátoru v1 i v0 se přes stávající restart obnoví od začátku, se zachovaným vlakem, číslem světa a upozorněním. Fixtury chrání vydanou v1, historický budoucí katalog i dosud nepodporovaný generátor 3. Čistý validátor ověřuje 20 000 prvních bloků a determinismus světa nezávisle na pořadí dotazů. V2 zároveň zavádí delší regiony, scénky, geometrické rezervace, podpory a plotové cesty, profily tratě podle krajiny (hory výš a víc nahoru a dolů), přední pole a lesní okraj, prostorově plynulé palety a rodičovskou diagnostiku.

#### R4 — adaptivní kvalita `auto`

- **Problém:** dokument 08 chce, aby `auto` začínala konzervativně a při dlouhodobém zpomalení omezila dekorativní částice, hustotu pozadí a rozlišení. Dnes `renderProfile` (`src/app/renderProfile.ts`) bere `auto` jako `standard` a nic ji za běhu nemění. Ruční volbu `low` nabízí `?quality=low` a skryté vývojářské volby v pauze ([D-020](decisions/020-developer-menu.md)); profil se použije po novém načtení.
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
- **Stav:** hotovo. Místa, jejichž `crossingWorldX` už je za `behindX`, se přeskočí dřív, než vznikne automat; stojící vlak za přejezdem už nové instance nealokuje.

#### R6 — podpěra vedení u portálu tunelu

- **Problém:** `catenarySupport` (`src/domain/world/Catenary.ts`) označí sloup do 72 u od portálu jako závěs ze stropu, takže stožár zmizí. `TunnelView` ale kreslí závěsy jen uvnitř zapečeného nitra (64 u za portálem, zkrácené o 4 u). Sloup 64–72 u za portálem nemá stožár ani závěs a drát se lomí ve vzduchu (například svět 25, chunk 6).
- **Oprava:** jedna společná hranice pro obojí: buď závěs kreslit až do hranice klasifikace, nebo sloupu mimo nitro vrátit stožár.
- **Test:** unit průchod tunely mnoha světů: každý sloup má buď stožár, nebo kreslený závěs; regresní svět 25.
- **Stav:** hotovo. Klasifikace podpěry a kreslení závěsu sdílejí hranici 60 u od portálu; sloup na hranici a dál má stožár na původním místě. Svět ani verze generátoru se nemění (otisk 5280 chunků shodný).

#### R7 — souběžná kolej i bez grafiky

- **Problém:** bez atlasu `ChunkView` skončí v `#addPlainInfrastructure` dřív, než zavolá `chunkSecondaryTrack`. Protijedoucí vlak se kreslí jako silueta (oprava `d90534b`), ale jede bez kolejí a bez portálových kopců a mizí na neoznačené hranici.
- **Oprava:** jednoduchá souběžná kolej a portálové kopce v náhradním kreslení, na stejných místech jako s grafikou.
- **Test:** E2E PWA-10 s nenačteným SVG u druhé koleje světa 123: kolej je vidět (nová diagnostika) a vlak mizí v portálu.
- **Stav:** hotovo. Bez grafiky se souběžná kolej a portálové kopce kreslí jednoduchými tvary na stejných místech jako s grafikou a protijedoucí vlak mizí po vozidlech v portálu (E2E PWA-10 ve světě 123).

#### R8 — velikost bloku biomu je pevná

- **Problém:** validace přijme jakékoli kladné `world.chunksPerBiomeBlock`, ale rozvržení slotů (přejezd ve slotu 3, most 4, tunel 6, druhá kolej 4–6, přechod 7) počítá s osmi chunky. Při hodnotě 4 by simulace pustila protijedoucí vlak tam, kde se koleje nekreslí.
- **Oprava:** validace vyžaduje 8, stejně jako u `blocksPerRouteCycle`. Odvození slotů z konfigurace se odkládá, dokud pro něj nebude konkrétní důvod.
- **Test:** unit test validace s hodnotou 4.
- **Stav:** hotovo. Validace vyžaduje `world.chunksPerBiomeBlock === 8`; hodnotu 4 odmítne (dokument 13). Odvození slotů z konfigurace zůstává odložené.

#### R9 — konečný předstih geometrie

- **Problém:** validace `world.geometryLookAheadU` (`src/config/gameConfig.ts`) hlídá jen dolní mez 2048, takže `Infinity` projde. `RideSimulation.#streamTrack()` pak předá `TrackWindow.ensureRange()` nekonečnou mez a smyčka `while (endS < toS)` neskončí: start i obnova cesty zamrznou.
- **Oprava:** hodnota musí být konečná a aspoň 2048.
- **Test:** unit test validace s `Infinity`.
- **Stav:** hotovo. `world.geometryLookAheadU` musí být konečné a nejméně 2048 u; `Infinity` validace odmítne dřív, než by zacyklila start cesty (dokument 13).

#### R10 — pozadí se s novou cestou vrátí na začátek

- **Problém:** `RideScene.#reset()` vyčistí chunky, částice i ticky, ale ne stav `Backdrop` (vrstvy, prolínání, biom). Když nová cesta začíná v jiném biomu, první snímek ukáže pozadí staré cesty a 1,2 s se prolíná.
- **Oprava:** `Backdrop` dostane reset stavu jízdy, který zavolá `RideScene.#reset()`.
- **Test:** E2E druhé cesty, jejíž první biom se liší: hned první snímek ukáže nový biom bez prolínání.
- **Stav:** hotovo. `Backdrop` má reset stavu jízdy, který volá `RideScene.#reset()`; druhá cesta ukáže svůj biom hned v prvním snímku, bez staré vrstvy a bez prolínání.

### Potom (M3–M5)

- scénky dokumentu 05;
- zbývající zvířata dokumentu 06 §6 (ryba); datel a sova jsou v D-025;
- porovnání 18 lokalit se sestavami dokumentu 06 §7;
- den a noc; sezóny a počasí jsou v D-027;
- poslech a kalibrace nahraných zvuků na zařízení (D-022);
- Fyzická instalace/offline a retenční chování PWA na Androidu, iOS a Tesle, opakované aktualizace a finální zařízení/výkon (M5); lokální produkční offline a čekající aktualizace jsou zavedené v D-031.
- test na skutečných zařízeních.

Volitelné místní reakce vagonků (dokument 06 §3) zůstávají mimo tento plán, dokud je vlastník nevyžádá.

## Známá omezení

Níže jsou zbývající omezení a scénáře přijaté vlastníkem 2026-10-16; podrobnosti vlastní odkazovaná rozhodnutí.

- **Zvuky:** nahrané, ale poslech a kalibrace na zařízení zbývají ([D-022](decisions/022-recorded-sounds.md)):
  - Elektrická houkačka není ověřená česká/evropská elektrická řada; používá upravenou skutečnou dieselovou nahrávku. Trakční rozjezd nahrazuje nahraný elektrický volnoběh. Identifikované CC0 zdroje při opakovaném pokusu vracely 403.
  - Městský bed vynechán, protože nešlo potvrdit absenci řeči. Cvrčci už znějí na letním venkově; v zimě je nahrazuje vítr. Horse/songbird nejsou druhy současného katalogu zvířat.
  - Poslech všech klipů, jemnost/hlasitost a spoje na zařízení **NEOVĚŘENO**. Skrytý seznam Zvuky připraven pro vlastníka. MP3 decode v Playwright Chromium ověřeno; Firefox/Safari, fyzický Android a konkrétní Tesla/firmware **NEOVĚŘENO**.
- **Světla lokomotiv** chybí. Přijdou se dnem a nocí ([D-017](decisions/017-second-track-and-oncoming-train.md), [D-018](decisions/018-bridges-and-tunnels.md)).
- **Souběžná kolej** zatím nemá vedení a protijedoucí vlak je parní nebo naftový. Doplní se s další elektrickou lokomotivou ([D-016](decisions/016-electric-locomotive-and-catenary.md), [D-017](decisions/017-second-track-and-oncoming-train.md)).
- **Portálové podpěry vedení ve stanici** chybí. Přijdou s vícekolejnými nádražími ([D-016](decisions/016-electric-locomotive-and-catenary.md)).
- **Pečená zem** má nadále strop 1 px/u (`GROUND_MAX_PX_PER_U`); nejde o strop celého světa, jehož atlas má na low 1,25 px/u ([D-013](decisions/013-landscape-localities-and-backdrops.md), [D-030](decisions/030-world-atlas-region-window.md)). Jemnost na zařízení zůstává NEOVĚŘENO.
- **Kvalita `auto`** je zatím totéž co `standard`. Odstraní ji R4.
- **Pole a les** ([D-025](decisions/025-farm-forest-content.md)): CR-05 má statické napajedlo bez cyklu napití. Nové audio a večerní čas sovy zůstávají otevřené; vodní scény a zimní listnáče už doplňují D-025 a D-027. Výkon husté kompozice na slabém profilu (WebGL, paseka) není prokázaný; ověří ho měření na skutečném zařízení.
- **Maximální sklon pod pantografem:** rovina ↔ svah podporuje `world.maxTrackGrade = 0,12`; přímý obrat +g → −g na 192 u má validovaný strop `pantographMaxReversingGrade = 0,098`. Regionové plány mezi opačné svahy vkládají rovinu. Snapshot `catenary.outOfRange` počítá omezený hráčův sběrač.
- **Křížení druhé koleje s přejezdem** zatím ve světě není: druhá kolej ve slotech 4–6 nekříží silnici přejezdu ve slotu 3. Rozhraní přejezdu přijímá více vlaků a bezpečnost ověřuje syntetický protijedoucí vlak; při přidání skutečného křížení musí simulace zahrnout jeho vlaky do seznamu ([D-021](decisions/021-crossing-closes-in-view.md)).
- **WebGL dávky s jednou texturou** obcházejí chybu Phaseru 4.2.1 ([D-010](decisions/010-webgl-single-texture-batches.md)).
- **Zvuk po velmi rychlém pokračování:** když hráč pokračuje dřív, než doběhne suspendování audio kontextu z pauzy, zvuk mlčí do dalšího ťuknutí nebo držení. Přijato 2026-10-16 bez opravy; serializace resume patří do další audio iterace ([D-022](decisions/022-recorded-sounds.md)).
- **Start jízdy:** po Vyjet zůstává clona asi 1,9–2,1 s na desktopu (dříve 0,15 s), na tabletu déle, protože D-030 dekóduje okolí startu až po odjezdu; báze dekódovala celý katalog už v menu. Vlastník to přijal 2026-10-16; předehřátí prvního okna během depa je další krok ([D-032](decisions/032-startup-and-ride-performance.md)).
- **Změna měřítka:** po resize, otočení nebo změně celé obrazovky se svět přerastruje asi za 1,6–8,6 s na desktopu, na tabletu déle; mezitím se kreslí stránky ve starém měřítku. Vlastník latenci přijal jako cenu paměťové meze ([D-030](decisions/030-world-atlas-region-window.md)).
- **SVG mimo RGBA evidenci:** současně je rozpracováno 19–37 SVG dokumentů (asi 6–11 MiB). Limit osmi dekódování byl změřen a zamítnut kvůli zpomalení studeného startu; D-030 uvádí Canvas +27–48 % ([D-030](decisions/030-world-atlas-region-window.md)).
- **Návrat z depa:** než doběhne starší práce pozadí, mohou se krátce vykreslit náhradní vozidla před další kontrolou vozidlového atlasu. Zděděné chování existovalo i před D-030 ([D-030](decisions/030-world-atlas-region-window.md)).
- **E2E citlivé na zátěž:** H0 obnova v `art.spec` a seed 1 v `world-atlas-regions` jsou na vytíženém stroji mezní i s přijatými 15s atlasovými polly a `test.slow()` u seedu 1. Kontroly hned po startu nebo obnově jízdy čekají na zvednutí clony nejvýše 15 s (`RIDE_START_TIMEOUT_MS`, rozhodnutí vlastníka 2026-10-16). CI spouští jeden prohlížeč na shard v 16 shardech, protože dva Chromie se softwarovým WebGL na čtyřech vCPU zdržovaly publikaci atlasů za 30s limit testu ([D-030](decisions/030-world-atlas-region-window.md), [D-032](decisions/032-startup-and-ride-performance.md)). `ride-reveal:279` (zachované prolínání pozadí při návratu z depa) jednou selhal v CI na desktopu, lokálně prošel 10/10; vlastník 2026-10-16 rozhodl takové drobnosti před nasazením jen zapsat, ne opravovat.
- **Determinismus sezónních efektů:** částice používají RNG seedovaný číslem cesty jednou za jízdu a ruční vizuální testy sněhu i střech začínají na ticku 0. Stejný počáteční stav a stejná posloupnost snímků dají stejné pixely; při jiném FPS se jednotlivé částice liší. Prahy viditelnosti se nesnižovaly ([D-027](decisions/027-seasons-and-life.md)).
- **Konec ulice pod kopcem:** seed 1 / chunk 11 zachovává viditelné čisté zakončení, protože ani jeden povolený přesah není celý pod neprůhlednou výplní kopce; vlastník scénář přijal ([D-024](decisions/024-settlements-and-long-stations.md)).
- **Fyzický tablet, telefon a Tesla:** **NEOVĚŘENO** ([D-032](decisions/032-startup-and-ride-performance.md), [matice zařízení](device-tests/v0.1.md)).
