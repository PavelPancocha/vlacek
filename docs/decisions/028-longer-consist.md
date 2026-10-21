# D-028: Delší souprava a pevné rámování uprostřed obrazu

Datum: 2026-10-13. Stav: přijato. Nahrazuje limit a pravidlo společného měřítka v [D-008](008-whole-train-in-view.md); aktualizace `camera-1` níže nahrazuje i původní rámování.

## Rozhodnutí a použitelnost

`train.maxConsistLengthU` roste z **1 600 na 2 000 u**, včetně lokomotivy a všech spřáhel (8 u). S parní lokomotivou dlouhou 156 u je to 12 otevřených vozů místo 9, 11 uhláků místo 9, 10 krytých místo 8, 10 klasických osobních místo 7, 9 kontejnerových místo 7 nebo 8 autovozů místo 6. Přesnou hranici 2 000 u tvoří 11 otevřených vozů a jeden krytý. Nejde o návrat ke stovce vozů.

**Aktualizace `camera-1` (2026-10-13):** nové zadání chce soupravu uprostřed a více krajiny před ní i za ní. Nahrazuje původní pravidlo tohoto rozhodnutí, které zachovávalo měřítko do 1 600 u.

Kamera používá `zoom = camera.trainWidthFraction × šířka / max(2000, délka jízdy)`, výchozí podíl **0,60**. Měřítko je pevné pro jízdu a velikost okna; rychlost, výška, sklon ani tick je nemění. Všechny povolené soupravy do 2 000 u mají stejné měřítko. Resize přepočítá zobrazení stejným pravidlem. Oproti původnímu rámování jsou soupravy do 1 600 u o 33,3 % menší a souprava 2 000 u o 16,7 % menší.

Střed soupravy je na `camera.trainCenterFraction = 0.46` šířky. Čtyřprocentní posun vlevo nechává o něco více místa vpředu a zachovává větší výhled dopředu i proti původnímu čelu krátkého vlaku na 35 %. Nejdelší souprava má geometricky **16 % za koncem a 24 % před čelem** (čelo na 76 %). Kreslené SVG mají malé přesahy: E2E proto vyžaduje nejméně 15 % za kresbou a 23 % před ní. Kratší soupravy mají větší rezervy po obou stranách. Unit zkouší všechny délky po 4 u mezi 144 a 2 000 u na čtyřech výřezech, včetně většího výhledu než předchozí pravidlo.

Výřez je široký **3 333,33 u**. Výhled před čelem je `1800 − délka / 2`, tedy **1 722 u** pro samotnou parní lokomotivu 156 u, **1 476 u** pro 648u krátkou soupravu, **1 000 u** pro 1 600 u a **800 u** pro 2 000 u. Za koncem zbývá `1533.33 − délka / 2`, například 533,33 u za nejdelší soupravou. Předstih 2 048 u stačí i s 64u kreslicí rezervou a maximálním sklonem 12 %.

| Viewport   | Zoom v CSS px/u | Nejkratší vagonek 144 u | Nejdelší vozidlo 216 u |
| ---------- | --------------: | ----------------------: | ---------------------: |
| 1280 × 800 |           0,384 |                55,30 px |               82,94 px |
| 1140 × 512 |           0,342 |                49,25 px |               73,87 px |
| 844 × 390  |          0,2532 |                36,46 px |               54,69 px |
| 568 × 320  |          0,1704 |                24,54 px |               36,81 px |

DPR se vykompenzuje při projekci z renderových do CSS pixelů. Dotyk jízdy přijímá hlavní herní svět; katalogové karty mají nadále nejméně 64px cíle a zvířata nejméně 80px dotykový průměr nezávislý na zoomu. Na 568 × 320 jsou jednotlivé vozy drobné; jejich rozpoznatelnost hodnotí screenshot, nikoli tvrzení o fyzickém hraní dítěte. Bubliny vyžadují nejméně 12 CSS px kresleného průměru a 64 CSS px dotykového průměru. Jejich počet, životnost, emitery a ostatní částice se tím nemění.

Svislý cíl je nyní `camera.bandAnchor = 0.5`, polovina pásu mezi HUD a brzdou. Follow zůstává exponenciální s koeficientem 3/s a okamžitými hranicemi pásu; zoom se podle kopců nemění. Unit simuluje výstup a sestup 8 % (horní mez současného generátoru) a 12 % (`world.maxTrackGrade`), vysoký absolutní terén 10 000 u i vrchol kopce, běžnou výšku 116 u a živý sběrač 168 u. Celý vlak zůstává uvnitř pásu a kolej od čela po pravý okraj viewportu v obraze. Ve světě 123, generátor 1, chunky 0–31 a vzorky po 1 u je naměřený největší sklon 7,9546 % (chunk 25, x = 544 u).

