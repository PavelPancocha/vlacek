# D-032 — Měření startu a výkonu jízdy

Datum: 2026-10-15 až 2026-10-16. Lane `perf-loading-1`, základ `8abe6d5`.

## Důvod a kontrakt sondy

Po integraci světa v2 zpomalil obnovený výlet. Optimalizace musí vycházet ze
stejné metody před/po a zachovat obraz, ovládání, seed, save i verzi generátoru.

`?debug=1` (také volba diagnostiky v dev menu po znovunačtení) zapne malou
sondu `window.__vlacek.snapshot().perf`. Dev menu → Diagnostika – podrobnosti
ukazuje český souhrn Načítání; Kopírovat JSON obsahuje celý vzorek. Bez diagnostiky ani grafu snímků se sonda ani PerformanceObserver nevytvářejí.

- `startInteractiveMs`: navigace → dokončení vytvoření aktivního úvodu/výběru;
  není to čas fyzického zobrazení pixelů.
- `ride`: požadavek Pokračovat/Vyjet zachycený před skutečným routerem → první
  POST_RENDER jízdy (i zmrazené obnovené), samostatně první snímek s platnými
  třemi atlasy. Chybějící/fallback grafika má `artReadyMs` neurčené.
- `svg`: v D-030 počet skutečně dekódovaných zdrojů a součet jejich Resource
  Timing fetchů (absolutní URL). Text může být přednačtený; nejde o součet všech
  síťových textových prefetchů. Decode interval běží od `decode:` k `bitmap:`
  v AtlasMetrics, tedy přes nativní SVG decode, bez čekání na bitmapový raster.
  Souběžné intervaly se sčítají a nejsou čistým CPU časem.
- `atlas`: počet publikovaných příprav a CPU součty existujících fází D-030
  `prepare`/`register` a `upload`. Zahrnují i práci zrušených či neúspěšných
  příprav, publikovaný počet roste jen po úspěšném commitPrepared. Není to GPU
  čas ani čekání mezi yieldy. Metody texture manageru se neobalují.
- `chunks`: prvních 12 různých indexů, součet generování scénérie a konstrukce/
  pečení ChunkView pro každý. Geometrie simulace se tím neměří a nemění.
- `longTasks`: podporuje-li prohlížeč Long Tasks API, počet, součet a maximum úloh
  delších než 50 ms se začátkem v prvních 15 s od prvního prezentovaného RIDING
  snímku. Pauza nevynuluje hodiny; nový požadavek vynuluje vzorek jízdy/úseků.

Sonda nevstupuje do simulace, náhodnosti, ukládání ani plánování. Observátor a
vstupní posluchače uvolňuje AppController.dispose, rozpracované decode záznamy
zrušení scény. JSON je oddělená kopie. Není přidána závislost.

## Ověření sondy

`VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/platform/PerformanceProbe.test.ts`
nejprve 3 behaviorální chyby (prázdný vzorek místo časů/součtů/omezeného okna),
po implementaci 3/3. Dvě další kontroly chrání reset/kopii vzorku a lifecycle
observátoru. Společně s RideScene a diagnosticsFormat: 12/12.

Browserový vzorek následně zachytil chybu sondy: Resource Timing má absolutní
URL, Phaser `file.src` relativní. Assertion `perf.svg.fetchMs > 0` nad vzorkem
`base-canvas-standard-1.json` selhal (0 ms); normalizace přes `document.baseURI`
a stejná assertion nad dalším během `base-canvas-standard-3.json` prošla
(422 zdrojů, 3385,1 ms). Trvalá regrese je v `loading-perf.spec.ts`.
Externí časy/count měřicího skriptu tato oprava nemění; první dva vzorky
sondy mají fetch součet neplatný, externí CDP síťový log zůstává platný.

## Metoda

Měření používá produkční buildy `35f260f` (`world-v2`), `8abe6d5` + sondu
(`world-v2-perf`) a `00e1b15` (`world-v2-perf-atlas`, starší obsahový základ).
V prvním a třetím worktree se mění pouze `dist/`. `npm ci` bylo hotové před
začátkem; všechny Node/npm příkazy běží přes Volta (24.21.0 / 11.19.0).

- Chromium headless shell Playwright 1.64.0, Linux, SwiftShader, DPR 1,
  viewport 1140 × 512, CDP `Emulation.setCPUThrottlingRate` 4, vypnutá cache,
  nový kontext prohlížeče pro každý vzorek. Port 4202, vždy jediný náš měřený
  prohlížeč. Ad hoc skript není E2E spec; ostatní lane dál používají desktop,
  proto se uvádí medián i celé minimum–maximum a malé rozdíly nejsou průkazné.
- Tři opakování pro každou sestavu × Canvas/WebGL × standard/low; stejný v1
  save, seed 123, generátor 2, chunk 7 / 512 u, `steam_local` a smíšená
  souprava přesně 2000 u (12 vozidel). Zvuk vypnutý, efekty dle profilu.
- Aktivní úvod pozoruje MutationObserver. Po Pokračovat se čte skutečné
  vykreslení canvasu (clear / GL draw) a odstranění clony; první rámec se
  zaznamená při následujícím browser RAF. Externí hranice má tedy odchylku
  nejvýše přibližně jednoho pomalého snímku oproti POST_RENDER sondy.
  Zvlášť se uchovává čekání včetně odeslání příkazu přes CDP.
- Po prvním snímku následuje Pokračovat z pauzy a držení ArrowRight 15 s.
  Měří se skutečně vykreslené snímky, ne všechny 60Hz browser RAF (low má
  vlastní limit 30). Každý běh ukládá medián/p95 a dlouhé úlohy >50 ms.
- Síťový log CDP počítá SVG; společný obal setteru Image.src měří blob SVG
  → load interval. Jeho součet obsahuje souběžné čekání, nikoli čistý CPU
  decode. CPU profil a timeline pomáhají rozlišit scripting a kreslení;
  `ScriptDuration` do odečtu úvodu / první jízdy není čistá doba parseru.
- GL drawArrays/drawElements a bindTexture se počítají mezi kreslenými
  snímky. Canvas nemá GL draw calls ani texture binds (v tabulce —).
  JS raw/gzip je součet skutečných build souborů, gzip standardní úroveň 6.
- Absolutní CPU/GPU výkon, latence skutečného dotyku a fyzická matice
  zařízení z tohoto měření nevyplývají. Atlasový snapshot má o 118 SVG méně
  obsahu než integrace; kauzální srovnání D-030 patří proti `35f260f`.

