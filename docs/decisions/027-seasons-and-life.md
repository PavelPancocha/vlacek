# D-027: Roční období, počasí a lokální život

Datum: 2026-10-14. Stav: implementace obsahové linky seasons-life.

## Důvod a rozhodnutí

World-core v2 již vlastní presety, dlouhé skupiny regionů a prostorový přechod.
`effectiveClimateAt(seed, worldXU)` v doméně vrací efektivní sezónu/počasí
a souvislé váhy jara, léta, podzimu, zimy a srážek. Výběr identity používá
stávající polovinu přechodu, váhy přesně jeho průběh. Žádný kalendář, timer
pro změnu sezóny ani nový povinný ovladač. `windAt(seed, timeSec)` sdílí směr
a vzácný poryv mezi částicemi a vegetací. Duny/pobřeží zůstávají letní.

Sezónní stromy mají vlastní SVG a původní pivot, conifery nemění podzimní barvu.
Konstrukce chunku prostorově mísí jednotlivé neprůhledné varianty. Sníh střech sleduje
autorské obrysy 26 střech a vynechává komíny; již zasněžená chata se nepokrývá znovu.
`SeasonalSceneryView` vlastní data a animace; obrázky i statické sněhové polygony vlastní kontejnery chunku.
`TunnelView` dostává dva malé dotazy na klima a písek pro svou vlastní kresbu.

`SeasonalEffects` drží nejvýše 32/12 lokálních zdrojů (standard/low), čtyři
prostorové buňky počasí a tři hloubky sněhu. Zdroje se průběžně odstraňují
z aktuálního výřezu, žádný emitter natrvalo za projetý chunk. Částice sdílejí
dosavadní pool 240/96. Bogie má vlastní dotaz na povrch a intenzitu; jízda
zvíří sníh jen nad sněhem a listí jen u listnáčů. Při stání nové víření končí
a stávající částice dohasnou. V pauze ani při návratu se nepřičítá skutečný čas.
Okolní srážky zůstávají venku při vjezdu vlaku do tunelu; jejich viditelnost
kontroluje skutečný kryt i terén.

Motýli jsou zachováni; teplé sladkovodní zdroje přidávají vážku, pobřeží racka,
koruny vzácný vzlet při průjezdu. Dvě kachny a vlnky plují v malé části svého
rybníčka. Mlýnské kolo, výpravčího paže a vlajka jsou samostatné díly.
Animace mají globální rozpočet 160/64; funkční přejezd se do něj nezapočítává.
Chimney emitery používají konkrétní otvor komínu. Nové animace neblokují input.
AudioDirector dostává sezónu: existující zimní vítr a letní venkovské cvrčky,
bez nové nahrávky.

## Důsledky a kompatibilita

Registry generuje stávající `generate:world-registries`; nové art moduly
`seasons-life.art.ts` a `life.art.ts`, scénový modul `seasons-life.scenes.ts`.
Sezónní díly mají `atlasGroup.seasons` pro D-030. Malá zimní scénka s dítětem
na sáňkách rozšiřuje dosud nevydaný world-core v2; schéma, katalog i
generátor zůstávají 1/1/2. Vydaný generátor v1 se stále obnovuje od startu
podle D-023. Kosmetické částice/animace se neukládají.

Ověření vlastní SEA-01–08 a SCN-FH06. Diagnostika efektů přidává
`seasonalSources` a `costMs` (lokální čas kroku/kreslení, není to čas GPU).
Fyzický tablet, Tesla a kalibrace zvuku NEOVĚŘENO.

## Regrese nalezená při runtime ověření

Seed 1, mill kolem chunků 286–290: vodní hrana má x = 451,01677097104704 u.
Dosavadní renderer ji předával jako číselný klíč do celočíselného `hash32`;
výjimka zastavila první snímek jízdy. Glinty a vlnky nyní klíčují přesný
text této souřadnice. Regresní test kreslí skutečný ChunkView s platformním
drawing doublem. Geometrie, rozmístění, save a hash algoritmus se nemění;
jde pouze o kosmetickou fázi vodních detailů.

