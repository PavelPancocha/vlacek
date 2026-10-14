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
  Zrcadlení celé sestavy řeší `farmMachineFlip`; při integraci jej nahradí společný
  heading helper linky roads. Směr kamery orientaci neurčuje.
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
Helper `vehicleHeading` na této základně ještě není; `farmMachineFlip` zůstává jediným
místem pro pozdější napojení roads. Sezónní metadata nadále nastavují jen `seasons`;
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
