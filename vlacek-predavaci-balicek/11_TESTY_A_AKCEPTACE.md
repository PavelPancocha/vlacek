# 11 — Testy, výkon a akceptace

[Zpět na rozcestník](../README.md)

## 1. Stav tohoto dokumentu

Níže jsou **požadavky na testy budoucí implementace**, nikoli výsledky testování hotové hry. V době vytvoření tohoto předání nebyla hra implementována ani testována na Tesle. Výsledky se vyplňují až nad konkrétním buildem.

Automatizované testy domény použijí Vitest, integrační/browser testy Playwright. Schopnosti emulace zjednodušují kontrolu viewportu, dotyků a offline stavu, ale nenahrazují fyzické zařízení (S12/S13, dokument 12). Testy gest mají ověřit skutečný InputRouter, ne pouze mock přímého volání rychlosti.

## 2. Testy ovládání — INP

| ID     | Situace                                                   | Očekávaný výsledek                                                      |
| ------ | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| INP-01 | Podržet prst ve světě 3 s.                                | Vlak zrychluje, nikdy nepřekročí limit.                                 |
| INP-02 | Pustit všechny prsty v plné rychlosti.                    | Plynule zpomalí k nule, bez couvání; nominálně zhruba 6 s.              |
| INP-03 | V plné rychlosti držet brzdu.                             | Výrazně kratší zastavení, nominálně zhruba 1 s.                         |
| INP-04 | Plyn jedním prstem, brzda druhým.                         | Brzda má přednost; po jejím puštění zbývající plyn znovu zrychluje.     |
| INP-05 | Dotknout se zvířete a držet 4 s.                          | Plyn funguje, jedna reakce, žádné nekonečné restartování zvuku.         |
| INP-06 | Klepnout na píšťalu a pauzu.                              | Dotyk nepropadne do plynu ani objektu pod tlačítkem.                    |
| INP-07 | Gesto doleva nad prahem a pod prahem.                     | Nad prahem brzda do puštění; pod prahem žádné náhodné brzdění.          |
| INP-08 | Táhnout prst ze světa na brzdu.                           | Zachytí se brzda, zůstane do puštění.                                   |
| INP-09 | Zvednout prst mimo plátno, pointercancel, ztráta capture. | Nezůstane viset plyn ani brzda.                                         |
| INP-10 | Skrýt okno / ztratit fokus při plynu.                     | Pauza, ticho, vymazané vstupy, žádný další simulační posun.             |
| INP-11 | Dotknout se Pokračovat a prst podržet.                    | Potvrzení samo nepohání vlak; nový dotyk po uvolnění už ano.            |
| INP-12 | Pět prstů, střídavé rušení a 30 rychlých tapů.            | Stabilní priority, bounded audio, žádná chyba nebo zaseknutá interakce. |
| INP-13 | Resize nebo otočení zařízení během držení.                | Pauza a nové hit oblasti; staré souřadnice neovládají novou scénu.      |
| INP-14 | Prst v levé části světa mimo brzdu.                       | Plyn, nikoli neviditelné brzdění celé levé poloviny.                    |

Klávesnicové ekvivalenty ověřit zvlášť, zejména `keyup`, auto-repeat a fokus v rodičovském panelu.

## 3. Souprava a geometrie — TRN