Přípustnost sáňkující postavy kontroluje efektivní klima celého obrysu
v `Placement.admissibleKind`, nejen zimní identitu vlastníka scénky.
Od poloviny přechodu do podzimu už sáňky nevznikají; jejich zimní atlasový
štítek tak odpovídá i skutečně vytvořeným rekvizitám.

Vzdálené vrstvy dostávají stejným postupem lehkou sezónní atmosféru
(jaro 0,08, podzim 0,20, zima 0,22; léto 0). Jde o jediný vlastněný
obdélník pod zadní zemí a všemi blízkými objekty, shodný na Canvasu a WebGL;
nepřekrývá vlak ani ovládání a neupravuje jehličnany v blízké scéně.

## Opravy po nezávislé obrazové kontrole (seasons-life-2)

Původní atmosférický závoj nebyl důkazem zimní vzdálené kresby. Nyní vlastní
venkov/víska/podhůří sezónní pásy; les dodá farm-forest. Backdrop vybírá
oba prostorové presety a prolíná jejich pásy. Každý pás používá autorskou šířku.
Před rasterizací `backdropWindowFrames` vybere pouze aktuální a příchozí pásy
plus mraky; všech 33 zdrojů současně by překročilo 2048². Zdrojové SVG zůstávají
v dosavadní cache; jejich regionální načítání vlastní D-030.

Pevné stromy/keře používají deterministickou prostorovou směs
jediné neprůhledné kresby, nikoliv dva průsvitné obrázky. Celý strom se kývá
na témže transformu. Střešní římsa má násobek výšky 1,8 a zachovává komínové
mezery. Samotná tenká kresba ani zvýšený počet změněných pixelů nestačil:
SVG nyní vyplňuje silnější polštář i směrem dolů do střešní roviny při
stejném pivotu (0, 10). Phone regrese ověřuje bílou plochu přímo na skutečném
střešním svahu mimo vikýř a komín, v Canvasu i WebGL. Holé zadní keře mají zimní díl; bílý kryt nízkého keře je výraznější,
barvy jehličnanů zůstávají vlastní kresbě.

Částice mají tři rezervované podíly poolu (18/20/27 %), zbytek patří vlaku
či lokálním efektům. Blízký sníh dopadá před terénem, zadní vrstvy za něj;
nepoužitelná částice se uvolní. Viditelnost celého sprite kontroluje hlavní
kryt a omezený obrys obou vedlejších portálů. Sněhové víření i paleta používají
`spatialSnowCoverage`; suchý písek a mostní otvor víření nedostávají.

Autoritativní stropy jsou 160/64 animovaných objektů a 32/12 lokálních zdrojů
(standard/low); částice 240/96. Staré návrhové limity 32/12 a 16/8 ve scénách
byly před měřením a nepočítaly jednotlivé koruny, trávu, vodní detaily ani
zvířecí pohyb. Nové limity zahrnují tyto malé pohyby, s osmi místy rezervovanými
zvířatům; nejdřív viditelný život, potom viditelné periferní kývání. Odebrání
rozpočtu zmrazí lokální animační čas. Náklad `animationCostMs` zahrnuje chunk
animace, jejich přidělení i dekorativní zvířata; `costMs` nadále měří částice.
Dřívější 1,00/2,30/5,20 ms bylo CPU částic při STÁNÍ a STANDARD, nikoli low.

Každá světová kresba, příloha i změna snímku používá `frameTexture`; integrace
D-030 vymění tento jediný accessor za svou mapu frame → textura. Malý seznam
`PARTICLE_FRAMES` musí zůstat v rezidentní společné stránce bez sezónního filtru.
Tato linka zapisuje pouze `atlasGroup.seasons`; krajinné závislosti a aliasové
vlastnictví jsou výslovně předány integrátorovi. Skutečný swap D-030 zde není.
SEA-01–08 nejsou označeny za celkově dokončené, dokud chybí integrované lesní
pásy/D-030 a skutečná zařízení; lokální obrazové důkazy mají vlastní rozsah.

Zimní vedlejší křídlo má vlastněný vektorový sněhový kryt v jeho kontejneru;
nevytváří další velký atlasový snímek. Opaque-variant mísení čte známé stromy/zadní keře a další explicitně
sezónně označené díly z art mapy. Pojízdný označený stroj má rovněž jediný
neprůhledný obrázek pod svým pohybem; neoznačený suffix se nevybírá. Cache geometrie
vedlejších portálů se uvolňuje s chunky i při přestavbě atlasu.

