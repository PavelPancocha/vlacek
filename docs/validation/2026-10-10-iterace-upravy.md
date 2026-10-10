# Ověření iterace „Úpravy první verze“ (dokument 14)

Průběžný protokol iterace podle [zadání 14](../../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md). Lokální běhy v cloudovém kontejneru: headless Chromium 156 (Playwright 1.64), softwarový WebGL bez GPU. Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## Výchozí stav (build `0.1.0+a9991f9`)

Obě chyby ze zadání se v sestavení potvrdily skriptovaným průchodem při DPR 1–3 (1280 × 720, 1180 × 820, 844 × 390):

- Depo kreslilo lokomotivu vlevo a vagonky přidávalo vpravo, tedy před její čelo. Jízda měla pořadí opačné.
- Kamera držela lokomotivu na 30 % šířky v pevném měřítku. Už druhý ze tří vagonků byl po Vyjet mimo obraz.
- Na telefonu na šířku byl katalog depa zalomený a tlačítko Vyjet z větší části pod okrajem.

## A — pořadí soupravy v depu (§1)

| Test                                                      | Red                                   | Green                   |
| --------------------------------------------------------- | ------------------------------------- | ----------------------- |
| E2E „the locomotive leads on the right, new wagons join…“ | FAIL: w3 vpravo od w2 (373 vs. < 252) | PASS (desktop i tablet) |
| E2E „the depot fits a phone held sideways“                | FAIL: Vyjet mimo výřez                | PASS                    |
| tamtéž, poslední karta katalogu dosažitelná               | FAIL: kartu překrývalo tlačítko Vyjet | PASS po opravě mřížky   |

Pás počítá polohy stejnou funkcí `layoutConsist` jako jízda. Ruční snímek telefonu: lokomotiva vpravo čelem doprava, vagonky doleva v pořadí výběru, katalog se posouvá, Vyjet v rohu.

## B — celý vlak v obraze a délkový limit (§2)

Rozhodnutí: [D-008](../decisions/008-whole-train-in-view.md).

| Test                                                                                             | Red                                                                         | Green   |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------- |
| Unit `ConsistEditor` „doc 14 §2: length limit“ (5 testů)                                         | 5 FAIL proti stubům (`0` místo 500, přijetí nad limit…)                     | 17 PASS |
| Unit `cameraFraming` (6 testů)                                                                   | 6 FAIL proti stubům                                                         | 6 PASS  |
| Integrace „a longer train saved by version 0.1“ (2 testy)                                        | 2 FAIL (jízda obnovena, `HOME` místo `RIDING`)                              | 20 PASS |
| Integrace „wagons stop at the length limit with a gentle signal“                                 | bez samostatného red: zapojení pravidel bylo nutné pro překlad; red je unit | PASS    |
| E2E „the depot fills to the length limit…“                                                       | proti buildu `a9991f9`: FAIL `Expected "7", Received "100 / 100"`           | PASS    |
| E2E „Vyjet shows the whole longest train…“, „…over hills and after a resize“, „…after a reload…“ | FAIL proti staré kameře: levý okraj vlaku −281 px                           | 8 PASS  |

Ruční snímky (1280 × 720, 1024 × 768, 844 × 390, nejdelší smíšená souprava s naftovou lokomotivou): celý vlak v obraze na startu i za jízdy, nad brzdou a pod tlačítky v rohu.

`PERF_SECONDS=30 npm run measure:perf` s nejdelší smíšenou soupravou (lokomotiva + 8 vagonků): všech 9 vozidel vykresleno celou dobu, nejvýše 6 živých chunků, žádné chyby. Medián **20 FPS**, p95 50 ms, nejhorší 200 ms. Verze 0.1 měla na stejném stroji 30 FPS. Výřez je teď asi dvakrát širší a v obraze jsou všechny vozy. Příčina se ověří v grafické iteraci; zatím se jen předpokládá vektorové kreslení trati v každém snímku. Jde o emulaci, ne o cílové zařízení.

Známá omezení po B:

- Ve WebGL se části některých vozů ve svahu vykreslovaly chybně; Canvas je kreslil správně. Původní podezření na `Graphics.generateTexture` se nepotvrdilo. Skutečná příčina a oprava jsou v oddílu „WebGL: zkosené vozy“ níže a v [D-010](../decisions/010-webgl-single-texture-batches.md).
- Scéna je při menším vlaku prázdnější a kopce působí velké; řeší grafická iterace a krajina (§3, §5).

## C1 — svižnější jízda (§6)

Rychlost na obrazovce je v novém měřítku `maxSpeedUPerSec × trainWidthFraction / maxConsistLengthU` šířky za sekundu, stejně na každém zařízení. Test `gameConfig` „the ride feels snappy on screen yet easy to follow“: red se 180 u/s (**0,081** šířky/s, pomaleji než 0,14 ve verzi 0.1 na 16:9), green s 480 u/s (0,216 šířky/s), rozjezd 160 u/s² (3 s), dojezd 96 u/s² (5 s), brzda 480 u/s² (1 s). Testy fyziky pohybu nově používají pevné referenční hodnoty místo laditelného výchozího nastavení; 283 unit/integračních PASS, E2E 54 PASS / 4 skipped.

## C2 — výškový profil, generátor v1 (§6)

Rozhodnutí: [D-009](../decisions/009-track-generator-v1.md).

Výchozí měření v0 stejnou metrikou (vzorky po 8 u, 64 chunků): sklon se mění na 94,5 % (svět 1), 93,7 % (77) a 91,4 % (123) délky; výška −42 až 39 u.

