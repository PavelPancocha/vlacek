# 07 — Vizuál, zvuk a dětské rozhraní

[Zpět na rozcestník](../README.md)

## 1. Výtvarný směr

Semi-realistická ilustrovaná železnice: rozpoznatelné proporce strojů, čitelné náklady, viditelné kolejnice a přirozeně působící středoevropské okolí. Styl moderní obrázkové knihy, ne fotorealistická textura a ne abstraktní neonová arkáda.

Použít zjednodušené objemy, měkké stíny, konzistentní tloušťku kontur a klidné pozadí. Stroj může být barevný, ale lokomotiva, vagón a okolí nesmí vypadat jako tři nesouvisející sady clipartů. Fantazijní vozy mají stejný výtvarný jazyk jako realistické.

Pohled na vlak je striktně boční. Hloubku vytváří vrstvy krajiny, ne otáčení 3D kamery. Kolej může stoupat a klesat, ale vlak nejede čelně k dítěti. Vzdálená vedlejší kolej musí být snadno odlišitelná od hráčovy.

Výchozí volba: žádné lidské oči a ústa na lokomotivách. Výraz je v siluetě, zvuku, barvě a rytmu jízdy. Zvířata mohou mít přívětivý styl bez nutnosti antropomorfních dialogů.

## 2. Čitelnost před množstvím detailů

Hlavním vizuálním objektem zůstává vlak. Pozadí má nižší kontrast; interaktivní zvíře se přirozeně odlišuje od houští. Interaktivitu naznačuje občasné vykouknutí či otočení hlavy, nikoli permanentní blikající obrys.

Dekorace nesmějí dlouhodobě zakrýt celý vlak. Výjimkou je skutečný neprůhledný tunel podle D-018: vjezd a výjezd jsou vidět v ústí, kamera pokračuje a ovládání zůstává dostupné. Přední strom může na okamžik překrýt jeden vagónek, nikoli lokomotivu a celou cestu po mnoho sekund. Při více možných cílech má být zřejmé, který reagoval.

Ve V1 není potřeba generovat grafiku za běhu. Obrázky, zvuky i fonty jsou součást buildu. Pokud vzniknou pomocí generativních nástrojů během vývoje, musí projít kontrolou konzistence a použitelnosti, stejně jako ručně vytvořený asset. Nezavádět runtime volání AI ani připojení kvůli jednotlivým krajinám.

## 3. Vrstvy vykreslování

Výchozí pořadí z dálky dopředu:

1. Obloha, slunce/měsíc, vzdálené mraky.
2. Vzdálené hory, moře a horizont.
3. Střední krajina, lesy, město, vzdálené stroje.
4. Zadní komunikace a souběžná kolej s vlastním vlakem.
5. Terén u trati a zadní části mostů, budov a tunelů.
6. Hráčova kolej, pražce a potřebné spodní části konstrukcí.
7. Hráčův vlak; kola, karoserie, světla a pantograf.
8. Přední zábradlí, portálové pilíře a vybraná vegetace.
9. Blízká zvířata a interaktivní objekty, pokud mají správnou prostorovou polohu.
10. Okolní částice a lokální světelné akcenty, které nezakryjí ovládání. Částice vozidel jsou nad vlastním vlakem, ale pod jeho tunelovým krytem.
11. HUD a modální UI.

Z-order není univerzální pravidlo „všechna zvířata před vlakem“: konkrétní entita má scénickou vrstvu. Hit-test používá skutečnou viditelnost a tutéž vrstvu. Troleje lze rozdělit na zadní nosné konstrukce a přední drát podle konkrétní perspektivy.

Pozadí používá dvě až tři parallax rychlosti. Nejbližší fyzický terén a kolej se pohybují přesně s kamerou. Na styku chunků nesmí zůstat prázdné místo v obloze či pozadí.

Implementace vrstev 5 a 6 ([D-012](../docs/decisions/012-track-tiles-and-terrain.md)): kolej tvoří vektorové dlaždice z atlasu, pokládané po 64 u a otočené podle profilu. Pod nimi je svah náspu a louka v pásech, které k divákovi tmavnou. Zem každého chunku přesahuje do dalšího, aby na Canvasu nevznikl šev.

