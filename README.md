# Vláček — implementační předání

**Hrát online:** [pavelpancocha.github.io/vlacek](https://pavelpancocha.github.io/vlacek/) — vždy poslední build z větve `master`; jeho číslo ukazuje pauza.

**Pracovní název:** Vláček  
**Verze specifikace:** 1.0 · **Datum:** 9. října 2026  
**Jazyk hry:** čeština; hlavní ovládání obrázky, bez nutnosti číst.  
**Výstup tohoto balíčku:** zadání a kontrakty pro implementaci, nikoli hotová hra.

## Co se má postavit

Jednoduchá 2D webová hra pro malé dítě. Před cestou si dítě vybere jednu z **10 odlišných lokomotiv** a připojí libovolnou kombinaci vagonků z **32 druhů**. Souprava je omezená na 2 000 u včetně lokomotivy a spřáhel, aby byl na obrazovce vidět celý vlak ([dokument 14](vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md), [D-028](docs/decisions/028-longer-consist.md)). Vlak má střed na 46 % šířky a pevné měřítko podle reference 2 000 u; nejdelší souprava zabírá 60 % šířky a má geometricky 16 % za koncem a 24 % před čelem ([D-028](docs/decisions/028-longer-consist.md)). Původní limit 100 vagonků už neplatí. Potom jede zleva doprava po nekonečné, procedurálně skládané trati. Držení prstu v herním světě vlak rozjíždí, puštění jej postupně zastaví. Vlevo dole je velká brzda; doleva lze také zabrzdit gestem.

Krajina je převážně středoevropská, postupně zahrnuje lesy, pole, vodu, podhůří, hory a pobřeží. Jsou v ní nádraží, mosty, tunely, fungující přejezdy, okolní provoz a zvířata. Dotyk vyvolává jednoduché reakce. Hra nemá skóre, prohru, povinné úkoly ani minihry. Nádraží lze projet. Scénky nezávisí na nákladu nebo složení vagonků. U elektrické lokomotivy se automaticky zobrazí trolejové vedení podél celé použité trasy.

**Technický výchozí návrh:** TypeScript + Phaser + Vite; statický web s volitelnými PWA funkcemi. Žádný backend, účet, obchod s aplikacemi ani síťová AI nejsou součástí V1. Cílem je Android tablet a běžný prohlížeč, včetně ověření na konkrétní Tesle Model 3 2019 s Intelem. Podpora konkrétních funkcí Tesly zatím není změřena ani garantována.

## Rozcestník

| Soubor                                                                              | Obsah a vlastník rozhodnutí                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [01_GAME_DESIGN.md](vlacek-predavaci-balicek/01_GAME_DESIGN.md)                     | Záměr, rozsah V1, herní smyčka, co se záměrně nedělá.                                       |
| [02_OVLADANI_A_STAVY.md](vlacek-predavaci-balicek/02_OVLADANI_A_STAVY.md)           | Dotyky, brzda, gesta, souběh prstů, menu, pauza, depo.                                      |
| [03_VLAK_A_JIZDA.md](vlacek-predavaci-balicek/03_VLAK_A_JIZDA.md)                   | Pohyb, dlouhá souprava, geometrie, kamera, elektrifikace.                                   |
| [04_PROCEDURALNI_SVET.md](vlacek-predavaci-balicek/04_PROCEDURALNI_SVET.md)         | Seed, úseky, kontinuita tratě, biomy, streaming, čas a počasí.                              |
| [05_SCENKY_A_INTERAKCE.md](vlacek-predavaci-balicek/05_SCENKY_A_INTERAKCE.md)       | Nádraží, závory, silniční provoz, druhé koleje, zvířata a reakce.                           |
| [06_KATALOG_OBSAHU.md](vlacek-predavaci-balicek/06_KATALOG_OBSAHU.md)               | Závazný katalog 10 lokomotiv, 32 vagonků a základních scén.                                 |
| [07_VIZUAL_AUDIO_UX.md](vlacek-predavaci-balicek/07_VIZUAL_AUDIO_UX.md)             | Výtvarný směr, vrstvy, assety, zvuk, přístupnost a rozložení.                               |
| [08_ARCHITEKTURA_A_DATA.md](vlacek-predavaci-balicek/08_ARCHITEKTURA_A_DATA.md)     | Moduly, typové kontrakty, ukládání, migrace a struktura projektu.                           |
| [09_WEB_PWA_ANDROID_TESLA.md](vlacek-predavaci-balicek/09_WEB_PWA_ANDROID_TESLA.md) | Platformy, offline režim, aktualizace, nasazení a kompatibilita.                            |
| [10_IMPLEMENTACNI_PLAN.md](vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md)       | Pracovní balíčky, závislosti a definice hotové práce.                                       |
| [11_TESTY_A_AKCEPTACE.md](vlacek-predavaci-balicek/11_TESTY_A_AKCEPTACE.md)         | Funkční, generativní, integrační a ruční testy; výkonové cíle.                              |
| [12_ROZHODNUTI_A_ZDROJE.md](vlacek-predavaci-balicek/12_ROZHODNUTI_A_ZDROJE.md)     | Potvrzené požadavky, doplněné výchozí volby, rizika a zdroje.                               |
| [13_VYCHOZI_KONFIGURACE.md](vlacek-predavaci-balicek/13_VYCHOZI_KONFIGURACE.md)     | Centrální číselné parametry a jejich význam.                                                |
| [14_UPRAVY_PRVNI_VERZE.md](vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md)       | Zadání iterace po verzi 0.1: souprava, kamera, grafika, živý svět. Při rozporu má přednost. |
| [AGENTS.md](AGENTS.md)                                                              | Pracovní instrukce pro implementátora nebo kódovacího agenta.                               |

## Jak balíček používat

Nejprve přečíst tento soubor, game design a rozhodnutí. Dokument 14 je pozdější zadání zadavatele; při rozporu má přednost před dokumenty 01–13 a ilustracemi. Před implementací vstupů přečíst celý dokument 02; před implementací tratě společně 03 a 04. Plán práce je v dokumentu 10. Dokument 11 je součást zadání od začátku, nikoli až závěrečný seznam přání.

V tomto repozitáři jsou specifikace ve složce `vlacek-predavaci-balicek/`; tento README je jejich rozcestník. Kořenový [AGENTS.md](AGENTS.md) určuje pracovní postup včetně TDD, povinné dokumentace a pravidel udržitelnosti. Při případném přesunu do `docs/spec/` oprav i odkazy a nevytvářej druhou kopii specifikací. Repozitář obsahuje rozpracovanou hru: průběžnou verzi 0.1 se světem v2, vývojové nástroje, lokální hook a workflow GitHub Actions s nasazením na GitHub Pages.

### Vývojové prostředí a kontroly od prvního dne

Použij [Volta](https://docs.volta.sh/guide/getting-started) a verze Node/npm připnuté v [package.json](package.json). V kořeni repozitáře Volta automaticky vybere projektové verze; závislosti zůstávají v lokálním `node_modules/`.

```bash
volta run npm ci
volta run npm run check
```

`npm ci` také nainstaluje lokální Git hook. `npm run check` ověří formátování, lint včetně hranic čisté domény, TypeScript, Vitest testy, katalog vozidel (`validate:assets`), místní odkazy v dokumentaci, tajné údaje a velikost souborů. GitHub Actions spouští stejný příkaz, produkční build s kontrolou velikosti a browserové testy (`npm run test:e2e`, po jednorázovém `volta run npx playwright install chromium`) na push a pull request. Testy pokrývají také doménu hry, vstupy, ukládání, generátor a browserové průchody; aktuální omezení shrnuje [roadmapa](docs/roadmap.md).

Reprodukci nahrávek s FFmpeg 6.1.1 popisuje [D-022](docs/decisions/022-recorded-sounds.md). Zdrojové nahrávky nejsou v Gitu; adresy, licence, původní SHA-256 a výřezy vlastní [sources.json](scripts/audio/sources.json).

```bash
volta run node scripts/audio/process-audio.ts /cesta/k/originalum
volta run node scripts/audio/credits.ts
volta run node scripts/audio/verify-audio.ts
volta run node scripts/audio/contact-sheet.ts /cesta/k/vystupu
```

### Co umí verze 0.1

Výběr z 10 lokomotiv → depo s 32 druhy vagonků ve čtyřech skupinách (přidat, vybrat, posunout, odebrat, vrátit; délkový limit 2 000 u podle [D-028](docs/decisions/028-longer-consist.md), aby byl celý vlak vidět). Na nízkých telefonech se karty lokomotiv posouvají vodorovně; na vyšších displejích se zalamují a posouvá se obsah obrazovky, šipka dolů upozorní na další mašinky. Katalog vagonků zůstává vodorovný. Posun funguje tahem, kolečkem i klávesou Tab (Enter a mezerník kartu aktivují); po přidání vagonku zůstane katalog na stejném místě. Akční řádky úvodu, výběru, depa, pauzy a vývojářských voleb zůstávají celé v dostupném viewportu od 568 × 320 do 1920 × 1200, zatímco obsah má pružnou výšku a posouvá se; stav plného vlaku patří do posuvného obsahu depa. Fyzický telefon a pohyb adresního řádku Android Chrome jsou NEOVĚŘENO. Katalog je kompletní podle dokumentu 06: 10 lokomotiv a 32 druhů vagonků, celkem 42 vozidel s vlastní grafikou; release validace prochází bez placeholderů a kontaktní list všech vozidel je v [protokolu ověření](docs/validation/2026-10-10-iterace-upravy.md) ([stav](docs/roadmap.md)) → jízda po nekonečné kopcovité trati krajinou osmi biomů (venkov, les, rybníky, podhůří, hory, pobřeží, duny, město) s lokalitami, zvířaty, přejezdy a protijedoucími vlaky → pauza → pokračování. Pokračování cesty se ukládá v prohlížeči a po obnovení stránky je vlak zastavený.

| Ovládání       | Dotyk / myš                                                                      | Klávesnice                             |
| -------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| Jízda          | držet prst kdekoli ve světě                                                      | `→` nebo mezerník                      |
| Dojezd         | pustit                                                                           | pustit klávesu                         |
| Brzda          | držet velké tlačítko vlevo dole, přejet na něj prstem nebo táhnout doleva        | `←`                                    |
| Píšťala        | tlačítko vpravo dole                                                             | `H`                                    |
| Bublina        | ťuknout na bublinu bublinkové mašinky: praskne a zároveň dál pohání vlak         | —                                      |
| Pauza          | tlačítko vpravo nahoře                                                           | `Escape`                               |
| Celá obrazovka | tlačítko na úvodu, při výběru mašinky a v pauze; stejným tlačítkem režim ukončit | Enter / mezerník na zaměřeném tlačítku |

Celá obrazovka je volitelná a vyžaduje dostupné Fullscreen API. Tlačítko se bez podpory skryje; po zamítnutí zůstane do obnovení stránky neaktivní s krátkou zprávou. Hra dál funguje v běžné kartě. Změna režimu zachová pauzu; opuštění během jízdy ji pozastaví a vymaže vstupy. Automatický vstup ani opakovaná žádost se nepoužívají. Ověření je v [protokolu celé obrazovky](docs/validation/2026-10-12-cela-obrazovka.md); fyzická zařízení zůstávají NEOVĚŘENO.

Svět v2 má pole před vlakem i za ním: jarní setí, letní kombajn a lis, podzimní orbu a zimní radlici na polním příjezdu; stroje mají otáčivá kola a zemědělec pracuje nebo mává. Les je souvislý hustý porost s nízkým kresleným okrajem vpředu. Na pasece pracují harvestor a vyvážečka s kmenem v drapáku, u lesní cesty čeká auto s kládami. Krmelec, datel, sova a lávka nad skutečným potokem doplňují lesní život ([D-025](docs/decisions/025-farm-forest-content.md)).

Vesnice v2 má jednu nepravidelnou náves s kaplí, domovními zahradami, autobusovou zastávkou a hřištěm; zahrádky mají společný plot s brankou, cestičky a záhony. Město má předměstí s řadovými, bytovými i panelovými domy, park, sklad nebo pilu a nízký český horizont. Zastávka měří 480 u, střední stanice 1 216 u a velké městské nádraží 2 368 u, takže se k nástupišti vejde celá souprava 2 000 u; nástupiště leží vždy na rovné trati. Ulice uvnitř obce patří sídlu, pěšiny končí uvnitř obce a přes potok vede silniční most ([D-024](docs/decisions/024-settlements-and-long-stations.md)).

Roční období a počasí se mění podle polohy na trati, ne podle kalendáře; zastavení vlaku je nezmění. V zimě jsou zasněžené vzdálené pásy, městský horizont i celé plochy střech (komíny a vikýře zůstávají volné), keře jsou holé, sněží viditelně a u podvozků víří sníh s krátkou stopou za vlakem; po zastavení víření dohasne. Na podzim mají listnáče barevné koruny, padá z nich listí a pole jsou sklizená. Kachny, mlýnské kolo, vlajka a výpravčí ožívají; ovládání se nemění, držení přidává plyn a brzda má přednost. Save se nemění ([D-027](docs/decisions/027-seasons-and-life.md)).

Elektrické lokomotivy jiskří u troleje: měkký modrobílý svit drží přesně na kresleném dotyku sběrače a krátké jasné čárky odletují dozadu. Velikost se řídí kamerou, takže jiskření je čitelné i na telefonu s nejdelší soupravou. Četnost roste s rychlostí a plynem, na namrzlém zimním drátu je o čtvrtinu vyšší, rozjezd a průjezd podpěrou vyvolají větší skupinku. Při stání a brzdění nové jiskry nevznikají a tunel celý efekt zakryje ([D-016](docs/decisions/016-electric-locomotive-and-catenary.md)).

Podél trati vede místy souběžná okreska s auty v obou směrech a vzácněji v dálce dálnice se dvěma vozovkami a provozem ([D-029](docs/decisions/029-roads-and-vehicle-heading.md)). Auta jedou vždy čelem ve směru jízdy podle společného výpočtu čela, otáčejí koly a za pohybu mají drobný výfuk; při zastavení drží směr. Okreska a dálnice nevstupují do vesnic, měst ani na nádraží a jejich konce mizí za terénem. Přejezdy a závory dál čekají na poslední vůz ([D-021](docs/decisions/021-crossing-closes-in-view.md)). Formát save se nemění.

Volitelná [PWA a offline režim](docs/decisions/031-installable-offline-pwa.md) připraví po prvním online načtení úplný balík hry. Stav najde rodič v pauze po pěti aktivacích řádky Build během 3 s, v sekci „Aplikace a offline“: „online“, „připravuje se offline balík“, „offline připraveno“ nebo „offline není dostupné“, spolu s ID uloženého buildu. Počkej na „offline připraveno“; potom lze stránku obnovit bez sítě a hrát. Nové vydání čeká do zavření všech starých oken hry, jízdu nepřepíná ani nereloaduje. „Instalovat aplikaci“ se ukáže jen rodiči a pouze při skutečné nabídce browseru; Safari používá Sdílet → Přidat na plochu. Online hra instalaci ani service worker nevyžaduje. Prohlížeč může cache později odstranit. Instalace a offline na fyzickém Androidu, iOS a Tesle (bez ověřeného zařízení a firmwaru) jsou **NEOVĚŘENO**.

Všech 42 vozidel katalogu má finální detailní vektorovou grafiku, parní mašinky s pohyblivými táhly ([D-011](docs/decisions/011-vector-vehicle-art-and-atlas.md)). Jízda má [samostatný atlas vozidel vybrané soupravy a seedované sady protijedoucích vlaků](docs/decisions/019-journey-atlas-and-npc-fleet.md), oddělený od atlasu světa; přestaví ho výjezd z depa i obnova. Atlas světa obsahuje jen díly okolních regionů a sezón; po změně velikosti okna se nejdřív přerastruje vlak a svět jej do několika sekund následuje ([D-030](docs/decisions/030-world-atlas-region-window.md)). Depo dál skládá stejné SVG díly. Protijedoucí vlaky vybírají ze dvou parních nebo naftových typů lokomotiv a šesti typů vagonků s kresbou. Za elektrickou lokomotivou vede celou trasou trolejové vedení 128 u nad kolejí a nízký široký pantograf se drátu dotýká i na svahu, mostě a v tunelu; celý katalog včetně nákladů má pod drátem bezpečnou rezervu ([D-016](docs/decisions/016-electric-locomotive-and-catenary.md)). Krajina má finální vektorovou grafiku: kolej a násep ([D-012](docs/decisions/012-track-tiles-and-terrain.md)), pozadí biomů, logické lokality, vodu a zvířata ([D-013](docs/decisions/013-landscape-localities-and-backdrops.md)). Vlak kouří, víří sníh a listí, při prudkém brzdění odletí jiskra, tráva se houpe a občas přeletí ptáci či motýli ([D-014](docs/decisions/014-particles-and-small-animations.md)); omezené efekty hustotu sníží. Přejezdy mají skutečné závory, blikající světla a auta s cyklisty, kteří čekají, dokud neprojede poslední vagon ([D-015](docs/decisions/015-level-crossings.md)). Na souběžné koleji občas vyjede z tunelu protijedoucí vlak a na píšťalu odpoví ([D-017](docs/decisions/017-second-track-and-oncoming-train.md)). Vedle kamenných mostků a krátkých tunelů vede kolej také dlouhými skalními tunely, viadukty a ocelovými mosty ([D-026](docs/decisions/026-long-tunnels-and-bridges.md)). Vodní břehy doplňuje přívoz a mlýn, hory lanovka a lom; Moravská Sahara má nízké duny, borovice a vřes ([D-025](docs/decisions/025-farm-forest-content.md)). Tunelové portály mají ústí a vnější pilíř za vlakem, vnitřní pilíř a celý klenák před ním. Kryt všech krátkých i dlouhých skalních tunelů včetně zimní varianty zprůhlední na 50 % při přiblížení hráčovy soupravy do 80 u a při průjezdu, mimo tento rozsah se vrací k neprůhlednosti. Hora a horní tvář zůstávají plné; 50% kryt ukazuje vlak pouze před tmavým vnitřkem. Přechod 6 s⁻¹ používá simulační čas, při odchylce ≤ 0,002 se přichytí přesně k cíli, obnova nastaví cíl hned a pauza jej drží. Viditelnou bublinu pod průhledným krytem lze propíchnout; emise uvnitř horniny zůstává potlačená a již živé částice zachovávají hloubky. Ovládání, kamera a zvukové tlumení se nemění ([D-033](docs/decisions/033-tunnel-see-through-and-split-portals.md)). Zvuky jsou lokální nahrávky strojů, zvířat a prostředí ([D-022](docs/decisions/022-recorded-sounds.md)): 35 mono MP3, 1,86 MiB. Lesní zvířata mají samostatné reakce (liška přiznaný fallback lidských kroků v suchém listí); změny vrstev a převzetí slotu používají 150ms rampu, doznívání je omezené na 2 zdroje a strop všech zdrojů je 10, se dvěma parními rázy 11. PWA precache po prvním snímku stahuje MP3 soubory na pozadí spolu se zbytkem buildu pro offline hraní, i při vypnutých zvucích a bez gesta. Samotný AudioManager před prvním gestem nic nestahuje ani nezakládá AudioContext; zvuk dekóduje až na vyžádání. Při opakované návštěvě s aktivním service workerem a zachovaným úplným balíkem se soubory čtou z cache. Kola a motor reagují na jízdu, přejezd tiše zvoní ve výstraze a tunel tlumí kola i motor. Parní rázy mají koleno 4 rázy/s a plynulý strop 6 rázů/s; cílem je, aby se při plné rychlosti nezlily v bzučení (poslech NEOVĚŘENO). Pod kolenem zůstává dosavadní kadence ([D-035](docs/decisions/035-steam-chuff-rhythm.md)). Každá z deseti píšťal má vlastní identitu; elektrické typy mají přiznaný nahraný fallback. Seznam Zvuky ve skrytých vývojářských volbách umožňuje poslech všech ID; odkaz O zvucích — autoři a licence otevírá kredity všech nahrávek dodané přímo s buildem. Opožděné krátké reakce se po 250 ms zahodí. Poslech, hlasitost a fyzický tablet/Tesla zůstávají **NEOVĚŘENO**. Původ a licence jsou v [původu assetů](assets/SOURCES.md). Parametr `?renderer=canvas` vynutí Canvas renderer, `?debug=1` ukáže diagnostiku a `?quality=auto|standard|low` zvolí kvalitu jen pro dané načtení. `?perfgraph=1` zapne malý graf času snímků (vodítka 16,7 / 33,3 / 50 ms, nejvýš 10 překreslení/s); stejnou volbu „Graf času snímků“ nabízí skryté vývojářské menu. Diagnostika ukazuje vedle mediánu FPS také p95 a počet dlouhých snímků za celou jízdu a Podrobnosti → Kopírovat JSON zahrnují `framePacing` (kruh 1 800 snímků, CPU fáze, zahozený simulační čas, události, údaje zařízení). Postup záznamu 60s jízdy na tabletu vlastní [D-034](docs/decisions/034-ride-frame-pacing-instrumentation.md). Stejné volby, omezené efekty a číslo světa nastavíš i ve skrytých vývojářských volbách: v pauze pětkrát během 3 s aktivuj řádku Build (myš, dotyk, Enter nebo mezerník). „Použít a znovu načíst“ a „Výchozí“ načtou stránku znovu až po úspěšném uložení cesty a nastavení; platná adresa má před uloženými volbami přednost ([D-020](docs/decisions/020-developer-menu.md)). Zapnutá diagnostika při jízdě ukazuje jen dva drobné průsvitné řádky vlevo nahoře (výkon, renderer a kvalita; číslo světa, úsek, rychlost a počet vozidel) a neblokuje držení pro jízdu. V dev menu „Diagnostika – podrobnosti“ zobrazí české skupiny a „Kopírovat JSON“ celý vzorek pro hlášení chyby. Aktuální svět má „Kopírovat číslo“, „Znovu tento svět od začátku“ a „Nový náhodný svět“; oba restarty zachovají soupravu a uloží novou cestu až po úspěšném uložení původní. Vrátí pauzu na startu, odstraní dev parametry adresy a nepoužijí rozpracované volby. Při chybě uložení původní cesta zůstává a panel vysvětlí důvod. Nedostupná nebo zamítnutá schránka nabídne označený text pro ruční kopírování. Formát save se nemění ([D-020](docs/decisions/020-developer-menu.md)). Ruční kopírování funguje i dlouhým dotykem → Kopírovat. Úspěšný restart ukončí staré zvuky a začne efekty a jejich odpočty od nuly; při chybě uložení zůstane původní stav. Pauza ukazuje drobně číslo světa; `?seed=123` začne každou novou cestu ve světě 123, takže jde svět zopakovat ([D-007](docs/decisions/007-world-seed-in-url.md)). Uloženou cestu „Pokračovat“ parametr nemění. Ověření je v [protokolu v0.1](docs/validation/2026-10-09-v0.1.md) a v [protokolu iterace podle dokumentu 14](docs/validation/2026-10-10-iterace-upravy.md); fyzický tablet a Tesla jsou zatím **NEOVĚŘENO** ([matice zařízení](docs/device-tests/v0.1.md)). Scénky přijdou v dalších milnících [plánu](vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md); co je hotové, co zbývá a v jakém pořadí, shrnuje [stav a další kroky](docs/roadmap.md).

### Spuštění a nasazení

```bash
volta run npm run dev -- --host 0.0.0.0
volta run npm run build
volta run npm run preview -- --host 0.0.0.0
```

`dev` spustí vývojový server Vite, `build` vytvoří statický web v `dist/` a `preview` jej servíruje lokálně. Proměnná `VLACEK_BASE` nastaví cestu nasazení (výchozí je kořen domény). Pro podadresář ji předej buildu i preview, např. `VLACEK_BASE=/vlacek/ volta run npm run build` a `VLACEK_BASE=/vlacek/ volta run npm run preview`; web je pak na `http://localhost:4173/vlacek/`. Server nemá SPA fallback, takže chybějící soubor vrací 404, nikoli HTML. Každý build nese identifikátor `<verze>+<commit>` v `<meta name="vlacek-build">`.

Offline testuj nad produkčním `preview`; `dev` service worker neregistruje. Build automaticky vytvoří manifest, worker, kredity a verzovaný inventář ze skutečného `dist/`, takže pokrývá i nově přidané SVG a MP3. Postup testu a odstranění workeru je ve [vývojovém návodu](docs/development.md).

Po úspěšných kontrolách na větvi `master` workflow nasadí build na [GitHub Pages](https://pavelpancocha.github.io/vlacek/). Nasazuje se aktuální průběžná verze hry. Podrobnosti jsou ve [vývojovém návodu](docs/development.md#nasazení-na-github-pages) a v [rozhodnutí D-002](docs/decisions/002-github-pages.md).

Podrobná instalace, příkazy, TDD, chování hooku a omezení kontrol jsou ve [vývojovém návodu](docs/development.md); volbu prostředí vysvětluje [rozhodnutí D-001](docs/decisions/001-toolchain.md).

### Pravidla autority

- **POTVRZENO:** explicitní požadavek zadavatele, souhrn v dokumentu 12. Má přednost před dřívějšími návrhy v konverzaci.
- **VÝCHOZÍ VOLBA:** rozhodnutí doplněné tímto zadáním, aby implementace nečekala na další otázky. Platí pro V1, dokud se vědomě nezmění.
- **POZDĚJI:** není součástí akceptace V1.
- Číselné parametry vlastní dokument 13; katalog obsahu dokument 06; logiku jednotlivých oblastí dokument uvedený v rozcestníku.
- Výkonnostní rozpočty jsou cíle k ověření. Nesmí být prezentovány jako naměřené výsledky.

Pokud se při implementaci objeví rozpor, zachovat potvrzený požadavek, zapsat krátké rozhodnutí a opravit související dokument i test. Nevracet automaticky starší zamítnuté nápady.

## Nejdůležitější invarianty

1. Vlak nikdy nevyjede ze své koleje, nejede pozpátku a nemůže havarovat.
2. Bez prstu se plynule zastavuje; automatické rozjezdy a povinné zastávky nejsou povolené.
3. Brzda má přednost před plynem. Menu a tlačítka nepropouštějí dotyk do řízení.
4. Dotyk zvířete či jiného objektu může zároveň pohánět vlak; žádná interakce nepřepíná scénu ani nezastavuje jízdu.
5. Po pauze, ztrátě fokusu nebo obnově stránky nejsou aktivní staré dotyky; k jízdě je potřeba nový dotyk.
6. Všechny vagonky sledují tentýž geometrický průběh tratě, každý ve své poloze.
7. Trať se nesmí odstranit před posledním vagónkem. Přejezd se neotevře mezi lokomotivou a koncem soupravy.
8. Žádný typ vagónku není podmínkou scénky. Jediná globální vazba typu lokomotivy na svět je elektrifikace; další odlišnosti jsou audiovizuální.
9. Nekonečnost znamená průběžně generovaný svět s omezenou pamětí, ne předem vygenerovanou nekonečnou mapu.
10. Základní online hra nesmí vyžadovat PWA instalaci, fullscreen, service worker ani trvalé místní úložiště.

## Co má implementátor skutečně dodat

Zdrojový kód, automatické testy, vlastní nebo řádně použitelné assety a jejich evidenci, reprodukovatelný build, návod ke spuštění, nasazení statické verze, popis ukládání a aktualizací a vyplněnou matici testovaných zařízení. V1 obsahuje celý katalog, nikoli jen technickou ukázku s jednou lokomotivou.

Technický prototyp a menší průběžné milníky jsou povolené a žádoucí. Nejsou náhradou finálního rozsahu.