| Test                                                                                    | Red                                                                         | Green               |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------- |
| Unit `TrackProfile` v1 (verze, charakter, plány bloků) proti plochému stubu             | 3 FAIL (verze 0, 3 dlouhé roviny místo > 15, prázdný plán)                  | 9 PASS, pak 10 PASS |
| tamtéž GEN-04/05: 1000 světů × 100 chunků (švy výšky a sklonu, konečnost, sklon, výška) | stub vyhověl triviálně; měření v0 výše je skutečný red charakteru           | PASS                |
| „every plan segment is long enough for its transitions“ (300 světů × 20 bloků)          | doplněno při revizi vlastního kódu spolu s opravou validace proveditelnosti | PASS                |
| Integrace „a journey from track generator v0“                                           | FAIL: bez upozornění, jízda obnovena na chunku 7 nové geometrie             | PASS                |
| Validace save s `generatorVersion` 0                                                    | 13 FAIL: fixtury 0.1 hlášené jako poškozené                                 | PASS (55 unit)      |

Ruční snímky jízdy světa 123 s nejdelší soupravou: dlouhé roviny, rovná stoupání a klesání s krátkými oblouky, celý vlak v obraze, žádné chyby konzole.

## WebGL: zkosené vozy (D-010)

Při ručních snímcích nové tratě se ve svahu ve WebGL opakovaně objevovaly klínovité, střižené karoserie. Pokusy na stejné seedované jízdě (snímky každých 2,5 s):

| Pokus                                             | Výsledek        |
| ------------------------------------------------- | --------------- |
| textury vozů z 2D canvasu místo `generateTexture` | chyba trvá      |
| obrázky bez otočeného `Container`                 | chyba trvá      |
| `setTexture` jen při změně                        | chyba trvá      |
| `render.maxTextures: 1`                           | **chyba zmizí** |

E2E `render.spec.ts` (stojící vlak na svahu světa 123, WebGL proti Canvas v rámečku soupravy): bez opatření FAIL, liší se 1,24 % pixelů (dva běhy) a 2,15 % (první běh); s opatřením 0 % ve dvou bězích, PASS na desktopu i tabletu.

Výkon s opatřením (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava, generátor v1, 480 u/s): medián 20 FPS, p95 50 ms, nejhorší 83 ms, všech 9 vozidel vykresleno, nejvýše 6 živých chunků. Medián se proti stavu bez opatření nezměnil. Celé E2E: 56 PASS / 4 skipped.

## Depo na užších telefonech (Codex review PR #2, `38310dd`)

Na 667 × 375 a 568 × 320 nestačila šířka pro dva ovládací řádky vedle sebe (~700 px). E2E „the depot fits a phone held sideways“ je nově pro 844 × 390, 667 × 375 a 568 × 320: všechny ovládací prvky celé ve výřezu, bez vzájemného překryvu, poslední karta katalogu klikatelná. Red: 667 × 375 a 568 × 320 FAIL (karta nedosažitelná); po prvním návrhu ještě 568 × 320 FAIL („depart overlaps .strip-item.loco“, pás 56 px byl nižší než 64px dotykový cíl). Green po úpravě (řádky pod sebou, pás nejméně 76 px, menší mezery a Vyjet 64 px): 22 PASS (depo a telefony, desktop i tablet).

## Codex review PR #2 (`3bab3fa`)

- **Nulový podíl šířky vlaku v kameře.** `camera.trainWidthFraction = 0` prošel validací, ale z kamery by udělal nulové přiblížení a nekonečné souřadnice. Validace teď chce kladnou hodnotu. Red: nový unit test 1 FAIL (validace nevrátila nic); green: 5 PASS.
- **Měření nejdelší soupravy hlídalo jen nejlepší vzorek.** Skript `measure:perf` si držel největší počet vykreslených vozidel, takže by prošel, i kdyby se konec vlaku později přestal kreslit. Teď hlídá nejmenší počet ze všech vzorků (`minRenderedVehicles`). Kontrola je přísnější, vadu s chybějícím vozidlem jsem nesimuloval. Green: `PERF_SECONDS=30 npm run measure:perf` PASS, ve všech vzorcích 9 z 9 vozidel (medián 20 FPS, p95 67 ms).
- **Číslo světa u příliš dlouhé jízdy z 0.1** se nemění. Taková jízda nemůže pokračovat a hráč vyjede z depa jako po každé úpravě vlaku, tedy v novém světě (dokument 03 §9, D-007). Generátor v1 navíc krajinu starého čísla stejně mění. Rozhodnutí je na vlastníkovi.

## D0 — grafika vozidel: manifest, atlas, depo (§3)

Rozhodnutí: [D-011](../decisions/011-vector-vehicle-art-and-atlas.md). První vozidlo s finální vektorovou grafikou je malá parní mašinka. Má tři spřažená hnací kola a pojezdové kolo; spojnice, ojnice a křižák se pohybují s koly.

| Test                                                                                  | Red                                                                     | Green             |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------- |
| Unit `steamGear` (klikový čep, spojnice, délka ojnice, zdvih)                         | 4 FAIL proti stubu vracejícímu nulovou polohu                           | 4 PASS            |
| Unit `packAtlas` (bez překryvů, deterministický, odmítne přerostlé díly)              | 2 FAIL proti stubu s prázdným atlasem (deterministika prošla triviálně) | 3 PASS            |
| Unit manifest: `steam_local` má grafiku, žádné nepoužité soubory                      | 2 FAIL (bez grafiky, 7 nepoužitých SVG)                                 | PASS              |
| Unit `vehicleArtLayers` (pořadí, kola na kolejnici, otáčení, táhla)                   | 4 FAIL proti stubu vracejícímu `[]`                                     | 5 PASS            |
| Unit `validateVehicleArt` (jeden vzhled, soubory a viewBox, délka, kola, táhla)       | 5 FAIL proti stubu bez chyb                                             | 7 PASS            |
| Tooling `validate:assets` (výpis s grafikou, `--release`)                             | 1 FAIL (starý výpis bez grafiky)                                        | 2 PASS            |
| Unit atlas: všechny díly se vejdou do 2048² při největším měřítku                     | 1 FAIL (stub bez položek)                                               | PASS              |
| Unit `artScaleFor` (krok 0,25 nad zoomem, meze 0,5–2,5)                               | 1 FAIL (stub vracel 2,5)                                                | PASS              |
| E2E `art.spec.ts`: jízda kreslí mašinku z atlasu; depo ukazuje 9 dílů ze stejných SVG | 2 FAIL proti buildu `3bab3fa` (`artVehicles` chybí, 0 dílů)             | PASS              |
| E2E tamtéž PWA-10: zablokovaný soubor karoserie → placeholder, jízda pokračuje        | FAIL bez zachycení chyby atlasu (UI zamrzlo, klik 30 s timeout)         | PASS              |
| E2E tamtéž D-011: 1280 × 720 → 0,75 px/u, po zvětšení okna na 1920 × 1080 → 1 px/u    | FAIL proti buildu s pevnými 2 px/u (`pxPerU` chybí)                     | PASS              |
| E2E `render.spec.ts` (WebGL proti Canvas, stojící vlak na svahu) s novou grafikou     | —                                                                       | PASS, 0 % rozdílů |

