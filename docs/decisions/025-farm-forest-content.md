# D-025: Pole a hustý pracovní les

Datum: 2026-10-13. Stav: přijato pro nevydaný svět V2.

## Důvod

První řez world-core měl geometrické pole a nízkou lesní siluetu, ale chyběly
sezónní stroje, kreslený přední les a činnosti podle textových scén CR-01 a FO-02/04.
Vlastník požaduje pole a les před vlakem i za ním, práci mimo chráněný pás a text před generátorem.

## Rozhodnutí linky farm-forest

- Scénový modul `farm-forest.scenes.ts` a mapa `farm-forest.art.ts` používají 41 z 52
  dodaných SVG; lanovka, lom, bagr a sáňky zůstávají podhorské lince. Původ assetů
  předává integrátor do `assets/SOURCES.md`. Registry se generují standardním příkazem.
- První ID `near-field` a `forest-work` zůstávají aliasy dokončených scén s nulovou
  váhou, aby plánovaná příležitost a starý lokátor zůstaly srozumitelné. Nové volitelné
  scény mají prefix `farm-forest-`. Husté lesní jádro má vlastní dvouchunkový slot. Další pevné místní sloty
  zaručují remízek/paseku a sad/statek; seed 10 bez nich ukázal region s jediným
  doplňkovým motivem (SCN-CR04/FO01).
- Sezónní pravidla čtou efektivní klima místa včetně obou hran celého obalu. Na jaře
  traktor připravuje/setí do brázd, v létě lisuje a kombajn sklízí zadní pole, na podzim
  orá a v zimě radlice čistí příjezd. Zimní podpory jsou zasněžené; letní plodiny a
  kombajn tam nesmějí vzniknout. Varianty mají `atlasGroup.seasons` pro D-030.
- Cesty se plánují před stroji. Mají numerický obrys a konkrétní závislost stroje;
  polní/lesní cesta nevytváří dopravní automat ani neřízené křížení koleje. Nářadí je
  připojené výtvarnými kotvami. Rozměry dílů se nezmenšují kvůli atlasu nebo výhledu.
- Numerický katalog přebírá a validuje konzervativní `workBoundsU`. Geometrie i
  validátor ji používají pro celé nářadí, ramena, kmen a oba směry patroly. Pole musí
  unést celou kontaktní patrolu. Oddělené pracovní kapsy jsou před tratí, auto a
  přístup ke skládce za tratí. Zadní příjezd je krátký, v hloubce 0,68 a na
  obou koncích mizí v porostu; jeho samostatné ID/rozsah odpovídají skutečné kapse.
  Tím nekoliduje s druhou kolejí ani jej nezahodí vzdálený portál. Dospělé stromy jsou vždy v zadní vrstvě. Pracovní přední scény mají malého
  ježka v odděleném dolním pásu; poloha aktéra je
  explicitně x = 128 u na suchém okraji mimo obaly strojů. Původní 60u odstup
  všech předních rekvizit od aktéra zůstává v platnosti i po přizpůsobení zvířete HUD.
- `FarmForestView` vlastní složené obrázky v kontejneru chunku. Kola sledují dráhu,
  ramena používají pomalý 32s cyklus a explicitní úchop kmene. Čas vychází ze stejné
  simulační smyčky; pauza zastaví činnosti. Žádné timery, listenery ani runtime RNG.
  Lože vyvážečky zůstávají na pevných koncích cesty; její 32s cyklus zastaví
  při uchopení i odložení a vodorovný kmen se pohybuje pouze v úchopu.
  Zrcadlení celé sestavy řeší společný `vehicleHeading` (D-029) z vlastního
  směru patroly a `front` metadat kresby. Směr kamery orientaci neurčuje.
- FO-02 má daleký a střední sezónní pás s původní paralaxou a nízký kreslený přední
  okraj. Na herním měřítku měly přední díly ostré obdélníkové okraje; lokální
  průhlednost posledních 5 % šířky a spodního lemu je změkčuje bez změny rozměrů. Bez načteného artu zůstává původní geometrický fallback. Datel a sova mají
  konkrétního rodičovského stromu. Lávka vznikne pouze nad potokem společného mostu.
  Krmelec stojí na suché ploše. Večerní čas sovy a nové zvuky potřebují vlastní
  existující systém den/noc/audio; tento řez je nepředstírá.

## Kompatibilita a integrace

Generátor 2 je stále nevydaný; tento obsah dokončuje jeho připravovaný PR. Schéma save,
ID vozidel a vydané migrační fixtury se nemění. Změna vydaného světa později vyžaduje
rozhodnutí kompatibility podle dokumentu 08. Podklady renderu, vstupy a vlaková fyzika
zůstávají autoritativní v world-core.

Fyzický telefon/tablet a Tesla: **NEOVĚŘENO**. Výkonový protokol a snímky obdrží
integrátor; desktopové Canvas/WebGL nejsou důkazem výkonu Tesly.

## Navazující linka nature-water

Tuto sekci doplní vlastník nature-water po svém dokončeném řezu; nejde o schválení
neimplementovaných změn vody nebo dalších krajin.

## Browserový průchod a čas

