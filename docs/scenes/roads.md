# Silnice a provoz podél koleje

Kontrakt RD-01 až RD-03 pro [akceptaci](acceptance.md); technická volba je D-029.
Silnice jsou motiv uvnitř krajiny, nikoli nový biom. Vše probíhá v hlavním pohledu,
bez navigace, úkolu nebo nové obsluhy dopravy.

## RD-01 — Souběžná okreska

Za tratí v nezastavěných scénách venkova a podhůří vede dvoupruhová okreska.
Sleduje výškový profil, ale odstup od koleje se pomalu mění; celá vozovka i
pohybové obálky aut zůstávají mimo kolejový koridor. Dva lehké proudy aut
jedou opačnými směry v oddělených pruzích. Čelo se řídí vlastní světovou
rychlostí, nikoli kamerou. Kola se otáčejí a při pohybu vzniká drobný výfuk.
Ve stání se čelo nepřeklápí, kola ani výfuk nepokračují; pauza zastaví činnosti.

Úsek přesahuje technický chunk, na společném řezu sdílí identitu, střed,
šířku i tečnu. Skutečný příjezd a odjezd se přes dlouhé oblouky vzdalují za
zadní terén/horizont. Asfalt nekončí příčnou hranou uprostřed pohledu. Vykreslení ho ořezává podle
místního profilu zadního terénu, nikoli obdélníkového okraje pečené textury.
Úsek se vynechá v bloku s druhou kolejí: její skutečné portálové kopce
přesahují i do sousedních slotů a mají přednost před dekorativní dopravou.
Auta se obracejí jen ve své dekorativní patrole; nejde o dopravní navigaci.
Nesmějí přeskakovat mezi chunkovými fragmenty ani ztratit cestu pod koly.

## Vlastnictví ulic osady — amendment 13

Uvnitř plánových scén vesnice, města, předměstí a staničního předprostoru
vlastní ulice a přístupové cesty linka settlements. Platí i pro aktuální
autoritativní celé intervaly `settlementStreetPlan()` (vesnice/předměstí/město)
a stanici vybranou nad scénou world-core.
Okreska ani dálnice tam nemají geometrii, auta či rezervaci. Část úseku
zabraná osadou se vynechá; před hranicí se oba koncové oblouky vrátí za
terén a po osadě smí infrastruktura pokračovat v dalším vhodném úseku.
Celé obálky vozovky a dálničního odstupu zůstanou vně vlastněného span.
Fyzické napojení není součástí tohoto řezu, spoj zůstává `terrain-hidden`:
`settlementConnections` pojmenuje osadu, její hranici a skrytý světový bod
konce okresky 96 u vně intervalu. ID a hranice odpovídají sdílenému
plánu osady; `roadEnd` je samostatný bod, nikoli endpoint hlavní ulice. Nejde o hotový sjezd ani falešnou viditelnou slepou odbočku.
Přejezdové silnice dál vlastní výhradně D-021.

## RD-02 — Přejezd a vesnická cesta

Kde plán dovolí, okreska protíná zadní rameno existující přejezdové silnice.
Vzniká čitelná spojnice k obci a dál přes přejezd, ne náhodná slepá odbočka.
Asfaltové plochy tvoří společnou křižovatku; krajnice a okrajové čáry
neprocházejí přes ústí okresky. Stopčáry a geometrie provozu se nemění.
Křížení koleje vlastní výhradně plánovaný přejezd: společný bod koleje,
desky, silnice, závor a pruhů. Okreska se nepřibližuje do konfliktu s vlakem.
Vesnické místní cesty zůstávají stávajícími cestami s doloženou podporou domů.
Přejezdová auta dál čekají na svou stopčáru; závory se otevřou až po posledním
vagonu všech relevantních vlaků. Barva auta ani směr nejsou závislé na vlaku.

## RD-03 — Vzdálený dálniční úsek

