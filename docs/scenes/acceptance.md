# Akceptace textového katalogu scén

Tento soubor definuje očekávané výsledky implementace.
Generátorové kontroly pracují s logickými objekty, jejich rozsahem a vztahy; obrazové kontroly ověřují výslednou čitelnost.
Úspěšný test descriptoru sám nepotvrzuje, že krajina skutečně vypadá hustě, že je vidět traktor nebo že vlak zůstává rozpoznatelný.

## Společné podmínky

| ID      | Strojově ověřitelný výsledek                                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| SCN-G01 | Region obsahuje 3–7 celých bloků po 8 192 u; zastavení ani simulační čas nemění jeho typ, interval nebo sezónu.                         |
| SCN-G02 | Stejný seed a verze dávají stejné scény, závislosti a statické umístění při vzestupném, sestupném i náhodném pořadí dotazů na chunky.   |
| SCN-G03 | Každé ID má jednoho logického vlastníka; renderovací fragmenty nevytvářejí další mlýn, portál, plot nebo výpravčího.                    |
| SCN-G04 | Půdorysy budov, kmenů a zařízení nezasahují do nepovolených rezervací kolejí, silnic, přejezdů, nástupišť a portálů.                    |
| SCN-G05 | Každý záměrný překryv má konkrétní vztah a podporující objekt: most–tok, kolo–náhon, rákosí–břeh, nástupiště–stanice.                   |
| SCN-G06 | Přípustnost se vyhodnocuje pro celý půdorys a pohybový obal uvnitř podzóny, také v přechodových chunky.                                 |
| SCN-G07 | Žádný `near` dekorativní objekt ani jeho animace neprotne chráněný pás soupravy; tunel je samostatně pojmenovaná výjimka.               |
| SCN-G08 | Plot má jeden skutečný začátek a konec, případné branky a souvislé panely; chunková hranice nevytváří další konec ani zdvojený sloupek. |
| SCN-G09 | Silnice, břehy, lesní pásy a nástupiště sdílejí hraniční geometrii; jejich pokračování nezávisí na přítomnosti aktéra.                  |
| SCN-G10 | Volitelné umístění používá nejvýše osm pokusů; neplatný celek nezanechá závislé děti a nespadne do neomezeného seznamu dekorací.        |
| SCN-G11 | Povinné motivy mají rezervované místo; generátor nesplnění jejich garance hlásí jako chybu testu, nikoli jako úspěšné vynechání.        |
| SCN-G12 | Všechny číselné profily dodržují `abs(grade) ≤ world.maxTrackGrade` a absolutní výškový limit; výška i sklon navazují na hranicích.     |

SCN-G06 navíc chrání oblé travnaté konce předních podpor bez hrotů a travnatou mezeru mezi sousedy.

U vody a pohybových obalů se ověřuje celý koridor; několik náhodně vybraných bodů není úplný důkaz containmentu.
U vizuálního obalu se zahrnuje měřítko, pivot, zrcadlení, náklon, reakční skok, rameno i maximální rozsah částic.
Krajinné rozsahy výšek platí pro jádro regionu; přechody musí navazovat a nesmějí geometrii useknout.

## Venkov

| ID       | Očekávaný výsledek                                                                                                                       |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| SCN-CR01 | Každý region `countryside` obsahuje CR-01 s traktorem v `near` nejpozději 12 288 u od začátku regionu.                                   |
| SCN-CR02 | Povinný traktor zůstává přítomen i v letní sklizňové variantě, kde může pracovat v navazujícím pruhu; v zimě má radlici a čistí příjezd. |
| SCN-CR03 | Povinná pracovní scéna má pole za tratí i před ní; celá dráha stroje a nářadí leží na příslušném poli nebo zimním příjezdu.              |
| SCN-CR04 | Region vedle CR-01 obsahuje alespoň dvě různé scény z CR-02 až CR-06 a alespoň jeden klidnější úsek dlouhý 512 u.                        |
| SCN-CR05 | Sad má řady stromů, přístup a bedny; statek společný dvůr; napajedlo leží uvnitř pastviny se zvířaty.                                    |
| SCN-CR06 | Sklizeň, lisování, orba a zimní úklid odpovídají presetu; kombajn ani letní obilí nevzniknou ve sněhu.                                   |
| SCN-CR07 | Případný pohyb přes trať patří silničnímu automatu přejezdu, nikdy obecnému patrolu traktoru.                                            |