Nový scénový E2E obnoví validní v1 cestu s krátkou nebo nejdelší smíšenou soupravou
(přes existující doménový helper). Výběr/depo mají vlastní UI testy. Cold boot
prostředí proběhne jednou v `beforeAll` pro renderer × délku soupravy, normálním
časem a s kontrolou připravených atlasů a všech vozů. Hook i samotné testy mají
původní samostatné 30s lhůty; timeout ani retry se nenastavují. Každý scénový
test lokátorem založí novou dočasnou simulaci, takže výsledek nezávisí na předchozí
scéně; opakovaný vstup ověřuje také cleanup skupin a masek.
Po skutečném vstupu lokátorem drží veřejný Playwright clock pozastavený a
postupuje po 80 ms, aby se nekreslily další snímky běžícího času. Tato délka je
pod limitem pěti catch-up kroků při 60 Hz; skutečný Phaser, InputRouter a simulace
běží dál. Každá fáze výslovně ověřuje nárůst `simulationTick` pro celý zadaný čas.
Původní `runFor` renderoval stovky zbytečných mezisnímků v softwarovém rendereru a
vyčerpal 30s limit i samostatně; limity, čekání, retries, kvalita a podmínky se
nezvyšují ani neoslabují. Screenshotové průchody používají standardní renderování.

## Opravy po review farm-forest-1 (farm-forest-2)

- Jediná 32s trajektorie vyvážečky určuje polohu, ujetou dráhu kol i směr. Zastavení
  drží předchozí směr; úchop a pevná lože jsou ověřeny skutečnými renderovými
  transformacemi ve světě. Browserový test vykreslí celý cyklus při stojícím vlaku;
  průjezd pracovní scénou patří také PNG průchodu. Není zvýšen timeout ani retry.
  Trace si ponechává API/source, ale vypíná JPEG/DOM snímky: 255 readbacků při
  400 explicitních časových krocích předtím vyčerpalo 30s limit.
- `workContactsU` přebírá kontakty kol a připojeného nářadí z výtvarných kotev.
  Podpora cesty se kontroluje po 8 u, včetně konců a obou zrcadlených nohou; samotné
  ID už nestačí. Lávka sdílí meandr a šířku skutečného potoka s kresbou a oba
  výtvarné břehové body musí ležet alespoň 3 u mimo vodu.
- `layout` je konkrétní statická kompozice řad a lesních skupin. Opakované skupiny
  sdílejí ořez podle stejného numerického polygonu jako umístění. Původní masky
  nahrazuje níže popsané zapečení; nejsou zavedeny timery ani další simulační smyčka.
  Pole má pracovní pruh, příčné brázdy a souvrať pouze na koncích scény, nikoli
  každého technického chunku. Nezávisí na konkrétní změně taperu world-core.
- Husté jádro se vybírá pouze ve svém garantovaném 2 048u slotu; stanice jej nesmí
  přerušit. Dvě bližší skupinové vrstvy doplňují paralaxu, 16 bližších kmenů a
  souvislý nízký přední okraj. Práce tvoří ohraničenou paseku. Boky a spodek osmi
  sezónních pásů mají průhledný lem; překrytí dlaždic brání obdélníkovým schodům.
  Nejsou přidány další atlasové díly ani měněny jejich rozměry či limity.
- Regionový validátor čte skutečné přeživší kompozice (včetně stanic), sezónní
  traktor, různé další motivy, klidnější interval a nepřerušené husté jádro s počtem
  stromů a skupinami. Globální svědci zůstávají doplňkem, nikoli důkazem garance.
- D-030 slučuje landscapes/seasons po jednotlivých polích podle rozhodnutí
  integrátora. Sezónní díly nadále mají pouze vlastní seasons; pravidla odvozují
  countryside/forest. Nepřímo používaná kola, nářadí, ramena a mávací póza potřebují
  při integraci dědění z rodiče nebo explicitní landscapes (seznam v předání).
- Nízký zimní lem je nová nepravidelná zasněžená silueta. Zimní listnáče a jejich
  výběr vlastní seasons-life; celý zimní les vyžaduje společný snímek po integraci.
  Vite warning JS chunku se nemění; SVG jsou samostatné soubory, nikoli jeho příčina.

Kompatibilita: stále nevydaný generátor 2; schéma save 1 a vydané ID se nemění.

Starší testy izolovaných sprite kotvy doplňuje kontrola skutečného ořezaného
polygonu proti řece/silnici a viditelného 2D obalu proti zvířeti. Identita
kompozic zůstává `rule/candidate`; kandidáti 1000+ nekolidují s běžným
přechodovým pravidlem stejného indexu. Samostatné kotvy zůstávají uvnitř chunku. Souvislé skupiny mají světové kotvy;
fragment z předchozího chunku je omezen jeho skutečným ořezem.

## Ověření farm-forest-2

- Cílené behaviorální reds: posunutá cesta se zachovaným ID, nespojené skupiny/řady,
  chybný meandr, chybějící regionové garance a původní světová poloha vyvážečky
  o 33,510 u vedle. Kola mají také regresi skutečného škálovaného poloměru.
- Závěrečný check: 904 testů / 95 souborů; typy, lint, formát, assety, registry,
  svět a dokumentační/provozní validátory zelené. První úplný běh zastavilo sedm
  starších invariantů kotvy/ID/ořezaných skupin; po jejich opravě se nutný
  závěrečný běh dokončil. Svět: 7 974 kompozic, čtyři pořadí dotazů, mutace;
  silnice/voda 18 400 případů / 100 seed cyklů; R3 20 000 bloků.
- Farmové E2E 12/12 (Canvas/WebGL × krátká/nejdelší souprava), celý pracovní
  cyklus; původní world-diagnostics sériově 4/4. Staré post-reload timeouty se
  nereprodukovaly; jejich příčina se z úspěšného běhu nepředstírá.
