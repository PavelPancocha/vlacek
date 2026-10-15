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
