# 12 — Rozhodnutí, předpoklady, rizika a zdroje

[Zpět na rozcestník](README.md)

**Stav k 9. říjnu 2026.** Dokument odlišuje zadání uživatele od doplněných návrhových voleb. Zápis POTVRZENO neznamená, že byla již ověřena technická proveditelnost na fyzickém zařízení. Zápis VÝCHOZÍ VOLBA znamená: implementovat bez dalších otázek, dokud se vědomě nerozhodne jinak.

## 1. Potvrzený produktový základ

| ID | Potvrzený požadavek | Specifikace | Hlavní kontrola |
|---|---|---|---|
| C-01 | Hra je především pro malou dceru, dotyky mají být velmi jednoduché. | 01, 02, 07 | INP, UI, ruční ergonomie. |
| C-02 | Před jízdou výběr z deseti různých lokomotiv. | 02, 06 | CNT-01 až CNT-03. |
| C-03 | Parní, naftové, elektrické a několik zábavných lokomotiv. | 06 | Katalog, odlišný vzhled a efekt. |
| C-04 | Velké množství připojitelných vagonků různých druhů včetně osobních a nákladních. | 03, 06 | TRN-01/02, CNT-01. |
| C-05 | Nekonečná procedurální cesta v bočním 2D pohledu: nahoru, dolů, tunely a mosty. | 03, 04 | TRN, GEN, streaming. |
| C-06 | Živá krajina: lesy, pole, zvířata, traktor, okolní provoz, nádraží a někdy druhá kolej s jiným vlakem. | 04, 05, 06 | SCN, CNT-04. |
| C-07 | Interaktivní věci pro zábavu, například balónky a schovaná zvířata. | 05, 06 | INP-05, SCN-11/12. |
| C-08 | Převážně středoevropské prostředí, postupně moře a hory; proměna dne a noci. | 04, 07 | GEN-07, CNT-05, DATA-08. |
| C-09 | Semi-realistický základ, ale povolené zábavné mašiny a vagonky. | 01, 06, 07 | Výtvarná akceptace. |
| C-10 | Elektrická mašinka automaticky znamená trolejové vedení; není třeba řešit napájení složitě. | 03, 04 | TRN-08, GEN-12. |
| C-11 | Držený dotyk pohání vlak, bez dotyku vlak postupně zpomaluje. | 02, 03 | INP-01/02/10/11. |
| C-12 | Všechny herní scénky v jednom pohledu; minihry v první verzi neřešit. | 01, 05 | SCN-01/02/03. |
| C-13 | Nádraží lze projet; zastavení a interakce nejsou povinnost. Scénky nezávisí na typu vagonků. | 01, 05 | SCN-01 až SCN-03. |
| C-14 | Co nejjednodušší zajímavé řešení v browseru, cílit také na Teslu/tablet, snadné aktualizace bez obchodů; případná budoucí appka pro Android. | 08, 09 | PWA, matice zařízení. |

Výraz u elektrické lokomotivy je zde operacionalizován jako trolejové vedení. Nejnovější upřesnění o dotykovém řízení a nepovinných stanicích má přednost před dřívějšími návrhy automatického rozjezdu a zastávek.

## 2. Doplněné výchozí volby

| ID | Výchozí volba | Důvod / dopad |
|---|---|---|
| D-01 | Velká viditelná brzda vlevo dole + gesto doleva. Ne celá neviditelná levá polovina. | Vyřešení uživatelem otevřené varianty brzdění, srozumitelná plocha. |
| D-02 | Dotyk objektu reaguje okamžitě a zároveň dává plyn. | Jednotný vztah dotyk–jízda, žádné čekání na rozpoznání záměru dítěte. |
| D-03 | Brzda má prioritu nad všemi plynovými dotyky. | Jednoznačnost při více prstech. |
| D-04 | Po přerušení je v = 0 a k rozjezdu je potřeba nový dotyk. | Odolnost vůči ztraceným koncovým událostem a nechtěnému rozjezdu. |
| D-05 | 100 vagonků a 32 katalogových druhů. | Konkrétní implementační výklad „hodně“. Čísla nejsou původní explicitní požadavek uživatele. |
| D-06 | Všechny typy dostupné hned; žádné skóre, odemykání a prohra. | Hračka pro malé dítě, nikoli výkonová hra. |
| D-07 | Žádná fyzika hmotností, couvání ani volba výhybek. | Zjednodušení bez ztráty hlavního zážitku. |
| D-08 | Kamera pevně sleduje předek, celá souprava je posuvná v depu. | Gesta během jízdy jsou vyhrazená řízení. |
| D-09 | Jeden režim, žádné samostatné minihry a úkoly. | Nepřidávat složitost, kterou uživatel odložil. |
| D-10 | Změna soupravy zahajuje novou cestu až po potvrzení Vyjet. | Bez přepojování vozů v živé krajině a přepočítávání obsazených přejezdů. |
| D-11 | Jeden lokální rozehraný výlet, žádné účty a synchronizace. | Nejmenší provozní a implementační náklady. |
| D-12 | Semi-realistická ilustrace bez obličejů lokomotiv, 7 realistických + 3 hravé typy. | Konzistentní rozpracování vizuálního záměru. |
| D-13 | Šest biomů a jednoduchá předvídatelná gramatika jejich návaznosti. | Proceduralita bez neuvěřitelných skoků a drahého plánování. |
| D-14 | Mírné počasí a pomalý herní den; žádná bouřka a globální roční období. | Atmosféra bez zahlcení a dalšího herního systému. |
| D-15 | Hudba výchozí vypnutá, zvuky zapnuté, žádné automatické mluvené poučování. | Zvuková odezva bez permanentního komentátora. |
| D-16 | TypeScript + Phaser + Vite, statické nasazení, malé DOM UI. | Jedna webová implementace, testovatelná logika a bez backendu. |
| D-17 | PWA je volitelná; online cesta funguje i bez ní. | Specifické browsery nesmějí selhat kvůli nepodporované nadstavbě. |
| D-18 | Standardní čekající aktualizace workeru, žádné nucené přepnutí uprostřed jízdy. | Jednoduchost a konzistence assetů. |
| D-19 | V1 má malé lokální JSON save a zálohu, ne databázový server. | Úměrnost rozsahu, snadná možnost pozdější výměny adaptéru. |
| D-20 | Numerické konstanty a výkonové rozpočty jsou výchozí, mají se měřit. | Nepředstírat otestované optimum před vznikem hry. |