Při prvním spuštění E2E se scéna vůbec nenačetla: Phaser 4.2.1 dekóduje každé `data:` URI jako base64, ale Vite vložil malé SVG URL-kódované (`atob` výjimka v konzoli, UI zamrzlé). Soubory vozidel proto zůstávají v buildu samostatně (`assetsInlineLimit`).

Ruční snímky skutečné aplikace (1280 × 720): výběr mašinky, depo a jízda. Atlas 0,75 px/u: mašinka je vyhlazená, s viditelnými táhly a koly. První verze s pevnými 2 px/u byla zubatá (zmenšení 3,5×), proto se měřítko řídí zoomem.

## D1 — detailní grafika všech deseti vozidel (§3)

Všech 10 vozidel současného katalogu má vlastní vektorovou kresbu:

- **Lokomotivy:**
  - malá parní: tři spřažená kola, pojezdové kolo, spojnice, ojnice, křižák, plamen v kabině;
  - velká naftová: dvě kabiny, žaluzie, palivová nádrž, dvounápravové podvozky;
  - hvězdičková: hvězdná kola se zlatými táhly, tulipánový komín, kabina s kulatým oknem.
- **Vozy:**
  - osobní vůz s cestujícími v oknech;
  - výletní vagónek s lavicemi a stříškou;
  - krytý vůz s posuvnými dveřmi;
  - uhlák s nákladem uhlí;
  - kontejnerový vůz se dvěma kontejnery;
  - jeřábový vůz s obsluhou a ležícím výložníkem;
  - balónkový vagónek.

Všechny nárazníky jsou 30 u nad kolejnicí, takže na sebe vozy v soupravě navazují. Lesk a stín kol nese neotáčivý překryv. Nikde nejsou loga dopravců ani obličeje lokomotiv. Barevné placeholder vzhledy zmizely; z placeholderu zbyla jedna neutrální silueta se žlutými šrafami pro selhání načtení grafiky (PWA-10).

| Test                                                                                       | Red                                                             | Green                     |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | ------------------------- |
| Unit `validateVehicleArt`: vlastní kresba každého typu, každý díl použit; `releaseErrors`  | 2 FAIL (pravidlo chybělo, stub `releaseErrors`)                 | PASS                      |
| Tooling `validate:assets` a `--release` se skutečným katalogem                             | starý test čekal 9 placeholderů a selhání release               | 2 PASS (0 placeholderů)   |
| E2E `art.spec.ts`: všechna vozidla z atlasu (33 rámečků), depo, PWA-10, překreslení        | —                                                               | 8 PASS (desktop i tablet) |
| E2E `render.spec.ts` „D-010: interleaved textures“ (grafika zablokovaná, fallback siluety) | s výchozím `maxTextures` FAIL, lišilo se 0,98 % a 0,97 % pixelů | PASS s `maxTextures: 1`   |

[D-010](../decisions/010-webgl-single-texture-batches.md) proto zůstává. Původní test s grafikou v jednom atlasu prošel i bez opatření (3 běhy). Chybu ale vyvolá každé střídání textur a krajina a částice je přinesou.

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava, software WebGL kontejneru):

- medián 20 FPS, stejně jako před grafikou;
- p95 66,6 ms (dříve 50 ms), nejhorší snímek 83 ms;
- všech 9 vozidel vykresleno.

Fyzická zařízení: **NEOVĚŘENO**.

Kontaktní list (stejné SVG díly a stejné skládání `vehicleArtLayers` jako ve hře):

![Kontaktní list deseti vozidel](img/2026-10-10-kontaktni-list-vozidel.png)

Skutečná aplikace, 1600 × 900, svět 7: depo se všemi sedmi vozy a stojící souprava po jízdě. Ovečky jsou zatím placeholder scénky (E2).

![Depo se všemi vozy](img/2026-10-10-depo-vsech-vozidel.png)

![Souprava všech vozidel v jízdě](img/2026-10-10-jizda-vsech-vozidel.png)

## E1 — kolej a terén (§3, §6)

Rozhodnutí: [D-012](../decisions/012-track-tiles-and-terrain.md). Kolej z vektorových dlaždic: kolejnice s lesklou hlavou, upevnění, konce pražců, štěrk, travnatý okraj. Pod ní seedovaný násep a louka v pásech.

