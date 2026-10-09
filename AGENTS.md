# Implementační instrukce pro projekt Vláček

## Úkol

Implementovat webovou hru podle [README.md](README.md) a navázaných specifikací. Toto předání je dokumentace, ne existující hotová aplikace. První výstup vývoje má být skutečně spustitelný vertikální prototyp; následné milníky doplní celý rozsah V1.

Při vložení balíčku do `docs/spec/` je vstupním bodem `docs/spec/README.md`. Je-li repozitář prázdný, založ standardní projekt v jeho kořeni, dokumentaci ponech oddělenou od `src/`. Existující projekt nejprve prohlédni a nevytvářej vedle něj bezdůvodně druhou aplikaci.

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

## Pracovní postup

Začni M0: spustitelný základ, dotykové řízení, jednoduchá souprava a měření. Potom postupuj podle [10_IMPLEMENTACNI_PLAN.md](10_IMPLEMENTACNI_PLAN.md). Každý dokončený řez musí fungovat, ne pouze rozšiřovat seznam prázdných souborů.

Nejdřív stabilizuj jednotky, vzorkování tratě, soupravu a input kontrakt; pak vyráběj mnoho obsahu. U konkrétní chyby generátoru vytvoř regresní seedový test. Kosmetické nejasnosti řeš konzistentním výchozím návrhem a zapiš, místo dalšího dlouhého dotazníku.

Před dokončením změny spusť relevantní testy, typecheck, lint a build. U celého vydání také validaci katalogu/assetů, E2E, offline aktualizační testy a rozpočty. Neoznačuj neprovedený test jako úspěšný.

## Co vykazovat při předání implementace

Co skutečně funguje, co bylo ověřeno, příkazy ke spuštění, build/release ID, testovací výsledky a známá omezení. U Tesly uveď konkrétní firmware a zařízení, nebo výslovně NEOVĚŘENO. Desktopová emulace není fyzický test Tesly.

Výchozí hodnoty dokumentu 13 jsou laditelné, ale změna nesmí potichu omezit katalog, počet vagonků nebo bezpečné chování přejezdu. Pokud se potvrdí platformní omezení, dolož je měřením a zapiš alternativu. Neřeš je bez důkazu plošným přepisem na jiný engine.

## Startovní zadání pro kódovacího agenta

> Načti `docs/spec/README.md` a navázané dokumenty projektu Vláček. Implementuj skutečnou webovou hru, nikoli další návrhový dokument. Začni technickým vertikálním řezem M0/M1 podle implementačního plánu a připrav reprodukovatelné spuštění a testy. Zachovej touch-to-drive, plynulý dojezd, prioritu brzdy, samostatnou geometrii vagonků a oddělení domény od renderu. Nevkládej minihry, povinné zastávky, backend ani závislost scén na nákladu. Používej výchozí rozhodnutí specifikace, eviduj nové technické volby a rozlišuj dokončené funkce od neověřené podpory fyzických zařízení. Cílový rozsah V1 je celý katalog a funkce specifikace, nikoli jen první prototyp.