## Oprava čitelnosti po druhé kontrole (seasons-life-3)

Rebase na `82a55bf` zachovává střed kamery 46 %, povrchy a tunelovou zem
world-core i dev menu/restart seedu z master. Po rebase se znovu generují
registry. Regrese zachování autorského povrchu nyní ověřuje přesné RGB
zvlášť pro léto, podzim a jaro před přechodem do zimy: původní letní
očekávání používalo podzimní witness seed 0 / x 193544. Letní očekávání
zůstává, sezónní případy přidávají tint D-027. Nejde o změnu geometrie
trasy, save ani katalogových ID.

Samotná zesílená římsa předchozí opravy na široké střeše nestačila:
`back.house-c` měla ve framebufferu přibližně 38 % bílé plochy ve středu
a 28 % dole. `roofSnowPlanes` nyní vlastní sněhové plochy 23 širokých střech
ve stejných SVG souřadnicích jako všech 26 `roofOutlines`. Úzké štíty a plochá
panelová střecha dále používají římsu; díl `back.chalet-snow` vlastní svou
zasněženou kresbu, běžný `back.chalet` dostává plochu s odkrytým oknem.
Polygony mají výřezy pro komíny, vikýře, hodiny a světlík, zachovávají
původní pivot, měřítko, otočení i zrcadlení. Nové settlements střechy
nepotřebují druhého vlastníka ani další atlasové snímky. Jeden Graphics
objekt na širokou střechu vzniká při vytvoření chunku a zaniká s ním.

Vločky mají bílou horní kresbu a modrošedý spodní obrys, takže jsou čitelné
na obloze i bílém terénu. Far/mid/near mají šířky 6/18/28 u. Víření má
čtyři oddělená nepravidelná zrna, nikoli průhledný kruh podobný páře.
Z dosavadních 70 částic/s (low polovina) se 70 % rozděluje všem viditelným
podvozkům a 30 % poslednímu, aby i nejdelší vlak nechával krátkou souvislou
stopu. Životnost 0,6–1,1 s, rychlostní práh, místní sníh a maskování se nemění.

Starý společný 65% práh sněžení omylem započítával kouř a víření, takže low
při jízdě ztrácel blízké vločky. Nyní limit každé vrstvy počítá pouze svou
vrstvu (18/20/27 % poolu), blízká vrstva má přednost při emisi. Celkový pool
zůstává 240/96, nominální emise 3/4/5 vloček/s na prostorovou buňku při
šířce 1400 u; nevyužité částice se nadále odstraňují.

SEA-01 měří horní/střední/spodní pás každé viditelné střechy a/b/c: každý
musí mít přes 65 % bílé plochy mimo komín/vikýř. Maska izoluje střechu
od náhodně přeletující vločky; herní snímky počasí ponechávají. SEA-04 porovnává skutečný
framebuffer s vypnutými příslušnými sprites. Počítá jen změny alespoň 24 RGB
úrovní, samostatně v oblasti padajícího sněhu, podvozků a za koncem vlaku,
i jejich rozložení v dlaždicích 24 px. Tři po sobě jdoucí kroky 30 Hz běží
skutečným hostem/reducerem/simulací, čtení framebufferu mezi nimi neposouvá
čas. Matice obsahuje Canvas/WebGL, krátkou/2000u soupravu a low/standard;
střechy mají výřez 1140 × 512. Mezní hodnoty se kalibrují vizuální kontrolou
snímků, nikoli pouhou existencí částic. Po zastavení víření dohasne.

Finální zimní snímek odhalil ještě zelenou patu vedlejšího portálu pod bílým
kopcem. `secondaryPortalFeet` nyní od RideScene dostává barvu podle stejné
prostorové zimní váhy jako kopec (zelená → `0xe7f0f5`). Mění se jen výplň
paty při vytvoření chunku; tmavá zadní polovina ústí, geometrie, sklon,
hloubka a životní cyklus zakrývání zůstávají. Regrese ověřuje obě výplně.

