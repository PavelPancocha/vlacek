# D-029: Silniční úseky a čelo podle světového pohybu

Datum: 2026-10-13, revize roads-8 2026-10-16. Stav: oprava po nezávislém review. Doplňuje D-013 a D-015;
bezpečnost přejezdu D-021 zůstává vlastníkem jeho automatu.

### Roads-7 — dávky společného plánu (2026-10-16)

Regrese `RoadCombinedPlan.test.ts` ověřuje každý seed 0–19 samostatným
případem, vždy všech 480 chunků a všechny dosavadní invarianty. Společnou
kontrolu výskytu a vzácnosti převzal v roads-8 samostatný test popsaný níže.
Jednotlivý seed nemusí obsahovat dálnici. Pětisekundový limit, retries
i rozsah pokrytí zůstávají; mění se pouze rozdělení práce v testu, nikoli generátor,
četnost dálnic, uložená data ani herní chování. Rebase na `ffc3377`
zachovává sezonní městské horizonty, keře a zimní varianty staveb.

### Roads-8 — nezávislá agregace (2026-10-16)

Samostatný test `aggregate highway presence and rarity` vždy projde všech
20 × 480 plánovaných chunků přes `roadStretchesInChunk` a `regionAt`.
Neopakuje kompozici ani drahou validaci scenérie. Počty a množiny vlastní
pouze tento test; neexistuje společný `afterAll` ani závislost na pořadí
či výběru per-seed případů. Nad celým plánem zachovává kontrolu 9 600
navštívených chunků, nenulového výskytu a původní meze vzácnosti dálnic.
Příkazy s `-t 'seed 0,'`, `-t 'aggregate highway'` a `--sequence.shuffle`
proto ověřují své vybrané případy nezávisle. Všech 20 per-seed validací,
jejich assertions, pětisekundový limit a retries zůstávají beze změny.
Generátor, runtime, uložená data a četnost dálnic se nemění.

## Důvod a obraz

[Silnice RD-01 až RD-03](../scenes/roads.md) dosud neměly textový kontrakt.
Audit starého buildu neprokázal couvání. Nová sonda v2, seed 123/chunk 18,
se stojícím vlakem a kamerou potvrzuje kladné rodičovské měřítko a správná
čela na obou patrolovacích větvích. Dva vzorky přes okamžik obratu mají
smíšenou sečnu minulého a nového kroku; nejsou důkazem soustavného couvání.
Kamera nesmí být vstupem orientace. Lodní symetrické trupy neměly označenou příď.

## Rozhodnutí

- `VehicleHeading.vehicleHeading` je malá exportovaná doménová funkce: předek
  assetu, světové vx/vy, uložené natočení; volitelná podepsaná tečna je fallback.
  Zapisuje do stavu vlastněného volajícím bez alokace za snímek. Při nule stav
  zachová. Boční kresba se zrcadlí právě jednou a zůstává vzpřímená; čelní/zadní
  přejezdové kresby mají vlastní vertikální vektor předku.
- `roadVehicleArt` vlastní směry `front` a kotvy kol/výfuku všech používaných
  aut, cyklisty, traktoru a tří lodí. Lodní příď je výslovně +x ve SVG.
  Neobracíme plošně kresby. Pracovní stroje mohou volat stejný helper.
- Generování `RoadStretches.ts` přidává okresku do slotů 2–3 suchého venkova,
  a podhůří mimo odchodový blok a blok s druhou kolejí; její portálové
  kopce mají skutečný 380u přesah i do předchozího slotu. Fragmenty sdílí absolutní vzorky,
  identitu a celkový rozsah. Odstup je přibližně 92–116 u; ramena 384 u
  odcházejí nad zadní horizont. Vozovka se ořezává na místním profilu terénu,
  takže z pečené textury nevykukuje příčná hrana nad horizontem. Geometrie i
  obálky rezervují asfalt před výplní.
- Dálnice je nejvýše jedna plánová příležitost v regionu: 1/4 vhodných regionů,
  sloty 0–1 třetího bloku, přibližně 169–179 u za kolejí. Nevytváří nový biom
  ani sjezd do přejezdové silnice. Prvky ani šířka nedoplňují novou navigaci.
  Má dvě oddělené dvoupruhové vozovky, zelený střed široký 8 u a nízký
  násep; celková šířka vozovek se středem je 56 u. Rezervace odstupu 20 u
  kontroluje celou kresbu domu. Dálnice nesplňuje závislost vesnického domu
  na místní cestě (původní svědek roads-2 seed 123 / x 500224;
  po amendment 13 zde dálnice nevzniká).