- 20 PNG při 1140×512 a 1280×800: pole, pracovní paseka, husté jádro, zimní
  okraj a lávka. Průjezd skutečně zvyšuje polohu vlaku a nezakrývá jeho pás.
- Headless srovnání s `10b331a`: 12 vozidel, 60 zahřívacích + 180 měřených
  snímků na kombinaci pěti scén a dvou rendererů. Aktualizovaná dekorativní
  view/chunk mají maximum 17–43 (kompozit stroje = jedno view); všechna jeho kola
  a ramena jsou zahrnuta v CPU čase. Compound update mean 0,077–0,158 ms, celý
  chunk update 0,296–0,501 ms, render CPU mean 2,700–4,837 ms.
  Canvas frame medián 18,1–23,5 ms; WebGL 33,0–43,7 ms (základ 31,1–41,8 ms).
  Pole/práce se ve WebGL zhoršily; zima/lávka zrychlily. Jitter sdíleného desktopu
  a software WebGL nedovoluje připsat celý interval CPU kresbě. GPU dokončení
  nebylo měřeno odděleně; 45 FPS brána ani fyzický přístroj nejsou prokázány.
- Generování 512 countryside/forest chunků: mean 2,468→4,431 ms, p95
  7,435→13,522 ms, mean props 32,207→37,549, maximum 57→59. Kompozice alokuje
  při sestavení chunku; vlastní per-frame smyčka používá znovu pose/foot a
  nevytváří nová pole/objekty. Podrobná měření a snímky předává protokol běhu.

Zimní listnáče musí seasons-life napojit i do `FarmForestComposition`
(`forest-trees`). Celý zimní les čeká na společný integrační snímek; zimní
popředí tohoto řezu je samostatně prokázané.

## Opravy po review farm-forest-2 (farm-forest-3)

Instalovaný Phaser 4.2.1 v `Mask.setMask` odmítá GeometryMask ve WebGL. Nová
`StaticComposition` proto nejprve vykreslí atlasové díly do Canvasu s `clip()` podle
stejného polygonu jako doména a až hotové pixely přidá přes `textures.addCanvas`.
Canvas i WebGL zobrazují tutéž texturu. Jedna statická textura přísluší každé
potřebné hloubce: dva zadní lesní pásy a jeden přední okraj; pole má dvě řady
v každé straně koleje. Blízké kmeny, zvířata a celé stroje zůstávají samostatné.
Ořezání nevyužívá rendererové masky ani nealokuje v animační smyčce.

Rozměry textury jsou těsným obalem viditelné kompozice, rozlišení nejvýše 1 px/u
(stejný limit jako zem v dokumentu 07). Dočasný kreslicí Canvas se po složení
vynuluje. Chunk vlastní textury i obrázky a při odchodu je uvolní; zkouška opakovaných
lokátorů porovnává registrované textury s živými obrázky a indexy chunků. Dekorativní
kontejnery mimo horizontální výřez se nekreslí, jejich pohyb zůstává analytickou funkcí
simulačního času. Culling nemění existenci vlaku ani železniční infrastrukturu.

Rozteč lesních skupin je `floor(promítnutá šířka × 0,88)`: přesah pokrývá oba 5%
průhledné boky. Kotvy jsou na světové mřížce, včetně dlaždice začínající před chunkem;
jejich výška se také vzorkuje ve světové souřadnici. Šev 64/65 seedu 1 kontroluje
promítnuté pokrytí obou zadních vrstev i předního okraje a shodu přesahujících kotev.
Skutečný začátek/konec porostu má 192u lem vzadu a 128u vpředu. Technický řez nemá
vlastní prolnutí; ukončení u stanice respektuje skutečnou náhradu plánované šablony
(regrese seed 2 / chunk 33). Pracovní kapsa i vyloučená infrastruktura mají vlastní
ořez a zakončení. Oblé souvratě a podpora z integrovaného world-core zůstávají zachované;
travnatý obrys se nekreslí přes technické příčné řezy.

`farm-forest.spec.ts` ověřuje skutečné pixely izolované vrstvy nad potokem,
u přejezdu a na kraji pracovní kapsy v obou rendererech. Obsah uvnitř polygonu musí
být nenulový, mimo něj nesmí zůstat pixel kromě jednobodového vyhlazení hran.
Konzole nesmí obsahovat odmítnutou masku. Traktor musí po pěti sekundách stále
existovat, teprve poté se kontroluje poloha a kola. Proba pouze odhalí reference
z testovaného buildu; produkční debug API se nerozšiřuje.

Rebase je na integrovaný `82a55bf` včetně kamery se středem na 46 % a master merge.
Integrace polish-1 nahrazuje `farmMachineFlip` společným `vehicleHeading` (D-029).
Traktor, kombajn, harvestor, vyvážečka a auto s kládami zachovávají původní
zrcadlení v obou směrech; nulová rychlost ponechá poslední směr. Složený
stroj bez patroly se neotáčí. Regrese `FarmForestView.test.ts` kontroluje
pravostrannou kresbu při pohybu doleva i po zastavení; `VehicleHeading.test.ts`
zachovává všechny původní případy orientace. Save ani geometrie se nemění.
Sezónní metadata nadále nastavují jen `seasons`;
D-030 slučuje `landscapes` nezávisle. Žádná nová závislost, licence ani save formát.
Generátor 2 stále není vydaný. Výsledky měření standard/low proti `f60a001`, browserových
bran a snímky jsou součástí předání tohoto běhu; nejde o důkaz fyzické Tesly/tabletu.