Široký E2E běh zachytil low snímek krátkého vlaku se 70 kontrastními pixely
u podvozků (brána zůstává >75). Samotná zrna mají proto šířku 32–44 u
před násobkem 1,5; jejich počet, životnost, rychlost a pool se nemění.
Pozitivní kontrola velké vločky u pravého vedlejšího portálu se přesouvá
celá nad kryt: původní střed byl venku, ale po zvětšení 3× vločka okrajem
zasahovala do skály. Zakrytá kontrola a její nulový pixelový limit zůstávají.

## Integrace s D-024 a D-025 (integrate-1)

`backdropFrames` je jediným vlastníkem výběru pozadí: využívá všechny čtyři
husté lesní far/mid pásy D-025, městské sparse/dense pásy D-024 a sezónní
venkov/víska/podhůří. Při chybějících městských dílech zachová původní sezónní
fallback. Každý změněný pás dostane původní autorský pivot a šířku; výběr
aktivního okna neduplikuje sezónní zdroje.

Farmové složené stroje, kola, nářadí, přepínané pracovní/mávací pózy a úchop
používají stejný `frameTexture` jako ostatní svět. Rovněž jednorázové pečení
lesních pásů, nízkých okrajů a řad plodin čte stránku konkrétního snímku;
polygonové ořezy, vrstvy po hloubce a cleanup D-025 se nemění. Generátor dál
vybírá sezónní řady a okraje podle efektivního kontextu, `SeasonalSceneryView`
vybírá neprůhledné varianty jednotlivých listnáčů. Nevzniká druhá kopie okraje
ani nová sezónní sada.

Dvoufázový animační průchod zachovává kosmetický automat stanice s polohou
čela a rychlostí. Farmové složené aktéry a staniční přílohy započítává do
společného rozpočtu, mimo viditelnost je neaktualizuje. Pracovní aktér při
odebrání rozpočtu drží pózu a při návratu pokračuje bez dohánění; jeden
složený aktér má jednu společnou trajektorii kol, nářadí a loží. Sníh nových
settlement domů používá původní `roofSnowPlanes`/`roofOutlines`, bez dalšího
vlastníka. Regrese ověřují štítový i valbový dům a odkrytý komín.

Tato integrace nemění schéma save ani katalog vozidel. Plná světová atlasová
kapacita při 2 px/u zůstává bránou D-030: nesmí se obcházet zmenšením artu,
zvýšením hrany nebo oslabením testů. Lokální výsledky a snímky uvádí předání
integrate-1; fyzická zařízení i GitHub Actions jsou tímto během NEOVĚŘENO.

Obrazová kontrola společné zimní vsi odhalila letní výplň rezervací návsi,
přednádraží a pracovního dvora. Jejich původní suchá barva se nyní prostorově
mísí se sněhovou paletou stejnou zimní vahou jako okolí; geometrie, cesty a
průjezdnost zůstávají. Test seed 2 / chunk 490 ověřuje skutečný vykreslený
polygon návsi. Původní pixelový test střech a/b/c byl přesunut z nového pole
v chunku 481 do zachované vsi v chunku 504/505 téhož zimního regionu. Nové
štítové a valbové domy mají samostatný důkaz ve skutečné osadě chunku 490,
Canvas i WebGL na 1140 × 512; stejné minimum 65 % bílé plochy v každém ze tří
střešních pásů, mimo původní štít a komín. Nejde o snížení výtvarné brány.

Nové valbové domy používají původní střešní obrys a výřez komína. Jejich
sněhový polštář má horní plochu na y = 8 u (1 u nad hřebenem) a spodní
nepravidelný lem 38,5–39,5 u kolem původní římsy y = 39 u; úzký modrošedý
obrys má 0,35 u. Celá kresba stále leží uvnitř původních rozměrů domu.
Canvas před opravou ukázal 52,63/50 % bílé nahoře a 60 % dole, zatímco
WebGL prošel. Samotná změna hřebene nebo zúžení čáry nestačila pro obě
zarovnání kamery k pixelům. Regrese proto ověřuje původní 65% minimum
v horním/středním/spodním pásu při obou zarovnáních 0/0,5 px, bez posunu
simulačního času. Bodové testy ověřují kryt hřebene i římsy a volný komín.