| Test                                                                                    | Red                                                      | Green               |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------- |
| Unit `embankmentU` (determinismus, meze a pestrost, spojitost přes chunky a uzly)       | 2 FAIL proti stubu vracejícímu 0                         | 3 PASS              |
| Unit `trackTilePlacements` (po 64 u na kolejnici, tětiva k další dlaždici, varianty)    | 2 FAIL proti stubu `[]`                                  | 3 PASS              |
| Unit manifest světa a `validateWorldArt` (chybějící, špatná velikost, zbylé, nepoužité) | 2 FAIL (bez dlaždic, stub validátoru)                    | 4 PASS              |
| Tooling `validate:assets` (výpis s díly světa)                                          | 1 FAIL (výpis bez světa)                                 | 2 PASS              |
| Unit konfigurace `world.terrain`                                                        | přidáno spolu s konfigurací (bez samostatného red)       | PASS                |
| E2E švy na Canvasu, nově bez pevné barvy země                                           | s nulovým přesahem chunků FAIL (šev na x 98, 688 a 1278) | PASS s přesahem 4 u |
| E2E `game`, `render`, `art`                                                             | —                                                        | 64 PASS / 4 skipped |

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava):

| Varianta                       | Medián FPS | p95     |
| ------------------------------ | ---------- | ------- |
| Dlaždice a 7 pásů louky po 8 u | 15         | 83 ms   |
| Jen 1 pás louky                | 20         | 50 ms   |
| Bez dlaždic (dražší jsou pásy) | 15         | 83 ms   |
| Obrysy země po 32 u (výsledek) | 20         | 66,6 ms |

Nejhorší snímek výsledné varianty měl 83 ms.

## E2 — krajina z lokalit, pozadí a zvířata (§3, §5)

Rozhodnutí: [D-013](../decisions/013-landscape-localities-and-backdrops.md). Biomy podle gramatiky dokumentu 04 a logické lokality se stabilními ID. Voda tvoří rovné nádrže se zaoblenými konci. Krajinu tvoří 114 vektorových dílů a dva atlasy, pozadí jsou ve dvou rychlostech parallaxy a mraky. Zvířata jsou velká, vždy pod vlakem a nad tlačítky. Země se jednou předkreslí do textury a hra se kreslí bez MSAA.

| Test                                                                                    | Red                                                                                                                                | Green                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Unit `biomeAt` a `chunkScenery` (gramatika, sloty, nádraží na rovině, ID, druhy zvířat) | `Biomes` 3 FAIL a `Scenery` 4 FAIL proti stubům; pak opravy rozpočtu přechodu, hostitele zvířete a doplňků nádraží                 | 40 PASS (`tests/unit/world`)               |
| Unit blízké rekvizity nepřesáhnou do vlaku i s perspektivním zvětšením                  | 1 FAIL (chybějící `nearDepthScale`)                                                                                                | 6 PASS                                     |
| Unit voda: lodě i se svou trasou na hladině, stavby a stromy na suchu                   | 3 FAIL (bez nádrží); po první implementaci 2 FAIL (plachetnice v polovině přechodu, lípa nádraží ve vodě pláže)                    | 10 PASS                                    |
| Unit bohatší louka, velká zvířata pod vlakem, kachna na rybníčku                        | 6 FAIL (13 nepoužitých dílů, chybí `ANIMAL_SCALE`, průměr blízkých rekvizit ≤ 20, kachna 7 u před rybníčkem); pak 1 FAIL (kapradí) | 238 PASS (celé unit)                       |
| Unit použití všech dílů světa a atlas pozadí                                            | 2 FAIL (stub `worldUsedKeys`: 97 nepoužitých dílů); 2 FAIL (chybějící strop atlasu pozadí, hlavní atlas se nevešel při 2,5 px/u)   | PASS (strop 2 px/u, pozadí 1 px/u)         |
| Unit okraje snímků atlasu a počátek pivotu (`framesWithMargin`, `frameOrigin`)          | 2 FAIL (chybějící funkce)                                                                                                          | 8 PASS                                     |
| Unit `placeAnimal` (pás nad tlačítky, zmenšení na telefonu, nikdy do vlaku)             | 3 FAIL proti stubu                                                                                                                 | 5 PASS                                     |
| E2E krajina ze dvou atlasů (počty snímků z manifestů, biom, lokality, bez chyb)         | FAIL: UI zamrzlo, Vite vložil 59 SVG světa jako data URI                                                                           | PASS po vyloučení `assets/world/` z inline |
| E2E blízké rekvizity ani zvířata nepřekryjí nejdelší vlak (seedy 7, 123, 2026)          | mutace `NEAR_FOOT_OFFSET_U = -60`: FAIL (2 překryvy)                                                                               | PASS                                       |
| E2E telefon 844 × 390: zvířata nad brzdou a houkačkou                                   | FAIL 242,7 px proti hraně 242 px (pruh kamery bez zvětšené dotykové plochy brzdy); mutace bez omezení: FAIL 276,6 px               | PASS                                       |
| E2E švy na Canvasu jen na hranicích chunků (`chunkEdges`)                               | FAIL na stoncích rostlin; mutace bez přesahu chunků: FAIL na x 99, 689, 1278                                                       | PASS                                       |
| E2E čára přes oblohu (jednopixelový řádek přes půl šířky, se sondou vložené čáry)       | FAIL starého testu: předpokládal jednobarevnou oblohu                                                                              | PASS, sonda čáru najde                     |
| E2E D-010 náhradní siluety WebGL proti Canvasu bez MSAA                                 | FAIL 0,45 % pixelů (siluety bez průhledného okraje)                                                                                | PASS s okrajem 2 px                        |
| `npm run check`, celé `npm run test:e2e`                                                | —                                                                                                                                  | 344 unit PASS; E2E 80 PASS / 4 skipped     |

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava, Chromium headless se softwarovým WebGL, 1280 × 720):

| Varianta                                                      | Medián FPS | p95    |
| ------------------------------------------------------------- | ---------- | ------ |
| E1 (před krajinou)                                            | 20         | 50 ms  |
| První zapojení krajiny                                        | 12         | 100 ms |
| Obloha jen nad pozadím, výplň jen do propadů, oříznutá pozadí | 15         | 83 ms  |
| Zem chunku předkreslená do textury                            | 15         | 67 ms  |
| Bez MSAA, okraje snímků atlasu (výsledek)                     | **30**     | 50 ms  |