## Velká vesnice

| ID       | Očekávaný výsledek                                                                                                                        | Stav settlements-3                                                                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| SCN-VI01 | Testovací kompozice velké vsi měří 6 144 u podle D-024 a obsahuje příjezd VI-01, střed VI-02 a odjezd VI-04.                              | OVĚŘENO: pořadí a délka plánových scén                                                                          |
| SCN-VI02 | V hustším středu je více domů na 1 024 u než na obou okrajích; alespoň jedna varianta obsahuje VI-03.                                     | ČÁSTEČNĚ: geometrie jediné návsi a přijatá hustota v regresním seedu; celá vizuální/sezónní matice zbývá        |
| SCN-VI03 | Každý obytný dům má suchou parcelu a dosažitelný přístup z obecní cesty; přístup není přímka skrz jiný dům.                               | OVĚŘENO: geometrické parcely/přístupy, kolize, suchý podklad a kanonické napojení i při objížďce (seed 1 / 8–9) |
| SCN-VI04 | Celá vesnice má nejvýše jeden kostel nebo kapli; sousední trojice domů neopakuje stejnou kombinaci fasády a střechy.                      | ČÁSTEČNĚ: kaple a různé fasády; celá sezónní matice střech zbývá                                                |
| SCN-VI05 | Autobus D-024 čeká ve vlastním zálivu u přístřešku mimo jízdní konflikt; hřiště je oddělené od silnice a koleje.                          | ČÁSTEČNĚ: stojící autobus, napojený záliv, oddělené hřiště; příjezdy/odjezdy zbývají                            |
| SCN-VI06 | V každém úplném dvanáctiregionovém itineráři existuje alespoň jedna velká vesnice v `countryside` nebo `foothills`.                       | OVĚŘENO: plánové itineráře                                                                                      |
| SCN-VI07 | Přední zahrádky mají jeden společný uzavřený plot, branku napojenou na pěšinu a 2–4 záhony 100 × 20 u uvnitř pozemku s vnitřními cestami. | OVĚŘENO: geometrie, mutační testy; čtyři záhony (seed 1 / 8), cesty uvnitř plotu (1 / 246)                      |

## Město

| ID       | Očekávaný výsledek                                                                                                           | Stav settlements-3                                                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SCN-TO01 | Region `town` obsahuje předměstí TO-01, hustší ulici TO-02 a alespoň jednu scénu TO-04 nebo TO-05.                           | OVĚŘENO: vlastní předměstí/ulice/park/areál; běžný celý TO-01 má 6–10 přijatých domů (seed 6 / 78–79) |
| SCN-TO02 | Před hustým středem a po něm existuje prostorový pokles hustoty; město nepřeskočí přímo do holého pole v jediném chunku.     | ČÁSTEČNĚ: pěšina končí zúžením na okraji, u dvora i u řeky (seed 6 / 79, 0 / 28–29); matice zbývá     |
| SCN-TO03 | Každý městský region obsahuje park TO-03 nebo jiný jeho explicitně navržený klidnější průchod, nikoli další náhodnou fasádu. | OVĚŘENO: plán obsahuje park                                                                           |
| SCN-TO04 | Budovy mají cesty a suché parcely; samostatné vysoké městské budovy nevznikají v `near`.                                     | OVĚŘENO: přístupové rezervace a výška vrstev                                                          |
| SCN-TO05 | Sklad, pila a jeřáb mají pracovní obal uvnitř areálu; žádný náklad nepřechází nad hráčovou kolejí.                           | ČÁSTEČNĚ: sklad/pila a materiál jsou uvnitř dvora; jeřáb/dopravní činnost zbývají                     |
| SCN-TO06 | Dálniční varianta je nejvýše jednou v regionu, má souvislou geometrii a používá společná pravidla orientace vozidel.         | OTEVŘENO: dopravní linka                                                                              |

## Les

