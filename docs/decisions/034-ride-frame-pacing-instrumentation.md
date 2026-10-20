# D-034 — Rytmus snímků jízdy a omezení průběžných alokací

Datum: 2026-10-20. Stav: přijato pro první kolo měření; fyzický tablet a Tesla NEOVĚŘENO.

## Důvod

Majitel na Android tabletu s Chrome v buildu `0.1.0+b211e87` hlásí přibližně
30 FPS a škubnutí 2–3× za sekundu i při stabilní hodnotě FPS. Samotný medián
z [D-032](032-startup-and-ride-performance.md) pravidelnost neukazuje. `auto` používá
standard (DPR nejvýš 1,5, bez limitu), pouze `low` používá Phaser limiter 30 FPS.
Pevná simulace zůstává 60 Hz, nejvýš pět doháněných kroků, s interpolací kamery
a vlaku. Tato změna nemění limiter, simulaci, geometrii, pořadí vrstev, save ani
`TRACK_GENERATOR_VERSION`.

## Záznam a jeho význam

`?debug=1` zapne `framePacing` v existujícím snapshotu a v JSON z podrobností
dev menu. `?perfgraph=1` zapne stejný záznam i bez HUD; oba přepínače jsou také
ve skrytém menu. Bez obou voleb sonda, její buffery, pozorování dekódování a
graf vůbec nevznikají. Běžná statistika FPS používá také pevný typed-array kruh.

- Kruh má 1 800 řádků v časovém pořadí, přibližně posledních 60 s při 30 FPS.
  `columns` popisuje číselné sloupce: pořadí snímku, čas od navigace, interval
  aktualizací vyvolaných rAF, CPU celé `RideScene.update` včetně aplikačního
  kroku, počet simulačních kroků, zahozené sekundy a CPU fáze world window,
  track/chunks (včetně synchronní konstrukce a pečení), efekty, objekty/vozidla,
  audio, UI a save. Simulace je zvlášť, s odečteným save. Součet fází nemusí
  pokrýt celou aktualizaci (např. kamera a pozadí); GPU a fyzická prezentace
  pixelů nejsou CPU čas aktualizace.
- Interval v řádku je čas **před** aktuální aktualizací. Její náročná práce se
  obvykle projeví intervalem následujícího řádku. Graf proto barví dlouhý
  interval podle dominantní CPU fáze předchozího řádku. Barva je vodítko pro
  korelaci, nikoli důkaz příčiny GC, GPU čekání nebo práce browseru.
- Počítadla `overMedian`, `over50`, `over100` pokrývají celou aktivní jízdu,
  přes pauzy, od nového objektu jízdy. První práh je >1,5× průběžný medián
  celé jízdy, kvantovaný histogramem po 0,25 ms (poslední koš >=1 s).
  Odhad periody je medián posledních nejvýš 1 800 mezer mezi těmito snímky,
  v ms i počtu snímků. Pauza nevytváří jeden umělý dlouhý interval.
- Kruh 256 událostí obsahuje číslo snímku, čas, délku, číselný druh a detail.
  Druhy jsou konstrukce chunku (detail = index), kompozice (detail = počet
  skutečných `readPixels`), atlasová CPU slice/upload/aktivace, save a dekódování
  zvuku. Kompozice se měří od zaúčtování jejího canvasu do dokončení přenosu
  textury; nezahrnuje výpočet obdélníků před alokací canvasu. Počet readbacků
  patří této kompozici, ne celému chunku. Dekódování je asynchronní **wall
  latency**, ne CPU; detail 1 značí úspěch, 0 chybu, frame index patří začátku.
  Záznam nijak nemění AudioManager, AudioDirector ani jejich scheduling.
- `summary` je první, číselné kruhy se při „Kopírovat JSON“ vypisují jeden řádek
  na vzorek. Snapshot obsahuje UA, DPR, velikost canvasu, renderer a profil.
  `estimatedRefreshHz` odhaduje panel z nejmenšího samostatně pozorovaného rAF
  intervalu >=4 ms od načtení. Funguje i při limitu 30 aktualizací/s. Není to
  zjištění fyzických parametrů panelu; VRR, časová přesnost a zatížení jej zkreslí.