Sezónní hook se volá také nad skutečnými připojenými díly settlements.
Střecha staničního přístřešku je samostatná příloha, proto dostává vlastní
sněhové kotvy; její nosná konstrukce druhou střechu negeneruje. Regrese
sleduje skutečně vytvořený díl a sněhovou plochu.

Sdílený výběr snímku nesmí změnit dlaždicovou mřížku D-025. Husté far/mid
lesní pásy mají kresbu 512 u a překrývající se krok 480 u; ostatní sezónní
pásy drží vlastní autorskou šířku. `backdropTileStepU` tento rozdíl určuje
před výpočtem počtu, světové fáze a pozic dlaždic. Čtyři sezónní regrese
zachovávají původní krok lesa i šířku nového městského pásu.

### Společný registr: město a drobná zeleň (2026-10-15, integrate-3)

Svědek seed 4 / x 1 021 952 (chunk 998) odhalil chybějící zimní městské
pozadí. Nové sparse/dense varianty pro podzim a zimu ponechávají původní
siluety i 1024 × 180 u; zima má sněhové střechy a podklad. Existující
`backdropFrames` je vybírá přes stejný sezonní suffix jako venkov.

`near.bush` má zimní holou/zasněženou a podzimní okrovou kresbu bez květů,
obě 64 × 42 u s pivotem (32, 42). `SeasonalSceneryView.frame` rozezná
sezónní rodinu z metadat `atlasGroup.seasons` v plném registru, proto není
nutná další výjimka v resolveru. Regrese používá skutečné staniční keře
seed 2 / chunk 489 / kandidáti 26, 27, 29 a ulici seed 4 / chunk 994 /
kandidáti 9, 10 včetně dalšího přirozeného keře v témže obrazu.

Audit kombinovaných umístění navíc našel letní zelené trsy zabudované v
`back.house-a/b/c`, `back.lodge` a `back.logs`. Jejich zimní varianty
mění pouze trsy a drobný sněhový podklad; rozměry, pivoty a zbytek kresby
zůstávají. Sněhové plochy střech dál vlastní původní hook, bez dvojího krytu.
Květiny, kapradiny, bobulový keř a zelené trsy samostatného popředí se
v zimě nevytvářejí; zahrady, řádky polí, lesní okraje a husté lesní pásy
již mají sezónní pravidla. Zadní keře mají zimní varianty a jehličnany
zůstávají zelené záměrně. Zelené okenice, nátěry strojů a uložené ovoce
nejsou vegetační mezera. Nový modul `integration-seasons.art.ts` pouze
rozšiřuje registr: nemění save, umístění, seed ani verzi generátoru.

Pixelový roof probe mapuje zimní názvy domů a/b/c na stejné původní rodiny
masek; sněhové varianty mají prokázanou shodnou geometrii. Nadále vyžaduje
všechny tři rodiny a přes 65 % bílé v každém ze tří pásů. Regrese nad
skutečným Canvas rendererem před opravou nalezla nula domů, po opravě
stejné původní masky a prahy, bez rozšíření timeoutů či vypuštění střech.

Plný browserový průchod po rozšíření probe odhalil u domu c spodní pás
s 63,92 % bílé na Canvasu (seed 2 / chunk 504, krátký vlak), pod původní
mezí 65 %. Sněhová plocha proto vede spodní střední hranu na y = 44,5–45 u
místo 42–44 u; původní římsa je na y = 45,68 u. Horní tvar, rohy, komín
a výřez vikýře zůstávají. Dva bodové testy zachycují nově pokrytou dolní
část, pixelová brána ani maska se nemění. Barva a tloušťka obrysu zůstávají.

Zimní domy a/c mají prázdné okenní truhlíky bez letních červených a žlutých
květů (polish-1). Mění se pouze kruhy květů pod okny; rozměry, pivoty,
geometrie střech a jejich sněhové masky zůstávají. Regrese `seasonalArt.test.ts`
porovnává oblast truhlíků s barvami květů v letních SVG. Save se nemění.

## Známá pixelově mezní pozorování (2026-10-16)

SEA-04, `seasonal-rendering.spec.ts:157`, má dvě oddělená předexistující
pozorování; oba případy ponechávají podmínku sněžení **>160 pixelů**:

- **Canvas / long / low / tablet-touch:** přijatý mezní vzorek **159** pixelů.
  Tato varianta selhávala také v CI před D-030; není to výsledek pomalého
  startovního čekání.
