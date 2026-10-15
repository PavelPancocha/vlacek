# Velká česká vesnice

Vesnice je složená místní scéna v `countryside` nebo `foothills`, nikoli samostatný biom.
Celek měří 3 072–6 144 u a má čitelný příjezd, hustší střed a odjezd.
Místní obrazy VI-01 až VI-04 jsou její části; společná silnice a identita pokračují přes jejich hranice.

## VI-01 — První domy a zahrady

V dálce zůstávají pole a nízké kopce hostitelské krajiny.
Za tratí se objeví první dva až čtyři domy podél místní silnice.
Každý má krátkou přístupovou cestu a zahradu, která vysvětluje jeho odstup od souseda.
U trati vede otevřený travnatý pás s nízkým plotem zahrady mimo kolej.
Před vlakem jsou zeleninové záhony, keře a kočka u branky.
Několik záhonů 100 × 20 u leží uvnitř jednoho většího pozemku se společným nízkým obvodovým plotem. Jedna branka navazuje na podélnou pěšinu; krátké vnitřní cestičky propojují záhony. Cestičky vycházejí ze vstupní cesty za brankou a i na nerovném terénu zůstávají celé uvnitř plotu. Plot ani pěšiny nepřecházejí kolej.
Nad střechami pomalu plynou mraky a obyvatel občas zamává z vlastní zahrady.

| Zóna           | Objekty                                                      | Počet                          | Vztahy a závislosti                | Zakázáno               |
| -------------- | ------------------------------------------------------------ | ------------------------------ | ---------------------------------- | ---------------------- |
| far            | Pozadí hostitele                                             | Souvislé                       | Pole přecházejí do střech          | Okamžitá městská stěna |
| back 0,30–0,85 | `back.house-a/b/c`, `tree.apple`                             | 2–4 domy, 2–5 stromů           | Každý dům u cesty na suché parcele | Dům v oblouku silnice  |
| bank           | Geometrie meze, `near.grass-b`                               | 1 pás                          | Volný železniční koridor           | Zahrada uvnitř koleje  |
| near 0,30–0,80 | NEW: záhon 100 × 20 u; `near.bush`, `animal.cat`, úplný plot | 2–4 záhony, 1 kočka, 1–2 ploty | Branky navazují na pěšiny          | Izolované plotové díly |

## VI-02 — Náves s lípou

Za zadní řadou střech se zvedá věž malého kostela nebo kaple.
Domy lemují nepravidelnou náves, kolem níž prochází místní silnice.
Uprostřed je lípa, lavička a dost volného prostoru, aby se obraz neslil.
Mezi návsi a kolejí leží cesta a travnatý odstup.
V popředí pokračují zahrádky a nízký plot, nikoli další řada vysokých domů.
Nad návsí proletí ptáci a dva lidé si občas vymění klidné gesto.

| Zóna           | Objekty                                         | Počet                         | Vztahy a závislosti                  | Zakázáno                        |
| -------------- | ----------------------------------------------- | ----------------------------- | ------------------------------------ | ------------------------------- |
| far            | Seskupené střechy hostitele                     | 1 skupina                     | Tlumená zadní vrstva                 | Druhý kostel vedle prvního      |
| back 0,30–0,85 | `back.house-a/b/c`, `tree.linden`, `back.bench` | 5–8 domů, 1 lípa, 1–2 lavičky | Kolem jedné návsi s přístupy         | Stejná fasáda třikrát za sebou  |
| back 0,65–0,90 | `back.church` nebo NEW: kaple 70 × 100 u        | Nejvýše 1 v celé vsi          | Na vlastní parcele u návsi           | Náboženská stavba v každé části |
| bank           | Geometrie meze                                  | Souvislá                      | Oddělení veřejného prostoru od trati | Lidé na kolejích                |
| near 0,35–0,80 | `near.bush`, záhony VI-01, úplný plot           | 2–4 skupiny                   | Přední zahrady, volný pás vlaku      | Vysoké fasády před vlakem       |