Měření 2026-10-14 používá 1140×512, DPR 1, soupravu 2000 u / 12 vozidel,
60 zahřívacích a 180 měřených snímků. Baseline `f60a001` má pro srovnání pouze
kamerové hodnoty sjednocené na výsledný zoom a střed 46 %. WebGL je SwiftShader.
Odhad textur včetně dekódovaných zdrojů je 55,5–56,1 MiB v obou profilech;
samotné kompozice zabírají 1,44 MiB v jádru a 1,71 MiB u paseky. Tři kompozice
mimo výřez se v obou případech nekreslí. Limity 96/192 MiB jsou v této matici splněné.

Výkonová brána zůstává otevřená: standardní Canvas má medián 19,3 ms v jádru,
ale 25,1 ms u paseky; WebGL 31,8/34,1 ms. Cíl 45 FPS tak splňuje jen Canvasové jádro.
Low WebGL jádro má 33,0 ms / p95 43,5 ms, paseka 40,9 / 51,1 ms
(baseline paseka 46,6 / 71,7 ms); paseka nesplňuje 30 FPS ani p95 50 ms.
Low Canvas je na hranici stropu 30 FPS: 33,5/33,4 ms, p95 36,1/35,7 ms.
Zbylý náklad je doložen, nikoli připsán samotné animaci: ve WebGL standard klesají
vykreslené sprity 418→390 a 444→372, ale GL draw volání rostou 22→46 a 33→53.
Samostatné textury přitom vyžadují další dávky při `maxTextures: 1`. Průměr CPU aktualizace chunků
zůstává 0,20–0,43 ms a render submission 2,60–4,67 ms napříč maticí. GPU čas není
měřen samostatně; další zrychlení vyžaduje profilování batchování a plošné kresby
na cílovém zařízení, nikoli další omezení katalogu nebo soupravy.

## Oprava po review farm-forest-3 (farm-forest-4)

Review farm-forest-3 našlo chybu pořadí kresby: `ChunkView` přidával zapečené vrstvy
do `nearProps` až za všechny jednotlivé props, ale seřazený byl jen `backProps`.
Vzdálenější letní řada pole (hloubka 0,66) tak překreslila bližší balík slámy (0,67)
a přední lesní okraj (0,28) vrcholky bližších mladých smrčků, v Canvasu i WebGL.

Každé dítě obou kontejnerů, tedy obrázek, kořen stroje, lože i zapečená vrstva, proto
nese hloubku podle `propDrawOrder` (vzadu `-depth`, vpředu `depth`) a po sestavení
chunku se oba kontejnery jednou stabilně seřadí. Stejné hloubky zachovají pořadí
`propDrawOrder`. Zapečené textury, jejich ořez, limit 1 px/u, uvolnění s chunkem,
culling mimo výřez bez alokací ve snímku i `maxTextures: 1` podle D-010 se nemění.

Regrese `FO02/CR01 baked depth order` ve `farm-forest.spec.ts` vykreslí v Canvasu
i WebGL izolovanou vrstvu s bližším propem: řady a balík (seed 1, chunk 36) a okraj
se smrčkem (seed 4, chunk 129). Prop vykreslený samostatně na dvou pozadích přesně
určí své neprůhledné pixely. Ve společném snímku nad vrstvou žádný z nich nesmí změnit
barvu a prop musí být v display listu za vrstvou. Před opravou vrstva překryla
2 545 / 2 534 pixelů balíku a 331 / 354 pixelů smrčku (Canvas / WebGL).

Proložení zapečených textur mezi sprity atlasu při `maxTextures: 1` téměř nemění
počet dávek. GL draw volání na snímek (1140×512, standard, souprava 2000 u, stojící
vlak, SwiftShader) před a po opravě: hustý les 46→46, pracovní paseka 53→53,
pole s balíkem 42→44.

## Integrace se settlements (integrate-1)

Plánovaná vesnice D-024 vlastní dvouchunkové sloty 4–6. Povinný sad a statek
proto ve společném plánu následují ve slotech 7 a 8; pole ve slotu 2 a lesní
skladba se nemění. Každý venkovský region tak zachovává nejméně dva další
zemědělské motivy i celou vesnici. Regrese `SCN-CR04/FO01` reprodukuje původní
kolizi v seedu 3 / regionu 0 a kontroluje 500 itinerářů. Jde stále o nevydaný
generátor v2, save schéma a katalog soupravy se nemění. Typ atlasových metadat
pracovních dílů nyní přebírá sezónní kontrakt `ArtPart`.

Rendererová regrese GEN-23 drží autorské pšeničné řady explicitně ve fixture
seedu 15 / chunku 16. Výběr nové scény ve společném plánu nemění požadavek
na kreslení a prolínání řad; původní barevná aserce zůstává.

## Linka water-mountains — vodní břehy, Moravská Sahara a horský terén

Datum: 2026-10-14. Tato sekce patří běhu `water-mountains-1`; předchozí
rozhodnutí a důkazy farm-forest zůstávají beze změny.

Motivy vycházejí z vlastních textů coast, lakes, dunes, foothills a mountains.
Samostatný `water-mountains.scenes.ts` přidává příležitosti rybničního souboru,
říčního údolí, skalnatého pobřeží, přístavu, otevřených dun, vřesového okraje,
lomu a lanovky. Malý výběrový hook ve WorldPlan dává základním motivům pevné
příležitosti. Stanice, mosty, tunely, vedlejší kolej a jejich rezervace mají
nadále přednost. Nejde o další registraci pluginů ani o novou simulační smyčku.