- **WebGL / short / low / tablet-touch:** úplný běh integrate-5 na `4718efe`
  naměřil v sousedních snímcích **165, potom 147** pixelů. Scéna už byla
  připravená, automatické aktualizace vypnuté a po 180 ručních snímcích se
  vlak pohyboval; podvozky a stopa prošly. Samostatná A/B opakování při jednom
  i dvou workerech prošla. Stejný název
  `[tablet-touch] seasonal-rendering.spec.ts:157 (webgl, short, low)`
  selhal již v CI běhu **38868530679** na `5e3385d`, před
  D-030. Jde o známé předexistující pixelově mezní pozorování po startu,
  oddělené od varianty Canvas / long / low i od startovní latence.

Test, jeho práh ani kresba se tímto záznamem nemění. Příčinu kolísání nelze
z těchto vzorků určit; případné ladění potřebuje samostatnou reprodukci a
obrazové ověření. Desktopový projekt `tablet-touch` není fyzický tablet.

## Deterministické částice (seasonal-flake-1)

Reprodukce oddělila dva zdroje kolísání. `RideScene` předával `Math.random`
částicovému poli, hráčskému i protijedoucímu vlaku, okolnímu životu a
sezónním emiterům. Test navíc vypínal automatické aktualizace až po
pokračování z pauzy, tedy po proměnlivém počtu skutečných snímků. Ručních
180 snímků tak nezačínalo ze stejného ticku ani stavu kamery a emiterů.
Částice, vítr a rozpočty již používaly simulační čas; reálný čas neřídil
jejich stáří ani hustotu.

Všech pět konzumentů sdílí lokální 32bitový LCG
(`state = (1664525 × state + 1013904223) mod 2³²`, výstup `state / 2³²`).
Při změně instance jízdy dostane jednou seed
`hash32(journeySeed, 'effects', initialSimulationTick)`, ještě před resetem
okolního života. Další emise pouze posouvají stav LCG; nezměněné, pozastavené
ani skryté snímky kvůli RNG znovu nevolají hash ani serializaci. Počáteční
tick je tick nové nebo obnovené jízdy.
Zachovává rozsahy, emise, životnosti a pool; nečerpá náhodnost layoutu ani
globálního browseru. Stejný počáteční stav a stejná posloupnost snímků,
kvality a vstupů opakují efekty. Rozdílné FPS mohou dál měnit kosmetický
průběh; částice se neukládají a verze geometrie, katalogu i save se nemění.

Ruční fixture nechá připravit atlasy ve skutečné pauze a vypne automatický
update před pokračováním. Host při ručním kroku dostane čas odvozený
z následujícího simulačního ticku, bez `performance.now()`. Pixelová regrese
nadále měří tři sousední snímky a všechny původní prahy; nový replay test
porovnává i celý stav částic po dvou obnovách cesty.
Tento instrumentovaný spec blokuje service worker: druhá návštěva jinak
může dostat nezměněný bundle z jeho cache a obejít síťový probe. Produkční
PWA ani její samostatné akceptační testy se tím nemění.

Výchozí produkční kód `6377948`, low matice 8 variant × 10 opakování se dvěma
workery: **77 prošlo, 3 selhaly** (8,2 min). Canvas long desktop měl 155,
Canvas short desktop 138 a Canvas long tablet-touch 138 pixelů sněžení,
vždy proti nezměněnému >160. První měřený snímek měl tick 550–831 místo
očekávaného 360; před ručním krokováním tak uběhlo 190–471 neřízených ticků.
Pozorované rozsahy přes oba projekty a tři sousední snímky:

| Renderer / vlak | Sněžení před opravou | Podvozky před opravou | Stopa před opravou |
| --------------- | -------------------- | --------------------- | ------------------ |
| Canvas / short  | 138–578              | 142–422               | 417–685            |
| Canvas / long   | 138–576              | 390–907               | 146–354            |
| WebGL / short   | 197–458              | 83–420                | 340–842            |
| WebGL / long    | 198–595              | 311–974               | 67–379             |