Tyto volby tvoří proveditelné zadání bez dalšího kola otázek. Jejich pozdější úprava má být malý popsaný zásah se změnou testů, ne neřízené přidávání funkcí.

## 3. Co je odložené

Samostatné minihry; nákladní zakázky a scénky závislé na vozech; album; profily a oblíbené soupravy; výhybky, mapa a výběr trasy; couvání; skutečná ekonomika a palivo; více obtížností; globální roční období; mluvené pojmenovávání; sdílení a synchronizace; nativní Android obálka; editor krajiny a veřejný komunitní obsah.

Ani dočasné nadšení implementátora není důvod tato rozšíření přidávat během základní implementace. Datové katalogy mají umožnit pozdější obsah, ale není potřeba předem vytvořit pluginový systém.

## 4. Neznámé a způsob rozhodnutí

**Cílový Android tablet:** konkrétní model nebyl zadán. Zahájit vývoj na běžném referenčním tabletu a před deklarací finální podpory doplnit skutečný model do testovací matice. Nečekat s geometrií a input reducerem na znalost jeho rozlišení.

**Tesla:** auto je cílové zařízení, ne běžná desktopová emulace. Firmware, dostupný prostor browseru, API a výkon ověřit. Základní online hra je cíl, PWA instalace a offline nejsou zaručené vlastnosti Tesly.

**Grafika a zvuky:** katalog definuje rozsah, ale finální assety nejsou součást tohoto předání. Technický prototyp může použít vlastní jednoduché tvary. Finální produkt potřebuje konzistentní a použitelné assety s evidencí původu.

**Konkrétní hosting:** není nutné rozhodnout před první implementací. Musí podporovat statické HTTPS soubory a správné cache chování. Výběr nemění herní architekturu.

## 5. Rizika a mitigace

| Riziko | Opatření |
|---|---|
| Dotyky na svět kolidují s ovládáním. | Jeden InputRouter, jasná priorita UI a brzdy, reakce objektu + plyn výslovně definovaná. |
| Dlouhý vlak rozbije výkon nebo vyjede z už smazané tratě. | Culling obrázků oddělený od geometrie; zachovat koridor až za tailS. |
| Generátor je náhodný, ale nesouvislý. | Sdílená hranicová funkce, LUT, omezené profily a deterministické rezervace. |
| Závory otevřou pod vagonky. | Interval celé soupravy a test v každém ticku, nikoli trigger jen na lokomotivu. |
| Výtvarný katalog se zamění za mnoho přebarvených ikon. | Katalogové siluety, kontaktní listy a vizuální akceptace. |
| Tesla nezvládne zvolený renderer nebo API. | M0 na reálném zařízení, konzervativní efekty, ověřený Canvas fallback; stav podpory poctivě označit. |
| Aktualizace smíchá starý kód a nové assety. | Hashed/verzované soubory, čekající worker, konzistentní release a žádný nucený reload. |
| Browser odstraní uloženou hru nebo offline balík. | Fallback do hratelné relace, rodičovská informace, netvrdit existenci cloudové zálohy. |
| Rozsah naroste o úkoly a nativní platformy. | Seznam mimo V1 a práce po milnících. |

## 6. Primární technické zdroje

Ověřeno při přípravě 9. října 2026. Zdroje podporují konkrétní tvrzení o platformě a nástrojích; nenahrazují měření této dosud neimplementované hry. Herní pravidla, katalog, parametry a geometrické konstrukce jsou návrhem tohoto zadání, nikoli převzatým doporučením výrobce frameworku.

### S01 — Phaser: vydání a zvolená verze