## VI-03 — Autobusová zastávka a malé hřiště

V dálce pokračují střechy a koruny stromů stejné vesnice.
Za tratí je autobusová zastávka u silnice a malé oplocené hřiště.
Přístřešek stojí vedle jízdního pruhu, takže autobus nezakrývá nástupištní prostor.
U koleje zůstává mez bez pěší zkratky přes pražce.
V popředí sedí pes za plotem a nízké keře rámují volný výhled.
Autobus občas přijede a odjede, zatímco houpačka se pod světlou oblohou jen mírně pohupuje.

| Zóna           | Objekty                                          | Počet             | Vztahy a závislosti           | Zakázáno                         |
| -------------- | ------------------------------------------------ | ----------------- | ----------------------------- | -------------------------------- |
| far            | Střechy a hostitelské kopce                      | Souvislé          | Navazuje na náves             | Nový biom kvůli hřišti           |
| back 0,65–0,98 | NEW: přístřešek 60 × 45 u, autobus 100 × 40 u    | 1 + 0–1           | Záliv a průjezdná silnice     | Autobus mimo cestu               |
| back 0,55–0,85 | NEW: malé hřiště 140 × 70 u; `back.person-a/b/c` | 1 celek, 2–4 lidé | U pěšiny, oplocené od dopravy | Hra na vozovce                   |
| bank           | `near.grass-a`                                   | 3–5/1 024 u       | Volný odstup                  | Přechod přes koleje bez přejezdu |
| near 0,35–0,80 | `animal.dog`, `near.bush`, úplný plot            | 0–1 pes, 2–4 keře | Pes uvnitř zahrady            | Rozběh psa k lokomotivě          |

## VI-04 — Poslední domy a obecní cesta

Hustší střechy zůstávají vzadu a před vesnicí se znovu otevírá krajina.
Za tratí stojí několik posledních domů a malý statek.
Silnice se stáčí k polím nebo k řádně rezervovanému přejezdu.
U koleje ubývá oplocení a přibývá trávy.
Před vlakem jsou poslední záhony, nízké balíky a traktor na vlastním příjezdu.
Z komína může stoupat jemný kouř a nad otevřenými poli se znovu ukazuje více oblohy.

| Zóna           | Objekty                                    | Počet                 | Vztahy a závislosti              | Zakázáno                     |
| -------------- | ------------------------------------------ | --------------------- | -------------------------------- | ---------------------------- |
| far            | Pozadí hostitele, ubývající střechy        | Souvislé              | Viditelný návrat do krajiny      | Ostrá svislá hranice         |
| back 0,30–0,80 | `back.house-a/b/c`, `back.farmhouse`       | 2–4 domy, 0–1 statek  | Napojené na pokračující silnici  | Cesta končící pod domem      |
| bank           | Geometrie meze, případně vlastněný přejezd | 1 koridor             | Přejezd pouze v plánovaném slotu | Nové křížení kvůli dekoraci  |
| near 0,35–0,80 | `back.tractor`, `back.haybale`, úplný plot | 0–1 stroj, 1–3 balíky | Traktor na suchém příjezdu       | Stroj v železniční rezervaci |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                                  | Reakce na vlak; cooldown      |
| ----- | ------------------------------------------------------------------- | ----------------------------- |
| VI-01 | Člověk projde zahradou po 20–40 s, kočka se protáhne                | Jeden obyvatel zamává; 16 s   |
| VI-02 | Dva lidé se pohnou v různých fázích, koruna lípy se lehce hýbe      | Jeden člověk nebo ptáci; 20 s |
| VI-03 | Autobus stojí 6–12 s mimo konflikt, další návštěva nejdříve za 35 s | Pes zvedne hlavu; 16 s        |
| VI-04 | Traktor projede příjezdem, za chladu kouří jeden komín              | Zemědělec zamává; 16 s        |

