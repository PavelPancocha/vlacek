# D-028: Delší souprava bez zmenšení dosavadních vlaků

Datum: 2026-10-13. Stav: přijato. Nahrazuje limit a pravidlo společného měřítka v [D-008](008-whole-train-in-view.md); ostatní pravidla rámování zůstávají.

## Rozhodnutí a použitelnost

`train.maxConsistLengthU` roste z **1 600 na 2 000 u**, včetně lokomotivy a všech spřáhel (8 u). S parní lokomotivou dlouhou 156 u je to 12 otevřených vozů místo 9, 11 uhláků místo 9, 10 krytých místo 8, 10 klasických osobních místo 7, 9 kontejnerových místo 7 nebo 8 autovozů místo 6. Přesnou hranici 2 000 u tvoří 11 otevřených vozů a jeden krytý. Nejde o návrat ke stovce vozů.

Kamera používá `zoom = camera.trainWidthFraction × šířka / max(1600, délka jízdy)`. Soupravy do 1 600 u tak zachovávají **přesně původní měřítko**. Jen delší souprava má poměrně menší měřítko, pevné pro danou jízdu a velikost okna; nezávisí na rychlosti, poloze ani ticku. Sestava se za jízdy nemění. Resize přepočítá měřítko stejným pravidlem. Nejdelší souprava je o 20 % menší než při původním měřítku.

Zůstává šířkový podíl 0,72, zadní rezerva 0,06 a minimální poloha čela 0,35. Čelo nejdelšího vlaku je na 0,78 šířky. Výhled před čelem je `0.22 / 0.72 × délka`: **488,89 u pro 1 600 u**, **611,11 u pro 2 000 u**, nezávisle na šířce obrazovky. Geometrický předstih 2 048 u je větší než tento výhled. Na 1280 × 800 má základní zoom 0,576 a nejdelší 0,4608; na 844 × 390 jsou hodnoty 0,3798 a 0,30384. Nejkratší vůz má při novém maximu přibližně 66,4 / 43,8 CSS px. Na screenshotu telefonu zůstává rozeznatelná konstrukce, kola a náklad; vozy za jízdy nejsou povinnými dotykovými cíli. Katalogové karty a HUD se tímto zoomem nezmenšují. Menší telefonní výřezy ověřují E2E, fyzická použitelnost dítětem zůstává NEOVĚŘENO.

Rychlost simulace se nemění: 480 u/s znamená 0,216 šířky/s pro dosavadní maximum a 0,1728 pro nové. Metr, přidávání a odjezd používají společné `ConsistLengthRules`; nepotřebují další konstantu ani zvláštní UI větev.

Na landscape displeji s výškou do 500 px a šířkou nad 760 px katalog rezervuje vpravo 104 px (96px tlačítko „Vyjet“ a 8px mezera). Poslední z 32 karet tak lze celou odkrýt i v plném depu na 844 × 390. E2E ověřuje skutečné obdélníky karet a tlačítka. Samostatný hotfix PR `fix/phone-picker-start` z `master` řeší dostupnost akcí všech obrazovek při všech velikostech viewportu; orchestrátor při integraci sladí toto úzké pravidlo s hotfixem.

## Geometrie, streaming a scénky

Rozložení a pořadí vozů, samostatná poloha podvozků a spřáhla nadále vlastní `layoutConsist` a `poseVehicle`. Kolej se uchovává od `tailS - geometryTailMarginU` po `frontS + geometryLookAheadU`, tedy 1 024 u za skutečným posledním vozem a 2 048 u před čelem. Tyto parametry ani délka chunku se nemění; souprava může zabírat více chunků včetně záporných při startu. Jednotková zkouška přesně 2 000 u ve světě 123 kontroluje všechny vozy a mezery při svazích, průjezdu chunkem stanice a setkání s NPC. Browserová zkouška kontroluje kresbu všech 13 vozidel, přejezd chunku 3 až po poslední vůz, tunel chunku 6 a obnovu celé soupravy. Změna nezasahuje implementaci přejezdů, tunelů, světa ani zvuku.