Sonda nepoužívá časovače pro každý snímek: zapisuje skaláry do předalokovaných
`Float64Array`/`Uint32Array`, bez třídění, closure a řetězců v průběžné cestě.
Buffery mají dohromady asi 251 KiB. Zapisovač `FramePacing` řadí a kopíruje až při exportu; stávající statistika
HUD dál vytváří seřazenou kopii 600 intervalů nejvýš 4×/s.
Čistý Node mikrobenchmark zapisovače (1 000 000 snímků, všech osm fází)
naměřil 0,083–0,092 µs/snímek; nezahrnuje browserové hodiny ani kreslení grafu
a není důkazem ceny na tabletu. Stávající HUD obnovuje medián, p95 a počet dlouhých snímků nejvýš 4×/s.
Malý DOM canvas 320 × 76 px se kreslí nejvýš 10×/s; nepřidává Phaser objekty,
textury ani uploady do herního WebGL. Má `pointer-events: none` a zaniká s
aplikací. Dev-only obaly účetní knihy kompozic, `readPixels` a
`decodeAudioData` se při shutdown/dispose vracejí na původní metody. Bez grafu
se canvas ani jeho kreslení neprovádějí.

## Jak majitel zachytí tablet

1. Otevři aktuální build na tabletu s `?debug=1`. Poznamenej model tabletu,
   Android, verzi Chrome, build a nastavenou obnovovací frekvenci displeje.
2. Vyber parní mašinku a nejdelší dovolenou soupravu. Po úplném zobrazení světa
   drž plyn **60 s** na plnou rychlost. Neotvírej diagnostické podrobnosti během
   měření. Volitelně přidej `&perfgraph=1` pro viditelný rytmus.
3. Pauza → pět aktivací řádky Build během 3 s → Diagnostika – podrobnosti →
   **Kopírovat JSON**. Při chybě schránky označený text zkopíruj dlouhým dotykem.
   Vlož celý JSON spolu s popisem, kdy bylo škubání vidět, a údajem displeje.
4. Pro nový srovnatelný záznam začni znovu stejný svět a stejnou soupravu,
   vypni Zvuky a zopakuj 60 s i export. Uveď, zda byl graf zapnutý.
5. Zopakuj stejnou cestu s `?debug=1&quality=low` (případně `&perfgraph=1`).
   Poznamenej skutečný režim displeje a exportované `estimatedRefreshHz`.
   Porovnáváme také rytmus 33/50 ms, ne jen údaj „30 FPS“.

## Bezpečné změny alokací

- Výběr atlasových klíčů běží až při změně seedovaného seznamu regionů. Levná
  brána používá číslo seedu, floor/ceil hranice chunkového okna a následně ID
  regionů; změna raster scale nezávisle přestaví požadavek. Stejné klíče a
  měřítka vracejí tentýž požadavek. `join` se provádí až při skutečné změně.
  Async publikace se dál obsluhuje každý snímek v původním pořadí. Regrese
  porovnává celou původní posloupnost požadavků na seedu 20261009 přes více
  než dvě regionální hranice a změnu scale.
- UI porovnává dříve serializovaná pole přímo, včetně důvodu/originu obrazovky,
  fullscreen, obsahu notices a identity neměnného draftu. DOM aktualizace a
  zachování formulářů zůstávají stejné.
- Animované sezónní obrázky mění texture pouze při změně stránky nebo frame,
  `world-part` pouze při změně frame; změna stránky atlasu zůstává zachována.
- Zvukové intervaly tunelů se přestaví jen při změně seedu/prvního/posledního
  uchovaného chunku. Deduplikace dlouhých tunelů a `coveredFraction` zůstává
  stejná. `contextAt` se čte jednou pro biome i sezónu.