Necommitovaný skript a JSON/CPU profily zůstávají v `_runs/perf/` (lokální
artefakty mimo zdrojový strom), screenshoty v `_runs/shots/perf/`. Příkazy:
`volta run npm run build`, `volta run node _runs/perf/measure.ts`,
`volta run node _runs/perf/parse.ts`, `volta run node _runs/perf/shots.ts before`.
Skripty spouštějí/ukončují preview na 4202; žádný nespouští `measure:perf`.
Povinné E2E specy používají sdílený zámek a `--workers=2`.

## Výsledky základů

Každá buňka je medián [minimum–maximum] ze tří běhů. Nejde o interval
spolehlivosti. Čísla nelze převést na konkrétní telefon/Teslu. Diagnostika
přidává malou režii; ostatní lane zatěžují stejný desktop.

### Start a SVG

| Build           | Renderer / profil |         Úvod (s) | Pokračovat → rámec (s) | → všechna grafika (s) | SVG fetch / decode | Součet fetch (s) | Součet SVG zpracování (s) |
| --------------- | ----------------- | ---------------: | ---------------------: | --------------------: | -----------------: | ---------------: | ------------------------: |
| 35f260f         | canvas / standard | 1.24 [0.97–1.95] |    48.96 [43.02–50.57] |   49.15 [43.21–50.75] |          304 / 304 | 6.93 [3.95–7.88] |    1455.3 [1278.1–1516.3] |
| 35f260f         | canvas / low      | 1.51 [1.11–1.68] |    42.17 [36.26–51.31] |   42.35 [36.35–51.49] |          304 / 304 | 4.46 [3.43–4.61] |    1236.1 [1140.4–1478.8] |
| 35f260f         | webgl / standard  | 1.70 [1.53–1.92] |    53.17 [39.71–60.70] |   53.34 [39.87–60.89] |          304 / 304 | 4.21 [3.15–4.48] |    1652.2 [1226.4–1858.7] |
| 35f260f         | webgl / low       | 0.99 [0.82–1.62] |    32.40 [31.25–45.13] |   32.48 [31.36–45.32] |          304 / 304 | 2.51 [2.50–3.01] |     1026.7 [915.0–1368.1] |
| 8abe6d5 + sonda | canvas / standard | 1.42 [1.14–1.47] |    74.33 [64.61–74.62] |   74.48 [64.74–74.83] |          422 / 422 | 4.30 [4.20–4.90] |    2158.5 [1943.4–2187.4] |
| 8abe6d5 + sonda | canvas / low      | 1.47 [1.23–1.91] |    72.75 [69.65–73.43] |   72.86 [69.83–73.55] |          422 / 422 | 5.21 [4.22–5.33] |    2219.9 [2121.0–2260.2] |
| 8abe6d5 + sonda | webgl / standard  | 1.47 [1.27–2.12] |    82.17 [79.17–82.98] |   82.40 [79.29–83.15] |          422 / 422 | 4.34 [4.14–4.58] |    2513.9 [2405.6–2587.6] |
| 8abe6d5 + sonda | webgl / low       | 1.28 [1.24–1.70] |    80.46 [67.55–84.24] |   80.57 [67.67–84.68] |          422 / 422 | 4.70 [4.58–5.30] |    2498.2 [2114.6–2568.1] |
| 00e1b15 (D-030) | canvas / standard | 0.87 [0.80–0.99] |    12.45 [11.43–17.47] |   12.67 [11.68–17.58] |          304 / 161 | 3.68 [3.19–4.23] |          20.1 [19.9–23.9] |
| 00e1b15 (D-030) | canvas / low      | 0.90 [0.83–1.67] |    11.45 [11.39–17.49] |   11.70 [11.62–17.68] |          304 / 161 | 3.28 [2.73–5.47] |          19.9 [18.0–24.6] |
| 00e1b15 (D-030) | webgl / standard  | 0.85 [0.82–0.96] |    18.64 [15.52–18.88] |   18.76 [15.60–19.02] |          304 / 161 | 2.36 [2.32–6.52] |          22.8 [20.8–24.7] |
| 00e1b15 (D-030) | webgl / low       | 1.21 [1.16–1.26] |    26.48 [24.89–27.99] |   26.57 [25.04–28.20] |          304 / 161 | 3.62 [2.63–6.30] |          30.9 [27.6–30.9] |

Součet zpracování SVG zahrnuje překryv a čekání na main thread. Není to CPU
čas: proto může být mnohem větší než doba načítání. Vnější časy zahrnující
odeslání CDP příkazu jsou zachované v JSON (`continueIncludingDispatchMs`).

### Prvních 15 sekund jízdy

| Build           | Renderer / profil |   Rámec medián (ms) |      Rámec p95 (ms) | Dlouhé úlohy počet | Součet dlouhých úloh (s) | GL draw / rámec | GL bind / rámec |
| --------------- | ----------------- | ------------------: | ------------------: | -----------------: | -----------------------: | --------------: | --------------: |
| 35f260f         | canvas / standard | 233.3 [216.7–250.1] | 333.4 [316.5–366.6] |         55 [54–58] |      10.66 [10.62–10.72] |               — |               — |
| 35f260f         | canvas / low      | 216.7 [133.3–250.0] | 383.3 [283.4–383.3] |         57 [51–79] |       10.17 [9.81–10.77] |               — |               — |
| 35f260f         | webgl / standard  | 116.8 [100.0–166.6] | 283.3 [199.9–316.6] |        92 [71–127] |       10.15 [9.53–11.11] |      35 [31–36] |      26 [24–29] |
| 35f260f         | webgl / low       |  133.3 [83.3–133.3] | 250.0 [150.0–266.6] |       100 [99–148] |      10.84 [10.57–11.23] |      35 [31–35] |      26 [24–26] |
| 8abe6d5 + sonda | canvas / standard | 283.3 [149.9–316.6] | 433.3 [350.0–450.0] |         45 [43–75] |        9.69 [9.03–10.27] |               — |               — |
| 8abe6d5 + sonda | canvas / low      | 316.7 [216.7–333.4] | 433.4 [350.0–500.1] |         39 [39–61] |        8.97 [8.38–10.57] |               — |               — |
| 8abe6d5 + sonda | webgl / standard  | 150.0 [149.9–150.0] | 300.0 [266.6–300.0] |         86 [78–86] |         9.81 [9.29–9.98] |      34 [34–36] |      26 [26–29] |
| 8abe6d5 + sonda | webgl / low       | 149.9 [100.0–183.3] | 283.3 [200.0–316.6] |        84 [68–127] |        9.68 [8.39–10.48] |      34 [31–36] |      28 [24–29] |
| 00e1b15 (D-030) | canvas / standard | 100.0 [100.0–216.6] | 166.7 [166.6–300.0] |       124 [67–126] |      13.14 [12.89–13.20] |               — |               — |
| 00e1b15 (D-030) | canvas / low      | 100.0 [100.0–100.0] | 150.0 [150.0–150.0] |      134 [129–140] |      13.14 [13.00–13.17] |               — |               — |
| 00e1b15 (D-030) | webgl / standard  |    83.3 [83.2–83.4] | 133.3 [116.7–133.3] |      152 [151–169] |      12.11 [12.09–12.60] |      31 [31–31] |      24 [24–24] |
| 00e1b15 (D-030) | webgl / low       | 116.6 [100.0–116.7] | 200.1 [166.6–216.7] |      110 [102–128] |      11.74 [11.11–12.25] |      34 [31–35] |      26 [24–26] |

