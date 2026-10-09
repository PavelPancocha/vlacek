# Implementační instrukce pro projekt Vláček

## Úkol

Implementovat webovou hru podle [README.md](README.md) a navázaných specifikací. Toto předání je dokumentace, ne existující hotová aplikace. První výstup vývoje má být skutečně spustitelný vertikální prototyp; následné milníky doplní celý rozsah V1.

V tomto repozitáři je vstupním bodem kořenový [README.md](README.md); dokumenty 01–13 jsou ve složce `vlacek-predavaci-balicek/`. Kořenový `AGENTS.md` vlastní pracovní postup, jednotlivé specifikace vlastní produktové kontrakty. Při případném přesunu do `docs/spec/` současně oprav odkazy a ponech jedinou autoritativní kopii specifikací. Je-li repozitář bez aplikace, založ standardní projekt v jeho kořeni, dokumentaci ponech oddělenou od `src/`. Existující projekt nejprve prohlédni a nevytvářej vedle něj bezdůvodně druhou aplikaci.

## Co přečíst před kódováním

Povinně README, dokumenty 01, 02, 03, 04, 08, 10, 11, 12 a 13. Před obsahem načti katalog 06, před scénkami 05 a před grafikou 07. Před instalací a distribucí čti 09. Zachovej všechny explicitní požadavky a respektuj vyznačené výchozí volby.

## Nepřepisuj produktový záměr

- Držení herního světa pohání vlak; puštění znamená dojezd. Žádný automatický tempomat jako výchozí chování.
- Viditelná brzda vlevo dole a gesto doleva; UI nepohání vlak, brzda vítězí nad plynem.
- Zvíře může reagovat zároveň s plynem. Všechny scénky zůstávají v hlavním pohledu.
- Nádraží lze projet. Žádné povinné úkoly, minihry a vazba scénky na typ nákladu.
- Deset lokomotiv a celý 32druhový katalog nejsou nahrazené několika placeholdery. Prototyp je pouze milník.
- Elektrická lokomotiva znamená vedení v celé trase, včetně mostů a tunelů.
- Až 100 vagonků, žádná reálná tažná fyzika, havárie, ztráta vagonků ani couvání.
- Online web je základ, PWA nadstavba. Žádné účty, backend, externí herní API nebo App Store jako podmínka.

## Technické zásady

Výchozí stack: TypeScript strict, Phaser 4.2.1, Vite, Vitest, Playwright; přesné verze uzamkni. Zkontroluj skutečné API instalované verze frameworku. Nepřidávej React, Redux, ECS, rigid-body engine, backend ani nativní Android projekt, dokud není konkrétní důvod měnící rozsah.

Doména nesmí importovat Phaser, DOM, localStorage ani audio API. Generování je čisté, seedované, s oddělenými klíči náhodnosti. InputReducer má jednotkové testy. Save má runtime validaci a bezpečnou obnovu. Pro dlouhý vlak uchovej kolej za posledním vagónkem; culling obrázků není culling existence soupravy.

Používej jeden router vstupů, jednu simulační smyčku a jasný pořádek automatů. Každý aktér má definovanou identitu a životní cyklus. Žádné anonymní timery a event listenery bez cleanupu při odstranění chunku.

Veškeré herní assety jsou součástí webového buildu a mají evidovaný původ. Runtime nepoužívá generativní AI ani externí fontový či assetový server. Dočasné assety jsou povolené jen v průběžných milnících a musí být označené.

## Dlouhodobá udržitelnost

- Před změnou najdi vlastníka chování a všechny dotčené volající, testy, fixtures, konfigurace a datové kontrakty. Měň nejmenší úplný řez; nesouvisející refaktoring odděl. Zachovej cizí rozpracované změny.
- Rozšiřuj existující moduly a datové katalogy. Nové rozhraní, závislost nebo obecnou abstrakci přidej až pro konkrétní potřebu. Nevytvářej předem pluginový systém ani prázdné vrstvy pro budoucí funkce.
- Od M0 vynucuj hranice domény typecheckem a lintem: doménový TypeScript projekt bez DOM typů, zákaz importů do renderu, UI, platformy a Phaseru včetně cest přes aliasy/reexporty. Doménové testy běží v Node bez browserových globálů. Čas a náhodnost přicházejí explicitně; doména nesmí číst `Date.now()`, `performance.now()` ani `Math.random()`.
- Používej `strict`, `noUncheckedIndexedAccess` a `exactOptionalPropertyTypes`. `any`, potlačení TypeScript/lint chyb a neověřené typové přetypování nesmějí obcházet validaci nebo kontrakty; nutnou výjimku lokálně zdůvodni. Jednotky a souřadné soustavy označ v názvech a kontraktech.
- Při změně save, katalogových ID nebo generátoru vyhodnoť kompatibilitu podle dokumentu 08. Udržuj malé fixtures skutečně vydaných formátů a testy jejich obnovy/migrace; neznámou novější verzi nepřepisuj. Změna geometrie nesmí potichu změnit rozehranou trasu.
- Každý nový zdroj událostí, timer, rendererový objekt a cache má vlastníka a cestu uvolnění. Změny lifecycle ověř opakovaným vstupem/odchodem a cleanupem; výkonové změny měřením se 100 vagonky. Optimalizace nesmějí měnit herní invarianty.
- Zaznamenej přesný Node patch, verzi správce balíčků a závislostí; používej jeden lockfile a `npm ci`. Aktualizace závislostí odděl od funkčních změn, ověř jejich skutečné API a spusť dotčené kontroly. Neprováděj automatické vynucené upgrady jen kvůli vyčištění hlášení auditu.
- Významnou změnu kontraktu nebo technické volby zapiš stručně do `docs/decisions/`: důvod, rozhodnutí, důsledky a kompatibilita. Aktualizuj příslušnou specifikaci a testy ve stejné změně. Dočasné omezení musí mít konkrétní podmínku odstranění; žádné obecné sliby „vyřeší se později“.

