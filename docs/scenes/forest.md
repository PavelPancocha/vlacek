# Les před vlakem i za ním

Lesní region střídá okraj, souvislý porost, paseku, pracovní cestu a potok.
Vysokou hustotu tvoří zadní skupinové vrstvy; před vlakem je lesní půda, nízké porosty a práce mimo kolej.
Všechny pohybové obaly včetně ramen strojů respektují pravidla [README](README.md).

## FO-01 — Lesní okraj

Za loukou se zvedá nejprve řídký a potom souvislejší pás stromů.
Na horizontu už je les, ale mezi bližšími korunami stále prosvítá obloha.
Za tratí rostou duby, břízy a několik borovic ve skupinách.
U náspu přechází tráva do kapradí a lesní půdy.
Přední lesní půda má měkký nepravidelný travnatý lem a oblé zakončení; netvoří obdélník ani ostrý hrot.
Její obrys pokračuje přes technické hranice chunků.
Před vlakem jsou bobulové keře a mladé smrčky pod chráněným pásem.
Srnka občas vykoukne na kraji porostu a klidně se vrátí o několik kroků zpět.

| Zóna           | Objekty                                               | Počet                  | Vztahy a závislosti             | Zakázáno                 |
| -------------- | ----------------------------------------------------- | ---------------------- | ------------------------------- | ------------------------ |
| far            | `backdrop.forest-far`, `backdrop.forest-mid`          | Navazující pásy        | Hustota postupně roste          | Ostrá stěna na hranici   |
| back 0,25–0,85 | `tree.oak`, `tree.birch`, `tree.pine`                 | 8–14                   | Skupiny s průhledy              | Stromy v rezervaci trati |
| bank           | `near.fern`, `near.grass-b`                           | 4–8/1 024 u            | Okraj lesa mimo kolej           | Kapradí přes kola        |
| near 0,30–0,85 | `near.berry-bush`, `near.young-spruce`, `animal.deer` | 3–6 rostlin, 0–1 srnka | Srnka má vlastní bezpečný výběh | Útěk do koleje           |

## FO-02 — Hustý lesní průsek

Vzdálené kopce téměř zanikají za dvěma tlumenými pásy korun.
Za tratí je souvislý smíšený les, nikoli jednotlivé stromy rozházené po louce.
Nad průsekem zůstává úzký otevřený pruh oblohy.
Kolej vede čistým koridorem a její násep je vidět po celé délce soupravy.
Před vlakem pokračuje nízká silueta lesa s kapradím, kládou a mladými stromky.
Veverka se krátce pohne u kmene za tratí a datel občas nenápadně zaklepe.

| Zóna           | Objekty                                                        | Počet                         | Vztahy a závislosti                           | Zakázáno                    |
| -------------- | -------------------------------------------------------------- | ----------------------------- | --------------------------------------------- | --------------------------- |
| far            | NEW: hustý lesní pás 512 × 160 u                               | 2 hloubkové pásy              | Nepravidelná souvislá koruna                  | Stovky jednotlivých animací |
| back 0,25–0,90 | `tree.spruce`, `tree.pine`, `tree.oak`, `tree.birch`           | 12–20/1 024 u                 | Kmeny mimo koridor, koruny se mohou překrývat | Strom v koleji              |
| bank           | Geometrie lesního průseku                                      | Souvislá                      | Čitelná kolej a vedení                        | Neprůhledná zelená stěna    |
| near 0,40–0,95 | NEW: nízký lesní okraj 512 × 48 u; `near.fern-big`, `near.log` | 1–2 pásy, 3–6 detailů/1 024 u | Vše pod vlakem                                | Vysoké přední koruny        |
| back 0,45–0,80 | `animal.squirrel`; NEW: datel 18 × 24 u                        | 0–1 od každého                | U konkrétního kmene                           | Pták bez stromu             |

## FO-03 — Světlá paseka