Implementace vrstev 1–5 a 8–9 ([D-013](../docs/decisions/013-landscape-localities-and-backdrops.md)):

- **Obloha a mraky.** Obloha je přechod barev. Mraky se posouvají rychlostí 0,06 a unášejí se podle simulačního času, takže v pauze stojí.
- **Pozadí biomu.** Vzdálené pozadí se posouvá rychlostí 0,25, střední 0,55. Při změně biomu se prolne za 1,2 s.
- **Zem za tratí.** Pole mají šikmé hranice ubíhající k obzoru a nádrže rovnou hladinu. Silnice je pod autem. Celá zem chunku se jednou vykreslí do textury.
- **Rekvizity.** Zadní rekvizity se s hloubkou zmenšují, blízké se zvětšují. Žádná blízká rekvizita ani zvíře nepřesahuje do vlaku.
- **Bez MSAA.** Hra se kreslí bez MSAA, protože hrany vznikají z textur: snímky atlasu mají 1 px průhledného okraje a zem je předkreslená. Bez MSAA běží jízda v softwarovém WebGL dvakrát rychleji.

## 4. Specifikace vozidlových assetů

Každý vozidlový typ musí být rozpoznatelný při běžné velikosti a mít náhled pro katalog. Obrázky se připravují alespoň pro základní a vyšší hustotu nebo ve zdrojovém vektoru; runtime nemusí pracovat s velkým SVG DOM.

Doporučené části: karoserie, kola či podvozky, volitelné táhlo, světla, pantograf, lokální interaktivní díl. Zdrojové soubory a exporty evidovat odděleně. Pro výkon běžně slučovat do atlasů; transparentní okraje nesmějí měnit pivot a geometrickou délku.

Manifest definuje pivot a offsety, ne ručně vložené „magické posuny“ ve vykreslovací funkci. Pro každou sadu existuje kontrolní scéna: rovina, kopec, vrchol, tunel a noc. Nad jedním vagónkem nesmí být stín nebo kouř patřící jinému typu kvůli chybně sdílenému stavu.

Implementace ([D-011](../docs/decisions/011-vector-vehicle-art-and-atlas.md)): zdrojem jsou SVG díly v `assets/vehicles/` v jednotkách u. Každé vozidlo má karoserii za koly, překryv před koly a táhly, sdílená kola a u parních lokomotiv spojnici, ojnici a křižák. Světlo dopadá zleva shora a lesk obručí nese neotáčivý překryv. Manifest `src/content/artManifest.ts` určuje rozměry, pivoty, polohy kol a parní rozvod; jízda i depo skládají díly stejnou funkcí `vehicleArtLayers`. Hra díly vozidel aktuální jízdy a NPC sady rasterizuje do samostatného atlasu podle zoomu kamery ([D-019](../docs/decisions/019-journey-atlas-and-npc-fleet.md)); svět a pozadí mají vlastní atlasy. Po změně velikosti okna se každý atlas podle potřeby překreslí, po změně jízdy se přestaví pouze atlas vozidel. `npm run validate:assets` kontroluje soubory, rozměry, délkový invariant, kola a táhla.

## 5. Barevnost, den a noc

Den je jasný, ale ne přeexponovaný. Noc není úplně tmavý filtr přes celý canvas. Udržet minimální čitelnost koleje, vozidel a zvířat; světla a teplá okna dodají atmosféru. Základní noční transformace musí fungovat i bez speciálních WebGL filtrů.

Plynulý přechod může kombinovat barevné vrstvy pozadí, měkký poloprůhledný překryv a rozsvícení jednotlivých assetů. Neměnit tón HUD tak, že zmizí brzda. Měsíc ani slunce nejsou nutně klikací tlačítka pro změnu denní doby.

Déšť a sníh jsou jednoduché omezené částice. Není třeba fyzikální hladina, odrazy nebo plošné post-processing efekty. Menší výkon nesmí vést k tmavšímu a nečitelnému světu.