Autobus je součást stávajícího silničního provozu; vlastní činnost nesmí obejít čekání u přejezdu.
Lidé se pohybují po návsi, chodníku a zahradách; nepotřebují obecnou navigaci ani cestu přes kolej.

## Profil a sezóny

Vesnické jádro má cílový absolutní sklon 0–0,03, náves a případná stanice dostávají rovné místo.
Výška se přebírá z hostitelské krajiny; vesnice na svahu může mít terasované parcely za tratí.
Jaro: kvetoucí ovocné stromy, nové záhony, lidé na návsi.
Léto: plné zahrady, klidné hřiště a otevřená vrata statku.
Podzim: sklizené záhony, barevná lípa, listí pouze u listnáčů.
Zima: sníh na skutečných střechách a plotech, prošlapané cesty a kouř z několika komínů.
V zimě může traktor s radlicí čistit příjezd; hřiště má klidnou variantu bez letního ruchu.

## Zvuky a nové kresby

Použít luční ptáky, vítr, psa a kočku; u návsi tlumené lidské okolí bez srozumitelných dialogů.
Nové audio: autobus na volnoběh a jemné obecní okolí; kostelní zvon není automatický opakovaný efekt.
NEW: záhon 100 × 20 u; nízké zeleninové řádky se sezónními variantami.
NEW: kaple 70 × 100 u; omítaná česká kaplička s jednoduchou střechou.
NEW: přístřešek 60 × 45 u a autobus 100 × 40 u; civilní podoba bez značek a obličeje.
NEW: hřiště 140 × 70 u; oddělený díl houpačky, bez vysokých atrakcí.
Mávací pózy lidí a sněhové střechy jsou sdílené se stanicemi a společným katalogem.

## Implementační řez D-024

Velká vesnice má 6 144 u: dva chunky příjezdu VI-01, dva návsi VI-02 a dva odjezdu VI-04 s autobusovou zastávkou a hřištěm VI-03. Jedna identita osady spojuje obecní cestu a přístupy. Cesta smí vytvořit pojmenované napojení na silnici existujícího plánovaného přejezdu za tratí; žádné nové křížení koleje nevzniká. Na skutečném začátku a konci odchází zúžením do zadního horizontu; přední pěšina se tam během posledních 160 u zúží do louky a končí v bodě. Řeka ji rozdělí na kusy zúžené před oběma břehy. Obecní cesta přejde potok po malém silničním mostě s kamennou mostovkou a nízkým zábradlím, místo aby se na březích usekla. Náves je nepravidelná plocha, kaple je pouze v prvním chunku středu. Typ domu se vybírá z pěti fasád podle pořadí parcely, se seedovaným posunem; sousední domy neopakují typ. Větší stanice má přednost před dekorací. Autobus čeká v samostatném silničním zálivu u přístřešku; v tomto řezu nepřijíždí přes přejezd. Houpačka se mírně pohybuje, v zimě stojí. Záhony vybírají spring/summer/autumn/winter z efektivního kontextu místa; každý zahradní celek má celý nízký plot s brankou a vlastní podporu.

## Oprava kompozice settlements-2

Náves VI-02 se plánuje jednou pro celý dvouchunkový obraz, před domy. Její nepravidelný obvod vede společnou silnici; parcely s přístupy ji obklopují. Hustota přijatých domů ve středu převyšuje oba okraje. Zahrady domů leží vedle jejich skutečné parcely nebo za ní. Přední záhony tvoří společnou zahrádkářskou skupinu s nízkou podélnou pěšinou a napojenými brankami; žádná pěšina nepřekračuje kolej. Přijaté budovy a přístupy rezervují místo dalším parcelám. Při konfliktu hlavní cesty se zkouší menší kompozice na bezpečném přístupu.

Objížďka překážky mění ulici jen uvnitř chunku a plynule se vrací na kanonické hraniční body. Vstup i výstup osady zůstávají přesně na bodech exportovaného plánu; před přijetím se kontroluje celý polygon vozovky včetně návratových ramen.