| ID       | Očekávaný výsledek                                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCN-FO01 | Každý region `forest` obsahuje husté jádro FO-02 dlouhé alespoň 2 048 u a nejméně dvě další různé lesní scény.                                                                                                                                                 |
| SCN-FO02 | Husté jádro má dva sezónní atlasové zadní pásy a 12–20 bližších kmenů v překrývajících se skupinách za čistým koridorem; před ním souvislý kreslený nízký okraj. Promítnuté skupiny překrývají průhledné lemy přes technické švy; skutečné konce jsou plynulé. |
| SCN-FO03 | Přední les tvoří nízký pás nebo mladé stromky; žádná dospělá koruna ani kmen nepřekrývá vlak.                                                                                                                                                                  |
| SCN-FO04 | V alespoň jednom lesním regionu každého úplného itineráře je FO-04 s harvesterem, vyvážečkou, cestou a skládáním klád.                                                                                                                                         |
| SCN-FO05 | Kmen zůstává v úchopu nebo na loži během 32s cyklu; úplný obal ramen i kmene nezasahuje kolej, člověka, auto ani druhý stroj.                                                                                                                                  |
| SCN-FO06 | Cesta vyvážečky spojuje pracovní kapsu a skládku; nákladní auto stojí na přístupové cestě, ne uvnitř hromady klád.                                                                                                                                             |
| SCN-FO07 | FO-05 má propojený potok a břeh; žába ani lávka nezůstanou po odmítnutí vody osamocené.                                                                                                                                                                        |
| SCN-FO08 | Listí vzniká u listnáčů nebo listové půdy; jehličnany samy nevytvářejí široké podzimní listy.                                                                                                                                                                  |

## Jezera a řeky

| ID       | Očekávaný výsledek                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| SCN-LA01 | Každý region `lakes` obsahuje jednu LA-01 se 3–5 záměrně seskupenými rybníky alespoň tří odlišných tvarových/velikostních kombinací. |
| SCN-LA02 | Mezi rybníky jsou skutečné hráze, suché mezery, pole nebo les; nejde o dotýkající se kopie téhož oválu.                              |
| SCN-LA03 | Mimo označený rybniční soubor mají středy dominantních rybničních scén rozestup alespoň 3 072 u.                                     |
| SCN-LA04 | Každý mlýn má tekoucí přítok, náhon, odtok, kontakt kola s kanálem a suchý přístup.                                                  |
| SCN-LA05 | Mlýn je nejvýše jeden v regionu a nejméně 8 192 u od jiného mlýna, i přes hranici regionů.                                           |
| SCN-LA06 | Celé pohybové obaly kachen, lodí a přívozu leží v jejich konkrétní vodě; přívoz má dva dosažitelné přístupy.                         |
| SCN-LA07 | Sladkovodní pláž sousedí s jedinou odkazovanou vodní plochou; uvnitř pláže nevzniká další náhodný rybník.                            |
| SCN-LA08 | Zimní preset nemá rybáře, plážové hračky ani aktivní přívoz; případné kachny zůstávají na otevřené vodě.                             |

## Podhůří

| ID       | Očekávaný výsledek                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| SCN-FH01 | Region obsahuje nejméně tři různé obrazy FH-01 až FH-04, včetně otevřené louky a údolního nebo skalního motivu.               |
| SCN-FH02 | Jádro dosahuje převýšení alespoň 260 u a obsahuje souvislé stoupání i klesání; jednotlivé výrazné svahy mají alespoň 1 024 u. |
| SCN-FH03 | Cílová výška zůstává v rozsahu −260 až +260 u, běžné sklony 0,04–0,09 a místní maximum nejvýše 0,10.                          |
| SCN-FH04 | Domy stojí na parcelách, nejsou natočené jako vozidla podle sklonu koleje.                                                    |
| SCN-FH05 | Lanovka má souvislé lano a krajní stanice; kabina neopouští jejich trasu.                                                     |
| SCN-FH06 | Bagr i sáňky mají bezpečný pohybový obal; sáňky končí daleko od dopravy a nejsou přítomné v létě.                             |

## Hory