- Auta nesou ID `g2:chunk:<k>:prop:road:<typ>:candidate:<0|1>`; silnice má vlastní identitu napříč fragmenty.
- Vozidla rozšiřují stávající `SceneryProp.motion` a crossing views. Okreska
  se geometricky potká se zadním ramenem přejezdu, dovolí-li to jeho poloha.
  Dekorativní patroly se drží mimo jeho průjezdový konflikt, bez falešné dopravní navigace.
  Přejezd dál simuluje své front/back aktéry, stopčáry, poslední vůz a více vlaků.
  Ústí se odvozuje z průniku skutečných vozovek; v něm se přeruší krajnice
  a okrajové čáry obou silnic, bez změny stopčar či pohybu aktérů.
  Auta okresky zůstávají dekorativní patrolou ve dvou oddělených pruzích.
- Půdorysy používají stejnou cestu jako renderer a zkouší celý pohyb, také sklon.
  Vesnická silnice se nesmí náhodně střetnout s novou okreskou. Plot předem
  kontroluje nové úseky. Vztah auta k silnici odkazuje na konkrétní rezervaci.
- Jeden malý Graphics objekt na pohyblivý asset kreslí kola, nanejvýš jeden
  krátký výfuk v souřadnicích světa a volitelné šipky. Čas přichází ze simulace,
  pauza neposouvá fáze; životní cyklus je chunk/aktér bez timeru nebo listeneru.
  Režim omezených efektů sníží výfuk; funkční čelo se nemění.
- Překryv silnic kreslí azurovou světovou rychlost a oranžový transformovaný
  předek. Testovací lokátor nabízí okresku u přejezdu, dálnici a konce silnic.
  Snapshot čte skutečné rendererové transformace; do uložených dat se nezapisuje.

## Kompatibilita a ověření

### Playtest cars-1 — čitelná silueta modrého auta (2026-10-20)

Vlastník 2026-10-19 na Android tabletu v buildu `0.1.0+b211e87` hlásil
„cars (some, the blue one) goes backwards“. `back.car` mělo správně čelo +x,
žlutý světlomet vpravo i červené zadní světlo vlevo, ale dlouhá nízká plocha
vlevo a krátká splývavá záď vpravo četly siluetu opačně. Dřívější pohybový
test porovnával posun s metadaty, nikoli s kresbou. Ručně překreslené SVG
má nyní krátký kufr vlevo, kabinu a šikmé čelní sklo před dlouhou kapotou
vpravo pod světlometem. Plátno 60 × 28, pivot (30, 28), kola, výfuk, barvy
i čelo +x zůstávají. „Neobracíme plošně kresby“ dál znamená, že runtime
neprovádí plošné přezrcadlení assetů; použije jedinou dosavadní transformaci
podle pohybu. Oprava mění zdrojový obrys jediného auta, ne orientační helper.

Kontaktní list před/po v herním měřítku a ve 4× velikosti zahrnuje všech
pět bočních položek `roadVehicleArt`, devět strojů/nářadí s `front` a navíc
datla. Traktory, kombajn, harvestor, vyvážečka, auto s kládami a bagr mají
čitelné čelo vpravo; pluh/lis mají vpravo tažné oko a radlice pracovní hranu.
U neutrálních lodních trupů zůstává smluvená příď +x. Žádná další silueta ani
metadata nepotřebovala otočit. Viditelný světlomet nebo určující přední prvek
(příď, závěs, kabina či základ ramene) je ve všech 14 SVG označen
`id="front-lamp"`; u cest jsou příslušné rovné obrysové úseky vyčleněny
do geometrických prvků bez nového světla. Datel se nemění.
`tests/unit/content/vehicleFrontMarkers.test.ts` ověřuje x střed označeného
prvku proti deklarované přední polovině viewBoxu. Test chrání metadata proti
světlu/prvku, **nikoli siluetu**; tu dokládá vizuální kontrola kontaktních
listů a jízdy v obou směrech. Před přidáním značek test selhal na jejich
absenci. Save, katalog, generátor, ovládání a bezpečnost přejezdu se nemění.
Fyzický tablet a Tesla po této opravě zůstávají NEOVĚŘENO.

### PR #13 — návrat silniční patroly do záběru (2026-10-16)