Diagnostika přejezdů používá `RideScene.worldScreenX`, tedy tentýž poslední vykreslený pohled, interpolaci a origin jako kamera. `AppController` nemá vlastní kopii zoomu ani rámování. Unit pokrývá CSS offset, DPR i rebase; E2E porovnává `screenX` s hranicemi skutečně kreslených chunků, včetně rebase a DPR 2 omezeného profilem. Samotná oprava projekce obnovila původní D-021 test bez změny jeho očekávání. Po rozšíření výhledu E2E vyžaduje viditelný začátek sklápění pro krátký vlak na plné i poloviční rychlosti a pro skutečné maximum 2 000 u; při obsazení zůstává závora přesně dole.

Rychlost simulace po [D-036](036-slower-train.md) je 240 u/s, tedy 0,072 šířky/s ve všech povolených sestavách; kamera se nemění. Při přijetí camera-1 to bylo 480 u/s a 0,144 šířky/s. Metr, přidávání a odjezd nadále používají společné `ConsistLengthRules`.

Zadní geometrická rezerva roste z 1 024 na **1 600 u**: širší pohled krátkého vlaku jinak odkrýval prázdný pás na levém okraji. Bubliny sdílejí CSS výpočet kresleného průměru nejméně 12 px a hit testu nejméně 64 px. Tunelový filtr `coversPoint` se zachovává pro střed bubliny i místo dotyku, včetně rozšířeného cíle. Při překryvu dotykových oblastí se vybírá nejbližší střed oprávněné bubliny; pořadí kresby rozhoduje pouze při přesné shodě vzdáleností ([dokument 02 §9](../../vlacek-predavaci-balicek/02_OVLADANI_A_STAVY.md)).

Na landscape displeji s výškou do 500 px a šířkou nad 760 px katalog rezervuje vpravo 104 px (96px tlačítko „Vyjet“ a 8px mezera). Poslední z 32 karet tak lze celou odkrýt i v plném depu na 844 × 390. E2E ověřuje skutečné obdélníky karet a tlačítka. Samostatný hotfix PR `fix/phone-picker-start` z `master` řeší dostupnost akcí všech obrazovek při všech velikostech viewportu; orchestrátor při integraci sladí toto úzké pravidlo s hotfixem.

## Geometrie, streaming a scénky

Rozložení a pořadí vozů, samostatná poloha podvozků a spřáhla nadále vlastní `layoutConsist` a `poseVehicle`. Kolej se uchovává od `tailS - geometryTailMarginU` po `frontS + geometryLookAheadU`, tedy 1 600 u za skutečným posledním vozem a 2 048 u před čelem. Předstih ani délka chunku se nemění; souprava může zabírat více chunků včetně záporných při startu. Jednotková zkouška přesně 2 000 u ve světě 123 kontroluje všechny vozy a mezery při svazích, průjezdu světem a setkání s NPC. Browserová zkouška kontroluje kresbu všech 13 vozidel, přejezd chunku 3 až po poslední vůz, tunel chunku 6 a obnovu celé soupravy. Browserová zkouška kamery navíc ověřuje skutečnou stanici světa 123 v chunku 57 pro krátkou i nejdelší soupravu na 568 × 320. Retence nemění profil koleje, generatorVersion ani uložený cursor; přejezdy, krycí geometrie tunelů a zvuk používají své dosavadní implementace.

Retenční koridor nejdelší soupravy má 2 000 + 1 600 + 2 048 = **5 648 u** a v 1 024u chunkech potřebuje nejvýše **7 chunků / 903 LUT vzorků** při kroku 8 u; délka cesty tento počet nezvětšuje. Srovnání stejné 50s jízdy světa 123 (3 000 ticků, konec v chunku 22) naměřilo před změnou nejvýše 6 chunků / 774 vzorků a po změně 7 / 903. Čtyři číselná pole LUT představují 24 768 → 28 896 bajtů číselného payloadu, tedy **+4 128 B**; nejde o měření celého JavaScript heapu. Test nejdelší jízdy chrání obě horní meze. Počty vozidel a částicové pooly se nezvětšují.

## D-019: důkaz rezervy atlasu

Z minimální lokomotivy a součtu nejkratších **různých** vagonků plyne horní mez 11 různých hráčových vagonků. Opakované vozy nepotřebují nové rámečky. S NPC sadou to znamená nejvýše 17 různých vagonků a 3 lokomotivy. Test vytváří konzervativní obálku: každý vůz dostane šířku nejširšího vozidla katalogu (216 u), výšky odpovídají sestupně nejvyšším 17 vagonkům a 3 lokomotivám. Každá karoserie i překryv má vlastní rámeček; navíc se zahrnou **všechny** pomocné díly katalogu (kola, táhla, sběrače), i když je jedna jízda nepotřebuje. Reálná sada se do těchto slotů při přiřazení podle výšky vejde.