Jde o seed 123 / chunk 7, nikoli o dříve měřenou lesní paseku. Na této trase
se medián GL draw integrací nezvýšil (35 → 34 ve standard). Starší údaj
22 → 46 z paseky proto není vyvrácen ani reprodukován touto tabulkou.
Animace/efekty na konci integrovaného standard vzorku zabíraly typicky jednotky
ms proti 150–300 ms celého snímku; malý refaktor alokací sám takový rozdíl nevyřeší.

### Atlasy a první úseky v integraci

Čas CPU, včetně čekání vyvolaného CPU ×4. Generování je scénérie, nikoli LUT.
V 15s okně bylo dosaženo 7–10 různých indexů; sonda uchovává nejvýše prvních 12.

| Profil            | Balení/rasterizace (ms) |     Upload CPU (ms) | Generování součet (ms) |    Pečení součet (ms) |
| ----------------- | ----------------------: | ------------------: | ---------------------: | --------------------: |
| canvas / standard |  1803.3 [1690.6–2941.5] | 218.7 [175.4–266.3] |   937.0 [724.0–1035.2] | 1073.8 [849.4–1132.2] |
| canvas / low      |  1399.5 [1244.8–1698.3] | 145.0 [137.1–170.6] |    731.9 [605.3–781.2] |   949.5 [744.6–966.4] |
| webgl / standard  |     629.2 [440.0–666.3] | 315.0 [212.5–370.0] |   778.9 [628.2–1076.1] | 1072.6 [993.6–1649.5] |
| webgl / low       |     527.9 [393.6–589.4] | 212.6 [169.0–301.4] |   746.8 [600.2–1031.3] | 1092.7 [989.9–1478.7] |

### JavaScript a parse/eval

Raw/gzip je součet JS souborů. Samostatný studený trace má tři opakování
stejnou metodou; parserové události jsou vnořené a nesmějí se sečíst s eval.
`ParseFunction` zahrnuje lazy parsing do odečtu úvodu. Rozdílná zátěž desktopu
je vidět i zde; z menšího času eval integrace nelze vyvozovat, že větší bundle
zrychlil start.

| Build           |   Raw B | Gzip B | V8.ParseProgram ms | V8.ParseFunction ms |   v8.evaluateModule ms |
| --------------- | ------: | -----: | -----------------: | ------------------: | ---------------------: |
| 35f260f         | 1695703 | 454755 |  95.6 [92.5–112.9] | 435.7 [325.1–451.6] | 1751.2 [1151.4–1812.8] |
| 8abe6d5 + sonda | 1782678 | 479935 |  84.6 [82.7–105.9] | 256.8 [223.1–328.1] |   864.7 [773.3–1162.7] |
| 00e1b15         | 1731824 | 466301 |   61.4 [58.2–64.2] | 327.7 [264.4–349.3] |  1157.4 [938.1–1473.4] |

Dodatečný čistý `8abe6d5` z `git archive` (jen pro kontrolu neúspěšných E2E)
má JS 1778178 B raw / 478309 B gzip a build ID `0.1.0+8abe6d5`.
Neobsahuje sondu; proti instrumentované baseline je o 4500 B raw / 1626 B gzip
menší (včetně rozdílu build metadat). Nejde o další časovou sérii a tato
kontrola nedokládá nulovou runtime režii instrumentace. Závislosti používá
shodné s připnutým lockfilem, zdrojové worktree se při archivaci nemění.

### Pořadí hotspotů a bezpečný rozsah

| Pořadí | Hotspot a důkaz                                                                                                                                                                                                   | Odhad / pozorovaný přínos                                                                                                                                                                                 | Riziko a vlastník                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Celokatalogový SVG decode: 304 → 422 zdrojů, start integrace 74–82 s ve standard při ×4.                                                                                                                          | D-030 na stejném starším obsahu: Canvas standard 49.0 → 12.5 s (−75 %), low 42.2 → 11.4 s (−73 %); WebGL standard 53.2 → 18.6 s (−65 %), low 32.4 → 26.5 s (−18 %). 304 fetchů zůstalo, decode 304 → 161. | Největší výhra, ale vlastní atlas lane. Výsledek s novými 118 zdroji je třeba znovu změřit.                                              |
| 2      | První atlasové/úsekové práce jsou synchronní. D-030 má v přípravě p95 cca 7–8 ms a maximum cca 80 ms / pomalý krok `plan` i při deklarovaných 4ms řezech. První pečení a další nový chunk vytvářejí dlouhý rámec. | Rozdělení plánování / přípravy odstraní jednotlivé špičky; zisk celkového času není doložen.                                                                                                              | Střední až vysoké: první úplný vlak, clona, geometrie za vlakem, aktivace stránek. Nedělit úseky na slepo v této lane.                   |
| 3      | Jediný JS index 1.78 MB raw / 480 kB gzip zahrnuje celý Phaser a mění URL s každou změnou aplikace.                                                                                                               | Studený přenos se nezmenšil (479935 → 479705 B gzip); stabilní Phaser představuje 74,1 % gzip JS / 77,1 % raw. Dva různé build ID i následná změna HUD zachovaly jeho hash.                               | Nízké: statický chunk přes instalované API Vite 8 / Rolldown, automatický modulepreload. Samostatná malá změna.                          |
| 4      | Debug HUD každých 250 ms volá celý snapshot: bounds vlaku/rekvizit, efekty, svět, audio, kopie sondy. Dva řádky potřebují pouze 8 levných údajů.                                                                  | 4 plné odběry/s → 0, potvrzeno browserovou regresí; konkrétní zisk ms/FPS není prokázaný.                                                                                                                 | Nízké: zachovat stejné formátování a plný snapshot na vyžádání v dev menu. Platí pro zapnutou diagnostiku.                               |
| 5      | Draw calls a přepínání textur v hustých scénách. Na naší startovní trase integrace 34 GL draw proti starším 35; neprokazuje problém paseky 22 → 46. Efekty/animace jsou jednotky ms proti celému snímku.          | Malé refaktory alokací zde nejsou průkazná hlavní výhra.                                                                                                                                                  | Vysoké riziko změny vrstev/zakrytí při slučování. Znovu měřit konkrétní paseku po D-030; neomezovat katalog, vlak ani efekty bez důkazu. |