| ID     | Situace                                                   | Očekávaný výsledek                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRN-01 | 0, 1 a nejdelší povolená souprava; starší delší soupravy. | Do 2 000 u jede celá; starý save 1 600–2 000 u se obnoví zastavený, nad 2 000 u zůstane celý v depu.                                                                                                                                                                                                                                                                                                                                                                                                            |
| TRN-02 | Opakovat jeden typ 100×.                                  | Platná souprava, unikátní instance, správná celková délka.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| TRN-03 | Rozdílné délky přes kopec a údolí.                        | Každá karoserie a podvozky mají vlastní správnou polohu.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| TRN-04 | Stejná délka simulace při renderu 30/60/120 FPS.          | Stejná dráha v toleranci integrace; žádná rychlost závislá na FPS.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| TRN-05 | Kopec nahoru, dolů, dlouhé stání.                         | Nikdy negativní v; po puštění zpomaluje i z kopce.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| TRN-06 | Jedna část soupravy v tunelu, druhá venku.                | Neprůhledný kryt zakrývá vozidla jednotlivě, i zastavená v ústí. Hráč ani NPC neprosvítá koly, střechou či pantografem; paty sledují vlastní sklon.                                                                                                                                                                                                                                                                                                                                                             |
| TRN-07 | Nejdelší počáteční souprava (2 000 u).                    | Kolej existuje za všemi vozy od prvního snímku i přes švy; zadní rezerva 1 600 u, předstih 2 048 u.                                                                                                                                                                                                                                                                                                                                                                                                             |
| TRN-08 | Elektrická mašinka přes most, tunel a šev chunku.         | Všechny tři elektriky: vedení 128 u nad kolejí, kontakt hlavy < 0,5 u na Canvasu i WebGL, pracovní dosah 34–59,4 u bez dalšího natahování, nedosažitelný drát se omezí a hlásí příznakem bez pádu rendereru; sweep přechodu 192 u ověřuje sklon 12 % rovina ↔ svah a 9,8 % při přímém obratu sklonu; test skutečných obrázků ověřuje úchyty stožárů a oba konce drátu; celý katalog s náklady má rezervu nejméně 20 u na rovině, pravidlo portálových podpěr R6 zůstává. Fallback vedení používá stejnou výšku. |
| TRN-09 | Opakovaný rebase přes 16 384 u.                           | Neviditelný posun originu, stejné hit oblasti a obraz, žádný skok vlaku.                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| TRN-10 | Vzorkování LUT a spřáhla na extrémním validním profilu.   | Chyba polohy ≤ 0.5 u, žádný průnik vozidel; spřáhlo vizuálně navazuje.                                                                                                                                                                                                                                                                                                                                                                                                                                          |

U nominálního zastavení připustit toleranci dvou simulačních ticků plus snap epsilon. Přesný dojezd při maximální rychlosti na rovině zkontrolovat i podle analytického vztahu `v²/(2a)`; standardní hodnoty dávají 540 u bez brzdy a 90 u s brzdou před zanedbatelnou diskretizační odchylkou.

## 4. Generátor — GEN

| ID     | Test                                               | Očekávaný výsledek                                                              |
| ------ | -------------------------------------------------- | ------------------------------------------------------------------------------- |
| GEN-01 | Stejný seed/verze/index dvakrát.                   | Shodný serializovaný layout.                                                    |
| GEN-02 | Generování pořadím 0,1,2 a 2,0,1.                  | Layout každého chunku se neliší.                                                |
| GEN-03 | Přidání dekorace do jiného jmenného RNG kanálu.    | Nemění geometrii a rozmístění hlavních objektů.                                 |
| GEN-04 | Alespoň 1 000 seedů × 100 navazujících chunků.     | Spojité výšky a sklony, konečné souřadnice, sklon ≤ 0.12 + numerická tolerance. |
| GEN-05 | Záporné chunky a přechod -1 → 0.                   | Stejná kontinuita a determinismus jako v kladné části.                          |
| GEN-06 | Stanice, přejezd a vícedílné rezervace.            | Žádné nepovolené překryvy, stanice a přejezd na rovině.                         |
| GEN-07 | Všechny varianty biomového cyklu.                  | Platné přechody, dosažitelné všechny biomy, žádný skok světa.                   |
| GEN-08 | Nevalidní dekorativní template / vyčerpané pokusy. | Deterministický bezpečný fallback, žádná smyčka generování.                     |
| GEN-09 | Hráč s nejdelší povolenou soupravou.               | Geometrie za zadní částí zůstane, nepotřebná stará data se zahodí.              |
| GEN-10 | 10 000 chunků v headless simulaci.                 | Počet živých chunků závisí na aktuálním okně, ne na ujeté historii.             |
| GEN-11 | Save/reload na hranici chunku a uvnitř kopce.      | Stejná geometrie a poloha, nikoli záměna x za délku oblouku.                    |
| GEN-12 | Změna lokomotivy při stejném testovacím seedu.     | Jediná globální změna je elektrifikace a vlastní vlak; layout se nepřeseeduje.  |