| ID       | Očekávaný výsledek                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------- |
| SCN-MO01 | Každý horský region obsahuje stoupání MO-01, otevřené sedlo MO-02 a alespoň jeden strukturální motiv MO-03 nebo MO-04. |
| SCN-MO02 | Jádro má rozdíl maxima a minima alespoň 500 u a nejvyšší místo nejméně +300 u, při cílovém rozsahu −380 až +380 u.     |
| SCN-MO03 | Obsahuje alespoň jedno stoupání a jedno klesání dlouhé nejméně 1 536 u s absolutním sklonem 0,08–0,12.                 |
| SCN-MO04 | Kromě svahů existuje alespoň jedna rovina dlouhá 768 u; profil není pravidelně opakovaná vlna.                         |
| SCN-MO05 | Křivka zůstává spojitá a v globálních limitech také u portálů, viaduktů a hranic bloků.                                |
| SCN-MO06 | Horské presety jsou pouze léto a zima; zimní tunel nemá letní zelenou květovanou hmotu.                                |

## Pobřeží

| ID       | Očekávaný výsledek                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| SCN-CO01 | Moře má souvislé hraniční vzorky přes všechny pobřežní chunky včetně stanice a přístavu.                     |
| SCN-CO02 | Pobřežní pláž neobsahuje `near.pond`, sladkovodní rybníky, jejich hráze ani osamocené vnitrozemské ostrůvky. |
| SCN-CO03 | Region obsahuje otevřenou pláž CO-01 a alespoň dvě další různé pobřežní scény.                               |
| SCN-CO04 | Maják je nejvýše jeden v regionu a patří přístavu nebo konkrétnímu mysu na suché ploše.                      |
| SCN-CO05 | Lodě zůstávají na moři a mimo mola či skály; jejich příď odpovídá vlastnímu světovému pohybu.                |
| SCN-CO06 | Existuje suché písečné popředí bez vody, ale moře nezaniká kvůli technické hranici chunku.                   |
| SCN-CO07 | Preset negeneruje sníh, sladkovodní vážky ani podzimní listové zdroje nad otevřeným mořem.                   |

## Duny

| ID       | Očekávaný výsledek                                                                                                               |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| SCN-DU01 | Region obsahuje DU-01 i DU-02 a nejméně jeden klidný otevřený písečný úsek dlouhý 1 024 u.                                       |
| SCN-DU02 | Povolený obsah tvoří písek, borovice, vřes, suchá tráva, kameny a místní cesty; kaktusy, palmy, velbloudi a oázy jsou vyloučené. |
| SCN-DU03 | Mušle a mořské vybavení nepřesahují celým půdorysem do vnitrozemské dunové podzóny.                                              |
| SCN-DU04 | Duny sousedí pouze s pobřežím nebo venkovem přes suchý prostorový přechod.                                                       |
| SCN-DU05 | Písečný poryv zůstává přízemní a omezený; nevytváří clonu přes vlak ani UI.                                                      |
| SCN-DU06 | `dunes` používá vlastní suchý preset, nikoli automatické čtyři sezóny.                                                           |

## Stanice

| ID       | Očekávaný výsledek                                                                                                                                | Stav settlements-3                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SCN-ST01 | První garantovaná stanice má nejméně 448 u použitelné roviny ve správném slotu; přechodová ramena se nezapočítávají.                              | OVĚŘENO: R3 a použitelná rovina                                                                |
| SCN-ST02 | Katalog a testovací presety obsahují délky malé 448 u použitelné (480 u celkové), střední 1 216 u a velké 2 368 u.                                | OVĚŘENO: tři délky a přednádraží                                                               |
| SCN-ST03 | Velké nástupiště je delší než maximální podporovaná souprava a má právě jeden skutečný začátek a konec.                                           | OVĚŘENO: délka, díly, jeden vlastník a nízká servisní cesta zúžená na obou koncích             |
| SCN-ST04 | Celá použitelná platforma má nulový sklon a navazuje na stejnou geometrii, po níž jedou vozidla.                                                  | OVĚŘENO: celý interval po 8 u                                                                  |
| SCN-ST05 | Budovy mají přístup, autobus silnici a lidé bezpečný nástupištní prostor; nikdo nevstupuje na kolej.                                              | ČÁSTEČNĚ: suchý přístup a geometrie osob; společný pohyb/integrovaná doprava zbývají           |
| SCN-ST06 | Kosmetický StationReaction D-024 průjezd ani rozjezd nezablokuje; zastávková scénka respektuje 4 u/s, 0,5 s a cooldown 12 s, bez vazby na náklad. | ČÁSTEČNĚ: logický automat a volný odjezd; viditelný pozdrav a opakovaný cleanup view NEOVĚŘENO |
| SCN-ST07 | Při dotazu jen na prostřední chunk dlouhé stanice jsou správně dostupné její pokračování, vlastník a geometrie.                                   | OVĚŘENO: dotaz na prostřední chunk a query order                                               |