`ChunkView.update()` nejdřív přepočítá polohu každého aktéra s `roadPath`
z absolutního simulačního času, teprve potom zkouší viditelnost s okrajem
60 u a rozpočet animací. Vyčerpání rozpočtu nesmí ukončit průchod před
aktualizací poloh dalších silničních aktérů. Auto se tak po obratu vrátí
do záběru i při stojícím vlaku a kameře. Kola, čelo a výfuk se dál
aktualizují pouze ve viditelném rozsahu a s přiděleným animačním místem;
samotný přepočet polohy místo nespotřebuje a nezvyšuje `animatedObjects`.
Při přeskočení vizuální aktualizace po posunu silničního aktéra se jeho
sourozenecká Graphics kresba vymaže, aby kola, výfuk a diagnostické šipky
nezůstaly na starém místě. Další povolená aktualizace je znovu vykreslí;
vymazání nemění animační čas ani počítání objektů.
Patroly bez `roadPath` ponechávají místní hodiny: mimo záběr nebo bez
rozpočtu stojí a po návratu pokračují bez dohánění času. Regrese nad
seedem 123 / chunkem 3 ověřuje návrat auta při rozpočtech 0/1/2, včetně
předchozího aktéra spotřebovávajícího místo. Testovací Graphics uchovává
čáry kol a šipek i kruhy výfuku; `clear()` tuto kresbu vyprázdní. Sled
animace → nulový rozpočet → animace vyžaduje kresbu přítomnou → prázdnou
→ znovu přítomnou a kotvu šipky u aktuální polohy každého auta. Regrese
odmítá chybějící vymazání při nulovém rozpočtu i vymazání až po kreslení.
Sled seedu 1 / chunku 102 hlídá zachování místních hodin.
Generátor, katalog, save a ovládání se nemění.

### Roads-6 — návrat orientace sáňkaře (2026-10-15)

Přehraný renderer omylem přeskočil natočení patrol bez `roadVehicleArt`.
`ChunkView.update()` pro ně znovu používá `image.setFlipX(!forward)`;
auta/lodě dál používají `vehicleHeading` s metadaty předku. Regrese seedu 1,
chunku 102, ID `g2:chunk:102:prop:rule:0:candidate:0` porovnává skutečný
světový posun obrázku sáňkaře s jeho zrcadlením v obou větvích patroly.
Vzorek přes obrat se nepoužívá jako směr nové větve; sousední souhlasné
kroky ano. Nejde o nový pohyb, ale obnovu chování integračního základu.

Audit všech pravidel s `motion` našel jako jedinou patrolu bez metadat
`back.sled-child`. Auto, původní traktor a tři lodě mají metadata;
`tractor-work`, `combine` a `forwarder` vlastní `FarmForestView`.
Zvířata hlavního pohledu používají samostatný `RideScene` se stabilním
směrem podle ID; sezónní živočichové mají vlastní `SeasonalSceneryView`.
Tato oprava tyto cesty nemění. Četnost dálnic, plán, save a assety se nemění.

### Roads-5 — společný plán osad (2026-10-15)

Po integraci na `8abe6d5` je autoritou `settlementStreetPlan()`:
celá vesnice `[region + 8192, region + 14336)` a celé město, včetně
předměstí. Adaptér `settlementSpanAt()` přebírá jeho ID i obě hranice;
staniční výjimky nadále zachovává. `roadEnd` zůstává samostatný skrytý
bod 96 u vně vlastněného intervalu, nikoli endpoint ulice.

Dálniční příležitost se přesunula do `[region + 16384, region + 18432)`
za osadou, před odchodovým blokem. Zachována je šance 1/4 a nejvýše jeden úsek na region,
vyloučení stanic i prostorových rezervací. Celoměstské regiony mají plné
vlastnictví settlements, takže se v nich kandidát neumisťuje. Nový lokátor
seedu 1 vrací x 16896, mimo garantovanou vesnici. Kombinovaný seedový test
ověřuje nulový překryv geometrie/rezervací a nenulový výskyt dálnic;
kontraktový test porovnává ID a obě hranice vesnice i města. Nad 20 seedy
× 480 chunky vzniklo 14 dálničních fragmentů (0,1458 % chunků), v 7/240
regionech (2,92 %). Skutečná kompozice i její rezervace se porovnávají
s plánem; nulový počet dálnic není přijatelný výsledek sweepu.

Kontrola odstupu zahrnuje i `back.farmhouse`, statek, řadové/bytové domy
a stodoly, které dřívější filtr `back.house-*` propouštěl. Pixelový svědek
tak nemá stavení přímo na dálnici. Ověřeno regresí celé kresby každého typu.

Rebase slučuje silniční vykreslení se stávajícím rozpočtem sezónních
animací a místními povrchy; nepřidává systém dopravy ani nové assety.
Save schema a ID katalogu se nemění. V2 krajina mimo osady nyní používá
opravené umístění; geometrii koleje, farm-forest, roční období a jiskry
rozhodnutí nemění.

### Roads-4 — krátká okna pohybu a levnější fixture (2026-10-14)