Referenční hodnoty hashe pro algoritmus uvedený v dokumentu 04:

| Argumenty `hash32(...)`                | Očekávaný unsigned výsledek |
| -------------------------------------- | --------------------------: |
| `123456, 1, 'terrain-boundary', 0`     |                  2052965658 |
| `123456, 1, 'terrain-boundary', -1`    |                  3405464579 |
| `0, 1, 'route-template', 0`            |                  2985350705 |
| `4294967295, 1, 'tree-position', 9999` |                  3781884757 |

Tyto kontrolní hodnoty se vztahují jen k dodanému hash algoritmu, nikoli k již implementované hře. Náhodnost testovacího fuzzování musí mít také seed, který se při chybě vytiskne. Screenshot není náhrada kontroly návaznosti koleje.

## 5. Scénky a doprava — SCN

| ID     | Situace                                                  | Očekávaný výsledek                                                                                                                                          |
| ------ | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCN-01 | Projet stanicí bez interakce.                            | Žádné automatické brzdění nebo blokování.                                                                                                                   |
| SCN-02 | Zastavit, během scénky se hned rozjet.                   | Odjezd funguje okamžitě; lidé neriskují skok pod vlak.                                                                                                      |
| SCN-03 | Soupravy osobní/nákladní/bez vagonků se stejným seedem.  | Stejné okolní scénky; žádný požadavek na konkrétní náklad.                                                                                                  |
| SCN-04 | Vjezd k přejezdu ze stání s plným plynem.                | Předstih stačí, závory se zavřou dřív než dorazí čelo.                                                                                                      |
| SCN-05 | Sto vagonků přes přejezd, pak zastavit.                  | Závory zůstanou dole až do odjezdu posledního vagonku.                                                                                                      |
| SCN-06 | Auto začalo přejíždět těsně před triggerem.              | Stihne bezpečně opustit konflikt, další auta čekají.                                                                                                        |
| SCN-07 | Další vlak se přiblíží během otevírání.                  | Silnice zůstane blokovaná, závory znovu zavírají.                                                                                                           |
| SCN-08 | Vlak stojí přes přejezd při reloadu.                     | První viditelný snímek má zavřený přejezd a auta mimo něj.                                                                                                  |
| SCN-09 | Druhý vlak projede celou sekundární trasu.               | Nikdy na hráčově koleji, žádný skokový vznik/zánik v záběru; oba portály postupně zakrývají/odkrývají jednotlivá vozidla a poslední má po celou dobu dráhu. |
| SCN-10 | Opakovaná píšťala a odpověď NPC.                         | Není zvuková zpětná vazba ani nekonečný dialog.                                                                                                             |
| SCN-11 | Prasklý balónek, pauza, reload.                          | Ve stále zachovaném chunku zůstane spotřebovaný.                                                                                                            |
| SCN-12 | Několik minut stání.                                     | Živé ale omezené okolí, žádný neomezený růst front aut, zvuků či událostí.                                                                                  |
| SCN-13 | Přejezd opustí renderovací okno, nikoli rozsah soupravy. | Automat dál funguje, nezmizí logické uzavření.                                                                                                              |
| SCN-14 | Zvíře, traktor a cyklista v pohybu.                      | Cesty nevedou do hráčovy koleje mimo zabezpečený přejezd.                                                                                                   |