`WaterMountainComposition` přidává děti z geometrie přijaté vody a skutečného
svahu. Rybniční soubor má tři různé šířky/hloubky, suché mezery a jednu identitu
scénky; úmyslná skupina se nepočítá jako tři sousední náhodné dominantní rybníky.
Její druhý chunk drží skupinu mimo infrastrukturní slot 4; u vedlejší koleje se
hladiny přesunou za její chráněný koridor. Voda nikdy nevzniká přes hlavní trať.
Přívoz odkazuje na svoji vodu a obě přijatá mola, rybář na suchý břeh, bagr na
lomovou stěnu na skutečném svahu. Břehové podpory zůstávají veřejnými kotvami
pro kachny a vážky seasons-life. Lávka využívá potok a břehovou geometrii za
tratí; nejedná se o nový železniční most.

`WaterMountainView` skládá tělo mlýna a samostatné kolo, rybáře a prut, přívoz
a paži, bagr a jeho rameno, lanovkové opory, lano a kabinu. Kolo používá
simulační čas (24 s/otáčku), jen při odkazovaném tekoucím náhonu mimo zimu.
Přívoz má 12 s pobyt a 26 s plavbu v každém směru; otočení vychází z přídě
assetu, stejně jako kontrakt roads (`front` ve světě +x pro dosavadní lodě).
Prut má vlastní 35s fázi, paže přívozu krátkou 20s fázi, bagr 24s cyklus a
kabina 80s návrat. V pauze je čas stálý. Žádné timery/listenery ani nový zdroj
času; kořeny, obrázky a lano uvolní stávající vlastník chunku. Update znovu
používá pose a bod podpory, nevyrábí pole ani pomocné objekty.

Nové art mapy jsou append-only; registry vznikají projektovým generátorem.
Značky sezón používají výhradně `atlasGroup.seasons`. Zimní a letní horský
horizont má dvě parallax vrstvy; duny mají vlastní nízký hřbet a borový pás.
Profil, délka soupravy, catenary a konstrukce tunnels-bridges se nemění.
Formát save a generátorová verze zůstávají 1 / 2: jde o dokončení nevydané V2
podle D-023, nikoli změnu již vydané geometrie.

Validátor vyžaduje kladné svědky všech přidaných motivů a kontroluje jejich
konkrétní podpory, suchý břeh, kontakt mola/nábřeží, celý obal přívozu a svah
lomu. Samostatné mutační testy odeberou podporu nebo zvětší obal; regionový
test kontroluje tři různé nádrže v každém sladkovodním regionu.

Před integrací D-030 překračuje společný backdrop atlas při 1 px/u mez 2048²:
29 dílů, plocha 4 304 340 px². World atlas má při 2 px/u 207 dílů a plochu
3 929 044 px², ale shelf packing také překročí mez. Tato linka nesnižuje kresby
ani nezvyšuje limit; podmínkou odstranění omezení je regionové/sezónní dělení
D-030. Nových 35 klíčů má zdrojovou plochu 1 459 020 u² (5 836 080 px² při
2 px/u); backdrops se za běhu používají nejvýše při 1 px/u.

Fyzický tablet, Tesla/firmware a výkonová brána skutečného zařízení zůstávají
NEOVĚŘENO. Zimní portály a vedlejší tunely vlastní tunnels-bridges; celkové
sezónní mapování stromů a ambientní život vlastní seasons-life.

Kompozice má deterministické číselné role a kandidáty ve stejném formátu ID
jako world-core; nová stopa vrací i přijaté/odmítnuté děti této linky. Suchý
přístup mlýna má konkrétní vztah `building-at-path`, který povolí jen vlastní
rezervaci pěšiny, nikoli jiné komunikace. Numerický katalog zahrnuje skutečné
vyšší tělo mlýna; klouby a osu samostatných dílů čte renderer z art kotev.
Fixtury pobřežní kompozice přecházejí z 0/332 na 1/312, protože se záměrně
mění plán místních scén; geometrické kontroly vody a obalu zůstávají stejné.
Regrese 0/326 zachovává incoming moře a jeho regionovou identitu také v říční
scéně. Publikované save fixtury ani katalogová ID vozidel se nemění.

Říční údolí používá `WaterGeometry.flowSpan`: společné světové meze hladiny,
návazný průřez na chunkovém švu a zaoblené skutečné konce za břehy. Otevřené
řezy platí jen pro tekoucí údolí; ovály rybníků a souvislé moře se nemění.
Plánovaný potok může vytvořit soutok za tratí, obal lodě nadále nesmí vstoupit
do rezervace železničního mostu. Regrese LA-02 je seed 1, chunky 292/293.
Rendererová regrese mlýna 1/288 odhalila desetinný počátek náhonu v `hash32`;
odlesky a vlnky nyní používají jeho stabilní vodní ID.

Kontrola kontraktu při pokračování 2026-10-15 doplnila jemný vítr pro vřes,
mladé borovice a oba rákosové díly přes stávající sdílenou funkci; její amplitudu
čte i numerický obal umístění. Teplé horské horizonty mají sezónní skupinu
jaro/léto/podzim, sněhové zimu. Přívoz při pobytu drží směr posledního připlutí,
otáčí se při odjezdu a v zimě zůstává vyvázaný. Validátor vyžaduje kladné
pokrytí také vrb, rákosí, obou pobřežních skal a souvislého říčního údolí;
infrastrukturní sweep zahrnuje všechny sladkovodní scény této linky.

