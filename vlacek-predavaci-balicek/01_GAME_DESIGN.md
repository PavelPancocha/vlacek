# 01 — Game design a rozsah V1

[Zpět na rozcestník](README.md)

## 1. Produktový záměr

Postavit především hračku pro malou dceru zadavatele: vláček, který lze snadno sestavit, rozjet a sledovat v živém světě. Věkové rozmezí přibližně 2–4 roky je návrhový předpoklad, ne požadavek na znalosti dítěte. Dospělý může ukazovat na zvířata a společně si o okolí povídat, ale není nutný jako obsluha každé akce.

Základ je **semi-realistický**. Stroje, koleje, silnice, příroda a běžné provozní situace jsou rozeznatelné. Fantazie je koření: hvězdičky z komína, bublinková lokomotiva, hravé vagonky. Lokomotivy nemají ve výchozí podobě lidské obličeje. Značky skutečných dopravců ani přesné licencované předlohy nejsou vyžadované.

Úspěch se posuzuje tím, zda dítě rozumí vztahu dotyk–jízda, zvládne zvolit vláček a opakovaně objevuje drobné reakce. Hra neměří výkon dítěte a nesnaží se maximalizovat dobu používání.

## 2. Herní smyčka

`Spuštění → výběr lokomotivy → přidání vagonků → Vyjet → volná jízda → pauza / návrat později`

Při existující uložené cestě se na začátku zobrazí dvě velké obrázkové volby: **Pokračovat** a **Postavit vlak**. Při prvním spuštění se přejde přímo k lokomotivám.

Během jízdy dítě drží prst v herním prostoru. Vlak zrychluje do klidné maximální rychlosti. Po zvednutí prstu zpomaluje až do zastavení. Aktivní brzda zastaví rychleji. Scénky se odehrávají přímo v pohledu na vlak, bez otevírání miniher. Při stání žije okolí dál; pauza naopak zmrazí i okolí.

## 3. Co je součástí V1

| Oblast | Rozsah |
|---|---|
| Souprava | 10 odlišných lokomotiv, 32 druhů vagonků, opakování typů, 0–100 vagonků. |
| Sestavení | Klepnutím přidat, vybrat již přidaný vagónek, odebrat, změnit pořadí tlačítky; bez povinného přetahování. |
| Jízda | Jeden směr, boční 2D pohled, podržení pro jízdu, dojezd, brzda, píšťala. |
| Trať | Kopce, klesání, zářezy, tunely, mosty, viadukty, náspy, přejezdy a stanice. |
| Svět | Šest biomů; vesnice a městské či průmyslové motivy jako scénky uvnitř nich. |
| Život | Auta, cyklisté, lidé a zvířata na oddělených drahách; protijedoucí vlak na druhé koleji. |
| Interakce | Zvířecí reakce, mávání, balónky a další jednoduché dotykové animace. |
| Atmosféra | Pomalý den/noc, mírný déšť, sníh v horách; osvětlená a čitelná noc. |
| Provoz | Online web, lokální pokračování, pauza, nastavení zvuku, PWA/offline tam, kde fungují. |

Všechny základní lokomotivy a vagonky jsou dostupné hned. Mezi typy není výkonnostní soutěž. Malá mašinka utáhne stejnou soupravu jako velká. Pohon nikdy nepotřebuje tankování, dobíjení ani doplňování vody.

## 4. Co V1 výslovně neobsahuje

Žádné minihry, skóre, měny, odemykání, úkoly, časové limity, porážku, srážky ani vykolejení. Žádné ovládání výhybek, couvání, skutečný jízdní řád, síťovou hru či simulaci železničního zabezpečení. Žádné nakládání podmíněné typem vagónu, plnění zakázek, sběratelské album ani dva obtížnostní režimy.

Bez účtů, synchronizace mezi zařízeními, reklam, plateb, oznámení, chatování a analytických SDK. Bez nativní aplikace pro Android v první verzi. Bez iOS rozsahu. Offline funkčnost Tesly a její celoobrazovkový režim nejsou předpoklady základní hry.