Test D-010 se záložními siluetami jednou selhal při zátěži celé sady. Měření s nulovou mezí ukázalo příčinu:

- s grafikou se WebGL a Canvas shodují přesně (0 %);
- záložní varianta měla 0,13–0,19 % rozdílných pixelů při mezi 0,2 %.

Rozdíl dělala záložní kolej kreslená v každém snímku čarou `Graphics`: bez MSAA je ve WebGL zubatá, na Canvasu hladká. Po předkreslení do textury, stejně jako zem, je rozdíl 0–0,004 %. Mez testu se neměnila.

Nejhorší snímek výsledné varianty měl 83 ms. Krátký pokus se skrýváním vrstev (dočasný parametr, odstraněn) ukázal, že nejvíc stálo kreslení `Graphics` v každém snímku: louka ubírala 4 FPS a zem za tratí 3 FPS. Měřeno v emulaci tohoto kontejneru, ne na cílovém zařízení.

Snímky ze skutečné aplikace (dokument 14 §7, `?debug=1`, diagnostika skrytá), všechny bez chyb a bez překryvu vlaku:

- [venkov: pastvina, vesnice se silnicí a autem, pole](img/2026-10-10-krajina-venkov.jpg);
- [les a paseka](img/2026-10-10-krajina-les.jpg);
- [rybníky: jezero s rovnou hladinou, rybníček, kachna](img/2026-10-10-krajina-rybniky.jpg);
- [nádraží v podhůří](img/2026-10-10-krajina-nadrazi.jpg);
- [zasněžené hory](img/2026-10-10-krajina-hory.jpg);
- [pobřeží: zátoky, maják, lodě, pláž](img/2026-10-10-krajina-pristav.jpg);
- [telefon naležato 844 × 390, kráva nad brzdou](img/2026-10-10-krajina-podhuri-telefon.jpg).

Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## F — částice a drobné animace (§4)

Rozhodnutí: [D-014](../decisions/014-particles-and-small-animations.md). Vlak a krajina mají tyto pohyby:

- **Kouř a pára.** Kouř jde v taktech hnacích kol, při rozjezdu přibývá bílá pára. Diesel má lehký výfuk, hvězdičková mašinka pouští hvězdičky.
- **Jiskry, sníh a listí.** Jiskry létají jen při prudkém brzdění. Sníh a listí víří kola jen tam, kde leží, a jen za jízdy.
- **Krajina.** Tráva a stromy se houpou, voda občas zableskne, zvířata jemně dýchají. Občas přeletí ptáci nebo motýli.

Vše běží v simulačním čase s omezeným polem částic a úsporným profilem podle dokumentu 13.

| Test                                                                                                       | Red                                                                                                        | Green                                  |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Unit `ParticleField` (kapacita, životnost, pohyb ve světě, pauza, determinismus, prolínání, úsporný strop) | 5 FAIL proti stubu (2 triviálně PASS)                                                                      | 7 PASS                                 |
| Unit emise (hodiny emisí, emitter se sklonem, sníh a listí podle podkladu), `TrainEffects`, `AmbientLife`  | 15 FAIL proti stubům; po implementaci 1 FAIL (ve stání příliš mnoho páry proti jízdě) → klidnější obláček  | 27 PASS                                |
| Unit emitery v manifestu (každý efekt lokomotivy na modelu, uvnitř rámu, vagony bez emitorů)               | 1 FAIL (`steam_local` bez emitoru)                                                                         | PASS                                   |
| Unit `RideSimulation.lastIntent`                                                                           | 1 FAIL (`undefined`)                                                                                       | 12 PASS                                |
| Unit profily kvality dokumentu 13 a jejich validace                                                        | 2 FAIL                                                                                                     | 7 PASS                                 |
| Unit houpání a odlesky (`ambientMotion`)                                                                   | 3 FAIL proti stubu                                                                                         | 3 PASS                                 |
| E2E kouř při jízdě v rozpočtu, zastavení v pauze, čistý diesel, strop 96 při omezených efektech            | 4 FAIL proti buildu E2 (`0b85346`, chybí diagnostika efektů); mutace „částice po reálném čase“: FAIL pauzy | 8 PASS                                 |
| `npm run check`, celé `npm run test:e2e`                                                                   | —                                                                                                          | 379 unit PASS; E2E 88 PASS / 4 skipped |

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava): medián 30 FPS, p95 50 ms, nejhorší snímek 100 ms. Proti E2 beze změny mediánu.

Snímky ze skutečné aplikace:

- [kouř za jedoucím vlakem v lese, rozvířené listí](img/2026-10-10-efekty-les.jpg);
- [brzdění na sněhu: kouř, sníh u kol, jiskry](img/2026-10-10-efekty-snih.jpg).

Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## G1 — přejezdy (§5)

Rozhodnutí: [D-015](../decisions/015-level-crossings.md). Ve slotu 3 bloku stojí na rovné koleji přejezd se silnicí do hloubky obrazu, závorami, světly a provozem aut a cyklistů. Automat drží závory dole, dokud na silnici je kterákoli část soupravy nebo se vlak blíží na Dclose. Auta čekají za stop čárou a po zvednutí závor projedou.

