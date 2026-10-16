# Suché duny s borovicemi

`dunes` je samostatná suchá krajina inspirovaná Moravskou Saharou.
Zachovává písečný obraz, který se majiteli líbil, a doplňuje borovice, vřes a suché trávy.
Sousedí s venkovem nebo pobřežím přes suchý přechod; nevytváří se z ní exotická poušť.

## DU-01 — Otevřený písečný hřbet

V dálce jsou nízké písečné vlny a řídká silueta borovic.
Za tratí leží široká světlá plocha s několika trsy trávy.
Kolej vede po stabilním suchém tělese a její pražce zůstávají čitelné.
Před vlakem pokračuje písek s drobnými kameny a nízkými travinami.
Vítr občas posune malý průsvitný pramínek písku při zemi.
Nad otevřenou krajinou je velká klidná obloha s řídkými mraky.
Žádná oáza ani voda není potřebná k vysvětlení této scény.

| Zóna           | Objekty                                     | Počet                    | Vztahy a závislosti              | Zakázáno                       |
| -------------- | ------------------------------------------- | ------------------------ | -------------------------------- | ------------------------------ |
| far            | NEW: dunový hřbet 512 × 100 u               | 2 navazující pásy        | Suché oblé tvary                 | Velehory a mořské rybníčky     |
| back 0,30–0,90 | Geometrie písku, `tree.pine`, `back.rock-a` | 2–4 borovice, 1–3 kameny | Stromy v suchých ostrůvcích půdy | Kaktusy a palmy                |
| bank           | Suché kolejové těleso                       | Souvislé                 | Písek nezasypává kolej           | Pohyblivá závěj přes vlak      |
| near 0,30–0,90 | `near.dune-grass`, `near.stones`            | 7–12 skupin              | Nízké rozptýlené rostliny        | `near.pond`, mušle bez pobřeží |

## DU-02 — Borový okraj s vřesem

Písečné hřbety se za tratí přibližují k souvislejšímu borovému lesu.
Na horizontu zůstávají nepravidelné koruny, mezi nimiž prosvítá obloha.
Za tratí stojí skupiny borovic s dostatečnými mezerami mezi kmeny.
U koleje je úzký suchý průsek s několika kameny.
Před vlakem leží nízký koberec vřesu a mladé borovice pod chráněným pásem.
Jednotlivý motýl se může držet kvetoucího vřesu a pták přeletí mezi korunami.
Vítr pohybuje každou skupinou trochu jinak, bez společného mechanického kývání.

| Zóna           | Objekty                                       | Počet                  | Vztahy a závislosti       | Zakázáno                    |
| -------------- | --------------------------------------------- | ---------------------- | ------------------------- | --------------------------- |
| far            | NEW: borový písečný pás 512 × 150 u           | 1–2 pásy               | Navazuje na dunové hřbety | Tropický prales             |
| back 0,30–0,85 | `tree.pine`                                   | 7–12                   | Shluky na suchém podkladu | Mokřadní vrby               |
| bank           | Geometrie suchého průseku, `near.stones`      | Souvislé, 3–5 detailů  | Volná kolej               | Kmeny přes vlak             |
| near 0,40–0,90 | NEW: vřes 80 × 24 u, mladá borovice 40 × 44 u | 5–9 vřesů, 2–4 stromky | Nízká přední lesní hrana  | Dospělá koruna v pásu vlaku |

## DU-03 — Písečná cesta na okraji krajiny

V dálce se mezi borovicemi ukazují první louky sousedního venkova.
Za tratí vede písčitá cesta, která má jasný začátek i pokračování za terén.
Kolej ji kříží jen tehdy, pokud zde existuje společně plánovaný přejezd.
V popředí jsou řídké keře, trávy a nízký dřevěný plot podél vyhrazené pěšiny.
Po cestě může pomalu projet cyklista nebo lesnické auto, nikoli oba při každém průjezdu.
Jediný člověk někdy zamává a potom pokračuje vlastní cestou.
Nad scénou zůstává suchá světlá obloha a písek postupně přechází do travnatých ostrůvků.