- Scéna znovu používá mapu přejezdů, seřazené indexy chunků, pole statistik,
  viditelné ID zvířat, ID NPC efektů a pole emitterů/kol. Nejde o odstranění
  všech alokací hry: geometrické výsledky, částice, objekty emitování a další
  konstrukce zůstávají mimo tento bezpečný řez.

## Mikrobenchmark výběru okna

Node 24.21.0, seed 20261009, stejné nezměněné okno 0–6800 u, 379 dílů,
199 světových klíčů. Tři opakování pod `/tmp/vlacek-playwright.lock`; čas byl měřen **bez** heap profileru,
alokace odděleně vzorkováním V8 po 4 096 B s uchováním již sesbíraných objektů.

| Cesta                  | ms/volání (3 běhy)                   | odhad alokovaných B/volání (3 běhy) |
| ---------------------- | ------------------------------------ | ----------------------------------- |
| Základ 7999022         | 0,266 / 0,262 / 0,338                | 421 456 / 426 220 / 421 044         |
| Cache nezměněného okna | 0,00000826 / 0,00000977 / 0,00000987 | 0 / 0,041 / 0                       |

Vzorkované bajty jsou odhad, nikoli přesné počítání každé alokace. Měnící se
okno nadále provádí skutečný výběr; čísla cache nejsou slibem ceny nové krajiny.
Původní cesta představuje asi 12,7 MB/s při 30 aktualizacích/s. Skript a syrová
opakování jsou v pracovním `_runs/perf/playtest-perf-1/` a v předání lane.

## Laboratoř a druhé kolo

`measure:perf` zachovává pořadí nezávisle zaznamenaných rAF intervalů, během
měřicího okna nečte snapshot, na konci čte `framePacing` jednou. Laboratorní
`longFrames` používají pro srovnání se starým buildem pevný medián celého
měřicího okna; `framePacing.summary` používá průběžný medián a celou jízdu.
Tato dvě počítadla tedy nemusejí být shodná. Volby
`PERF_CPU_RATE=4` a `PERF_TRACE=1` přidávají CDP CPU throttle a trace s v8 GC /
devtools.timeline a blink.user_timing. `gc` počítá pouze vnější dokončené
MinorGC/MajorGC slices hlavního vlákna **měřené herní stránky**, nikoli
vnořené fáze nebo service worker. Harness získá ID hlavního rámce přes CDP
session této stránky a v jejím hlavním JS kontextu vloží jedinečné
`performance.mark` značky obsahující toto ID. Parser vybere jejich pid/tid,
ověří shodu obou značek a metadata `thread_name = CrRendererMain`; při
chybějících nebo rozporných značkách měření selže, nevybírá první renderer.
`workerGc` samostatně uvádí GC vláken označených v metadatech jako worker
(včetně service workeru, případně jiných workerů v trace) a jejich pid/tid/názvy.
GC jiného renderer main vlákna se do žádného z těchto dvou součtů nedostane.

Zapnutí i vypnutí samplingu uloží `performance.now()` a v témže synchronním
kroku vloží značku s explicitním `startTime` této hodnoty. `samplingWindow`
exportuje oba časy stránky v ms, trace hranice v µs, skutečnou délku okna,
URL, ID rámce, značky a renderer pid/tid. První rAF interval přesahující
počátek se vynechá; ukládají se celé intervaly uvnitř okna. GC se počítá jen
při kladném překryvu s polootevřeným oknem [start, end); délka překryvu je
u hraničních GC oříznuta. Zkopírování pole intervalů i snapshot proběhnou až
po vypnutí samplingu a ukončení trace, takže alokace exportu nezvyšují GC
souhrn. Regresní fixture obsahuje herní renderer, cizí renderer, service i
dedicated worker, GC před/po okně a přes obě jeho hranice.

Trace i throttle měření zatěžují; stejné volby musí mít základ i nový kód.
Přesné příkazy a opravené lokální výsledky jsou v předání lane
`playtest-perf-2`; integrátor zopakuje srovnání bez ostatních lane.