V každém ticku dopravního testu assertovat, že vlak a silniční aktér současně neobsazují konflikt. Zahrnout různé délky vlaku, rychlostní nastavení a okamžiky start/stop. Kontrola musí vyhodnotit i pohybový interval mezi tick stavy, ne pouze jejich koncové obrázky.

## 6. Obsah a rozhraní — UI / CNT

| ID     | Test                                                | Očekávaný výsledek                                                                                                                                                                                                      |
| ------ | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI-01  | První spuštění bez save.                            | Dostupný výběr lokomotivy bez čtení a přihlášení.                                                                                                                                                                       |
| UI-02  | Přidat, vybrat, přesunout, odebrat, vrátit editaci. | Jednoznačné operace, žádné smazání pouhým výběrem vozu.                                                                                                                                                                 |
| UI-03  | Přidávat vagonky až po délkový limit.               | Do 2 000 u včetně spřáhel; přesná hranice přijata, další vůz blokován, metr a všech 32 karet dosažitelné i na telefonu.                                                                                                 |
| UI-04  | Otevřít kopii v depu a vrátit se.                   | Původní cesta zůstává; změna draftu ji nepřepsala.                                                                                                                                                                      |
| UI-05  | Běžná karta bez fullscreen a bez instalace.         | Všechno podstatné dostupné a neodříznuté.                                                                                                                                                                               |
| UI-06  | Na výšku, malý výřez a velmi široký výřez.          | Žádné překrytí důležitých tlačítek, bezpečná pauza při resize.                                                                                                                                                          |
| UI-07  | Vypnutý zvuk, klávesnice, rodičovská branka.        | Ovládání srozumitelné bez zvuku, dostupná nastavení.                                                                                                                                                                    |
| CNT-01 | Validace katalogu.                                  | Přesně 10 lokomotiv, nejméně všech 32 požadovaných vagonků a unikátní ID.                                                                                                                                               |
| CNT-02 | Validace assetů a rozměrů.                          | Každý klíč existuje, žádný povinný placeholder, délky a pivoty jsou platné.                                                                                                                                             |
| CNT-03 | Kontaktní listy a živé scény.                       | Rozlišitelné typy a konzistentní styl; ne 10 přebarvených lokomotiv. Elektrické sběrače jsou nízké a široké; snímek ověří dotyk hlavy s drátem na pobřeží, mostě a u portálu, patrový vůz i náklady se pod drát vejdou. |
| CNT-04 | Přehled biomů a infrastruktury.                     | Šest biomů, 18 scénických sestav, varianty mostů/stanic a požadované živé typy.                                                                                                                                         |
| CNT-05 | Den, noc, tunel, sníh a déšť.                       | Vlak, kolej a brzda zůstávají čitelné ve standardním i úsporném režimu; v neprůhledném tunelu pokračuje kamera a vjezd/výjezd je vidět v ústí.                                                                          |

## 7. Ukládání a odolnost — DATA

| ID      | Situace                                                | Očekávaný výsledek                                                                           |
| ------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| DATA-01 | Uložit a obnovit všechny typy souprav.                 | Stejné pořadí a vizuální instance, zastavená jízda a stejný seed.                            |
| DATA-02 | Primární JSON je poškozený.                            | Použije se validní záloha nebo bezpečná nová hra, žádný crash.                               |
| DATA-03 | Úložiště zakázané / quota error.                       | Hra jde dál, rodič vidí omezení ukládání.                                                    |
| DATA-04 | Neznámá vyšší schemaVersion.                           | Data se nepřepíšou naslepo; informované bezpečné chování.                                    |
| DATA-05 | Známá migrace a přejmenovaný typ.                      | Zachování soupravy podle migračního pravidla a testu.                                        |
| DATA-06 | Velký save, NaN, Infinity, neznámé ID, dlouhé řetězce. | Vstup se odmítne či opraví definovanou cestou; nikdy se neprovede jako kód/HTML.             |
| DATA-07 | Ukončení mezi zálohou a primárním zápisem.             | Existuje alespoň poslední validní obnova, dvojice zápisů není mylně považovaná za transakci. |
| DATA-08 | Simulační hodiny po hodinové přestávce.                | Hodina nepřibude do jízdy; fáze pokračuje od uloženého ticku.                                |
| DATA-09 | Ztráta WebGL kontextu a návrat.                        | Pauza, rekonstruovaný render, žádný starý plyn.                                              |
| DATA-10 | Uložení při neúspěšném startu nové cesty.              | Předchozí validní cesta zůstává obnovitelná.                                                 |