| Zóna           | Objekty                                   | Počet                         | Vztahy a závislosti                | Zakázáno                      |
| -------------- | ----------------------------------------- | ----------------------------- | ---------------------------------- | ----------------------------- |
| far            | Dunový a borový pás, přechodové louky     | Souvislé                      | Postupný suchý přechod             | Svislá hrana biomu            |
| back 0,25–0,85 | Geometrie cesty, `tree.pine`, `back.car`  | 1 cesta, 3–6 stromů, 0–1 auto | Auto používá cestu a správný směr  | Auto na volném písku          |
| bank           | Průsek, případně řízený přejezd           | 1 koridor                     | Přejezd z infrastrukturního plánu  | Dekorativní přejíždění kolejí |
| near 0,35–0,85 | `near.dune-grass`, vřes DU-02, úplný plot | 4–8 skupin, 0–1 plot          | Plot sleduje pěšinu a má oba konce | Plot ústící do koleje         |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                    | Reakce na vlak; cooldown  |
| ----- | ----------------------------------------------------- | ------------------------- |
| DU-01 | Přízemní poryv 2–4 s po 25–45 s                       | Žádná výrazná reakce      |
| DU-02 | Koruny, jednotlivý pták, motýl jen u kvetoucího vřesu | Pták klidně přeletí; 24 s |
| DU-03 | Jeden průjezd po cestě nebo krátká procházka          | Člověk zamává; 20 s       |

Písek je jemný lokální efekt, nikoli bouře ani celoplošný filtr.
Jeho částice nevstupují do chráněného pásu vlaku a neomezují ovládání.
Cyklista u přejezdu používá existující řízenou dopravu; mimo přejezd má samostatnou bezpečnou cestu.
Není zde aktivita vyžadující sbírání vody, hledání oázy nebo zastavení.

## Profil a preset

Cíl koleje: −100 až +100 u, absolutní sklon 0–0,04.
Mělké písečné vlny mohou být výraznější než samotná kolej, která zůstává plynulá.
Region používá suchý jasný nebo mírně větrný preset.
Čtyři české sezóny se zde nelosují a sníh nemá automaticky překrýt oblíbený písečný obraz.
Kvetoucí vřes je varianta místní scény v tomto presetu, nikoli nový kalendář.
Na hranici s pobřežím končí mušle, mola a mořská voda dříve, než začne vnitrozemská dunová podzóna.
Na hranici s venkovem přibývají travnaté ostrůvky a teprve potom pole.

## Zvuky

Použít jemný vítr a řídké lesní ptáky.
Cvrčci mohou znít u travnatých a vřesových míst, ne jako hlasitá smyčka celé pusté plochy.
Moře je přípustné pouze v dosahu skutečného sousedního pobřeží a plynule se vzdaluje.
Nový zvuk není nutný; písečný poryv může zůstat čistě vizuální.
Nepřidávat exotická zvířata, hudební klišé ani prudké nárazy větru.

## Nové kresby

NEW: dunový hřbet 512 × 100 u; měkká okrová vlna s jemnou strukturou písku.
NEW: borový písečný pás 512 × 150 u; řídké nepravidelné koruny nad světlým podkladem.
NEW: vřes 80 × 24 u; nízké tlumeně fialové a zelené skupiny.
NEW: mladá borovice 40 × 44 u; kompaktní silueta vhodná do bezpečného popředí.
Přízemní písek může využít společnou kresbu jemného prachu s vlastní barvou.
Stávající borovice, dunová tráva a kameny se sdílejí s ostatními krajinami.
Nevznikají kaktusy, velbloudi, palmy, oázy ani nový katalog pouštních rekvizit.

### Sezónní život D-027

Sezónní části a činnosti používají společný [kontrakt D-027](README.md#sezónní-vzhled-a-život--d-027)
a řádky SEA-01 až SEA-08 v [akceptaci](acceptance.md). Jedna váha podle x řídí
koruny, podklad i intenzitu částic; stání pouze nechává pokračovat animaci.

## Implementační řez water-mountains-1

DU-01 je otevřený písek, DU-02 borový okraj s kvetoucím i zeleným vřesem
a nízkými mladými borovicemi. Vzdálený dunový hřbet a borový pás mají
samostatné parallax vrstvy. Klidný otevřený úsek zůstává alespoň 1 024 u.
V incoming dunové podzóně není voda; suchý přechod zachovává písečné popředí.

Review water-mountains-3: dospělá borovice má rovný nebo mírně prohnutý kmen,
dole šedohnědý a nahoře oranžovohnědý. V horní třetině nese několik oddělených,
plochých nepravidelných modrozelených shluků jehličí na viditelných bočních
větvích. Varianty mění výšku a směr koruny; mezery mezi shluky zůstávají
čitelné i při herní výšce přibližně 30–40 px na telefonu 1140 × 512.
Stejný tvar vlastní samostatné stromy i vložené stromy borového horizontu.
Žádné šikmé palmové listy ani jediná deštníková koruna. Mladé borovice jsou
hustší, kuželovité a od dospělých zřetelně odlišné. Vřes tvoří nízké souvislé
růžovofialové polštáře čitelné i při 1140 × 512. Tunelovou hmotu vlastní
samostatná linka tunnels-bridges.