## 6. Zvukové vrstvy

| Vrstva      | Chování                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| Pohyb vlaku | Tichá smyčka kol podle rychlosti; při stání ztichne.                         |
| Lokomotiva  | Rozlišené parní, naftové, elektrické a pohádkové motivy.                     |
| Píšťala     | Krátký charakteristický zvuk, viditelné tlačítko, omezené opakování.         |
| Prostředí   | Ptáci, vítr, voda, jemné městské okolí; maximálně několik současných smyček. |
| Reakce      | Zvířata, prasknutí balónku, mávnutí či stroj; krátké a nelekavé.             |
| Hudba       | Volitelná jemná smyčka; ve výchozím nastavení vypnutá.                       |

Výchozí zvuky jsou zapnuté, ale skutečné spuštění respektuje odemčení audia uživatelským dotykem. Neúspěšné odemčení nesmí blokovat hru. Chybějící zvuk se hlásí dospělému v diagnostice, ne chybovou obrazovkou před dítětem.

Audio manager má celkový limit osm hlasů: nejvýše tři smyčky a nejvýše pět jednorázových zvuků. Při přeplnění odmítne nejméně důležitý nový zvuk nebo jemně ukončí nejméně důležitý starý; nikoli vytvoří nekonečnou frontu. Hráčova píšťala má přednost před vzdáleným ptákem. Stejný zvířecí zvuk se nesčítá hlasitostí při pěti dotycích.

Lokální hlasitost se může mírně měnit podle vzdálenosti, ale důležitá odezva na dotyk nesmí být neslyšitelná jen kvůli výtvarné hloubce. Žádné výrazné stereo efekty vyžadující sluchátka.

Implementace nahrávek: [D-022](../docs/decisions/022-recorded-sounds.md). Lokální MP3 se načítají po gestu až na vyžádání; 32 souborů má 1,84 MiB. Kola a engine reagují na rychlost, pára na ujetou délku, výstražný zvonek na fázi a vzdálenost, tunel na překrytí celé soupravy. Nejvýše 3 smyčky a 5 jednorázových hlasů; výstraha má přednost před ambientem. Elektrické houkačky a trakce mají přiznané nahrané fallbacky. Poslech na zařízení zůstává **NEOVĚŘENO**; seznam Zvuky ve skrytém D-020 menu dovoluje přehrát každé ID.

## 7. Bezpečné audiovizuální chování

Žádné lekání, výbuchy, sirény přes celou scénu, prudké otřesy, rychlé celoobrazovkové blikání ani hlasité reklamy. Praskání balónků je měkké. Přejezd má přiměřenou lokální signalizaci. Noční sova se ozve krátce, ne strašidelně.

Režim omezených efektů sníží dekorativní pohyb, částice a houpání UI. Nezruší funkční signalizaci ani informace o reakci objektu. Veškeré důležité ovládání funguje i se zcela vypnutým zvukem.

Implementace částic a drobných animací ([D-014](../docs/decisions/014-particles-and-small-animations.md)):

- **Pole částic.** Omezené, znovupoužívané pole drží částice ve světových souřadnicích. Okolní život kreslí vrstva 10; částice hráčova vlaku vrstva 7,55 a NPC 4,32 pod příslušnou skálou. Zdroje uvnitř skály nevypouštějí nové částice a kryt zakryje i dříve vzniklé částice. Pole se posouvá simulačním časem, takže v pauze stojí.
- **Zdroje částic.** Kouř, pára, výfuk a hvězdičky vycházejí z emitorů v manifestu vozidla, se sklonem modelu.
  - Kouř jde v taktech hnacích kol.
  - Brzdové jiskry přicházejí jen při prudkém brzdění; kontaktní jiskření elektrických lokomotiv popisuje sekce sparks-1 níže.
  - Sníh víří každý viditelný podvozek jen nad místním sněhem a za jízdy; listí pouze na podzim u konkrétního listnatého zdroje.