Mezi lesními pásy se otevře světlé místo s výhledem na vzdálený hřbet.
Za tratí zůstává několik starších stromů a nepravidelný okraj porostu.
U koleje je nízká tráva s pařezy v bezpečném odstupu.
Před vlakem rostou mladé smrčky, kapradí a několik hub.
Liška pomalu obejde keř a veverka se může ukázat u starého pařezu.
Obloha zabírá větší plochu a v teplé sezóně se nad květy objeví několik motýlů.

| Zóna           | Objekty                                                          | Počet                   | Vztahy a závislosti  | Zakázáno                 |
| -------------- | ---------------------------------------------------------------- | ----------------------- | -------------------- | ------------------------ |
| far            | Lesní pozadí s průhledem                                         | 1 otevřený úsek         | Les obklopuje paseku | Samostatná náhodná louka |
| back 0,30–0,85 | `tree.birch`, `tree.pine`, `back.stump`                          | 3–6 stromů, 4–7 pařezů  | Pařezy na pasece     | Pařez ve vozovce         |
| bank           | `near.grass-b`, `near.stones`                                    | 3–6/1 024 u             | Otevřený koridor     | Kmen ležící přes trať    |
| near 0,30–0,80 | `near.young-spruce`, `near.fern`, `near.mushrooms`, `animal.fox` | 6–10 rostlin, 0–1 liška | Zvíře uvnitř paseky  | Lesní práce mezi zvířaty |

## FO-04 — Lesní cesta a práce se dřevem

V dálce pokračuje souvislý les a za tratí se ukazuje suchá pracovní cesta.
U ní leží uspořádaná skládka klád s přístupem pro nákladní auto.
Kolej odděluje od práce otevřený násep bez volných větví.
Před vlakem může pracovat harvester v malé vyhrazené části lesa.
Stroj kmen nejprve pevně uchopí a pomalu položí na prázdné lože; nic volně nepadá.
Vyvážečka v jiné fázi odveze klády ke skládce a pod klidnou oblohou čeká zajištěný náklad na autě.

| Zóna           | Objekty                                                                   | Počet                 | Vztahy a závislosti                       | Zakázáno                    |
| -------------- | ------------------------------------------------------------------------- | --------------------- | ----------------------------------------- | --------------------------- |
| far            | Hustý lesní pás FO-02                                                     | 1–2 pásy              | Práce je malá kapsa uvnitř lesa           | Holina přes celý region     |
| back 0,35–0,85 | `back.logs`; NEW: nákladní auto s kládami 110 × 48 u                      | 2–4 hromady, 0–1 auto | Skládka na suché ploše u cesty            | Klády ve vozovce            |
| bank           | Geometrie otevřeného odstupu                                              | Souvislá              | Mimo celý dosah strojů                    | Rameno nad kolejí           |
| near 0,50–0,90 | NEW: harvester 110 × 72 u, vyvážečka 120 × 60 u, pracovní kmen 24 × 100 u | 1 + 1 + 1             | Oddělené pracovní kapsy a spojovací cesta | Volný pád, lidé pod ramenem |
| near 0,35–0,85 | `near.log`, `back.stump`                                                  | 3–6                   | Lože pro položení kmene                   | Klády klouzající k vlaku    |

## FO-05 — Potok a hájovna

Les se otevře kolem potoka, který má čitelný přítok i pokračování.
Za tratí stojí hájovna u lesní cesty a drobná lávka přes vodu.
Kolej překonává potok pouze společně plánovaným mostkem.
Před vlakem pokračuje břeh s kapradím, kameny a nízkými keři.
Žába se drží břehu a člověk u hájovny může krátce zamávat.
Mezi korunami je vidět obloha a vodní odlesky se pohybují pomaleji než ptáci nad lesem.