Historický kontrolní běh seasonal-flake-1 (tehdy s reseedem každý snímek)
prošel všech 16 pixelových variant i oba replay
testy (18/18). Low má následující rozsahy přes tři sousední snímky;
desktop a tablet-touch dávají pro odpovídající snímek stejná čísla:

| Renderer / vlak | Sněžení po opravě | Podvozky po opravě | Stopa po opravě |
| --------------- | ----------------- | ------------------ | --------------- |
| Canvas / short  | 249–263           | 228–252            | 568–648         |
| Canvas / long   | 460–468           | 590–648            | 232–247         |
| WebGL / short   | 254–264           | 236–254            | 572–652         |
| WebGL / long    | 465–474           | 603–644            | 225–246         |

Velikost, hustota, životnost i pool zůstaly beze změny; nebylo potřeba ladit
čitelnost low ani spouštět `measure:perf`. Pixelové oblasti, kontrast 24 RGB,
minima dlaždic a prahy >160 / >75 / >45 se nesnižují.

Opakovaný běh všech 16 variant s `--repeat-each=10 --workers=2` prošel
**160/160** za 17,8 min. Kontrola všech 480 záznamů potvrdila 48 skupin
(projekt × renderer × délka × kvalita × snímek), v každé deset shodných
počtů pixelů i dlaždic. Rozptyl mezi opakováními je tedy **0**; nenulový
rozsah v tabulce vyjadřuje pouze pohyb mezi tickem 360, 362 a 364.

Stejná matice s `--repeat-each=10 --workers=1` prošla **160/160** za
25,4 min. Společná kontrola obou logů ověřila všech **960** záznamů:
každá z 48 skupin má dvacet shodných výsledků pixelů i dlaždic, včetně
shody mezi jedním a dvěma workery. Oba běhy používaly současně
`/tmp/vlacek-playwright.lock` a `/tmp/vlacek-check.lock`, bez retries či skipů.

### Revidovaný životní cyklus RNG (seasonal-flake-2)

Reseed přes `hash32` v každém snímku vytvářel pole argumentů a JSON řetězec
i během pauzy a skrytého světa. Seedování se proto přesunulo do existující
větve změny instance jízdy před `#reset()`, který inicializuje čekání okolního
života. Generátor ani sdílený hash nepotřebují nové rozhraní. Regrese
`RideScene.perf.test.ts` před opravou zaznamenala **120 hashů pro 120
nezměněných snímků** (60 skrytých a 60 viditelných), po opravě **0**.
Samostatně ověřuje jeden seed při každé změně jízdy a žádný při změně ticku
stávající jízdy. Dotčená sada scény, částic a sezón prošla **103/103** testů.

Nový souvislý stream mění konkrétní rozmístění částic, nikoli jejich parametry.
Low výsledky přes ticky 360, 362 a 364 (oba projekty dávají stejná čísla):

| Renderer / vlak | Sněžení | Podvozky | Stopa   |
| --------------- | ------- | -------- | ------- |
| Canvas / short  | 348–366 | 302–323  | 516–636 |
| Canvas / long   | 203–240 | 513–557  | 94–116  |
| WebGL / short   | 351–373 | 305–321  | 532–629 |
| WebGL / long    | 206–239 | 530–568  | 91–110  |

První běh nezměněné matice `--repeat-each=3 --workers=2` zaznamenal všech
**144 vzorků**; 48 skupin má vždy tři stejné výsledky pixelů i dlaždic
(rozptyl **0**). Celý test prošel 37×, dalších 11 WebGL případů vyčerpalo
původní limit 30 s; žádná pixelová podmínka neselhala. Tento běh tedy není
zelenou časovou bránou. Traces ukazují timeouty při odečtu framebufferu
nebo dokončení testu; timeouty, retries ani čekání se kvůli tomu nemění.

Opakování stejného příkazu bez dalších změn kódu prošlo **48/48** za 7,8 min.
Společná kontrola obou logů ověřila **288 vzorků**, v každé z 48 skupin šest
shodných výsledků pixelů i dlaždic, včetně ticků 360/362/364. Úplný projektový
`check` pod `/tmp/vlacek-check.lock` se čtyřmi Vitest workery prošel včetně
**2 493 testů / 154 souborů**, typů, lintu a všech validátorů. Velikost, hustota,
životnost, pool i pixelové prahy zůstávají beze změny.