Při nezměněném `ART_MAX_PX_PER_U = 2`, paddingu 2 px a stropu 2048² se obálka 59 rámečků zabalí do **2022 × 1932 px**. Náročná skutečná povolená sestava, odvozená z ploch manifestu, má 10 různých vozidel, délku 1 932 u a s největší zbývající NPC sadou 48 rámečků v **1932 × 1494 px**. Původní test osmi největších vozidel a samostatného atlasu světa zůstává. Packing, rozdělení atlasů, strop rasterizace ani pravidlo fallbacku není třeba měnit.

## Kompatibilita

Schéma 1, `contentVersion`, katalogová ID i verze generátoru zůstávají. Save nad starým limitem, který nyní měří nejvýše 2 000 u, se obnoví jako zastavená jízda se všemi vozy. Při stejné verzi generátoru se zachová cursor a tick; při starší geometrii stále platí dosavadní ohlášený restart tratě. Save nad 2 000 u zůstane celý v depu s upozorněním a blokovaným odjezdem, nic se tiše nemaže. Validace save nadále přijímá až 100 vozů kvůli kompatibilitě. Starší build s limitem 1 600 u může novou delší sestavu opět vrátit do depa; nejde o změnu formátu dat.

## Ověření a výkon

Pro `camera-1/2` red nejprve zachytil chybné rámování a projekci (4 unit chyby; browserový střed krátkého vlaku 20,6 % místo 46 %), poté nedostatečnou zadní rezervu a velikost bublin (5 unit chyb). Poslední cílené unit kontroly mají 50/50; browserová kamera, stanice a projekce 22/22, skutečný reload 2/2 a celá tunelová sada 28/28. Přejezdy při plné i poloviční rychlosti, art, celé soupravy a bubliny prošly cíleným browserovým průchodem. TS projekty, timeouty, počet vozů ani délka stress testů se neoslabují.

Při ověřování `camera-1/2` zůstala úplná kontrola otevřenou integrační bránou: třikrát 675/676 testů, pouze GEN-10 (100 vozů, 36 000 kroků) překročil 5 s: 7 307 / 7 222 / 7 269 ms. Samostatná stejná simulace překročila 5 s i s původní rezervou 1 024 u; obě rezervy zachovaly nejvýše 24 chunků a konec v chunku 277. Format, lint, typecheck a samostatné validátory assetů, odkazů, tajných údajů a velikostí souborů prošly. Nejde o zelené potvrzení celé integrační větve.

Red před implementací: jednotkové testy odmítly hodnotu 1 600 místo 2 000, chybné měřítko krátké jízdy a obnovu staré 1 876u cesty (`train-too-long`). Test atlasové obálky zachytil 8 místo 11 různých hráčových vagonků. Browserový red na původním buildu skončil na zakázaném desátém otevřeném vagonku. Green příkazy a výsledky jsou součástí předání lane `train-length-1`.

Následující výkonová čísla jsou z původní linky `train-length-1` před změnou rámování `camera-1`; nejde o měření nového širšího pohledu. Srovnání pod sdílenými zámky (`vlacek-playwright.lock` a `vlacek-check.lock`), stejný nový build s původním měřítkem staršího vlaku: **32,9 / 47,8 ms** (medián/p95, 1 600 u, 10 vozidel, 587 snímků), **34,3 / 46,1 ms** (2 000 u, 13 vozidel, 570 snímků). Měří se rAF po dosažení plné rychlosti po 20 s, Chromium headless shell, WebGL, standardní kvalita, svět 123, 1280 × 800, `?debug=1`. Medián vzrostl o 4,3 %, p95 se nezhoršilo; výsledek podporuje limit 2 000 u, ale neměří fyzický tablet ani Teslu. První nezamčené vzorky byly 85,1 / 134,1 ms (medián/p95, 1 600 u) a 41,3 / 67,0 ms (2 000 u); rozdíl je ovlivněný souběžnými lane a není důkaz zrychlení. `measure:perf` zůstává integrační bránou orchestrátora; jeho fixture nyní používá aktuální verzi generátoru a nový konfigurovaný limit a zaznamenává také medián snímku v ms. Výchozí smíšená sestava má sedm různých typů a další otevřené vozy až k limitu; s `steam_local` měří přesně 2 000 u (11 vagonků). Opakování `PERF_WAGON` zůstává zachované, například `passenger_open` dává 12 vagonků / 1 980 u.

Fyzický tablet a Tesla: **NEOVĚŘENO**. Změna nepřidává závislost ani měnění fyziky či výkonových profilů.