## Mosty a tunely

| ID       | Očekávaný výsledek                                                                                                          |
| -------- | --------------------------------------------------------------------------------------------------------------------------- |
| SCN-TB01 | Každý most odkazuje na existující tok, cestu nebo údolí a jeho opěry dosahují na vhodný terén.                              |
| SCN-TB02 | Loď nebo silniční aktér pod mostem má volný koridor mimo podpěry.                                                           |
| SCN-TB03 | Katalog obsahuje nízký kamenný most, ocelový most a vysoký viadukt; nelze je nahradit jediným zvětšeným spritem.            |
| SCN-TB04 | Tunel má právě dva skutečné portály, jednu identitu a souvislé neprůhledné těleso přes všechny své chunky.                  |
| SCN-TB05 | Existuje krátká varianta 448–768 u a dlouhá varianta alespoň 3 072 u, která přesahuje maximální soupravu.                   |
| SCN-TB06 | Tunelová stavba zůstává dostupná při dotazu na vnitřní chunk bez vlastnícího chunku a při části soupravy uvnitř.            |
| SCN-TB07 | Zakrytí respektuje konkrétní kolej a části vozidel hráče i NPC; jiný vlak ve stejném x se neskrývá bez prostorového důvodu. |
| SCN-TB08 | Částice již emitované před portálem ani nové částice neprosvítají horninou; venkovní sněžení dál pokračuje.                 |
| SCN-TB09 | Elektrická trasa má návazné vedení a potřebnou světlost v mostě, stanici i tunelu.                                          |

## Život, sezóny a výkon

| ID         | Očekávaný výsledek                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| SCN-LIFE01 | Při nulové rychlosti vlaku pokračují povolené ambientní aktivity; při pauze se jejich simulační stav neposouvá.                      |
| SCN-LIFE02 | Dvě různé instance stejného druhu nemají povinně shodnou fázi; přiblížení nespustí všechny reakce současně.                          |
| SCN-LIFE03 | Průjezdová reakce respektuje cooldown a nové přiblížení; stojící vlak nespouští mávání každý snímek.                                 |
| SCN-LIFE04 | Po opuštění a znovunačtení místa nevznikne dávka zmeškaných zvuků, neomezený počet aktérů ani duplicitní pracovní stroj.             |
| SCN-LIFE05 | Kolo mlýna, koruny, voda a jiné vizuální aktivity nezmění statický plán při přepnutí kvality nebo omezení efektů.                    |
| SCN-LIFE06 | Zimní víření od vlaku vyžaduje nenulovou rychlost a sníh pod konkrétním zdrojem; ambientní sněžení může pokračovat při stání.        |
| SCN-LIFE07 | Nízká kvalita zachová nosné objekty a jejich vztahy; omezuje vedlejší animace a výplň, nevymaže povinný traktor nebo most.           |
| SCN-LIFE08 | Dekorace, animované objekty, částice, lokální zdroje a audio hlasy dodržují společné rozpočty.                                       |
| SCN-LIFE09 | Uvolnění scény odstraní její renderovací objekty a zdroje; bezpečnost přejezdu ani kolej pod vlakem se neřídí samotnou viditelností. |
| SCN-LIFE10 | Pohybující se auta, traktory i lodě mají orientaci podle vlastní světové dráhy; změna kamery ji nepřeklápí.                          |

## Reprodukovatelné ověření

Každá místní scéna má cílený preset nebo dohledatelný seed a interval; všechny navržené varianty musí být dosažitelné.
Regionální garance se testují nad úplnými regiony, nikoli nad náhodným krátkým výřezem bez jejich jádra.
Počáteční generátorová sada použije seedy 1–500 a pro každý celý itinerář včetně přechodů mezi cykly.
Doplní záporné chunkové indexy, dotazy do středu dlouhých staveb a různé pořadí načítání.
Selhání vypíše seed, verzi generátoru, region, scénu, chunk, ID objektu a porušený vztah.

