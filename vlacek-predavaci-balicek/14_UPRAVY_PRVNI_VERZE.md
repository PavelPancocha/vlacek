# Úpravy první verze vláčkové hry: souprava, kamera, grafika a živý svět

Pracuješ na existující první verzi browserové vláčkové hry pro malé dítě. Nezačínej nový projekt a nepřepisuj bez důvodu fungující části. Projdi současnou implementaci a uprav ji podle následující zpětné vazby.

Spolu se zadáním dostáváš grafické referenční listy: celkový styl, lokomotivy a vagonky, venkov, les, nádraží a vesnice, železniční infrastruktura, voda a hory, pobřeží, vegetace, terénní moduly a atmosférické varianty.

**Cílem této iterace je správně zobrazený, celý viditelný vlak a výrazně lepší vizuální zážitek. Ne další herní systémy nad prototypovou grafikou.**

Toto zadání má při rozporu přednost před starší specifikací a ilustracemi. Zejména již neplatí požadavek na stovku vagonků za cenu toho, že souprava zmizí mimo obrazovku. Některé reference mohou obsahovat vlak otočený opačně, nevhodné UI nebo nesprávné popisky. Přebírej z nich výtvarný styl, ne tyto chyby ani nové herní mechaniky.

## 1. Oprav sestavování a směr soupravy

Nynější chyba: při přidávání se vagonky skládají před lokomotivu.

**Hráčův vlak jezdí zleva doprava. Lokomotiva je vpředu vpravo, čelem doprava. Vagonky jsou připojené za ní směrem doleva.** Nový vagonek přidávej na konec soupravy, nikoli před lokomotivu nebo mezi již připojené vozy.

```text
[konec: vagonek 3]—[vagonek 2]—[vagonek 1]—[lokomotiva →]    směr jízdy →
```

Stejné pořadí, orientace a rozestupy musí platit v depu, při náhledu, po vyjetí i po obnovení uložené hry. Vagonky se nesmějí překrývat ani odpojovat. Použij jednu společnou logiku soupravy pro depo i jízdu, ne dvě implementace s opačnými souřadnicemi.

Případné zrcadlení grafiky nesmí obrátit české nápisy. Čitelné cedule a označení řeš odděleně od zrcadleného podkladu.

## 2. Celý vlak musí být vidět; podle toho omez jeho délku

Nynější chyba: po stisknutí „Vyjeď“ vlak není vidět. Oprav skutečnou příčinu: ověř počáteční souřadnice, umístění kamery, měřítko, vrstvy i existenci tratě pod celou soupravou.

**Od prvního vykresleného snímku po vyjetí musí být vidět lokomotiva i poslední vagonek.** Totéž platí během jízdy po rovině, ve stoupání, při zastavení i po návratu do hry. Kamera nesleduje pouze lokomotivu tak, že zbytek soupravy zůstane mimo obraz.

Vlak může být menší než v současné verzi, ale musí zůstat rozpoznatelný a detailní. Navrhni společné stabilní měřítko a maximální délku soupravy podle skutečně dostupné herní plochy. Neřeš to neomezeným zmenšováním při každém přidaném voze.

Výchozí kompoziční cíl: nejdelší povolená souprava zabere přibližně **70–75 % využitelné šířky**, aby zůstalo místo před lokomotivou na krajinu a interakce a malá rezerva za posledním vozem. Toto je ladicí výchozí hodnota, ne povinnost vynucovat stejné procento na každém zařízení.

Limit odvozuj od délky konkrétní lokomotivy, všech zvolených vagonků, spřáhel a mezer. Nestačí univerzální počet vozů, jestliže mají různou délku. V depu dovol přidat pouze vagonek, který se do limitu vejde. Dosažení limitu naznač jednoduše a bez chybového dialogu; existující soupravu nemaž.

Kamera musí zohledňovat i výškový rozsah soupravy na svahu a místo zabrané ovládáním. Pohybuj s ní plynule; žádné cukání nebo výrazné přibližování a oddalování na každém hrbolu. Po změně velikosti okna přepočítej zobrazení. Na nepoužitelně úzkém displeji raději pozastav hru a nabídni otočení na šířku, než abys vlak ořízl nebo změnil na tečky. Uložené vagonky nikdy tiše neodstraňuj.

Trať musí existovat pod celou soupravou už při startu a nesmí se odstraňovat před průjezdem posledního vozu. V tunelu použij čitelný průřez nebo zprůhlednění zakrývající vrstvy, aby dítě neztratilo svůj vlak.

## 3. Grafika je hlavní priorita této iterace

