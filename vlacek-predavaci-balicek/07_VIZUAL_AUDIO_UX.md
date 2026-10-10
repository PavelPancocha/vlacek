# 07 — Vizuál, zvuk a dětské rozhraní

[Zpět na rozcestník](../README.md)

## 1. Výtvarný směr

Semi-realistická ilustrovaná železnice: rozpoznatelné proporce strojů, čitelné náklady, viditelné kolejnice a přirozeně působící středoevropské okolí. Styl moderní obrázkové knihy, ne fotorealistická textura a ne abstraktní neonová arkáda.

Použít zjednodušené objemy, měkké stíny, konzistentní tloušťku kontur a klidné pozadí. Stroj může být barevný, ale lokomotiva, vagón a okolí nesmí vypadat jako tři nesouvisející sady clipartů. Fantazijní vozy mají stejný výtvarný jazyk jako realistické.

Pohled na vlak je striktně boční. Hloubku vytváří vrstvy krajiny, ne otáčení 3D kamery. Kolej může stoupat a klesat, ale vlak nejede čelně k dítěti. Vzdálená vedlejší kolej musí být snadno odlišitelná od hráčovy.

Výchozí volba: žádné lidské oči a ústa na lokomotivách. Výraz je v siluetě, zvuku, barvě a rytmu jízdy. Zvířata mohou mít přívětivý styl bez nutnosti antropomorfních dialogů.

## 2. Čitelnost před množstvím detailů

Hlavním vizuálním objektem zůstává vlak. Pozadí má nižší kontrast; interaktivní zvíře se přirozeně odlišuje od houští. Interaktivitu naznačuje občasné vykouknutí či otočení hlavy, nikoli permanentní blikající obrys.

Nepoužívat dlouhé neprůhledné překážky, které zakryjí celý vlak. Přední strom může na okamžik překrýt jeden vagónek, nikoli lokomotivu a celou cestu po mnoho sekund. Při více možných cílech má být zřejmé, který reagoval.

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
10. Částice a lokální světelné akcenty, které nezakryjí ovládání.
11. HUD a modální UI.

Z-order není univerzální pravidlo „všechna zvířata před vlakem“: konkrétní entita má scénickou vrstvu. Hit-test používá skutečnou viditelnost a tutéž vrstvu. Troleje lze rozdělit na zadní nosné konstrukce a přední drát podle konkrétní perspektivy.

Pozadí používá dvě až tři parallax rychlosti. Nejbližší fyzický terén a kolej se pohybují přesně s kamerou. Na styku chunků nesmí zůstat prázdné místo v obloze či pozadí.

Implementace vrstev 5 a 6 ([D-012](../docs/decisions/012-track-tiles-and-terrain.md)): kolej tvoří vektorové dlaždice z atlasu, pokládané po 64 u a otočené podle profilu. Pod nimi je svah náspu a louka v pásech, které k divákovi tmavnou. Zem každého chunku přesahuje do dalšího, aby na Canvasu nevznikl šev.

## 4. Specifikace vozidlových assetů

Každý vozidlový typ musí být rozpoznatelný při běžné velikosti a mít náhled pro katalog. Obrázky se připravují alespoň pro základní a vyšší hustotu nebo ve zdrojovém vektoru; runtime nemusí pracovat s velkým SVG DOM.

Doporučené části: karoserie, kola či podvozky, volitelné táhlo, světla, pantograf, lokální interaktivní díl. Zdrojové soubory a exporty evidovat odděleně. Pro výkon běžně slučovat do atlasů; transparentní okraje nesmějí měnit pivot a geometrickou délku.

Manifest definuje pivot a offsety, ne ručně vložené „magické posuny“ ve vykreslovací funkci. Pro každou sadu existuje kontrolní scéna: rovina, kopec, vrchol, tunel a noc. Nad jedním vagónkem nesmí být stín nebo kouř patřící jinému typu kvůli chybně sdílenému stavu.

Implementace ([D-011](../docs/decisions/011-vector-vehicle-art-and-atlas.md)): zdrojem jsou SVG díly v `assets/vehicles/` v jednotkách u. Každé vozidlo má karoserii za koly, překryv před koly a táhly, sdílená kola a u parních lokomotiv spojnici, ojnici a křižák. Světlo dopadá zleva shora a lesk obručí nese neotáčivý překryv. Manifest `src/content/artManifest.ts` určuje rozměry, pivoty, polohy kol a parní rozvod; jízda i depo skládají díly stejnou funkcí `vehicleArtLayers`. Hra díly za běhu rasterizuje do jednoho atlasu v měřítku podle zoomu kamery a po změně velikosti okna atlas překreslí. `npm run validate:assets` kontroluje soubory, rozměry, délkový invariant, kola a táhla.

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

## 7. Bezpečné audiovizuální chování

Žádné lekání, výbuchy, sirény přes celou scénu, prudké otřesy, rychlé celoobrazovkové blikání ani hlasité reklamy. Praskání balónků je měkké. Přejezd má přiměřenou lokální signalizaci. Noční sova se ozve krátce, ne strašidelně.

Režim omezených efektů sníží dekorativní pohyb, částice a houpání UI. Nezruší funkční signalizaci ani informace o reakci objektu. Veškeré důležité ovládání funguje i se zcela vypnutým zvukem.

Mluvené pojmenovávání věcí, automatický komentátor a další jazyky nejsou součást V1. Případně se později doplní jako volitelná zvuková vrstva, nikoli závislost herní logiky.

## 8. Rozložení obrazovky

Hra je navržená na šířku. Orientační referenční výřez je 1280 × 720, ale žádná funkce nesmí předpokládat celé rozlišení displeje Tesly. Měřit skutečný prostor kontejneru.

Za jízdy: brzda vlevo dole, píšťala vpravo dole, malá pauza a zvuk v horním rohu. Mezi velkými tlačítky zbývá souvislá dotyková krajina. Umístění respektuje safe-area a dostupnou výšku. Skutečné zařízení rozhodne, zda je nutné posunout ovládání dál od okraje prohlížeče.

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

Přepínání biome nesmí na hlavním vlákně najednou dekódovat velkou novou sadu a zadrhnout řízení. Přednačíst aktuální a následující prostředí; po odjezdu a uvolnění referencí odložit nepotřebné textury. Dlouhý vlak za kamerou potřebuje geometrii, ne všechny dekódované obrázky minulého lesa.

## 11. Kontrola původu

Repozitář má `assets/SOURCES.md` s původem a podmínkami použití každé sady a `THIRD_PARTY_NOTICES.md` podle skutečně použitých závislostí. Dočasné placeholdery musí být označené. Nečerpat bez ověření z náhodných obrázků z vyhledávání nebo z chráněných dětských seriálů.

Výtvarná akceptace vyžaduje kontaktní list všech 10 lokomotiv a 32 vagonků, denní a noční scénu každého biomu a přehled hlavních infrastruktur. Tento balíček definuje, co se má vytvořit; samotné ilustrace ani audio v něm dodány nejsou.