[Phaser 4.2.1 — oficiální stránka vydání](https://phaser.io/download/release/v4.2.1) a [přehled vydání Phaser 4](https://phaser.io/download/phaser4). Oficiální přehled při ověření uváděl 4.2.1 z 9. července 2026 jako nejnovější zveřejněné vydání. To odůvodňuje výchozí připnutí; další aktualizace závislosti není automatické rozhodnutí za běhu vývoje.

### S02 — Phaser: renderer a typy konfigurace

[Oficiální Types.Core pro Phaser 4.0.0](https://docs.phaser.io/api-documentation/4.0.0/typedef/types-core). Dokumentuje varianty rendereru včetně automatického výběru. Tento konkrétní dokument má jinou verzi než navržené připnutí 4.2.1; implementátor musí ověřit skutečné typy a podporu nainstalované verze. Není to důkaz výkonu ani bezchybnosti Canvas větve na konkrétní Tesle.

### S03 — MDN: Pointer Events

[Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events). Podklad pro samostatné pointer ID, capture a správnou reakci na ukončení či zrušení dotyku. Priority plyn/brzda a interakce jsou vlastní herní pravidla.

### S04 — MDN: touch-action

[touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action). Vysvětluje vztah dotyků aplikace k manipulaci a gestům prohlížeče. Omezení se aplikuje na herní plochu, ne plošně na všechny rodičovské dokumenty.

### S05 — MDN: zobrazovací režim PWA

[Web app manifest — display](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/display). Podklad pro odlišení `fullscreen`, `standalone` a běžné karty i pro náhradní zobrazovací režimy. Manifestová preference není univerzální garance celoobrazovkového zobrazení.

### S06 — MDN: Fullscreen API

[Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API). Podklad pro samostatné API, feature detection a zacházení s uživatelskou aktivací a selháním požadavku.

### S07 — MDN: autoplay a Web Audio

[Autoplay guide for media and Web Audio APIs](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). Zvuk může být omezen pravidly prohlížeče; hra se nesmí spoléhat na automatické spuštění bez gesta nebo selhat při jeho odmítnutí.

### S08 — MDN: úložiště a odstraňování dat

[Storage quotas and eviction criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria). Podklad pro zachycení chyb kvóty, možnost odstranění dat a rozlišení místního save od trvalé zálohy.

### S09 — MDN: viditelnost stránky

[Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API). Podklad pro detekci skrytí stránky a uvědomění si omezení časovačů v pozadí. Rozhodnutí zmrazit celou hru a obnovit ji zastavenou je součást produktu.

### S10 — Tesla: příručka pro Model 3 2017–2023

[Theater, Arcade, and Toybox](https://www.tesla.com/ownersmanual/2017_2023_model3/en_us/GUID-79A49D40-A028-435B-A7F6-8E48846AB9E9.html). Výrobce popisuje související zábavní funkce a jejich podmínky. Zdroj neudává výkon této hry, konkrétní podporu PWA ani možnost naší stránky ověřit stav Park. Tyto věci se nesmějí odvozovat z obecné příručky.

### S11 — Vite: vývoj a build

[Getting Started](https://vite.dev/guide/). Podklad pro Vite jako build nástroj a ověření požadavků na Node při bootstrapu. Zvolenou přesnou verzi a kompatibilitu nástrojů je třeba zaznamenat do skutečného repozitáře.

### S12 — Vitest: testovací prostředí

[Getting Started](https://vitest.dev/guide/). Oficiální návod a systémové požadavky. Podklad pro testy čisté domény; žádný konkrétní test hry ještě není tímto zdrojem provedený.

### S13 — Playwright: emulace browserového prostředí

[Emulation](https://playwright.dev/docs/emulation). Podklad pro testovací nastavení viewportu, dotykového prostředí a offline síťového stavu. Emulace není test fyzického infotainmentu.

### S14 — MDN: service workers a jejich životní cyklus

[Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers). Podklad pro bezpečný kontext, instalaci, cache a čekající aktualizace. Navržený systém záměrně neprovádí nucené přepnutí živé hry.

### S15 — Capacitor: pozdější Android obálka

[Installing Capacitor / Add Capacitor to your web app](https://capacitorjs.com/docs/getting-started). Oficiální dokumentace popisuje začlenění existujícího webového projektu. Jde o pozdější možnost, nikoli o součást současné implementace a nikoli o automatický příslib aktualizování vložených assetů pouhým vydáním webu.

## 7. Pravidlo následných změn

Každou změnu základního kontraktu zaznamenat krátce: problém, rozhodnutí, alternativy, dopad na soubory a testy. Příklad: „D-01 měníme na širší viditelnou brzdovou plochu, protože při testu dítě netrefovalo ikonu; svět mimo ni zůstává plyn.“ Nepsat nové rozsáhlé koncepční zadání kvůli přesunu jednoho tlačítka.

Při pokračování s jiným implementátorem předat celý balíček a aktuální rozhodnutí. Samotný první nápad nebo krátké shrnutí nemá přebít zde vyřešené hraniční situace.