## 8. Web, PWA a aktualizace — PWA

| ID     | Situace                                                 | Očekávaný výsledek                                                                                   |
| ------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| PWA-01 | První návštěva online.                                  | Hra není blokována nehotovou offline cache.                                                          |
| PWA-02 | Úplný balík → offline → zavřít a znovu otevřít.         | Hratelné menu, všechny vozy a všech šest biomů bez síťového stahování.                               |
| PWA-03 | Přerušit internet v polovině offline přípravy.          | Žádné nepravdivé „offline připraveno“, stará kompletní verze funguje.                                |
| PWA-04 | Nový build během rozehrané jízdy.                       | Žádný nucený reload, ztráta scény ani mix JS/asset verzí.                                            |
| PWA-05 | Nový worker, dvě staré otevřené karty.                  | Staré karty zůstávají konzistentní; čekající aktualizace je nepřepne násilím.                        |
| PWA-06 | Zavřít všechny instance a znovu otevřít.                | Připravená nová verze se aktivuje a save zůstane použitelný.                                         |
| PWA-07 | Chybí service worker, localStorage nebo Fullscreen API. | Online hra funguje s odpovídajícím omezením; bez Fullscreen API není tlačítko celé obrazovky.        |
| PWA-08 | Zamítnuté audio / fullscreen.                           | Žádný crash ani opakované rušivé žádosti; zamítnutý fullscreen zneaktivní tlačítko pro dané načtení. |
| PWA-09 | Nasazení na root i do `/vlacek/`.                       | Správné cesty, scope, ikony a načítání všech assetů.                                                 |
| PWA-10 | Chybějící obrázek nebo zvuk.                            | Nevrací se HTML app shell jako falešný asset; řízená chyba/fallback.                                 |
| PWA-11 | Několik aktualizací a cleanup cache.                    | Nepřibývají všechny historické balíky; aktuální ani záložní úplná verze se nepokazí.                 |
| PWA-12 | Browser vymaže offline data.                            | Stav se znovu zjistí; aplikace neslibuje offline funkčnost jen podle starého příznaku.               |

Offline testovat nad produkčním preview/HTTPS buildem, ne pouze přes Vite dev server. Emulace offline síťového stacku je jeden test; alespoň na cílovém Androidu ověřit i skutečné odpojení sítě a studený start.

## 9. Výkonnostní cíle — PERF

Cíle nejsou dosud naměřené hodnoty. Reference se doplní skutečným modelem tabletu a stavem Tesly.

| Metrika                              | Výchozí přijímací cíl                                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Plynulost v cílovém úsporném profilu | Medián alespoň 30 FPS během měřeného pětiminutového průjezdu.                                                     |
| Frame time                           | 95. percentil nejvýše 50 ms; samostatně uvést i nejhorší delší záseky.                                            |
| Odezva brzdy                         | Změna vstupního stavu nejpozději v následujícím simulačním kroku; viditelná odezva do 100 ms v referenční zátěži. |
| Dlouhá souprava                      | Výše uvedená kontrola i s nejdelší povolenou soupravou, přejezdem a živým okolím; celý vlak stále v obraze.       |
| Záseky při změně biomu               | Žádný opakovatelný main-thread blok přes 250 ms po předehřátí assetů.                                             |
| Paměť v 30min průjezdu               | Po úvodním načtení se ustálí; neexistuje růst živých chunků či listenerů podle historie.                          |
| Textury a síťový balík               | Rozpočty z dokumentu 07; případné překročení je měření a rozhodnutí, ne skrytá výjimka.                           |
| Lokální save                         | Do 128 KiB cílově, tvrdý limit 512 KiB, žádné velké assety uvnitř.                                                |