Lokální uzávěrka: cílené unit testy 51/51, browserové testy této linky a
world-diagnostics 32/32 (Canvas/WebGL, krátká i nejdelší souprava). Úplný check
má 980/983 úspěšných testů; tři atlasové rozpočty zůstávají červené z výše
uvedeného důvodu D-030, bez zvýšení limitů nebo přeskočení kontrol. Při souběhu
cílené sady s úplnou kontrolou jednou vypršel limit seedové trasy 1; opakování
bez změny timeoutu prošlo 51/51. Snímky v obou rozměrech a s oběma délkami
soupravy jsou mimo repozitář v `_runs/shots/water-mountains/`.

### Review water-mountains-2 (2026-10-15)

Nálezy 1/4/5/6/7 opravuje tento řez. Rozsah řeky a vlastník lanovky se vybírají
nad skutečnými základními kompozicemi obou chunků scény. `baseChunkScenery`
nevytváří děti water-mountains, takže plánování nevolá samo sebe a nezávisí na
pořadí streamování. Přijaté fragmenty řeky sdílejí rozsah i hloubku; odmítnutý
soused zkrátí skutečný konec a jeho 160u zúžení. Regrese 1/290→291 končí v
x=297984 místo otevřeného technického řezu. `validateWaterMountainScenes`
vyžaduje souseda na každém vnitřním švu, shodný rozsah a shodné nenulové
průřezy. Chybějící, uzavřené i rozdílné pokračování mají mutační důkazy.
Sweep 100 úplných tras obsahuje 1 188 říčních fragmentů bez otevřených konců.

Lanovka má jeden scénový feature a prvního přípustného vlastníka. Obě stanice
se vzorkují v jejich skutečných x (−35 a +365 u v lokálním prostoru sestavy),
stejně jako věže (0 a +320 u). Výšku dodává stejný vzorek koleje jako renderer;
kabina zůstává na laně mezi věžemi. Zakřivený profil v unit testu rozlišuje
stanice od sousedních věží. Původní dvojice instalací 1/100 a 1/101 je jediná.

Moravská Sahara používá dvě vlastní dospělé siluety `tree.sahara-pine-a/b`,
nepravidelné patrovité tmavozelené koruny a oranžovohnědou horní kůru.
Stávající dune props `tree.pine` se v této krajině překládají na stejné vlastní
varianty se shodným obalem 60×120 u; společná lesní kresba se nemění. Překreslen
je i borový horizont, kuželovitá mladá borovice a dva nízké vřesové polštáře.
Telefonní pixelová kontrola vyžaduje nejméně 150 růžovofialových pixelů v dolní
části scény; původní kresba měla 0 u krátkého i nejdelšího vlaku. Botanickou
siluetu doplňuje vizuální kontrola snímků, nikoli jen názvy klíčů či barvy.
Zelená tunelová hmota zůstává tunnels-bridges.

Trasový test má 240 osmichunkových dávek místo čtyř 480chunkových případů;
zachovává všechny čtyři seedy, všech 480 chunků a diagnostický kontext. E2E
ověřuje THROTTLE, kladnou rychlost a posun `headS`, pak samostatný COAST a
teprve potom pauzu. Sestavy se sledují přes běžný renderovací loop, bez přímého
volání `ChunkView.update(t)`. Negativní browserové důkazy záměrně odpojí vstup
nebo aktualizaci chunků: samotné přibývání ticků potom nové aserce nesplní.
Timeouty a retries se nemění.

Nálezy 2/3 zůstávají výslovně odložené na integrační pokračování. Všechny
compound-child a backdrop/cloud frame lookupy procházejí jedinou funkcí
`waterMountainFrame`; na této základně jen vrací existující atlas. Nevzniká
náhradní implementace D-030 ani jeho host mappings. Tělo, kolo a animaci mlýna
vlastní jediná funkce `assembleWatermill`, která se po rebase vymění jako celek
za dohodnutého vlastníka seasons-life. Konkrétní flowing-water dependency se
zachovává. `life.watermill-wheel`, `frameTexture` a `effectiveClimateAt` se zde
nezavádějí; následná integrace musí odstranit dvojího vlastníka. Save ani
geometrie koleje se nemění. Dvě nové borovice přidávají 14 400 px² při 1 px/u
(57 600 při 2 px/u); tři stávající atlasové brány stále náleží D-030.

Lokální kontrola review 2: 288/288 cílených unit případů (včetně všech trasových
dávek), úplný check 1 223/1 226; selhávají pouze tři známé kapacity atlasů.
Validace světa má 8 992 kompozic se čtyřmi pořadími dotazů a 20 792 vodních/
silničních případů. Assety: 238 světových dílů, žádný placeholder. Nové snímky
1140×512 jsou v `_runs/shots/water-mountains/wm-2/`, důkazy v
`_runs/water-mountains-2/`. Telefonní vřes prošel s 662/264 barevnými pixely
(krátká/nejdelší souprava). Orientační zahřáté generování seedu 1, 480 chunků,
proti 85d2cf3: 1,70–1,89 → 1,34–1,69 ms/chunk na sdíleném stroji; nejde o
výkonovou bránu zařízení ani průkaz zrychlení. Maximum zůstává 56 doménových
rekvizit a dvě složené animace/chunk, celkem 12 750 → 12 748 rekvizit. Nové
frame lookupy a sestavení mlýna alokují při konstrukci/přepnutí, nikoli v
ustáleném update; heap profil a fyzická zařízení zůstávají NEOVĚŘENO.