| Zóna           | Objekty                                                | Počet                        | Vztahy a závislosti                                 | Zakázáno                  |
| -------------- | ------------------------------------------------------ | ---------------------------- | --------------------------------------------------- | ------------------------- |
| far            | Lesní pozadí                                           | Souvislé                     | Údolní průhled                                      | Mořský horizont           |
| back 0,35–0,85 | `back.lodge`; NEW: lávka 100 × 35 u, krmelec 60 × 50 u | 0–1 od každého               | Hájovna u cesty, lávka přes potok, krmelec na suchu | Lávka bez vody            |
| bank           | Potok a případný most TB-01                            | 1 průchod                    | Vazba na konkrétní tok                              | Voda položená přes koleje |
| near 0,35–0,85 | `near.fern-big`, `near.boulder`, `animal.frog`         | 4–7 rostlin/kamenů, 0–1 žába | Žába má dosažitelnou vodu                           | Žába na suché cestě       |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                             | Reakce na vlak; cooldown                          |
| ----- | -------------------------------------------------------------- | ------------------------------------------------- |
| FO-01 | Srnka vykoukne po 20–40 s                                      | Zvednutí hlavy; 18 s                              |
| FO-02 | Koruny, datel po 25–45 s, veverka u svého kmene                | Jeden pták přeletí průsek vysoko nad vlakem; 20 s |
| FO-03 | Liška popojde po 18–35 s, motýli jen u květů                   | Krátké otočení hlavy; 18 s                        |
| FO-04 | Uchopení a položení kmene 10–16 s; odvoz 25–45 s, nesynchronně | Obsluha zamává jen v klidové poloze; 24 s         |
| FO-05 | Proud a žába, občasný člověk u hájovny                         | Zamávání; 18 s                                    |

Práce nemá řetězovou pilu v rukou člověka, ostrý řezný zvuk ani nebezpečný pád.
Harvester, vyvážečka a auto zůstávají čitelnou společnou scénou, ale výrazný pohyb má současně jen jeden stroj.

## Profil, sezóny a zvuky

Cíl koleje: −180 až +180 u, absolutní sklon 0–0,06; průseky střídají rovinu a delší mírný svah.
Jaro: světlé listy, kapradí, několik květů na okraji; léto: plné koruny a motýli na pasece.
Podzim: barevné listnáče, zelené jehličnany, listí z konkrétních korun a lesní půdy.
Zima: sníh na větvích, mladých smrčcích, hájovně i skládce; práce probíhá na připravené cestě bez prachu.
Použít lesní ptáky, vítr a potok; nové audio: krátký datel, tlumená hydraulika a měkký motor lesního stroje.
Zvuky lesních zvířat po dotyku: jelenovité krátce zamečí, veverka cvakne, ježek odfrkne; liška má přiznaný fallback: venkovní kroky člověka v suchém listí místo hlasu. Každý má samostatnou nahrávku, nikoli výřez větru ([D-022](../decisions/022-recorded-sounds.md)); poslech majitelem zůstává NEOVĚŘENO.
Sova může být tichou večerní variantou hustého lesa, bez lekavého výkřiku.

## Nové kresby

NEW: hustý lesní pás 512 × 160 u a nízký přední okraj 512 × 48 u; smíšené koruny, sezónní varianty.
NEW: harvester 110 × 72 u a vyvážečka 120 × 60 u; oddělená kola, rameno a uchopovač.
NEW: pracovní kmen 24 × 100 u s jasným úchopem; jeho celý otočný obal patří do rezervace práce.
NEW: nákladní auto s kládami 110 × 48 u; náklad s klanicemi a viditelným zajištěním.
NEW: lávka 100 × 35 u, krmelec 60 × 50 u, datel 18 × 24 u a sova 24 × 28 u.
Sdílet existující klády, pařezy, mladé smrčky, kapradí a zvířata; nevytvářet druhou sadu stejné lesní půdy.

## Implementovaný řez farm-forest-1

FO-02 používá dva souvislé, sezónní atlasové pásy korun a jednotlivé dospělé stromy
pouze za kolejí. Přední okraj tvoří kreslený nízký pás na lesní půdě, nikoli geometrická
silueta. Všechny čtyři sezóny zachovávají velikost a pivot. Podzim mění listnáče,
jehličnany zůstávají zelené; zima přidává sníh.