Úvod je v základní matici interaktivní přibližně za 0,8–2,1 s, zatímco
obnovení integrace čeká desítky sekund. `preloadArt` už pouze řadí zdroje do
Phaser loaderu bez sekvenčních await; audio manifest je statický a AudioManager
načítá zvuk až pro konkrétní přehrání. Všechny měřené jízdy měly zvuk vypnutý,
takže nové přednačítání audia nemůže vysvětlit jejich hlavní náklad. Další eager
fetch, lazy rozdělení dev panelů nebo přepis farm/forest batchů se bez měření
příslušné scény nepřidává. Úprava pouze cache frameworku zůstává malým,
nezávislým a ověřitelným řezem.

## Přesné návrhy pro atlas lane

1. **Hotovo v [D-030](030-world-atlas-region-window.md):** integrovaný start
   dekóduje 234 SVG místo 422 (měření integrate-5 níže; původní atlasová linka
   měla 222). Následující měření 304 → 161 jsou historická,
   pocházejí ze staršího obsahového základu. Nepřidávat další eager preload. V identickém starším světě klesl počet decode 304 → 161 a
   standardní start o 65–75 %. Raw SVG texty lze dál fetchovat souběžně;
   problém je drahé zpracování a zdrojové textury. Znovu měřit všech 422
   zdrojů / stejné regionové okno, low i standard (WebGL low má mnohem menší zisk).
2. Přípravu `plan` zahrnout do skutečně rozděleného plánování. Na ×4 má
   `prepare` opakovaně `violations: [prepare]`, p95 7–8 ms, max přibližně
   80 ms. Jeden nerozdělený plán nejde schovat za součet 4ms dílů. Doložit
   samostatně plán, decode, RGBA kopii, registraci a CPU upload; Canvas upload
   má oprávněně nulu, WebGL nikoli. Zaznamenat i první aktivaci/pečení úseků,
   které se nyní objeví v affected frames přes 800 ms.
3. Při integraci připojit asynchronní fáze na stejnou sondu. Její současný
   callerový obal `ArtAtlas.update` měří synchronní D-019, nikoli budoucí
   Promise/job z D-030. D-030 již má vlastní AtlasMetrics: použít jeho fáze,
   nedělat druhý obal ani nepřičítat čekání mezi yieldy jako CPU pack/upload.
   SVG fetch/decode také připojit u producenta D-030: jeho fetch/svgSource již
   nemusí emitovat původní Phaser load/filecomplete události.
   Upravit současně `loading-perf.spec.ts`: dnešní shoda fetch/decode a tři
   synchronní atlasy jsou kontrolou D-019, nikoli kontraktem D-030. Ověřit přesnou
   potřebnou množinu dekódovaných zdrojů/aktivních stránek místo vynucení decode
   celého katalogu nebo pouhého oslabení počtové assertion.
4. Kapacitní testy a vizuální/lifecycle brány D-030 zůstávají povinné. Tato
   lane neupravuje ArtAtlas, TextureMemory, atlasPacking, atlasFramePixels
   ani worldAtlas soubory a nemůže je označit za vyřešené.

## Optimalizace mimo atlas

Výchozí matice a obrázky byly dokončeny před implementací optimalizací.
Následující části uvádějí výsledky jednotlivých malých změn a závěrečné kontroly.
Fyzický telefon/tablet a Tesla: **NEOVĚŘENO**; žádné zvýšení timeoutů, změna save,
seedu, katalogu ani TRACK_GENERATOR_VERSION.

### Samostatný chunk Phaseru

`vite.config.ts` používá instalované Vite 8.3.4 / Rolldown API
`build.rolldownOptions.output.codeSplitting.groups` s názvem `phaser` a
selektorem `node_modules/phaser/`. Žádná závislost ani verze se nemění.
Phaser 4.2.1 zůstává celý, staticky importovaný; nevzniká nový lazy stav UI.
Vite vygeneruje odpovídající modulepreload se správným base path.

Po `volta run npm run build` má aplikace 408215 B raw / 124042 B gzip a
Phaser 1374100 B / 355663 B gzip. Celkem 1782315 B / 479705 B gzip;
studený přenos je prakticky stejný jako 1782678 B / 479935 B před změnou.
Při aktualizaci aplikace může host/browser znovu použít 74,1 % gzip JS
(77,1 % raw); to je doložený přínos, nikoli slib stejného zrychlení prvního
studeného startu.

Artifact assertion před změnou selhala: `Phaser must have one independent
cacheable chunk` (0 místo 1). Po změně prochází i kontrola HTML modulepreload.
Dva buildy s GITHUB_SHA `111…` / `222…`, oddělenými outDir a shodným kódem
mají jiné aplikační URL, ale byteově stejný `phaser-D8EC1TLR.js`.
Jde o lokální reprodukční kontrolu, nikoli o test CDN cache na zařízení.

Instalace a příkazy zůstávají beze změny: `volta run npm ci`,
`volta run npm run build`, `volta run npm run report:budgets`. Rozpočtový
skript již počítá všechny chunky. CI i lokální build používají stejný config.
Při regresi rozdělení zkontrolovat `dist/assets/phaser-*.js` a modulepreload
v `dist/index.html`; ručně nefixovat fingerprintované URL v HTML.

Časové A/B vzorky po rozdělení stále mají 422 fetch/decode a měnící se délku
SVG zpracování. Proto navíc následuje kontrolní návrat ke zmrazenému původnímu
dist, stejný Canvas/standard ×4, tři opakování. Bez tohoto rozlišení by se
pokles desktopové zátěže chybně vydával za odstranění SVG bottlenecku.

#### Před / po rozdělení bundlu

Stejný skript, všech 12 kombinací/opakování zopakováno. Čas rámce je medián
běhu a pak medián [min–max] tří běhů; p95 obdobně. Původní čísla jsou uvedena
výše. Počet SVG stále 422/422. Nižší doba SVG zpracování nemůže být přínosem
odstranění decode, protože se jeho implementace nemění.