Dříve navržené automatické zastávky, automatický rozjezd, tři rychlostní tlačítka a povinné úkoly **se nepřebírají**. Poslední upřesnění zadavatele je nahradilo jednodušším ovládáním.

## 5. Záměrná jednoduchost

### Nádraží

Nádraží je místo v krajině. Dítě může projet, zpomalit nebo zastavit. Lidé mohou zamávat i projíždějícímu vlaku. Při vlastním zastavení se spustí krátká nepovinná scénka. Rozjezd ji může plynule ukončit; nic nečeká na dokončení animace.

### Vagonky

Výběr určuje vzhled soupravy a případné místní reakce vagónku, nikoli obsah trasy. Vagonky mají náklad jako kresbu či jednoduchou animaci. Hra nevede zásoby zboží.

### Fantazie

Fantazijní lokomotivy mohou pouštět hvězdičky nebo bubliny. V okolním světě ale převládá normální krajina. Draci, vesmírné tunely a magické portály nejsou součástí základního katalogu.

### Realismus

Závory zastavují silniční provoz, voda je pod mostem, most má opory, tunel má vjezd a výjezd. Elektrická lokomotiva má vedení i přes most a uvnitř tunelu. Není nutné modelovat elektrické obvody, aerodynamiku či hmotnost nákladu.

## 6. Výchozí volby doplněné zadáním

- Jediný dětský režim. Maximální rychlost lze snížit v rodičovském nastavení, nikoli rozšířit nad standard.
- Žádné automatické zastavení při klepnutí na zvíře ani při příjezdu do stanice.
- Kamera sleduje předek vlaku. Za jízdy není ruční panorámování, protože by se pletlo s řízením a brzdným gestem.
- Celou dlouhou soupravu lze prohlížet v depu posouváním jejího pásu, nikoli zmenšením do nečitelných teček.
- Jeden lokální rozehraný výlet, jedna poslední sestava, rozpracovaná změna sestavy. Profily a knihovna oblíbených vlaků jsou pozdější rozšíření.
- Změna soupravy a volba jiné lokomotivy probíhá v depu před novou cestou. Neprovádí se přepojování za jízdy.
- Začíná se v denní venkovské krajině; další prostředí přicházejí bez menu s volbou trasy.

## 7. Ukázkový průběh

Dítě zvolí malou parní lokomotivu a šest různých vagonků. Klepne na velké obrázkové „Vyjet“. Uvidí stojící vlak. Podrží prst na louce a vlak se rozjíždí. Na poli jede traktor; druhým prstem klepne na krávu, která zabučí. Před přejezdem se rozblikají světla, sklopí závory a auto počká. U nádraží prst pustí; souprava dojíždí. Přidržením brzdy zastaví vedle nástupiště. Výpravčí zamává. Dítě znovu podrží prst a vlak pokračuje, aniž by muselo něco potvrdit.

O kus dál vjede část soupravy do tunelu; zadní vagonky jsou ještě venku. Ve světlejším průřezu je vlak vidět i uvnitř. Na souběžné koleji později projede jiný vlak. Po západu slunce se rozsvítí nádraží a objeví světlušky. Při přepnutí na jinou aplikaci se vše pozastaví. Po návratu se hra nehne bez nového pokynu.

## 8. Hranice hotového produktu

Hotová V1 není pouze plynule se posouvající obrázek pozadí. Musí splnit samostatné polohy všech vagonků na zakřivené trati, skutečnou kontinuitu generovaného světa, funkční dotykové priority a bezchybnou jízdu i bez interakcí. Celý katalog musí být vizuálně rozlišitelný.

Výchozí designové a technické volby jsou připravené k implementaci. Jediné nezbytné pozdější vstupy jsou skutečné testování na cílovém tabletu a Tesle, případně rozhodnutí o vlastním výtvarném zpracování. Tyto neznámé nebrání zahájení technického prototypu.