Současný vlak tvořený jednoduchými čtverečky a obdélníky je pouze prototyp. **Taková podoba už není přijatelný výsledný stav.**

Vycházej z dodaných referencí: detailní, semi-realistické 2D modely, rozpoznatelné materiály a české prostředí. Inspirace OpenTTD se týká detailnosti a věrohodnosti malých objektů; zachovej boční pohled hry, nepřeváděj ji na izometrickou mapu. Nepřecházej ani do plochého stylu velkých geometrických tvarů nebo plastových hraček.

U lokomotivy musí být čitelná její silueta, kabina, podvozek, kola, okna a detaily podle pohonu. U parní lokomotivy komín, kotel a táhla; u elektrické sběrač a odpovídající trolejové vedení nad tratí. Vagonky se mají lišit konstrukcí, okny, podvozky a nákladem, ne pouze barvou stejného obdélníku.

Kola se při jízdě otáčejí a parní táhla se pohybují souhlasně s nimi. Jednotlivé vozy sledují svůj vlastní úsek koleje a náklon, ne jednu společnou rotaci celé soupravy. Kola mají vizuálně sedět na kolejích.

Referenční listy jsou podklady pro tvorbu assetů, nikoli hotové sprite atlasy. Připrav z nich použitelné samostatné assety s čistými hranami a podle potřeby průhledným pozadím. Nevložíš do hry celý prezentační list, jeho nadpisy ani bílé kartičky kolem objektů. Nelze-li prvek kvalitně vyříznout, vytvoř podle reference vhodný samostatný asset dostupnými prostředky. Překážky přiznej; geometrické placeholdery nevydávej za dokončenou grafiku.

Drž jednotné měřítko, ostrost, způsob stínování a míru detailu. Všechny hráčské popisky budou česky. Z referencí nepřebírej bodování, odměnové hvězdy, odemykání ani další UI, které není součástí herního zadání.

## 4. Přidej částicové efekty a drobné animace

Vlak ani prostředí nesmějí působit jako nehybné obrázky posouvané po obrazovce. Efekty musí vycházet z konkrétních míst a reagovat na pohyb nebo prostředí.

| Situace                           | Požadovaný vizuální projev                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Parní lokomotiva                  | Kouř a pára z komína, výraznější při jízdě a rozjezdu, menší ve stání. Za jedoucím vlakem se obláčky přirozeně táhnou převážně doleva. |
| Naftová a elektrická lokomotiva   | Odlišné projevy pohonu. Naftová může mít jemné výfukové zplodiny; elektrická nesmí bezdůvodně kouřit z komína.                         |
| Brzdění nebo vhodný okamžik u kol | Občasné malé jiskry. Ne neustálý ohňostroj a ne dojem porouchaného nebo hořícího vlaku.                                                |
| Průjezd místem se spadaným listím | Krátké rozvíření listů kolem projíždějících kol, které se následně snesou nebo zmizí.                                                  |
| Průjezd sněhovým úsekem           | Rozprášený sníh u kol nebo přední části lokomotivy, pouze tam, kde sníh skutečně je.                                                   |
| Krajina                           | Jemný pohyb vody, trávy nebo větví, občas pták či motýl. Ne všechno současně.                                                          |

Emitery upevni na správná místa modelu a zohledni jeho náklon a měřítko. Již vypuštěný kouř nebo listí se nesmějí dál pohybovat jako pevně přilepená součást vlaku. Průjezdové efekty spouštěj podle pohybu přes příslušný úsek; stojící vlak nesmí neustále odhazovat nový sníh.

Efekty musí mít omezený počet částic a životnost. Mysli na slabší zařízení, opakované použití objektů a snížení hustoty efektů. Při pauze pozastav také příslušné animace. Přednost mají čitelnost a plynulost před množstvím částic.

## 5. Zpestři krajinu, ale zachovej přehlednost

Použij podklady pro výrazně bohatší prostředí: stromy různých druhů, keře, trávu, květiny, kameny, ploty, pole, balíky sena, farmy, vesnické domy, nádraží, potoky, rybníky, mosty a tunely. Přidej přiměřený život kolem trati: traktor na poli, auta a cyklisty na cestách, zvířata v krajině, čekající cestující nebo výpravčího.

Skládej logické lokality, ne náhodnou změť objektů. Farma patří k polím, rákosí k vodě, nástupiště k nádraží. Střídej klidnější úseky s bohatšími scénkami. Vzdálené kopce, střední krajinu a blízké prvky odděl do vrstev s různou rychlostí posunu, ale nenech dekorace dlouhodobě zakrývat vlak.