| Renderer / profil |     Původní start s |      Po rozdělení s | Po rozdělení rámec ms | Po rozdělení p95 ms |
| ----------------- | ------------------: | ------------------: | --------------------: | ------------------: |
| Canvas standard   | 74.33 [64.61–74.62] | 42.27 [17.25–45.96] |     99.9 [50.1–200.0] |  300.0 [83.4–350.0] |
| Canvas low        | 72.75 [69.65–73.43] | 40.88 [19.03–45.82] |     83.4 [66.6–183.3] | 183.4 [116.6–283.3] |
| WebGL standard    | 82.17 [79.17–82.98] | 49.17 [42.95–49.94] |     83.3 [83.3–100.0] | 183.4 [150.0–200.1] |
| WebGL low         | 80.46 [67.55–84.24] | 60.32 [54.08–60.58] |   100.0 [100.0–133.3] | 233.4 [216.6–250.0] |

Čtyři předběžné tunelové testy nad zmrazeným původním dist přes preview 4202
prošly: desktop art/fallback 21,1/21,2 s, tablet-touch art/fallback 21,0/20,4 s.
To je proti dříve zadaným ~26 s rychlejší ještě **před změnou HUD**; potvrzuje to
význam prostředí, nikoli opravu jeho zdrojového SVG načítání. První pokusy na
4173 se ani nerozběhly kvůli cizímu serveru; nejsou vykázané jako herní chyby.

Kontrolní návrat na **původní monolitický dist**, beze změny jeho kódu, dal
Canvas/standard start 29,27 s [26,13–38,58] a medián rámce 100,0 ms
[99,9–133,3], p95 183,3 ms [183,3–233,3], stále 422 fetch/decode.
To je výrazně rychlejší než původních 74,33 s a leží uvnitř rozptylu série
po rozdělení. **Z těchto běhů není doložen kauzální zisk ani regrese studeného
startu/FPS rozdělením JS.** Doložený přínos této změny je izolovaná cache
frameworku; hlavní SVG problém zůstává D-030. Kontrolní JSON mají build ID
původního dist a uchovávají se jako `control-canvas-standard-[1-3].json`.

### Levný pravidelný HUD

`AppController.#frame` každých 250 ms předává `hudLines` pouze stávající
FPS/p95, renderer/kvalitu, seed, úsek, rychlost a počet vozidel. Plný snapshot
včetně geometrie a kopií efektů zůstává pro explicitní diagnostiku/dev menu.
Četnost a české formátování dvou řádků se nemění, veřejný snapshot má stejný
obsah. Nový getter/cache ani abstrakce není potřeba.

Před změnou `hud-perf.spec.ts` na skutečném buildu pod zámkem selhal v obou
projektech: Expected 0, Received 1 po `page.clock.fastForward(1100)`.
Test instaluje hodiny před bootem, vyprázdní text HUD a pak vyžaduje skutečné
obnovení českého textu i nulový počet plných odběrů. Nejde o umělé čekání ani
zvýšený timeout. Stejná sada unitů sondy, prezentace a formátování po změně
prošla 12/12. Browserový green: `hud-perf.spec.ts` + `loading-perf.spec.ts`,
6/6 v desktop/tablet-touch za 30,7 s. Výsledná časová matice je níže.
Průkazný přínos je odebraná práce (4 plné geometrické odběry/s → 0), nikoli
předem slíbený růst FPS. Save, RNG, simulace a zobrazení zůstávají stejné.

#### Před / po levném HUD

Před je rozdělený bundle bez opravy HUD, po je tentýž bundle s opravou.
Všech 12 opakování se stejným skriptem, 422 fetch/decode; opět nelze oddělit
časový šum desktopu od malé úspory práce. Zhoršení/zlepšení jednotlivých buněk
se neinterpretuje jako kauzální výkonový výsledek. Kontrolní monolit popsaný
výše už nezávisle prokázal velký posun prostředí.

| Renderer / profil |        Start před s |          Start po s |       Rámec před ms |         Rámec po ms |           p95 po ms |
| ----------------- | ------------------: | ------------------: | ------------------: | ------------------: | ------------------: |
| Canvas standard   | 42.27 [17.25–45.96] | 52.81 [49.98–56.53] |   99.9 [50.1–200.0] | 183.4 [149.9–233.2] | 316.7 [300.0–333.3] |
| Canvas low        | 40.88 [19.03–45.82] | 48.93 [40.27–57.90] |   83.4 [66.6–183.3] | 166.7 [116.7–233.3] | 266.7 [216.6–366.6] |
| WebGL standard    | 49.17 [42.95–49.94] | 51.31 [49.79–51.48] |   83.3 [83.3–100.0] |  100.0 [83.4–100.0] | 233.4 [216.7–249.9] |
| WebGL low         | 60.32 [54.08–60.58] | 80.19 [50.27–80.68] | 100.0 [100.0–133.3] | 100.0 [100.0–166.6] | 216.6 [183.4–350.0] |

Výsledný JS: aplikace 408558 B raw / 124087 B gzip, Phaser zůstává byteově
stejných 1374100 B / 355663 B gzip. Tři další studené trace: ParseProgram
71,8 ms [60,0–74,7], ParseFunction 245,7 ms [234,7–326,2], evaluateModule
938,4 ms [910,9–1300,2]; parserové události zůstávají vnořené, nesčítat.

Kontrola všech 63 jízd (36 základy + 12 bundle + 3 kontrolní návrat + 12 HUD)
prokázala plnou 2000u soupravu (12 vozidel), všechny tři atlasy, nenulový čas
úplné grafiky a žádnou pageerror. Žádný vzorek této matice není fallback.
Raw JSON obsahuje také frame/long-task/draw/bind rozptyl pro jednotlivé změny.

## Odstranění diagnostických alokací ze sondy

Závěrečná kontrola našla režii v samotné instrumentaci: připravenost grafiky
přes `scene.vehicleAtlas` sestavovala každý prezentovaný snímek diagnostický
seznam katalogových vozidel. `RideScene.artReady` nyní čte pouze tři aktuální
texture keys; nevytváří diagnostické objekty ani pole a AppController používá
přímo tuto boolean hodnotu. Žádná textura, automat ani čas hry se nemění.

`VITEST_MAX_WORKERS=4 volta run npm test -- src/render/RideScene.test.ts`
nejprve behaviorálně selhal Expected true / Received false po přidání třetí
připravené textury. Minimální implementace po každém přidání/odebrání textury
vrací správný stav; mockovaný getter `info` při použití vyhodí chybu, takže test
chrání i zákaz sběru diagnostiky. Společná dotčená sada má nyní **13/13**;
projektový typecheck a cílený lint prošly. Celý check a 63 měřicích jízd výše
proběhly před touto drobnou opravou sondy, s totožnou tehdejší instrumentací
v každé naší A/B sérii. Závěrečné kontrolní jízdy/obrázky jsou vykázané zvlášť.