Regresní případy zahrnou dřívější mlýny u přejezdů 83/19 a 110/59, pobřežní přechod 2/31 a loď 10/27.
Dále zahrnou opakování rybníků seed 234, majáků seed 63, ploty přes hranice a přejezd seed 1226.
Po změně verze nemusí nové světy reprodukovat původní layout; zachová se také malá cílená fixture původní vadné kompozice.
Demonstrační světy 123 a 7 musí zachovat předepsané počáteční infrastrukturní motivy.
Testy aktivit používají explicitní simulační kroky a kontrolu celého cyklu, nikoli skutečné čekání.

## Obrazové a provozní kontroly

- Pole a traktor před vlakem jsou vidět při krátké i maximální soupravě; nejde pouze o platný objekt pod spodním okrajem.
- Velká vesnice má čitelný příjezd, náves a odjezd; město se pozná hustotou a typem zástavby.
- Hustý les působí souvisle za vlakem i pod jeho pásem, ale vlak a jeho kola zůstávají rozpoznatelné.
- Hory ukazují skutečné delší stoupání, sedlo a hlubší údolí, také při kameře sledující soupravu.
- Moře netvoří řadu rybníků, duny zůstávají suché a sladkovodní pláž patří své vodě.
- Podzim má skutečné listnaté varianty; zima správné střechy, stromy a terén tunelů.
- Dlouhá stanice a tunel fungují přes hranice chunků; tunel se ověří při vjezdu, úplném zakrytí, výjezdu a stání v portálu.
- Ověří se obě koleje, oba směry NPC, elektrická souprava a změna velikosti výřezu.
- Výkon se změří v městě, hustém lese, lesních pracích a zimě s nejdelší soupravou; rozpočty nejsou náhradou měření.
- Desktopová obrazová kontrola a emulace se vykážou odděleně od fyzického tabletu a konkrétního zařízení/firmwaru Tesla.

## Stav tohoto předání

Vznikl textový kontrakt scén nad aktuálním katalogem, projekcí, závazným plánem a auditními podklady; soubory nebyly zapsány ani commitnuty.
Vynecháno: implementace, běh testů a nové runtime snímky; fyzický tablet a Tesla jsou NEOVĚŘENO.
Riziko: nové hustoty, pracovní obaly a výraznější horský profil musí projít generátorovou i obrazovou akceptací, než se označí za hotové.

Řez farm-forest-2 prokazuje SCN-CR01/02/03/04 a SCN-FO01/02/03 regionovými,
geometrickými a obrazovými kontrolami. Pracovní část SCN-FO05/06 má celý 32s
renderovaný cyklus: oba stop stavy, směry, skutečné světové kontakty úchopu/loží,
kolové fáze a návrat. Farmové E2E: 12/12 Canvas/WebGL × krátká/nejdelší souprava;
původní world-diagnostics sériově 4/4. Úplná unit sada: 904/904, světový
validátor: 7 974 kompozic a regionové garance nad skutečným složením.
Headless WebGL neprokazuje 45 FPS bránu; fyzický tablet/Tesla zůstávají NEOVĚŘENO.
SCN-CR05 není dokončený dvůr/sad/napití. SCN-FO07 zahrnuje lávku na skutečném
potoku, žába a navazující břeh patří nature-water. SCN-FO08 a zimní listnáče
vlastní seasons-life; celý zimní les vyžaduje ověření po integraci. Nové audio
a večerní čas sovy zůstávají otevřené. Formát save se nemění.

Farm-forest-3 doplňuje SCN-FO02: promítnuté pokrytí a sdílené dlaždice seedu 1 na
švu 64/65, plynulý skutečný výstup a ukončení u stanice (seed 2 / chunk 33).
SCN-CR01/FO02 doplňují pixelové regrese Canvas/WebGL na potoku, přejezdu a pracovní
pasece, včetně zákazu varování nepodporované masky a kontroly uvolnění statických
textur při opakovaných lokátorech. Výkonová brána se posuzuje zvlášť pro standard
(45 FPS) a low (medián 30 FPS, p95 nejvýše 50 ms), nikoli z nastavení auto.
Otevřené části CR05/FO07/FO08, nové audio a večerní sova se tímto nerozšiřují.