Přejezdy mají blikající výstrahu, zavírající se závory a čekající silniční provoz. Závory zůstanou zavřené až do průjezdu posledního vagonku. Další vlak může jet po oddělené koleji, ne proti hráči na stejné.

Nevytvářej nové minihry ani závislost scének na nákladu. Nádraží zůstává dobrovolná zastávka; když ho dítě projede, nic se nepokazí.

## 6. Zrychli jízdu a oprav charakter výškového profilu

Jízda má být viditelně svižnější než nyní. Nestačí zvýšit číslo rychlosti, pokud po změně měřítka působí posun krajiny pořád pomalu. Laď výslednou rychlost na obrazovce tak, aby bylo cestování zřetelné, ale dítě ještě stíhalo sledovat a dotýkat se okolí. Rozjezd i dojezd mají zůstat plynulé.

Zachovej jednoduché ovládání: **držím dotyk = vlak jede a zrychluje; pustím = postupně zpomaluje; brzda zpomalí výrazněji.** Nevyžaduj přesné dávkování ani nové ovládací prvky. Parametry rychlosti, akcelerace a brzdění soustřeď do konfigurace.

Trať má být výškově pestřejší, ale **nesmí připomínat souvislou sinusovku nebo horskou dráhu**. Požadovaný charakter:

```text
rovina → krátký plynulý přechod → delší rovný sklon nahoru
       → krátké zaoblení → rovina → delší rovný sklon dolů
```

Generuj především úseky s konstantním sklonem, mezi nimi krátká plynulá zaoblení. Střídej různé délky rovin, stoupání a klesání, bez pravidelného vlnění. Nedělej ostré zlomy. Nádraží umisťuj na rovné, přehledné úseky. Terén kolem může být členitější než samotné kolejové těleso.

Každý vůz musí po přechodech správně následovat předchozí bez poskakování, levitace a zanořování kol. Nezaváděj kvůli tomu složitý fyzikální simulátor.

## 7. Postup implementace a ověření

Nejprve oprav pořadí soupravy, startovní zobrazení a kameru. Potom dosaď kvalitní reprezentativní vlak a prostředí, ověř měřítko a délkový limit. Následně dolaď pohyb, profil tratě a částicové efekty a stejný výtvarný standard rozšiř na dostupný obsah.

Zachovej udržitelnou strukturu existujícího projektu. Neřeš kameru sérií nesouvisejících posunů pro konkrétní lokomotivu. Pravidla soupravy, délkový limit, profil tratě a konfigurace efektů musí být srozumitelná a testovatelná. Nepřidávej backend, účty ani nový technologický stack bez skutečné potřeby.

Ověř minimálně následující:

| Test                                        | Podmínka přijetí                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Samotná lokomotiva a přidávání různých vozů | Čelo doprava, vozy přibývají vlevo na konci, pořadí odpovídá výběru.                                 |
| „Vyjeď“ a obnovení uložené hry              | Celá souprava je okamžitě viditelná; žádný prázdný začátek ani skok kamery od nesprávného místa.     |
| Nejdelší dovolená smíšená souprava          | Vejde se na obrazovku na rovině i při přejezdu výškových přechodů; další vůz nad limit nelze přidat. |
| Změna velikosti herní plochy                | Nic se tiše nemaže, kamera přepočítá zobrazení nebo hra srozumitelně řeší nevhodnou orientaci.       |
| Držení, puštění a brzdění                   | Plynulá, svižnější jízda; odpovídající pohyb kol a efekty.                                           |
| Les, pole, přejezd, tunel a zimní úsek      | Čitelné prostředí a správně umístěné efekty; závory respektují poslední vůz.                         |
| Delší hraní a pauza                         | Bez neomezeného hromadění částic či objektů a bez pokračování simulace na pozadí pauzy.              |

Po úpravách aplikaci skutečně spusť, projdi sestavení vlaku a jízdu a zkontroluj konzoli. Pořiď screenshoty **skutečné aplikace**, alespoň depo, celou soupravu za jízdy a členitý úsek. Nepředkládej referenční ilustrace jako důkaz hotové implementace.

Na závěr stručně uveď, co je opravené, jak je stanoven délkový limit, jaké assety a efekty jsou skutečně zapojené a co bylo otestováno. Neověřená zařízení nebo zbývající placeholdery přiznej. Test v desktopovém prohlížeči nevydávej za ověření na Tesle.

**Výsledkem má být existující hra dotažená do podoby, ve které dítě vidí svůj celý správně sestavený vlak, ten svižně projíždí věrohodnější krajinou a kolem něj se přirozeně něco děje.**