PERF-01 je instrumentovaný průjezd s nejdelší povolenou soupravou přes všechny typy infrastruktury. PERF-02 je 30min reálná jízda s opakovanou pauzou a změnami prostředí. PERF-03 je headless streaming 10 000 chunků. PERF-04 je studený start, předehřátý start a offline start se zaznamenáním podmínek sítě a cache.

Pro 1280 × 720 a současné maximální rozměry vozidel cílit nejvýše na zhruba 48 živých geometrických chunků; přesná mez se odvodí z délky soupravy, rezerv a dráhy NPC. Není dovoleno použít pevnou mez, která smaže poslední část dlouhého vlaku. Rozpočet na počet renderovaných objektů je samostatný.

Měřit skutečný frame time a počty objektů; pouze průměr FPS nezachytí škubnutí u tunelu. Není-li dostupné přímé měření browser paměti, vykázat počty živých entit/textur/listenerů a limitation; nevymýšlet přesný údaj v MB.

## 10. Testovací matice zařízení

Pro každé zařízení vyplnit:

```text
Zařízení / model:
OS nebo firmware:
Browser a verze / user-agent:
Datum a build:
Viewport CSS px / DPR:
Renderer / quality:
Dotyk 1 prst / více prstů / gesto brzdy:
Audio první start / po návratu:
Online hra:
Místní save:
Fullscreen:
PWA instalace:
Offline studený start:
Výkonový průjezd nejdelší povolené soupravy:
Známá omezení a reprodukce:
Výsledek: PASS / FAIL / NEOVĚŘENO / NEPODPOROVÁNO
```

Fullscreen, instalace a offline režim mohou být na Tesle nepodporované, aniž by tím automaticky selhal základní online cíl. Ovládání, vykreslení a stabilita online hry však pro deklarovanou podporu Tesly projít musí.

## 11. Krátké ověření s dítětem a dospělým

Bez skórování dítěte ověřit, zda po ukázce chápe držení/puštění, jestli neplete brzdu s píšťalou, zda trefí zvířata a jestli se hra nezasekne při nečekaném zacházení. Zaznamenat problém ovládání, ne údaj o schopnostech dítěte.

Dospělý vyzkouší vytvoření nové soupravy, pauzu, návrat po přepnutí aplikace, vypnutí zvuku a aktualizaci webu. Zpětnou vazbu promítnout nejprve do velikosti cílů, rychlosti a hustoty dění, ne automaticky do přidávání dalších režimů.

## 12. Konečná akceptace V1

V1 je hotová, když jsou splněné potvrzené požadavky a katalog, kritické automatické testy procházejí, skutečný web je nasazený, save/offline/aktualizace jsou ověřené v deklarovaných prostředích a omezení jsou výslovně uvedená. Blokující chyby: samovolně visící plyn, srážka na přejezdu, chybějící trať, rozpad soupravy, ztráta všech save bez fallbacku nebo nucené rozbití hry aktualizací.

Nesplněné neklíčové kosmetické přání lze viditelně odložit. Záměna chybějících devíti lokomotiv za „snadno rozšiřitelný katalog“ není dokončení potvrzeného obsahu.

### Delší souprava (D-028)