## TDD jako výchozí pracovní postup

Nové chování a opravy chyb implementuj cyklem **red → green → refactor**, od prvního pohybového kroku a InputReduceru v M0:

1. Vyber malý pozorovatelný výsledek a odpovídající akceptační ID z dokumentu 11, pokud existuje.
2. Napiš nejmenší test očekávaného chování a spusť jej **před implementací**. Potvrď, že selhal kvůli chybějícímu či chybnému chování; chyba instalace, importu nebo prostředí není důkaz red.
3. Přidej minimální produkční kód a spusť test znovu do green. Teprve potom refaktoruj při zachování zelených testů a spusť dotčenou sadu.
4. U opravy nejdřív zachyť reprodukci. U generátoru uchovej seed, verzi, index chunku a relevantní stav soupravy; při fuzzování vypiš reprodukovatelný seed.
5. Testuj veřejné chování a invarianty, ne pořadí privátních volání. Doménové testy mají explicitní tick/seed, bez skutečného čekání a sítě. Mockuj platformní hranice, ne logiku, kterou má test ověřit. Integrace ověřují skutečný InputRouter a spolupráci automatů; Playwright pokrývá uživatelské průchody.
6. V předání uveď příkaz a skutečný výsledek red i green. Nelze-li test spustit, uveď překážku a neoznačuj chování za ověřené. Čistý refaktoring začni zeleným výchozím stavem; chybí-li pokrytí měněného chování, doplň nejdřív charakterizační test.

Dokumentace, čistě výtvarné úpravy a triviální konfigurace nepotřebují umělý unit test; ověř odkazy, příslušný validátor nebo vizuální výsledek. Procento coverage nenahrazuje testy brzdové priority, ztráty vstupu, geometrie celé soupravy, přejezdů a bezpečné obnovy. Neupravuj správnou očekávanou hodnotu jen proto, aby prošla vadná implementace. Flaky test neopravuj pouhým přidáním čekání, retries nebo trvalým skipem.

## Dokumentace je součást definice hotové práce

Každá nová funkce, oprava měnící chování, nástroj, závislost, konfigurační volba a změna pracovního postupu musí mít odpovídající dokumentaci **ve stejné změně a commitu**. Bez ní není práce hotová. Aktualizuj existujícího vlastníka informace; nevytvářej druhý protichůdný návod.

- U funkce popiš nové chování, ovládání, omezení a dopad na uložená data; aktualizuj příslušnou specifikaci a akceptační testy.
- U nástroje nebo závislosti popiš účel, připnutou verzi nebo její autoritativní zdroj, instalaci, přesné příkazy, konfiguraci a lokální/CI chování. Vysvětli obnovu prostředí a relevantní diagnostiku selhání.
- Změní-li se spuštění, nastavení prostředí, testování nebo distribuce, aktualizuj README a navázaný provozní návod. Významná rozhodnutí patří do `docs/decisions/`.
- Ověř dokumentované příkazy a odkazy. Výsledky rozlišují lokální test, GitHub Actions a skutečné zařízení; neprovedené kroky označ NEOVĚŘENO.
- U změny bez dopadu na chování nebo postup (například interní refaktoring) výslovně zdůvodni v předání, proč stávající dokumentace zůstává správná. Není to výjimka pro nové funkce nebo tooling.

## Automatické kontroly a Git hooky