Při D-030 musí `artReady` vycházet ze všech právě potřebných stránek a framů,
nejen existence asynchronně inicializované instance atlasu. Současné tři
synchronní texture keys platí pro D-019.

### Párová kontrola opravené sondy

Stejný ad hoc `measure.ts`, CPU ×4, WebGL/standard, 2000 u, cache vypnutá,
nový kontext a tři opakování. Běhy střídají starý zmrazený artefakt a opravený
artefakt (1 před, 1 po, 2 před, 2 po, 3 před, 3 po). Přepínače pouze vybírají
label/URL/rep; původní skript je archivovaný jako `measure-original.ts`.
Zátěž ostatních lane pokračuje i během této série.

| Ukazatel             | Před boolean opravou |   Po boolean opravě |
| -------------------- | -------------------: | ------------------: |
| Pokračovat → rámec s |  61.55 [24.12–62.67] | 29.12 [22.75–52.77] |
| Rámec medián ms      |     83.4 [50.1–83.4] |   66.7 [50.0–100.1] |
| Rámec p95 ms         |   200.0 [83.4–250.0] | 150.0 [100.0–200.1] |
| Dlouhé úlohy počet   |          90 [78–113] |        112 [47–140] |
| GL draw / snímek     |           31 [30–34] |          31 [30–34] |
| GL bind / snímek     |           24 [23–26] |          24 [23–26] |
| SVG fetch / decode   |            422 / 422 |           422 / 422 |

Rozdíl startu nemůže rozumně vysvětlit odstranění diagnostického seznamu až
v prvním POST_RENDER; jde znovu hlavně o podmínky desktopu. Intervaly rámců
se překrývají a počet dlouhých úloh neklesl konzistentně. Doložený výsledek
je tři čtení klíčů místo sestavování diagnostických atlasových objektů při
každém snímku; kauzální zisk FPS z těchto časů nevyvozujeme. Aplikační chunk
408597 B raw / 124087 B gzip, Phaser beze změny. Všech **69/69** jízd (původních
63 + tato šestice) prošlo guardem rendereru/profilu/2000 u/12 kompletně
vykreslených vozidel/tří atlasů/platného času grafiky/žádné pageerror
(`validated-rides.json`).

## Obrazové porovnání a prostředí testů

Osm dvojic v `_runs/shots/perf/`: 1140×512 a 1280×800, Canvas/WebGL,
156u samotná lokomotiva a 2000u smíšený vlak. Seed 123, chunk 7 / 512 u,
tick 0 a pauza; proměnlivý HUD a pauzové UI jsou při odečtu skryté. Výsledná
porovnání mají **8/8 přesných RGB shod, 0 změněných pixelů**. `comparison.json`
obsahuje cesty/počty. Nejde o vizuální důkaz všech biomů ani o fyzické zařízení.

První živý dist baseline měl dva neplatné obrazové vzorky: pouze 188/121 SVG
a `artVehicles=0` s chybějícími atlasy (fallback při souběžných buildech).
Původní soubory jsou zachované v `initial-baselines/`; neúplné vzorky nebyly
přijaty jako vizuální regrese. Celá baseline se zopakovala proti **zmrazenému
původnímu artefaktu před optimalizací**, přes samostatné `before.html` na témže
preview, bez změny hlavní testované stránky. Nový guard odmítne snímek bez
úplné grafiky. Výsledné obrázky po změně vznikly bez volání plného snapshotu
před expozicí, takže čtení bounds nemohlo maskovat případný vedlejší účinek.

Port 4173 byl obsazený jinou lane. Všechny skutečně spuštěné naše specy proto
používají podporované `E2E_BASE_URL=http://localhost:4202/`, předepsaný zámek a
`--workers=2`. Preview servíruje neměnnou kopii produkčního buildu, takže další
build příkaz neodstraní assety pod probíhajícím testem. Normální `dist/` ani
publikovaný build neobsahuje experimentální `before.html`.

Závěrečný E2E výběr se zdržel na uniklém sdíleném zámku: původní řídicí
PID 610858 už neexistoval, dva osiřelé dočasné `npm exec vite preview`
wrappery PID 642773/642774 (PPID 1, porty 4190/4191) stále držely jeho FLOCK
přes zděděný fd 3. Porty neměly připojené klienty. Po uložení příkazů a fdinfo
(`stale-lock-proof.json`) byly ukončené tyto dva neaktivní wrappery přes SIGTERM;
fronta ihned postoupila na naše čekající testy. Nešlo o neúspěch hry ani změnu
limitu. Dočasné background preview musí mít cleanup a nesmí si ponechat
zámkový descriptor řídicího procesu. Finální osmice po boolean opravě má opět
8/8 přesných RGB shod; starší after snímky jsou v `after-before-readiness/`.

## Lokální ověření