Cílené E2E `water-mountains.spec.ts` a `world-diagnostics.spec.ts` pod společným
zámkem, projekt desktop a dva workery: 34/34 za 2,4 minuty. Obsahují Canvas
i WebGL, krátký i nejdelší vlak, 10 běžných animačních cyklů a dvě telefonní
pixelové kontroly vřesu. Behaviorální red/green příkazy a jejich výstupy jsou
v `_runs/water-mountains-2/test-commands.md`. Build prošel; integrační atlasové
a sezónní nálezy 2/3 nejsou tímto výsledkem uzavřené.

### Review water-mountains-3-astra (2026-10-15)

Druhý review nepotvrdil rozpoznatelnost dospělých borovic ani lanovky na
telefonu. Tento řez mění pouze jejich kresbu a čitelnost v existující scéně.
Borovice A/B a jejich vložené kopie v horizontu mají samostatné ploché,
nepravidelné shluky jehličí v horní třetině, viditelné boční větve a rovný nebo
mírně prohnutý kmen; horní kůra je oranžovohnědá, dolní šedohnědá. Zachovávají
rozměry 60 × 120 u, pivot i způsob umístění. Mladé borovice a vřes se nemění.

Kamera 1140 × 512 má 0,342 px/u pro krátký i nejdelší vlak; lanovka v hloubce
0,55 má výsledných 0,276165 px/u. Kabina 24 × 20 u proto měla jen 6,63 × 5,52 px
a lano 1,3 u jen 0,36 px. Nová kabina 56 × 48 u má 15,47 × 13,26 px,
červené tělo, tmavý obrys a světlá okna. Její pivot i kotva jsou (28,2).
Lano 6 u má 1,66 px; sloupy mají výraznější siluetu při stejných rozměrech
a kotvách. Stanice se nemění. Stromy příslušné scény stojí v hloubce 0,85–0,90,
aby nezasahovaly do dráhy kabiny. Počet objektů ani animací se nezvyšuje.

Rozměry kabiny a kotvy jsou aktualizované v art mapě; numerický katalog je
přebírá. Vnější obal celé sestavy (−70…400, −200…50 u) nadále zahrnuje všechny
polohy větší kabiny i obě stanice, což kontroluje regresní test na rovné
a šikmé reprodukci. Není důvod jej zvětšovat a měnit přípustnost podpor.
Vlastník, vzorkování stanic/věží, trasa ani animační čas se nemění; update
nepřidává alokace, listenery ani cache. Nevznikají nové klíče nebo moduly.
Plocha kabiny navíc je 2 208 px² při 1 px/u, 8 832 při 2 px/u. Tři známé
kapacitní brány atlasů zůstávají v D-030; `waterMountainFrame` a
`assembleWatermill` zůstávají každá jedinou integrační funkcí.

Save schéma, katalog vozidel a geometrie koleje jsou beze změny. Jde o
výtvarné dokončení dosud nevydaného generátoru V2; hloubka stromů se změní
pouze v lanovkové scéně. Fyzická zařízení a výkonová brána zůstávají NEOVĚŘENO.

Lokální jednotkové ověření: 299/299 cílených případů; úplná sada v připnutém
Node 24.21.0 má 1 228/1 231, se třemi známými kapacitními chybami D-030.
Lint, typecheck, registry, assetový a světový validátor prošly. Světový sweep
obsahuje 8 992 kompozic, 20 792 vodních/silničních případů a 1 188 říčních
fragmentů bez otevřených nebo neshodných švů. Browserové a fyzické brány se
vykazují samostatně; snímky a protokol běhu jsou v `_runs/water-mountains-3-astra/`
a `_runs/shots/water-mountains/wm-3/` mimo repozitář.

První E2E běh obou dotčených souborů pod zámkem se dvěma workery: 70/76,
desktop i tablet-touch. Všech osm nových kontrol lanovky prošlo; šest
stávajících případů skončilo na limitu 30 s (WebGL přívozy 1/312 a 1/293,
WebGL bagr 1/105 a desktopový restart/nový svět). Tento běh není zelená
E2E brána. Traces a jediné opakování neúspěšných případů se vykazují
v protokolu běhu, bez změny timeoutů či assertions.

### Integrace water-mountains-4: D-030 a jediný mlýn

Datum: 2026-10-16.

Rebase na 95cf68c zachovává atlasové interní moduly, integrační osady, silnice,
sezóny a animace. Grafika b6b2288 se nemění. `SeasonalSceneryView` je jediným
vlastníkem sestavy i animace mlýna; používá `life.watermill-body/wheel`.
WaterMountainView přestává mlýn vytvářet a jeho dva duplicitní art klíče
se odstraňují. Normální sezónní průchod tak není přeskočen. ChunkView předává
konkrétní channel dependency; kolo se otáčí jen na tekoucí vodě a mimo zimu
podle `effectiveClimateAt`. Rozpočet a lokální animační čas vlastní D-027.
Kachny, vážky a sáňky zůstávají beze změny v seasons-life.

Potomci vodních sestav používají `frameTexture` a `world-part`. D-030
Backdrop zůstává jedinou cestou kreslení vzdálených pásů; výběr se doplňuje
o Sahara a horské pásy. Host mapy zahrnují přívoz na pobřeží i jezerech,
podhorské zářezy a explicitní jezerní alias lávky. Odebrán je pouze vlastní
snapshot registrovaného modulu. Vodní sestavy nepřidávají pixelové pracovní
plochy ani readback; stávající pečení chunku přebírá D-030 API.