| Test                                                                                                                                       | Red                                                                                                                                   | Green                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Unit konfigurace přejezdů a Dclose z nejvyšší rychlosti                                                                                    | 1 FAIL (chybí `crossing`)                                                                                                             | 8 PASS                                 |
| Unit umístění (slot 3, rovná kolej, odstup od zvířete) a rezervace pruhu silnice ve scenérii                                               | 2 FAIL proti stubu; pak scenérie bez `crossing`                                                                                       | 81 PASS (svět, obsah)                  |
| Unit automat `LevelCrossing` (SCN-04, 05, 06, 07, 08, 12 a fuzz invariantu)                                                                | 6 FAIL proti stubu (2 triviálně PASS); první implementace 2 FAIL na chybném nastavení testů (Dclose od okraje rozšířené zóny, SCN-07) | 8 PASS                                 |
| Mutace: zavírání ignoruje blížící se vlak                                                                                                  | SCN-04 a fuzz FAIL                                                                                                                    | obnoveno                               |
| Unit přejezdy v `RideSimulation` (SCN-13 nejdelší souprava, SCN-08 obnova)                                                                 | 2 FAIL (žádné přejezdy)                                                                                                               | 14 PASS                                |
| Unit uspořádání silnice: fronta před tratí u paty náspu, nejhorší doba vyklizení ≤ `roadClearanceSeconds`, šířka silnice = konfliktní zóna | 3 FAIL (fronta na 40 místo 56 u, stub `Infinity`, šířka 22 proti 24 u)                                                                | 31 PASS                                |
| Mutace: kola 46 u/s                                                                                                                        | FAIL (vyklizení 2,43 s > 2 s)                                                                                                         | obnoveno                               |
| Unit body světel a kloubu na výstražnících                                                                                                 | 1 FAIL proti stubu                                                                                                                    | 9 PASS                                 |
| Unit kresba přejezdu (`crossingLayout`): závory mezi stop čárou a kolejí, nízký výstražník a zvednuté břevno pod vlakem, pruhy, světla     | 6 FAIL proti stubům (4 PASS původní silnice)                                                                                          | 10 PASS                                |
| E2E závory dole před příjezdem i pod vlakem, nahoru až za posledním vagonem; fronta čeká u stojícího vlaku a po odjezdu projede            | 2 FAIL (diagnostika bez `crossings`)                                                                                                  | 2 PASS                                 |
| `npm run check`, celé `npm run test:e2e`                                                                                                   | —                                                                                                                                     | 406 unit PASS; E2E 92 PASS / 4 skipped |

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava): medián 30 FPS, p95 50 ms, nejhorší snímek 167 ms (jednorázová špička). Medián i p95 jsou proti F beze změny.

Snímky ze skutečné aplikace:

- [vlak zastavil před zavřeným přejezdem, za závorou čeká auto](img/2026-10-10-prejezd-pred-vlakem.jpg);
- [vlak stojí přes přejezd, zespodu přijíždí auto k frontě](img/2026-10-10-prejezd-pod-vlakem.jpg);
- [detail: vysoký výstražník za tratí, nízký před ní, svítí červená, břevna dole](img/2026-10-10-prejezd-detail.jpg).

Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## G2 — elektrická lokomotiva a trolejové vedení

Rozhodnutí: [D-016](../decisions/016-electric-locomotive-and-catenary.md). Katalog má hranatou elektrickou lokomotivu `electric_retro`. Za ní vede celou trasou trolejové vedení: stožáry v jedné globální fázi a drát 160 u nad kolejí. Pantograf se drátu dotýká i na sklonu; v depu leží sklopený. Lokomotiva nekouří, jen občas odletí jiskra od troleje.

| Test                                                                                                                                                         | Red                                                                                                          | Green                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Unit konfigurace vedení dokumentu 13 a její validace (rozteč dělí šířku chunku)                                                                              | 2 FAIL (chybí klíče, chybí validace)                                                                         | 10 PASS                                |
| Unit stožáry v globální fázi, mimo silnice přejezdů, drát u stožárů ve výšce kontaktu a bez zlomu na švech (TRN-08)                                          | 3 FAIL proti stubu (1 triviálně PASS); první implementace 1 FAIL (stožár na ose silnice mimo hledaný rozsah) | 4 PASS                                 |
| Unit katalog: elektrická lokomotiva vyžaduje vedení a nekouří; manifest: pantograf právě u lokomotiv s vedením, v rámu                                       | FAIL (chybí `electric_retro`, nové SVG hlášené jako soubory mimo manifest)                                   | 38 PASS                                |
| Integrace: elektrická cesta je elektrifikovaná celá i po obnově, parní není                                                                                  | 1 FAIL (`electrified` chybí)                                                                                 | PASS                                   |
| Unit pantograf: sklopený bez drátu, ramena natažená na dosah, sběrač nenatažený, omezené přizpůsobení; výška koleje podle x                                  | 4 FAIL proti stubům                                                                                          | 14 PASS                                |
| Unit dosah pantografu k drátu z nakloněné střechy                                                                                                            | 2 FAIL proti stubu                                                                                           | 2 PASS                                 |
| Unit úchyty drátu na stožáru odpovídají výšce kontaktu                                                                                                       | 1 FAIL proti stubu                                                                                           | 10 PASS                                |
| Unit občasná jiskra na pantografu, ve stání žádná, nikdy kouř                                                                                                | 1 FAIL                                                                                                       | 29 PASS                                |
| E2E TRN-08: stožáry v každém vykresleném chunku, sběrač na drátu (mezera < 0,5 u), celý vlak v obraze; parní jízda bez vedení; obnovená elektrická s vedením | 3 FAIL proti buildu G1 (`6002845`: chybí lokomotiva i diagnostika `catenary`)                                | 3 PASS                                 |
| `npm run check`, celé `npm run test:e2e`                                                                                                                     | —                                                                                                            | 422 unit PASS; E2E 98 PASS / 4 skipped |

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava): s parní lokomotivou medián 30 FPS, p95 50 ms, nejhorší snímek 133 ms; s elektrickou (`PERF_LOCOMOTIVE=electric_retro`, vedení po celé trase) medián 30 FPS, p95 50 ms, nejhorší snímek 83 ms.

Snímky ze skutečné aplikace:

- [výběr mašinky se čtyřmi lokomotivami](img/2026-10-10-elektricka-vyber.jpg);
- [depo: elektrická lokomotiva se sklopeným pantografem](img/2026-10-10-elektricka-depo.jpg);
- [elektrická souprava u přejezdu pod vedením](img/2026-10-10-elektricka-prejezd.jpg);
- [u rybníků a nádraží, stožáry za tratí](img/2026-10-10-elektricka-kopce.jpg);
- [detail: sběrač na troleji](img/2026-10-10-elektricka-pantograf.jpg).

Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## G3 — druhá kolej a protijedoucí vlak

Rozhodnutí: [D-017](../decisions/017-second-track-and-oncoming-train.md). Ve slotech 4–6 bloku 1 a asi třetiny dalších bloků vede za hlavní tratí druhá kolej mezi dvěma tunelovými portály. Když se hráč přiblíží, vyjede z pravého portálu protijedoucí parní nebo naftový vlak. Projede krajinou, vozidlo po vozidle zajede do levého portálu a na píšťalu odpoví s rozumným odstupem.

| Test                                                                                                                                                                                           | Red                                                                                                                                                                    | Green                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unit konfigurace druhé koleje a protijedoucího vlaku dokumentu 13 a její validace                                                                                                              | 2 FAIL (chybí klíče a validace)                                                                                                                                        | 12 PASS                                                        |
| Unit místa souběhu (blok 1 vždy, blok 0 nikdy, jinak asi třetina), trať o 64 u hlouběji se skrytými konci                                                                                      | 2 FAIL proti stubům (1 triviálně PASS)                                                                                                                                 | 3 PASS                                                         |
| Unit protijedoucí vlak: složení, rychlost, výjezd celý zevnitř pravého portálu, jízda doleva po existující geometrii, konec až po skrytí posledního vozu, vagony vpravo od lokomotivy (SCN-09) | 2 FAIL proti stubu (1 triviálně PASS)                                                                                                                                  | 3 PASS                                                         |
| Unit jízda: jediný výjezd u bodu 512 u, dojede i se stojícím hráčem; po obnově za bodem nevyjede; odpovědi na píšťalu nejvýš po 8 s; jediné zahoukání při setkání (SCN-10)                     | 3 FAIL proti stubům (1 triviálně PASS)                                                                                                                                 | 18 PASS                                                        |
| Mutace: odpověď bez vlastního cooldownu                                                                                                                                                        | FAIL testu odpovědí                                                                                                                                                    | obnoveno                                                       |
| Unit volné místo: pás tratě a portálové kopce bez blízkých zadních rekvizit, voda za tratí, přejezd mimo kopec                                                                                 | 1 FAIL (`g1:chunk:11:prop:17` na pásu druhé koleje); rozsahy 1 FAIL proti stubu                                                                                        | PASS                                                           |
| Unit zrcadlený emitor kouře protijedoucího vlaku                                                                                                                                               | 1 FAIL                                                                                                                                                                 | PASS                                                           |
| E2E SCN-09: vlak vyjede jednou, ukáže se v krajině, vozidla přibývají a mizí po jednom, zruší se až po skrytí posledního                                                                       | 1 FAIL proti buildu G2 (`914a3b3`, diagnostika bez `oncoming`); po implementaci 1 FAIL na chybné kontrole testu (vlak mezitím ujel 50 u; přesný start hlídá unit test) | PASS                                                           |
| `npm run check`, celé `npm run test:e2e`                                                                                                                                                       | —                                                                                                                                                                      | 437 unit PASS; E2E 100 PASS / 4 skipped (po opravě testu níže) |

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava; jízda projede souběhem bloku 1): medián 30 FPS, p95 50 ms, nejhorší snímek 67 ms.

Snímky ze skutečné aplikace:

- [souběh: protijedoucí parní vlak vyjel z tunelu, hráčův vlak stojí u přejezdu](img/2026-10-10-protijedouci-soubeh.jpg);
- [protijedoucí vlak zajíždí do levého portálu](img/2026-10-10-protijedouci-portal.jpg);
- [detail: lokomotiva mizí v oblouku, vagony za ní](img/2026-10-10-protijedouci-detail.jpg).

Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

Oprava testu nalezená při ověření G3: `tests/e2e/render.spec.ts` otevíral v každém testu dvě stránky s jízdou a nezavíral je. Čtyři stránky dál kreslily v softwarovém WebGL a zpomalily všechny další testy v tomtéž prohlížeči. Kouřový test bootu pak na plném běhu dvakrát překročil 10 s (samostatně PASS). Měření: kouřový test po testech vykreslování trval 9,7 s, po zavření stránek 2,1 s; druhý test vykreslování se zkrátil z 13,8 na 9,0 s.

## G4 — mosty přes potoky a krátké tunely

Rozhodnutí: [D-018](../decisions/018-bridges-and-tunnels.md). Ve slotu 4 bloků bez souběhu vede kolej po kamenném mostku přes potok v mělkém údolí. Ve slotu 6 prvního bloku a podle biomu i dalších bloků projíždí krátkým tunelem. Kopec nad tunelem při průjezdu zprůsvitní a vozidla uvnitř ztmavnou každé podle své polohy. Elektrický vlak má drát i přes most a tunelem, kde visí na závěsech ze stropu.