- `VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/platform/PerformanceProbe.test.ts src/render/RideScene.test.ts tests/unit/ui/diagnosticsFormat.test.ts`: původně 12/12, po poslední boolean opravě sondy 13/13; projektový typecheck a cílený lint také prošly.
- `E2E_BASE_URL=http://localhost:4202/ flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- tests/e2e/hud-perf.spec.ts tests/e2e/loading-perf.spec.ts --workers=2`: 6/6. Před opravou HUD stejná regrese selhala 2/2, Expected 0 / Received 1.
- `flock /tmp/vlacek-check.lock env VITEST_MAX_WORKERS=4 volta run npm run check`: provedeno jednou. Format/lint/typecheck prošly; unit 1076 pass / 2 fail, 113 pass / 1 fail souborů (114 celkem). Oba známé D-030 testy v atlasPacking: osm největších různých vozidel a legální souprava C.3 se samostatným atlasem světa na ART_MAX_PX_PER_U; `art does not fit a 2048 × 2048 atlas`. Timeout ani očekávání se nezměnily.
- Zbývající validátory spuštěné explicitně pod check lockem prošly: assets 42 vozidel / 103 částí vozidel / 319 částí světa / 0 placeholderů; world 8023 případů, tři mutation proofs a R3 20000 prvních bloků; docs 72 Markdown souborů; secrets/sizes 921 souborů. Unit brána D-030 tím není vyřešená.
- Tunelový požadovaný grep pod Playwright lockem / workers=2: 4/4. Desktop art/fallback 22,0/21,7 s, tablet-touch 24,2/23,6 s (zadaná integrace cca 26 s). Předběžný původní artefakt byl ve stejném prostředí rychlejší, takže nejde o důkaz kauzálního zrychlení touto lane.
- Cílené `smoke.spec.ts`, `ride-reveal.spec.ts`, `dev-menu.spec.ts`, `art.spec.ts`, `quality.spec.ts`, `layout-sweep.spec.ts`: **257 pass / 13 fail za 35,9 min**. Dev menu 68/68, smoke 14/14 a quality 2/2 prošly; art 16/18, ride reveal 34/38, layout 123/130. Dva art H0 + dvě native resize + pět home/parent ve vysokém rozlišení vyčerpaly celkových 30000 ms. Čtyři restored-ride reveal (standard/low × desktop/tablet) měly po pevných 30 browser RAF stále clonu a `rideFramesDrawn=0`; jde o nesplněné očekávání, nikoli pouze timeout. Traces zůstávají v `_runs/perf/final-e2e-results/`.
- `world-atlas*.spec.ts` na tomto základu neexistuje. Všech 14 vybraných variant neúspěšných scénářů se jednou izolovaně zopakovalo na předoptimalizačním artefaktu se sondou i na artefaktu po rozdělení/HUD: v obou případech 0 pass / 14 fail. Kontrola čistého `8abe6d5` bez sondy (git archive, pouze dočasný strom) má 1 pass / 13 fail za 4,2 min. Jediný pass: tablet 1920×1080 home/parent za 29,5 s. Body selhání se kvůli zátěži liší; u čistého základu některé reveal také narazily na celkových 30000 ms. To dokládá existující načítací bránu integrace, nikoli totožnost příčiny každého selhání ani zelenou větev. `isolation-summary.json` ukládá jednotlivé případy, `clean-baseline-results/` jejich trace. Nenavyšuje se timeout, nepřidává čekání, retry ani skip.
- Závěrečný výběr na `bf33e7b` (neměnný produkční artefakt s poslední opravou sondy): `E2E_BASE_URL=http://localhost:4202/ flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- tests/e2e/loading-perf.spec.ts tests/e2e/hud-perf.spec.ts tests/e2e/tunnel-occlusion.spec.ts --grep 'PERF:|tunnel-3 webgl.*stopped player locomotive' --workers=2`: **10/10 za 59,9 s**. Tunely desktop art/fallback 17,1/17,8 s, tablet-touch 20,8/19,8 s; proti zadaným cca 26 s pod limitem, avšak bez kauzálního přiřazení rozdílu této drobné opravě.
- Finální 8/8 obrazových dvojic přesně stejných. Všech 69 jízd má skutečně zvolený backend/profil, příslušný limit FPS (standard 0, low 30), 12 vykreslených vozidel, všechna art vozidla a platné tři atlasy.
- Finální produkční build a `report:budgets` se kontrolují zvlášť po uzavření zdrojových commitů; skutečný výsledek, přesné build ID a byteový/normalizovaný otisk vůči otestovanému artefaktu vlastní lokální `final-build-proof.json`, logy `final-build.log` a `final-budget.log`. Podmínka: stejný Phaser, aplikační JS shodný po nahrazení samotného build ID. Nejde o deploy ani browserový běh jiné funkční revize.

### Jednorázové kontroly načítacích selhání

Pass / celkem, vždy Playwright lock a workers=2. Před i po zde označuje
neměnné artefakty původní A/B série, před poslední boolean opravou sondy.

| Vybraný scénář (oba projekty) | Před optimalizacemi + sonda | Po rozdělení/HUD | Čistý 8abe6d5 |
| ----------------------------- | --------------------------: | ---------------: | ------------: |
| Art H0 depot/restore          |                         0/2 |              0/2 |           0/2 |
| Native resize přes 500 px     |                         0/2 |              0/2 |           0/2 |
| Home/parent 1140×512          |                         0/2 |              0/2 |           0/2 |
| Home/parent 1920×1080         |                         0/2 |              0/2 |           1/2 |
| Home/parent 1920×1200         |                         0/2 |              0/2 |           0/2 |
| Restore reveal standard/low   |                         0/4 |              0/4 |           0/4 |

Příkazy jsou stejné jako u široké sady, omezené `--grep` na uvedené názvy.
`E2E_BASE_URL` se liší pouze `/` (po), `/baseline/` (před) a `/baseline-clean/`
(čistý základ) na témže preview 4202. Žádný běh nemění očekávání.

Oprava HUD je interní změna odběru existujících dat: ovládání a produktové
specifikace zůstávají správné. Doplňuje se pouze zde popsaná diagnostika a
akceptace PERF-LOAD; text pro hotspoty development/roadmap je připravený pro
integrátora. Fyzický Android/tablet a Tesla včetně firmware, GitHub Actions a
produkční deploy jsou **NEOVĚŘENO**. `measure:perf` nebyl spuštěn.

## Oprava režie sondy po review (`perf-loading-2`)

Review `review-perf-1` našlo P2: sonda obalovala `addCanvas` i při nezměněné
škále všech tří atlasů. `RideScene` nyní před měřením porovná existující
`atlas.info.pxPerU` s `artScaleFor(zoom, maxPxPerU)`: svět a vozidla mají maximum
2 px/u, pozadí 1 px/u. Při shodě volá původní `update()` bez wrapperu a bez
čtení hodin sondy. První sestavení, invalidace přes `selectParts()` (smaže
metadata) a změna efektivní škály nadále procházejí měřením. `finally` obnovuje
identitu `addCanvas` i při chybě rasterizace nebo uploadu; existující fallback
zachovává starší texturu. Soubory atlasové lane zůstaly beze změny.

Regrese přes veřejný `RideScene.update()` používá skutečnou simulaci a mock
Phaser hranic; končí na kameře po všech třech aktualizacích atlasů, před kreslením
scenérie. Za 60 ustálených snímků (včetně resize uvnitř stejného kroku škály)
před opravou naměřila **360 přiřazení `addCanvas` a 180 čtení hodin**, po opravě
**0 a 0**. To odstraňuje také 180 vytvářených wrapperů. Nejde o měření FPS ani
o nové porovnání rychlosti načítání. Další dva případy ověřují přesné součty
úspěšných sestavení, invalidaci, resize a obnovu metody po chybě atlasu i uploadu.
Ovládání, obraz, uložená data, seed a generátor se nemění; produktová specifikace
a dosavadní ovládací dokumentace proto zůstávají správné.

Příkazy a úplné logy jsou v lokálním artefaktu
`/home/pavel/Projects/vlacek-worktrees/_runs/perf-loading-2/`:

- Red: `VITEST_MAX_WORKERS=4 volta run npm test -- src/render/RideScene.perf.test.ts`;
  2/2 selhaly kvůli nadbytečnému měření (`assignments: 360, clock: 180` proti 0/0;
  6 přiřazení místo 4 při změně škály s již hotovým pozadím). První pokusy před
  tímto behaviorálním red pouze doplňovaly chybějící Phaser mocky a nejsou důkazem red.