Rebase změnil konkrétní svědky: původní bagr 1/105 patří zimním sáňkám,
lanovka 1/186 koliduje s integrovanými rezervacemi. Stejné nezměněné aserce
používají 1/108 (bagr) a 1/112 (lanovka ve skutečném sklonu). Přístup mlýna
je výslovně `style: path`, jak vyžaduje integrační rozlišení krátkého přístupu
a průběžné komunikace; geometrie cesty ani validační aserce se nemění.

Přepočet D-030 nad registrovaným modulem: scratch/readback příspěvek 0 B.
Správné hostování zvětší nejhorší world window na 9 437 184 B low a
20 742 144 B standard. Úplné životnostní meze jsou 94 429 648 B (90,055 MiB)
a 133 955 048 B (127,749 MiB), tedy +2 097 152 / +98 304 B proti 95cf68c.
Rezerva low je 5,945 MiB, rozpočty 96/192 MiB zůstávají. Stávající kompoziční
envelope zahrnuje 1 425 408 B největší plochy a 402 192 B readback; vodní
sestavy další plochu nepřidávají. Předchozí hodnoty 88,06/127,66 MiB jsou
pro rebased stav nahrazené tímto přesným přepočtem.

Kosmetický klíč glintů a vlnek přebírá integrační `String(basin.fromX)`,
ne druhou lokální hash politiku. Zachované jsou `motionBoundsU` osad spolu
s pracovními a břehovými kotvami této linky, silniční pozice a heading,
pořadí rezervací i efektové aktualizace RideScene. Skalní/tunelové/mostní
view ani atlasové interní moduly tento řez neupravuje. Starý lokální výpočet
mlýnského úhlu je odstraněný; živé kolo má výhradně lokální čas D-027.

Lokální kontrola tohoto řezu: 2 371/2 371 unit a integračních testů ve
141 souborech; celý check včetně validátorů prošel. První úplná kontrola
měla jedinou zastaralou expectation, že duny i při přítomnosti vlastních
pásů používají forest-mid. Nová expectation vyžaduje dunes-pines; původní
fallback při chybějících dílech má dál vlastní aserci. Čtyři atlasové matice
mají 814 případů, navazující atlasová sada celkem 865/865. Skutečný ChunkView
a Backdrop: 31/31, 2 100 chunků seedů 1/7/123 včetně zimních bloků.

Validátor světa prošel nad 9 031 kompozicemi ve čtyřech pořadích dotazování,
100 trasami a 1 188 říčními fragmenty bez otevřeného/nestejného švu.
Road/water sweep má 23 458 případů a 4 748 spojů cest; release asset validátor
365 světových dílů bez placeholderu. Sedm snímků 1140×512 (rybník s kachnami,
pobřežní přívoz, mlýn v létě a zimě, Sahara obou délek, lanovka) má
missingFrames prázdné a pending false; jsou mimo repo v
`_runs/water-mountains-4-proof/`.

Běžný loop/pauza se testují samostatně od přesných obrazových póz lanovky.
Ty už nevolají ChunkView.update s absolutním časem, který by při lokálních
hodinách D-027 nezaručil požadovaný bod. Nastaví skutečný obraz kabiny mezi
reálnými věžemi na 0/0,5/1 a kontrolují poměr i původní pixelové/rozměrové
limity. Po resume se testuje publikace atlasů i existence skutečné kresby
soupravy před původními třemi kontrolovanými snímky. Timeouty a retries
jsou beze změny.

Svědek seed 1 / chunk 108 / nejdelší souprava odhaluje crossing.post-low
přes service_crane.body. Stejný grep nad head i archivem 95cf68c selhal
v Canvas i WebGL se všemi 12 vozidly skutečně vykreslenými. Jde o problém
báze, nikoli vodního bagru; cizí CrossingView ani aserce se neobcházejí.
První široký E2E běh má 147/172, není zelenou browserovou bránou; přesné
finální cílené výsledky a A/B protokoly vlastní předání tohoto běhu.

Rezidenční regrese far/mid pásů výslovně zahrnuje přechod letní Sahary
do zimních hor i zimních hor do letní Sahary, vedle změny horské sezóny.

Dev-menu regrese po skoku do dun čeká na publikaci D-030 atlasu i skutečnou
kresbu overlaye; původní nenulový limit zůstává. Samotná změna lokace ještě
neznamená vykreslený svět, stejně jako samotný resume neznamená kresbu vlaku.
Původní DEV-02/03 selhal na overlay count 0 v obou projektech i na 95cf68c;
po synchronizaci prošel celý world-diagnostics 12/12. Finální cílená sada
vodních scén má 48/48 (32 ovládání, 8 lanovkových póz, 8 mlýnů); přidaný
art.spec:187 selhal v obou projektech, celkem tedy 48/50. Široký běh 147/172
se tím nepřepisuje. Timeouty, retries a původní limity asercí se nezměnily.

### Integrace obou obsahových linek (integrate-4)

D-026 rezervuje v seedu 2 / chunku 69 nový dlouhý tunel, proto se pozitivní
svědek lomu přesouvá do stejného seedu / chunku 105. Priorita infrastruktury
a kontrola přítomnosti i validního umístění zůstávají. Zrcadlené molo v
ChunkView ukládá autorský pivot přes D-030 `setWorldPivot`, aby jej pozdní
publikace stránky zachovala (regrese seed 1 / chunk 290). Save se nemění.