GitHub Actions a spustitelné testy musí existovat **od prvního dne, před herním M0**. Aktuální tooling a jeho meze popisuje [vývojový návod](docs/development.md). Používej **Husky + lint-staged**, ESLint pro TypeScript a Prettier pro formátování; přesné kompatibilní verze jsou v `package.json` a lockfilu. Hooky i CI volají stejné projektové kontroly. Následující tabulka určuje cílové brány; kontroly hry přidávej zároveň s příslušnou implementací, nikdy jako prázdné úspěšné skripty.

| Kdy                                   | Co kontrolovat                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-commit                            | Na staged souborech formátování, ESLint s nulovou tolerancí warningů včetně hranic domény, konfliktní značky a lokální odkazy při změně Markdownu. Přidat kontrolu tajných údajů a nechtěných velkých souborů; konkrétní limit a výjimky pro herní assety odvodit z dokumentu 07.  |
| Před předáním změny a v CI každého PR | Čistá instalace, formátování, úplný projektový typecheck, lint, všechny unit a integrační testy bez watch režimu a produkční build. Od zavedení katalogu také jeho validace a validace assetů; od prvního hratelného řezu základní Playwright průchod řízením, pauzou a obnovením. |
| Dotčená oblast a vydání               | Rozšířené E2E, seedové stress testy, dlouhá simulace, rozpočty a po zavedení PWA aktualizace/offline nad produkčním buildem. Před vydáním celý relevantní rozsah dokumentu 11 a skutečná matice zařízení.                                                                          |

Pre-commit má být rychlý a bez síťových volání; build, browsery, dlouhé testy a síťový audit závislostí do něj nepatří. Začni úplnou rychlou unit sadou v CI; výběr pouze souvisejících testů přidávej až podle měření, s úplnou sadou jako povinnou CI kontrolou.

Hook nesmí zahrnout uživatelovy unstaged úpravy ani provádět `git add .`. Výchozí kontroly soubory pouze čtou; automatické opravy spouštěj explicitně. Při zavedení ověř i částečně staged soubor, smazání/přejmenování a cestu s mezerou. Typecheck spouštěj nad projektem, ne předáním seznamu staged `.ts` souborů.

Lokální hook lze obejít; požadované CI kontroly před mergem jsou skutečná brána a jejich vynucení musí být nastavené v hostingu repozitáře. CI nesmí hlásit úspěch při nenalezených testech, vypnutém lintu nebo chybějícím validátoru dokončené funkce. Při bootstrapu dolož, že úmyslně vadný test, zakázaný import a typová chyba kontroly skutečně shodí. Instalaci hooků a příkazy dokumentuj v README; dosud nezavedenou kontrolu označ jako chybějící.

## Pracovní postup

Začni M0: spustitelný základ, dotykové řízení, jednoduchá souprava a měření. Potom postupuj podle [10_IMPLEMENTACNI_PLAN.md](vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md). Každý dokončený řez musí fungovat, ne pouze rozšiřovat seznam prázdných souborů.

Nejdřív stabilizuj jednotky, vzorkování tratě, soupravu a input kontrakt; pak vyráběj mnoho obsahu. U konkrétní chyby generátoru vytvoř regresní seedový test. Kosmetické nejasnosti řeš konzistentním výchozím návrhem a zapiš, místo dalšího dlouhého dotazníku.

Před dokončením změny spusť relevantní testy, typecheck, lint a build. U celého vydání také validaci katalogu/assetů, E2E, offline aktualizační testy a rozpočty. Neoznačuj neprovedený test jako úspěšný.

## Co vykazovat při předání implementace

Co skutečně funguje, co bylo ověřeno, příkazy ke spuštění, build/release ID, testovací výsledky a známá omezení. U Tesly uveď konkrétní firmware a zařízení, nebo výslovně NEOVĚŘENO. Desktopová emulace není fyzický test Tesly.

Výchozí hodnoty dokumentu 13 jsou laditelné, ale změna nesmí potichu omezit katalog, počet vagonků nebo bezpečné chování přejezdu. Pokud se potvrdí platformní omezení, dolož je měřením a zapiš alternativu. Neřeš je bez důkazu plošným přepisem na jiný engine.

## Startovní zadání pro kódovacího agenta

> Načti kořenový `README.md` a navázané dokumenty ve `vlacek-predavaci-balicek/`. Implementuj skutečnou webovou hru, nikoli další návrhový dokument. Začni technickým vertikálním řezem M0/M1 podle implementačního plánu, postupuj pomocí TDD red → green → refactor a připrav reprodukovatelné spuštění a testy. Zachovej touch-to-drive, plynulý dojezd, prioritu brzdy, samostatnou geometrii vagonků a oddělení domény od renderu. Nevkládej minihry, povinné zastávky, backend ani závislost scén na nákladu. Používej výchozí rozhodnutí specifikace, eviduj nové technické volby a rozlišuj dokončené funkce od neověřené podpory fyzických zařízení. Cílový rozsah V1 je celý katalog a funkce specifikace, nikoli jen první prototyp.