Desktopový headless Chromium není fyzický tablet. Druhé kolo začne až po
majitelových JSON: rozhodne se, zda a kde rozdělit konstrukci chunků, jak
omezit synchronní `readPixels`, a zda upravit limiter. [Hotspot #2 v D-032](032-startup-and-ride-performance.md)
se nerozděluje naslepo. Atlasové `gl.getError`, pečení statických Graphics a
ukládání mohou mít vlastní špičky; tato změna je nepřepisuje.

## Dvanáct lokálních 60s oken — opravené měření playtest-perf-2

Základ `7999022` proti head `dc17d3f` (produkční kód se oproti `e3d5c75`
neměnil). Tato série **nahrazuje** tabulku z `playtest-perf-1`, která chybně
sčítala GC rendereru a service workeru a neměla výslovně společné hranice.
Nová tabulka odděluje `CrRendererMain` měřené herní stránky a worker vlákna.

Všechny běhy měly seed 20261009, parní nejdelší smíšený vlak (12 vozidel),
plný plyn, 1280 × 720, WebGL, zvuk vypnutý, quality auto a **PERF_TRACE=1**.
Tabulka zahrnuje režii trace. `base` měl změněný pouze totožný měřicí harness
s parserem v detached checkoutu; `head` byl čistý commit `dc17d3f`. Pro každé
ze tří opakování se střídalo ×1 base/head, potom ×4 base/head, každý běh pod
`/tmp/vlacek-playwright.lock`. `dirty` u základního buildu označuje pouze
měřicí harness, nikoli změnu produkčního základu.

| Kód  | CPU / běh | medián / p95 / worst ms | >1,5×med / >50 / >100 | perioda ms / frames | renderer GC počet / součet ms / max ms | worker GC počet / součet ms / max ms |
| ---- | --------- | ----------------------- | --------------------- | ------------------- | -------------------------------------- | ------------------------------------ |
| base | ×1 / 1    | 16.7 / 33.4 / 83.3      | 876 / 7 / 0           | 66.6 / 3            | 193 / 151.133 / 12.831                 | 2 / 8.446 / 6.034                    |
| base | ×1 / 2    | 33.3 / 33.4 / 83.3      | 55 / 23 / 0           | 83.4 / 2            | 156 / 161.287 / 10.790                 | 2 / 12.000 / 6.422                   |
| base | ×1 / 3    | 33.3 / 50.0 / 100.0     | 291 / 82 / 0          | 83.3 / 2            | 133 / 147.562 / 10.303                 | 2 / 11.509 / 5.999                   |
| base | ×4 / 1    | 33.3 / 50.0 / 150.0     | 209 / 69 / 4          | 150.0 / 4           | 119 / 290.623 / 5.835                  | 2 / 7.843 / 5.410                    |
| base | ×4 / 2    | 33.4 / 66.7 / 266.7     | 147 / 187 / 18        | 116.7 / 1           | 110 / 377.973 / 86.105                 | 2 / 8.636 / 5.949                    |
| base | ×4 / 3    | 33.4 / 50.1 / 183.4     | 89 / 123 / 7          | 333.4 / 8           | 107 / 342.219 / 65.942                 | 2 / 7.904 / 6.315                    |
| head | ×1 / 1    | 16.7 / 33.4 / 50.1      | 711 / 1 / 0           | 83.3 / 4            | 141 / 105.338 / 9.670                  | 2 / 17.665 / 15.475                  |
| head | ×1 / 2    | 33.3 / 50.0 / 83.4      | 160 / 65 / 0          | 99.9 / 2            | 112 / 120.300 / 10.372                 | 2 / 13.171 / 10.127                  |
| head | ×1 / 3    | 33.3 / 33.4 / 100.0     | 79 / 26 / 0           | 150.0 / 4           | 108 / 133.461 / 17.869                 | 2 / 10.329 / 6.713                   |
| head | ×4 / 1    | 33.4 / 50.1 / 200.0     | 124 / 124 / 9         | 183.4 / 4           | 81 / 250.596 / 5.883                   | 2 / 6.112 / 4.585                    |
| head | ×4 / 2    | 33.4 / 66.7 / 166.6     | 175 / 175 / 8         | 116.6 / 2           | 81 / 219.329 / 7.394                   | 2 / 7.777 / 5.358                    |
| head | ×4 / 3    | 33.3 / 50.0 / 150.1     | 150 / 69 / 7          | 133.3 / 3           | 92 / 214.570 / 4.169                   | 2 / 6.971 / 4.871                    |

Skutečná exportovaná okna měla 60.205–60.491 s; 60 s je požadovaný
čas čekání, doručení příkazů a scheduling jej mírně prodlužují. Hranice trace
a stránky se shodují. Všech 12 souhrnů bylo nezávisle překontrolováno proti
syrovým značkám, metadatům a GC událostem v trace.

Medián kolísá i mezi opakováními stejného kódu. Počet >1,5× medián proto
nelze porovnávat bez jeho prahu; perioda se vztahuje právě k tomuto počítadlu.
Celý desktop zůstával sdílený s ostatními lane. Výsledky nejsou izolovaným
důkazem procentuálního zrychlení ani měřením fyzického tabletu. Integrátor
má zopakovat srovnání sám.

V uchovaném kruhu nového kódu, po omezení na stejné měřicí okno, byly špičky:
při ×1 CPU 25.8–43.4 ms, track/chunks 25.4–42.4 ms; při ×4 CPU 121.1–167.8 ms, track/chunks 116.0–163.5 ms.
Kompoziční události celé uvnitř okna měly až
6 skutečných readbacků na kompozici (nikoli na celý chunk), nejdelší
zachycená kompozice trvala 16.5 ms.
Jde o poslední omezený kruh, ne maximum všech seedů ani celé jízdy. To jsou
signály pro druhé kolo, nikoli oprávnění rozdělit chunk bez tabletových dat.

Syrové intervaly, CPU kruhy a trace jsou v pracovním
`_runs/perf/playtest-perf-2/{base,head}/`; souhrny `results.md`,
`summary.json`, `causes.json` a `causes-summary.json` jsou součástí předání
integrátorovi. Záměrně nejsou herními assety ani runtime telemetrií.

## Lokální ověření

Opravné kolo `playtest-perf-2`:
`flock /tmp/vlacek-check.lock env VITEST_MAX_WORKERS=4 volta run npm run check`
prošlo na první pokus: **162 testových souborů, 2 516 unit/integračních testů**,
typecheck, lint, katalog, generátorové validace, odkazy v 79 Markdown
dokumentech, secrets a velikosti. Bez timeoutů a opakování.

Parser GC měl nejprve behaviorální red pro smíchaná vlákna (5 GC místo 2),
pak samostatný red pro chybné okno (18 ms místo 7 ms). Finální tři testy
pokrývají také chybějící, dvojité a rozporné značky. Pět observer testů
ověřuje i přesnou identitu promise a zachování původního odmítnutí s detailem 0. Produkční observer byl již správný, nové audio charakterizace byly ihned
green; kontrolní mutace identity a failure detailu je shodily. Původní čtyři
observer testy byly napsány až po implementaci v prvním kole; tuto odchylku
od TDD opravné kolo nezastírá. Přesné red/green příkazy a výstupy jsou v
předání `playtest-perf-2`, stejně jako závěrečné cílené opakování
`flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- tests/e2e/frame-pacing.spec.ts --workers=2`.

Historické ověření prvního kola `playtest-perf-1`: celý check prošel
161 soubory / 2 512 testy po opravě lintu vypůjčených nativních metod přes
ověřenou funkci a `Reflect`, bez potlačení pravidel. Kombinace
`frame-pacing.spec.ts` a `dev-menu.spec.ts` prošla 72 testy na desktopu a
touch emulaci; nad finální implementací observerů byly zopakovány čtyři
frame-pacing testy (4 passed). Snímky 1140 × 512 a 1280 × 800 ukazují graf,
další snímek přepínač a skutečný export JSON pochází z textarea fallbacku
přes Kopírovat JSON. UI se v opravném kole nemění. Fyzické zařízení a CI
aktuálního commitu tím nejsou ověřeny.