## D-019: důkaz rezervy atlasu

Z minimální lokomotivy a součtu nejkratších **různých** vagonků plyne horní mez 11 různých hráčových vagonků. Opakované vozy nepotřebují nové rámečky. S NPC sadou to znamená nejvýše 17 různých vagonků a 3 lokomotivy. Test vytváří konzervativní obálku: každý vůz dostane šířku nejširšího vozidla katalogu (216 u), výšky odpovídají sestupně nejvyšším 17 vagonkům a 3 lokomotivám. Každá karoserie i překryv má vlastní rámeček; navíc se zahrnou **všechny** pomocné díly katalogu (kola, táhla, sběrače), i když je jedna jízda nepotřebuje. Reálná sada se do těchto slotů při přiřazení podle výšky vejde.

Při nezměněném `ART_MAX_PX_PER_U = 2`, paddingu 2 px a stropu 2048² se obálka 59 rámečků zabalí do **2022 × 1932 px**. Náročná skutečná povolená sestava, odvozená z ploch manifestu, má 10 různých vozidel, délku 1 932 u a s největší zbývající NPC sadou 48 rámečků v **1932 × 1494 px**. Původní test osmi největších vozidel a samostatného atlasu světa zůstává. Packing, rozdělení atlasů, strop rasterizace ani pravidlo fallbacku není třeba měnit.

## Kompatibilita

Schéma 1, `contentVersion`, katalogová ID i verze generátoru zůstávají. Save nad starým limitem, který nyní měří nejvýše 2 000 u, se obnoví jako zastavená jízda se všemi vozy. Při stejné verzi generátoru se zachová cursor a tick; při starší geometrii stále platí dosavadní ohlášený restart tratě. Save nad 2 000 u zůstane celý v depu s upozorněním a blokovaným odjezdem, nic se tiše nemaže. Validace save nadále přijímá až 100 vozů kvůli kompatibilitě. Starší build s limitem 1 600 u může novou delší sestavu opět vrátit do depa; nejde o změnu formátu dat.

## Ověření a výkon

Red před implementací: jednotkové testy odmítly hodnotu 1 600 místo 2 000, chybné měřítko krátké jízdy a obnovu staré 1 876u cesty (`train-too-long`). Test atlasové obálky zachytil 8 místo 11 různých hráčových vagonků. Browserový red na původním buildu skončil na zakázaném desátém otevřeném vagonku. Green příkazy a výsledky jsou součástí předání lane `train-length-1`.

Srovnání pod sdílenými zámky (`vlacek-playwright.lock` a `vlacek-check.lock`), stejný nový build s původním měřítkem staršího vlaku: **32,9 / 47,8 ms** (medián/p95, 1 600 u, 10 vozidel, 587 snímků), **34,3 / 46,1 ms** (2 000 u, 13 vozidel, 570 snímků). Měří se rAF po dosažení plné rychlosti po 20 s, Chromium headless shell, WebGL, standardní kvalita, svět 123, 1280 × 800, `?debug=1`. Medián vzrostl o 4,3 %, p95 se nezhoršilo; výsledek podporuje limit 2 000 u, ale neměří fyzický tablet ani Teslu. První nezamčené vzorky byly 85,1 / 134,1 ms (medián/p95, 1 600 u) a 41,3 / 67,0 ms (2 000 u); rozdíl je ovlivněný souběžnými lane a není důkaz zrychlení. `measure:perf` zůstává integrační bránou orchestrátora; jeho fixture nyní používá aktuální verzi generátoru a nový konfigurovaný limit a zaznamenává také medián snímku v ms. Výchozí smíšená sestava má sedm různých typů a další otevřené vozy až k limitu; s `steam_local` měří přesně 2 000 u (11 vagonků). Opakování `PERF_WAGON` zůstává zachované, například `passenger_open` dává 12 vagonků / 1 980 u.

Fyzický tablet a Tesla: **NEOVĚŘENO**. Změna nepřidává závislost ani měnění fyziky či výkonových profilů.