Vzácně ve venkově vede za okreskou vzdálenější dálnice. Kandidát je
v prvních dvou chunkech třetího bloku regionu, za vesnicí a před přechodem;
celoměstský region vlastní osada, proto v něm dálnice nevzniká.
Nejvýše jeden kandidát v regionu zachovává pravděpodobnost 1/4 a
vyloučení stanic i jejich odstupů. Dálnici tvoří
dvě samostatné vozovky, každá se dvěma pruhy, odděluje viditelný zelený
středový pás. Pozvolné oblouky leží na nízkém náspu v zadním pásmu.
Celá kresba obytné budovy (i statku/rodinného domu, řadového nebo
bytového domu) a přilehlé stodoly musí zůstat alespoň 20 u od vnější hrany vozovky;
dálnice nikdy nenahrazuje místní přístupovou cestu vesnického domu.
Je to jeden úsek v regionu, ne přepnutí krajiny. Kombinovaný průchod seedů
0–19 × chunků 0–479 má 14 dálničních fragmentů z 9600 (0,1458 %),
7 z 240 regionů (2,92 %); žádný obrys ani rezervace nevstupuje do osady.
Lokátor seedu 1 míří na x 16896, za vesnici `[8192, 14336)`;
krátký vlak začíná 140 u za tímto bodem, aby dálnice ležela u středu
46% kamery, nikoli teprve na pravém okraji výřezu.
Lehký dekorativní provoz používá stejnou rychlost a orientační kontrakt jako
auta na ostatních silnicích; vzdálenější auta jsou menší. Začátek a konec
odcházejí plynule za terén, přes vnitřní chunky silnice pokračuje.
Bez náhodných sjezdů, nefunkčních křižovatek, textů, značek nebo nových zvuků.

## Vrstvy, klima a životní cyklus

Obě silnice leží v zadní vrstvě pod rekvizitami, auta ve své hloubce;
nikdy nezakrývají soupravu. Suchá vozovka funguje v létě i zimě, nezavádí
vlastní počasí. Bez nové bitmapy nebo externího assetu; využívá asfalt,
existující vektorová auta a malé kreslené pohybové detaily. Žádné nové audio.
Fragment, auto, jeho kola, výfuk a diagnostika patří chunkovému rendereru
s existujícím cleanupem. Činnosti čtou simulační čas, ne čas kamery.

Vývojářský překryv Silnice ukazuje zvlášť světovou rychlost (azurová) a
transformovaný předek assetu (oranžová). Při stání zůstane oranžový směr,
azurová šipka má nulovou délku. Lodní kontrakt označuje příď směrem +x SVG;
symetrický trup není důkaz opačného směru. Ověření zahrnuje všechny varianty,
oba směry, oba pruhy, svahy, zastavení a opětovný rozjezd. Směr se ověřuje
nezávislým rozdílem světových poloh stejného ID mezi snímky, také při pohybu
kamery. Vzorek přes okamžik obratu se označí změnou čela a ověří se sousední
kroky před i po něm; nula sama směr neurčuje.

Regresní sonda se stojící kamerou obnoví seed 123 před známým obratem
patroly chunku 3 (tick 128). Krátká souvislá okna běžného pohybu a obratu
čtou pouze `__vlacek.roadMotion()` — simulační tick, světové polohy a
transformovaná čela rendereru. Nevytvářejí úplný diagnostický snapshot
v každém snímku. Každé okno vyžaduje přes 100 nezávislých pohybových
pozorování; obrat musí mít měřený krok před i po změně směru. Lokátor,
vývojářské menu a šipky mají vlastní test. Přejezdový test dál ověřuje
oba přístupy, čekání, rozjezd a kameru pohybující se nezávisle na autě.
Opakovaný render téhož simulačního ticku musí mít totožnou polohu i čelo;
obrat se pak ohraničí sousedními skutečnými simulačními kroky, nikoli
nulovým rozdílem dvou prezentací stejného ticku.