Debug-only `__vlacek.roadMotion()` čte pouze tick a skutečné rendererové
polohy/čela vozidel. Je jen pro čtení a vytváří data až při zavolání;
nepřidává smyčku, timer ani práci do běžného snímku. Test seed 123/chunk 3
odvozuje obratový tick 128 z patrolovacího deskriptoru a obnoví save krátce
před ním. Dvě 36snímková okna nahrazují hledání obratu ve 360 úplných
snapshotech. Zachovají vlastní světový rozdíl stejného ID, oba směry,
svahy, sousední kroky kolem obratu, přes 100 pohybových pozorování v každém
okně a neměnnou kameru/pauzu. Lokátor a menu se ověřují samostatně.
Fixture vykreslí jeden snímek skrytého menu se zastaveným simulačním tickem;
po obnovení kamera rovnou použije meze jízdního HUD. Nedochází k čekání
na doběhnutí vyhlazení kamery. Opakované prezentace stejného ticku musí
být totožné; obrat ohraničují sousední skutečné simulační kroky.

Pomalý příjezd k přejezdu začíná v seedu 123/chunk 1/offset 450 namísto
chunku 0/offset 800. Závory musí být na začátku otevřené a vlak stojí;
přísné meze rychlosti při zavírání, viditelnost i plné sklopení před
obsazením zůstávají. Nejde o zkrácení bezpečnostní vzdálenosti v produktu.
Schema save, generátor, grafika a herní ovládání se nemění. Zjištění 1 a 3
review-roads-3 tehdy čekala na autoritativní plán linky settlements;
navazující roads-5 výše doplňuje přesun dálnice i adaptér vlastnictví.

### Roads-3 — vlastnictví ulic, amendment 13 (2026-10-14)

Osady mají přednost před rezervacemi linek roads: `village`, `hamlet`,
`town-village`, integrované role `settlements-*` a skutečný staniční chunk.
Čteme čistý plán scén a existující výběr stanice; nerozhoduje kamera ani
pořadí kompozice. Okreska/dálnice se z těchto span vyřízne, včetně všech
rezervací. Přilehlý konec ustoupí 96 u za hranici a jeho oblouk mizí za
terénem; i celý obrys asfaltu a odstupu zůstává vně osady. Geometrie její
hlavní ulice zde dosud není: `settlementConnections` má pojmenovaný skrytý
koncový bod a hranici osady pro následné napojení integrátorem. Přejezdová
geometrie a automat D-021 se nemění. Starý svědek dálnice seed 123/x 500224
leží ve vesnici, proto se tam po tomto rozhodnutí dálnice správně nevytváří;
pozitivní dálniční test musí použít skutečný nezastavěný úsek.

Plánovací funkce jsou v `RoadStretches.ts`; registry entrypoint
`roads.scenes.ts` obsahuje pouze data. Import čistého plánu scén z datového
modulu by způsobil ESM cyklus (Vitest loader jej mohl skrýt). Stávající
výběr roviny/slotu stanice je přesunut beze změny do `Stations.ts`;
`Scenery.ts` jeho veřejné exporty zachovává. Pozitivní dálniční svědek je
seed 1/x 16896, zatímco seed 123/x 500224 se ověřuje jako vlastněná vesnice.
Po roads-5 lokátor znovu najde dálnici také v seedu 123 (x 508416);
oba pozitivní svědci leží mimo autoritativní osadu.

Regrese zkouší první vesnický/městský blok v pozicích 2–3, oba koncové
oblouky před hranicí, staniční override i široký seedový průchod geometrie
a rezervací. Nevydaný generátor zůstává 2; již vydané v0/v1 cesty a formát
save/katalog 1 se nemění.

Generátor v2 je stále rozpracovaný a nevydaný. Doplňujeme jeho schválený
obsah, nikoli vydanou trasu; verze generátoru zůstává 2, save/katalog 1.
Vydané cesty v0/v1 dál obnovuje D-023 od startu. Nové losování používá `roads-v2:*`.
Žádná nová závislost, runtime síť, externí font ani asset. Žádná změna ovládání.

SCN-RD01–07 vlastní [akceptace](../scenes/acceptance.md). Roads-1 unit testy
pokrývaly helper a metadata, ale tehdejší E2E SCN-RD02/03 nebylo nezávislým
důkazem skutečného směru pohybu ani čel přejezdových variant. Roads-2 musí
porovnat transformovaný předek s rozdílem světových poloh stejného ID,
označit obratové intervaly a pokrýt čekání/rozjezd, svahy i pohyb kamery.
Dokončení SCN-RD02/03 vyžaduje zelený regresní test a selhání po otočení
vstupu čela při zachování poloh. Konečné výsledky vlastní handoff roads-2.
Cílené E2E přejezdů zůstávají regresní bránou. Úplné E2E a výkonový protokol
spouští integrátor; fyzický telefon/tablet/Tesla jsou NEOVĚŘENO.