| Test                                                                                                                                                                       | Red                                                                                 | Green                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| Unit místa: most ve slotu 4 bloků bez souběhu (blok 0 vždy), údolí s rovným dnem pod mostem, tunel ve slotu 6 podle biomu                                                  | 3 FAIL proti stubům                                                                 | 3 PASS                                  |
| Unit výška břehu = max(násep, údolí)                                                                                                                                       | 1 FAIL proti stubu                                                                  | PASS                                    |
| Unit odstup rekvizit od potoka a stožárů od potoka                                                                                                                         | 2 FAIL (scenérie bez `bridge`; stožár 32 u od potoka)                               | 61 PASS                                 |
| Unit závěs ze stropu v tunelu a 72 u kolem něj, jinde stožár                                                                                                               | 1 FAIL proti stubu                                                                  | 6 PASS                                  |
| Unit šířka potoka u trati a rozměry nových dílů (mostek, zábradlí, portál s otvorem pro pantograf)                                                                         | 1 FAIL (šířka potoka); u rozměrů mutace výšky mostku 80 u → FAIL testu i validátoru | PASS                                    |
| Unit kryt tunelu: průsvitný, když je kterákoli část vlaku v tunelu nebo u něj, plynulá změna v čase simulace; poloha vlaku venku, částečně, uvnitř (TRN-06)                | 2 FAIL a 1 FAIL proti stubům                                                        | 3 PASS                                  |
| E2E TRN-06 a TRN-08: elektrická souprava přejede most a projede tunelem, sběrač stále na drátu, nic nepřekrývá vlak, kryt při částečném vjezdu průsvitný a pak neprůhledný | 2 FAIL proti buildu G3 (`aaa1817`, diagnostika bez `tunnels`)                       | 2 PASS                                  |
| `npm run check`, celé `npm run test:e2e`                                                                                                                                   | —                                                                                   | 449 unit PASS; E2E 102 PASS / 4 skipped |

Při vizuální kontrole jsem opravil tři věci, které testy nezachytí:

- Kopec nad tunelem měl nad portály svislé švy a jiný odstín než boky. Kryt teď nad portály pokračuje výš než 214 u a od paty portálu se svažuje k louce. Boky a kryt mají stejný tón i mřížku keřů a kvítí.
- Stožáry vedle tunelu byly za boky kopce. Boky jsou teď pod stožáry.
- Kopec dostal keře a kameny.

Výkon (`PERF_SECONDS=30 npm run measure:perf`, nejdelší souprava; jízda do chunku 15 projede mostem i tunelem bloku 0): s parní lokomotivou medián 30 FPS, p95 50 ms, nejhorší snímek 67 ms. S elektrickou (`PERF_LOCOMOTIVE=electric_retro`) medián 30 FPS, p95 50 ms, nejhorší snímek 67 ms.

Snímky ze skutečné aplikace:

- [parní souprava na mostku přes potok](img/2026-10-10-most-potok.jpg);
- [detail mostku: oblouk, římsa, zábradlí za vlakem](img/2026-10-10-most-detail.jpg);
- [elektrická souprava před tunelem](img/2026-10-10-tunel-pred.jpg);
- [průjezd tunelem: průsvitný kopec, ztmavená vozidla uvnitř, závěs drátu](img/2026-10-10-tunel-prujezd.jpg).

Známá vada mimo G4: kde začíná lesní lokalita, mění se barva blízké louky ostrým svislým okrajem. Vada je už v buildu G3; oprava je další samostatný krok.

Fyzický tablet, telefon a Tesla: **NEOVĚŘENO**.

## Oprava: ostrý okraj louky na přechodu biomů

Kde v přechodovém chunku (slot 7, od x = 512) začínala lesní lokalita, měnila se barva blízké louky a náspu ostrým svislým okrajem přes celou výšku obrazu. Vada vznikla v E2 ([D-013](../decisions/013-landscape-localities-and-backdrops.md)) a byla vidět i v buildu G3, viz [před opravou](img/2026-10-10-prechod-louky-pred.jpg). Teď louka i násep přecházejí plynule přes 192 u, viz [po opravě](img/2026-10-10-prechod-louky-po.jpg). Okraje polí za tratí zůstávají záměrně ostré a šikmé.

| Test                                                                                               | Red                                                    | Green                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| Unit prolnutí palet louky: na krajích přesně levá a pravá paleta, mezi nimi barvy každého odsazení | 2 FAIL proti stubu (vrací levou)                       | 2 PASS                                  |
| Řádek pixelů přes přechod ve světě 123 (chunk 7)                                                   | skok o 20–48 úrovní kanálu na jednom pixelu (build G3) | kroky po jedné úrovni zhruba každé 2 px |
| `npm test`, E2E krajiny a vykreslování (WebGL i Canvas stejně)                                     | —                                                      | 451 unit PASS; 14 E2E PASS              |

## CI: přejezdový E2E nezachytil fázi OPENING (`1d563ec`)

Na GitHub Actions selhal desktopový test „the barriers are down before the train arrives and rise only after the last wagon“. Viděl fáze `OPEN, WARNING, CLOSING, CLOSED, OPEN`, chyběla `OPENING`. Ostatních 101 testů prošlo.

- **Příčina.** Automat přejezdu je v pořádku: fáze OPENING trvá vždy, dokud se závory nezvednou, asi 0,8 s (48 kroků). Pořadí fází hlídají unit testy. Test ale fázi četl jen asi po 100 ms skutečného času přes `page.evaluate`. Na pomalém CI stačí jedna prodleva nad 0,8 s (snímek obrazovky, pečení chunku) a celá fáze proběhne mezi dvěma čteními. Simulace přitom za snímek dožene nejvýš 5 kroků, takže záznam po snímcích fázi minout nemůže.
- **Oprava bez čekání a opakování.** S `?debug=1` aplikace každý snímek zaznamená fáze každého přejezdu (`crossings[].phases`). Záznam má nejvýš 8 fází na přejezd a přejezd, který z jízdy zmizel, z něj vypadne. Test ověří pořadí WARNING → CLOSED → OPENING → OPEN z tohoto záznamu a kontroly během průjezdu zůstávají.

| Test                                                                 | Red                                               | Green  |
| -------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| Reprodukce: původní test při 6× zpomaleném CPU (CDP), 3 běhy         | 1 FAIL se stejnými fázemi jako na CI              | —      |
| Unit záznam fází: každá fáze jednou a v pořadí, omezená délka, úklid | 2 FAIL proti stubu                                | 2 PASS |
| Upravený E2E                                                         | FAIL proti buildu `1d563ec` (snímek bez `phases`) | 4 PASS |
| Upravený E2E při 6× zpomaleném CPU, 5 běhů                           | —                                                 | 5 PASS |