- **Drobné pohyby.** Tráva a stromy se houpou, voda občas zableskne, zvířata jemně dýchají. Jen jednou za čas přeletí ptáci nebo motýli.
- **Úsporný profil.** Profil `low` i omezené efekty snižují strop částic z 240 na 96 a hustotu na polovinu.

Mluvené pojmenovávání věcí, automatický komentátor a další jazyky nejsou součást V1. Případně se později doplní jako volitelná zvuková vrstva, nikoli závislost herní logiky.

## 8. Rozložení obrazovky

Hra je navržená na šířku. Orientační referenční výřez je 1280 × 720, ale žádná funkce nesmí předpokládat celé rozlišení displeje Tesly. Měřit skutečný prostor kontejneru.

Za jízdy: brzda vlevo dole, píšťala vpravo dole, malá pauza a zvuk v horním rohu. Mezi velkými tlačítky zbývá souvislá dotyková krajina. Umístění respektuje safe-area a dostupnou výšku. Skutečné zařízení rozhodne, zda je nutné posunout ovládání dál od okraje prohlížeče.

Na všech obrazovkách (úvod, výběr lokomotivy, depo, pauza, chyby a vývojářské volby) zůstávají akční řádky celé v dostupném viewportu a nesmějí se smršťovat. Obsah mezi nimi má pružnou výšku a při nedostatku místa se posouvá; všechny karty katalogu zůstávají dosažitelné. Toto pravidlo platí průběžně mezi breakpointy, ne jen pro konkrétní model telefonu. Rozměry vycházejí z dostupného kontejneru s výškou `100dvh` a safe-area, nikoli z `screen.height`; adresní řádek prohlížeče nesmí zakrýt spodní akce. Na nízkém telefonu zůstává vodorovný výběr lokomotiv a kompaktní depo. Pás soupravy a katalogy dovolují oba směry dotykového posunu: vodorovně listují řádkem, svisle posouvají okolní obsah obrazovky. Při svislém přetečení výběru ukazuje malá neanimovaná šipka dolů, že pod okrajem jsou další mašinky; po dosažení konce zmizí. Stav „Vláček je plný“ nebo „Vláček je moc dlouhý“ patří do posuvného obsahu depa a nesmí zvětšovat pevné řádky ovládání. Změna rozložení nemění katalog ani uložená data.

Na malé šířce zmenšit množství současných položek UI, ne jejich dotykovou plochu. Rozměry 64/80 CSS px jsou minimum návrhu, ne hodnoty v interní textuře. Celoobrazovková ikona je rozšíření; její nepodpora nesmí znefunkčnit žádnou jinou akci.

Na výšku se pozastaví jízda a ukáže velký obrázek otočeného zařízení. Automatické zamčení orientace může být použito jen jako volitelné zlepšení. Prohlížečové okraje a systémové ovládání nelze slibovat skrýt všude.

## 9. Texty a přístupnost

Hlavní české texty: „Vyber mašinku“, „Přidej vagonky“, „Vyjet“, „Pokračovat“, „Postavit vlak“, „Pauza“, „Zvuky“, „Hudba“, „Otoč zařízení“, „Zkusit znovu“. Nevyžadovat čtení textu před každým rozjezdem.

DOM tlačítka mají srozumitelný `aria-label`, viditelný focus pro klávesnici a odpovídající disabled stav. Canvas objekty nejsou ve V1 prezentovány jako plně čtečkou obrazovky ovladatelný svět; tento rozsah se nesmí nepravdivě deklarovat. Výběr vlaku, nastavení, spuštění a pauza však mají být dosažitelné z běžného DOM UI.

Použít systémový font nebo řádně licencovaný přibalený font s českou diakritikou. Nezáviset na externím fontovém serveru. Barva není jediný signál stavu: brzda má tvar a ikonu, vybraný vlak zřetelné označení.

## 10. Rozpočty assetů

Výchozí cíle, které se měří na skutečném buildu:

- První použitelné menu a základní jízda mají vyžadovat nejvýše přibližně 10 MiB přenosu; zbytek se může načíst pro další prostředí.
- Úplný offline balík se všemi lokomotivami, vozy, prostředími a zvuky cílit do 45 MiB přenášených souborů.
- Odhad dekódovaných textur: do 96 MiB v úsporném profilu, do 192 MiB ve standardním. To není totéž jako velikost PNG na disku.
- Běžné atlasy nejvýše 2048 × 2048, skutečný limit respektuje zjištěná kapacita rendereru. Není nutné mít všech šest biomů současně na GPU.

Stav ([D-013](../docs/decisions/013-landscape-localities-and-backdrops.md), [D-019](../docs/decisions/019-journey-atlas-and-npc-fleet.md)): hra má tři atlasy, každý do 2048 × 2048:

- atlas vozidel aktuální jízdy a její NPC sady, do 2 px/u;
- atlas koleje, rekvizit, zvířat a částic světa, do 2 px/u;
- atlas pozadí a mraků všech šesti biomů, do 1 px/u.

Dekódované textury se odhadují asi na 60 MiB:

- atlasy;
- zdrojové obrázky dílů;
- zem nejvýše šesti živých chunků v nejvýše 1 px/u.

Přepínání biome nesmí na hlavním vlákně najednou dekódovat velkou novou sadu a zadrhnout řízení. Přednačíst aktuální a následující prostředí; po odjezdu a uvolnění referencí odložit nepotřebné textury. Dlouhý vlak za kamerou potřebuje geometrii, ne všechny dekódované obrázky minulého lesa.

## 11. Kontrola původu

Repozitář má `assets/SOURCES.md` s původem a podmínkami použití každé sady a `THIRD_PARTY_NOTICES.md` podle skutečně použitých závislostí. Dočasné placeholdery musí být označené. Nečerpat bez ověření z náhodných obrázků z vyhledávání nebo z chráněných dětských seriálů.

Výtvarná akceptace vyžaduje kontaktní list všech 10 lokomotiv a 32 vagonků, denní a noční scénu každého biomu a přehled hlavních infrastruktur. Tento balíček definuje, co se má vytvořit; samotné ilustrace ani audio v něm dodány nejsou.

### Roční období a místní život — D-027

Vzhled a intenzita počasí používají společný postup regionu podle x, žádný
skutečný kalendář. Listnaté stromy mají jarní, podzimní a holé/zasněžené zimní
kresby; jehličnany na podzim zůstávají zelené. Střechy používají autorské
obrysy sněhových říms a plochy širokých střešních rovin s výřezy pro komíny
a vikýře, tunel vlastní svou sezónní kresbu. Listy a okvětní
lístky mají lokální zdroje, sněžení tři hloubky a pokračuje při stání.
Víření od podvozků po zastavení dohasne, kryt tunelu i terén zakrývají
částice podle skutečné polohy. Vážky zůstávají nad sladkou vodou, kachny
s vlnkami na rybníčku, rackové u pobřeží. Mlýn, vlajka, výpravčí a klidné
pohyby pastviny používají herní čas a vlastní fáze. Společný strop částic
je 240/96, zdrojů 32/12 a dekorativních animací 160/64 (standard/low).
Podrobnosti a kompatibilita: [D-027](../docs/decisions/027-seasons-and-life.md),
akceptace SEA-01–08 v [katalogu scén](../docs/scenes/acceptance.md).

Sníh zůstává čitelný i na bílém podkladu díky modrošedému spodnímu obrysu
vloček. Víření od podvozků tvoří oddělená zrna a krátkou stopu za posledním
vozem, odlišnou od komínové páry; nezvyšuje dosavadní pool ani emisní strop.
Zimní střechy se kontrolují v horním, středním i spodním pásu při měřítku
krátké a nejdelší soupravy v Canvasu i WebGL (D-027).

## Kontaktní jiskření elektrického vlaku — sparks-1