FO-04 má za tratí pracovní cestu, auto s kládami a skládku. Harvester a vyvážečka
pracují v oddělených kapsách před kolejí; vyvážečka pomalu převáží klády mezi svým
ložem a skládáním. Kmen je při přesunu vždy v uchopovači, při uvolnění leží na
připraveném loži. Klády na loži přibývají po položení a ubývají při naložení;
nevzniká volný pád. Lože jsou pevné sourozenecké kontejnery na obou koncích
patroly, nepohybují se společně s vyvážečkou. Vyvážečka při úchopu a položení
stojí, převoz drží kmen vodorovně a kola v době stání neotáčí. Rozsah ramen, kmene, nářadí a celé patroly je součást numerické
obálky stroje. Přední cesta spojuje pracovní kapsy, zadní příjezd vede kolem skládky,
žádná pracovní cesta nekříží kolej. Lidé a zvířata nemají dráhu v dosahu strojů. V pracovním řezu je drobný ježek
v dolním suchém pásu na x = 128 u chunku, mimo oba pracovní obaly i po
přizpůsobení zvířete malému displeji.

FO-05 přidává krmelec na suchém místě a lávku jen nad skutečným tekoucím potokem
společného mostního slotu; bez potoka se lávka negeneruje. Datel i sova patří ke
konkrétnímu zadnímu stromu, nejsou samostatně položené na zem. Datel se jemně naklání;
sova je klidný detail. Večerní zobrazení sovy doplní systém den/noc, který tento řez nemění.

## Opravy farm-forest-2

Husté jádro má souvislé překrývající se skupiny těsně za čistým koridorem, ve dvou
bližších hloubkách nad rámec far/mid paralaxy. Šestnáct kmenů ve skupinách doplňuje
míšenou hmotu; jejich koruny se překrývají. Nízký přední okraj navazuje přes chunky
a sleduje bezpečný obal; pracovní prostor je vymezená menší paseka uvnitř lesa.
Vyvážečka má jedinou 32s trajektorii: stojí při úchopu i odložení, při stání drží
poslední směr, kola odpovídají skutečně ujeté dráze. Úchop a pevná lože na sebe
navazují v souřadnicích světa včetně výšky terénu. Lávka používá skutečný meandr
a její dvě výtvarné kotvy stojí na suchých březích. Zimní nízký okraj tvoří
nepravidelné zasněžené mladé jehličnany, keře a klády. Zimní listnáče a jejich
výběr vlastní seasons-life; celý zimní les vyžaduje společný snímek po integraci.

## Ořez a návaznost skupin (farm-forest-3)

Husté koruny a nízký přední okraj se opakují v pevné světové mřížce. Krok vychází
z promítnuté šířky kresby a překrývá oba 5% průhledné boky; technický řez chunku
nemění fázi ani výšku dlaždice. Fragment přes hranici sdílí stejnou světovou kotvu.
Skutečný vstup/výstup porostu a okraj pracovní kapsy se zjemní postupným průhledným
lemem, nikdy až na technickém řezu uvnitř porostu. Potoky, přejezdy a kopce tunelů
zůstávají mimo kresbu korun i popředí podle společných ořezových polygonů.
Statické skupiny každé potřebné hloubky se jednou složí do textury nejvýše 1 px/u;
blízké kmeny a stroje zůstávají samostatné. Stejná textura funguje v Canvas i WebGL,
při odchodu chunku se uvolní a mimo záběr se dekorativní skupiny nekreslí.

### Sezónní život D-027

Sezónní části a činnosti používají společný [kontrakt D-027](README.md#sezónní-vzhled-a-život--d-027)
a řádky SEA-01 až SEA-08 v [akceptaci](acceptance.md). Jedna váha podle x řídí
koruny, podklad i intenzitu částic; stání pouze nechává pokračovat animaci.