Unit testy ověřují pevný zoom podle reference 2 000 u, střed na 46 %, rezervy na 1280 × 800, 1140 × 512, 844 × 390 a 568 × 320, konzervativní atlas všech možných různých vozidel s NPC při 2 px/u a obnovu starého nadlimitního save. `tests/unit/train/longestConsist.test.ts` ověřuje 2 000 u, pořadí, spřáhla, svahy, zachování koleje a setkání s NPC. `tests/e2e/train-length.spec.ts` sestaví přesně 2 000 u a při jízdě světem 123 ověří všech 13 kreslených vozidel, uzavřené závory až po poslední vůz na přejezdu chunku 3, průjezd tunelem chunku 6 a obnovení. Stávající testy celé soupravy a katalogu na 844 × 390, 667 × 375 a 568 × 320 zůstávají bránou.

Regrese tunnel-1 (TRN-06, SCN-09): svět 123, hlavní tunel chunku 6 a oba NPC portály na sklonu −0,07885, polohy ±100, ±35 a 0 u včetně zastavení. Canvas i WebGL a fallback bez artu: žádné vozidlové pixely za krytem; žádná nová emise ze skály, žádný viditelný kouř vzniklý před vjezdem ani jiskry při brzdění uvnitř. Okolní život zůstává nezávislý. Regrese tunnel-3 navíc zastaví hráčovu lokomotivu s vagónem u obou hlavních ústí (art/fallback) a porovná zakryté i odkryté výřezy; pozitivní kontrola existuje u obou NPC portálů. Zakrytá již vypuštěná bublina nemá hit, pop ani záznam mezi viditelnými bublinami; odkrytý dotyk stále pohání vlak. Paty a zadní poloviny ústí nemění pixely při vzniku či zániku NPC a uvolní se teprve s vlastníkem scenérie.

### Kamera `camera-1`

| ID     | Situace                                                                                           | Očekávaný výsledek                                                                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TRN-11 | Všechny délky do 2 000 u na 1280 × 800, 1140 × 512, 844 × 390 a 568 × 320.                        | Střed geometrie na 46 %, nejméně 16 % za koncem a 24 % před čelem; celé kreslené SVG v obraze s rezervou nejméně 15 % / 23 %. Pevný zoom během jízdy.                      |
| TRN-12 | Stoupání a klesání současné horní meze 8 % a maximálního sklonu 12 %, vysoký terén i živý sběrač. | Celý vlak mezi HUD a brzdou, střed v prostřední části volného pásu; kolej od čela po pravý okraj stále v obraze, bez změny zoomu na kopci.                                 |
| GEN-13 | Širší výřez krátkého vlaku přes hranice chunků.                                                   | Kolej pokrývá celý viewport a 64u kreslicí rezervu, bez prázdného pásu na levém okraji.                                                                                    |
| SCN-15 | Snapshot přejezdu, rebase a DPR; krátký vlak plně/polovičně a nejdelší vlak.                      | Projekce přesně odpovídá kreslené kameře; začátek sklápění je ve viewportu, při obsazení závora 1 až po poslední vůz.                                                      |
| UI-08  | Katalog, zvířata a bubliny v malých výřezech.                                                     | Ovládací cíle nejméně 64 CSS px, zvířata 80 px; bublina nejméně 12px kreslený a 64px dotykový průměr. V překryvu nejbližší oprávněný střed, při přesné shodě horní kresba. |

Unit a integrace: `cameraFraming.test.ts`, `cameraTrackCoverage.test.ts`, `bubbleInteraction.test.ts`, `EffectsView.test.ts`. Bublinová regrese má dva středy 20 CSS px od sebe, oba dotyky a obě pořadí vložení; přesná shoda vzdáleností zachovává pořadí kresby. E2E `effects.spec.ts` klepá na bublinu, která není poslední kreslená. Výškový limit TRN-08 v `electric.spec.ts` používá společné rámování, ověřené proti skutečně kresleným hranicím chunků; limit výšky se nemění. Dále `camera.spec.ts`, `crossings.spec.ts` a stávající zkoušky celé soupravy, tunelu, stanice a setkání s NPC. Fyzická zařízení a hraní dítětem nejsou desktopovou emulací ověřené.