- Green: `VITEST_MAX_WORKERS=4 volta run npm test -- src/render/RideScene.perf.test.ts src/render/RideScene.test.ts tests/unit/platform/PerformanceProbe.test.ts tests/unit/ui/diagnosticsFormat.test.ts`;
  16/16 prošlo ve čtyřech souborech, včetně obou variant chyb.
- `flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- tests/e2e/smoke.spec.ts tests/e2e/loading-perf.spec.ts tests/e2e/hud-perf.spec.ts --workers=2`:
  **20/20 za 1,3 min** (smoke 14, sonda 4, HUD 2; desktop a tablet-touch).
- `flock /tmp/vlacek-check.lock env VITEST_MAX_WORKERS=4 volta run npm run check`:
  spuštěno jednou; registry, format, lint a typecheck prošly. Unit **1080 pass /
  2 fail** ve 115 souborech (114 pass / 1 fail). Selhaly pouze dva výše popsané
  známé kapacitní testy D-030 (`art does not fit a 2048 × 2048 atlas`). Žádný
  timeout ani očekávání se nezměnily. Navazující validátory kvůli ukončení
  řetězce proběhly samostatně pod stejným check zámkem a prošly: assets (42
  vozidel, 103 jejich částí, 319 částí světa), world (8023 případů, tři mutation
  proofs a R3 20000 prvních bloků), docs (72 dokumentů), secrets a sizes (922
  souborů). Příkaz: `flock /tmp/vlacek-check.lock bash -c 'volta run npm run validate:assets && volta run npm run validate:world && volta run npm run check:docs && volta run npm run check:secrets && volta run npm run check:sizes'`;
  log `check-tail.log`.

## Integrace integrate-4 (2026-10-16)

Callerový synchronní timing nahrazuje odběr existujících AtlasMetrics fází.
WorldAtlasRequests hlídá identitu obsahu i měřítka; nezměněný požadavek
nevytváří timing wrapper ani nečte timing hodiny, nové okno ve stejném měřítku
se měří. RideScene.perf.test testuje skutečný request automat a propojení
RideScene → AtlasMetrics → PerformanceProbe. Odebrání identity guardu musí
regresi shodit. Publikace vozidel, světa a pozadí se počítají samostatně.
Readiness používá publikované texture keys a lehké pending/ready příznaky,
bez tvorby diagnostického snapshotu. loading-perf navíc vyžaduje přesný součet
framů publikovaných world/backdrop stránek a vozidlového atlasu.

Phaser chunk split zachovává plugin PWA i inventář precache. Historické
benchmarky výše nejsou novým FPS či fyzickým měřením integrovaného buildu.

### Integrate-4: první zakrytá příprava a podrobnosti rodičovského panelu

Produkční scheduling zůstává podle D-030. Pokus použít cold/message-task
režim během zakrytého startu neodstranil mezní běhy, proto se nezavádí.
Testovací setupy a původní lhůty zůstávají beze změny; žádné dodatečné čekání.

Nadpisy diagnostických skupin mají scroll-margin-block 4 px: po přidání
výkonových údajů uměl prohlížeč při programatickém scrollu na tabletu oříznout
část nadpisu Tunely (viewport ratio 0,984375). Původní požadavek plné
viditelnosti ratio 1 zůstává a šest clipboard/viewport případů po opravě
prochází v desktop i tablet-touch.

## Start jízdy po Vyjet

Měření integrate-5 z 2026-10-16 porovnává čistý integrovaný build
`0.1.0+4718efe` s bází `0.1.0+5e3385d`: WebGL, desktop 1140 × 512, DPR 1,
seed 123, stejná nejdelší souprava 13 vozidel / 2 000 u. Pět čerstvých
browserových kontextů na build a profil, buildy se střídají. Čas běží od
skutečného aktivačního `pointerup` na Vyjet do mutace skrývající clonu;
nezahrnuje stavění soupravy. Sonda D-032 souhlasí do 0,7 ms.

| Build     | Profil   | Medián (ms) | Minimum–maximum (ms) |
| --------- | -------- | ----------: | -------------------: |
| `4718efe` | low      |     1 890,1 |      1 801,4–2 058,6 |
| `4718efe` | standard |     2 145,8 |      1 949,9–2 329,7 |
| `5e3385d` | low      |       156,4 |          137,9–203,2 |
| `5e3385d` | standard |       141,0 |          136,5–162,1 |

Zdroj: lokální `_runs/integrate-5-proof/start-latency-summary.json`; surové
vzorky a metoda jsou ve stejné složce. Během měření neběželo naše E2E, check
ani build a oba sdílené zámky byly držené. Stroj však nebyl zcela nečinný:
zatížení CPU na pozadí před sérií **12,9 %**. Je to lokální desktopové srovnání,
nikoli měření fyzického tabletu/Tesly nebo výsledek CI.

Na `5e3385d` Phaser `preload()` už během menu dekódoval celý katalog
**422 SVG**; `ArtAtlas` držel dekódované obrázky a po Vyjet synchronně
rastroval atlasy. Rychlý start tedy ukazoval skutečnou grafiku, fallback
byl chybová cesta. D-030 přednačítá v menu jen SVG texty a při odjezdu
dekóduje/publikuje startovní okno (**234 SVG** v tomto měření). Delší pobyt
v depu tuto práci zatím nepřipraví. Dodatečných přibližně 1,7–2,0 s po Vyjet
je skutečné zpomalení tohoto průchodu výměnou za omezenou paměť; přínos
rychlejšího Pokračovat hned po načtení je jiný průchod než tato tabulka.

**Rozhodnutí vlastníka 2026-10-16:** „Přijmout + 15 s v testech“.
Přibližně dvousekundová clona zůstává, sdílené testovací čekání na start/obnovu
má nejvýše 15 s podle [D-030](030-world-atlas-region-window.md).
Následující krok je připravovat startovní svět už během pobytu v depu;
není součástí této změny a musí zachovat paměťovou mez i první úplný snímek.

## Navazující záznam škubání — D-034

[D-034](034-ride-frame-pacing-instrumentation.md) doplňuje pořadí posledních
1 800 snímků, fáze CPU, zahozený simulační čas a události během celé jízdy.
Původní souhrn prvních 12 chunků a long tasks prvních 15 s zůstává doplňkem
pro start; není z něj možné vyvozovat nepřítomnost pozdějších špiček. První
kolo odstraňuje bezpečné opakované alokace. Hotspot #2 (synchronní konstrukce
a pečení chunků včetně readbacků) se rozdělí až podle tabletového záznamu,
nikoli naslepo.