Revize sparks-2 (2026-10-14): původní pevné velikosti v u a práh dvou
změněných pixelů technicky prokazovaly efekt, ale dítě jiskření nevidělo.
Dítě nyní pozná modrobílý záblesk u kontaktu na první pohled: měkký svit
má 14 → 12 CSS px, jasné bílé jádro a modrý průhledný okraj. Žije 0,15 s,
s krátkým náběhem a dohasnutím. Čtyři světlé čárky mají 5 → 4 CSS px,
životnost 0,28–0,4 s, odletí dozadu podél drátu a trochu klesnou.
Za plného plynu a rychlosti přijde běžná skupinka přibližně každých 0,36 s;
četnost roste s rychlostí a trakcí, při námraze o čtvrtinu více. Nejde o
poruchu, ohňostroj ani celoobrazovkové blikání. Sběrač i drát zůstávají
čitelné, HUD je nad efektem.

Velikost je v CSS px a renderer ji převádí skutečným `unitsPerCss`,
nikoli pevnou velikostí světa: na 1140 × 512 je měřítko 0,342 CSS px/u,
na 568 × 320 přibližně 0,17. Oba viewporty se soupravou 2 000 u mají stejnou
čitelnost. Při rozjezdu a průjezdu podporou/spojem vznikne šest čárek do
6 CSS px a svit necelých 16 CSS px. V této troleji jsou
spoje rozpětí u podpor; efekt používá skutečné posunuté souřadnice podpor
z `Catenary.ts`, žádný fiktivní spoj uprostřed drátu. Ve stání, při pomalém
dojezdu (do 20 % rychlosti), brzdění, sklopeném sběrači nebo omezení dosahu
nevznikají nové kontaktní částice. Jiskry od brzdových kol se nemění.

Efekt sleduje skutečný kontakt i na svahu, mostě a portálu. Revize sparks-3
ukotvuje svit po celých 0,15 s k aktuálně vykreslenému kontaktu; krok pole
částic ho už neposouvá rychlostí vlaku o snímek dopředu. Kotva se obnovuje
i při interpolačním snímku bez simulačního ticku. Volné čárky dál odletují
samostatně. Sklopení sběrače, `outOfRange` nebo reset jízdy živý svit zruší;
při stání či brzdění platný kontakt jen nechá dosavadní svit doznít.
Zdroje za skálou
neemitují a všechny částice i svit mají vrstvu 7,55 pod neprůhledným krytem
D-018. Čas je herní, pauza ani návrat do aplikace nespustí doháněcí emisi.
Nejvýše jedna skupinka na krok; globální stropy 240/96 platí i pro svit.
Úsporný profil má poloviční četnost, dvě/tři čárky a menší svit 7 → 6 CSS px. Stav,
pole i obrázky se opakovaně používají. Save a geometrie trasy se nemění.

`RideScene` napojuje `frostyWire` na `effectiveClimateAt(seed, worldXU)`
v aktuálním světovém x kresleného kontaktu sběrače. Efektivní zima nebo
nenulová váha sněžení na přechodu znamená námrazu a zvýší četnost o 25 %;
teplý suchý drát zachová původní četnost. Zvuk se nepřidává.

Zdrojové assety `assets/world/fx.contact-spark.svg` a
`assets/world/fx.contact-glow.svg` jsou vlastní vektorové kresby vytvořené
pro tento projekt 2026-10-14, bez externích zdrojů; stejné podmínky jako
ostatní vlastní SVG světa. Jsou součástí atlasu a webového buildu.

### Předek silničních a vodních assetů (D-029)

`src/content/roadVehicleArt.ts` doplňuje ke stávajícím world art klíčům
vektor `front` v souřadnicích SVG (x doprava/y dolů), kotvy kol a výfuku.
Boční auto a traktor mají předek +x; čelní přejezdové varianty +y a zadní −y.
Příď `back.rowboat`, `back.sailboat` a `back.fishing-boat` je explicitně konec
+x SVG, i když je jejich trup symetrický. Renderer aplikuje právě jednu
orientační transformaci z vlastního pohybu. Diagnostika silnic ukazuje
azurovou světovou rychlost a oranžový skutečný předek; není v běžném dětském
pohledu. Pohybové detaily jsou malé vektorové kresby, bez nové atlasové plochy.
