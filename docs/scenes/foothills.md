# Vysočina a podhůří

Podhůří má skutečně výraznější převýšení než venkov, ale stále dlouhé čitelné svahy a roviny.
Krajinu tvoří zvlněné louky, lesíky, menší osady, zářezy a údolí.
Výška okolního terénu pomáhá ukázat stoupání i při kameře sledující vlak.

## FH-01 — Louka ve svahu

V dálce se za sebou zvedají oblé zalesněné hřbety.
Za tratí stoupá louka s několika skupinami bříz a smrků.
Kolej vede po mírném náspu a její směr zůstává dobře čitelný.
Před vlakem klesá pastvina s ovcemi a nízkými kameny.
Ovce se pomalu pasou, zatímco na vzdáleném svahu může projet malá kabinka lanovky.
Nad hřbety se pohybují mraky a trávu lehce sjednocuje vítr.

| Zóna           | Objekty                                                                                | Počet                   | Vztahy a závislosti                               | Zakázáno                    |
| -------------- | -------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------- | --------------------------- |
| far            | `backdrop.foothills-far`, `backdrop.foothills-mid`                                     | Souvislé                | Více oblých hřbetů                                | Ostré velehorské štíty      |
| back 0,35–0,90 | `tree.birch`, `tree.spruce`; NEW: vzdálená lanovka, sloup 20 × 80 u a kabina 56 × 48 u | 4–8 stromů, 0–1 lanovka | Kabina na souvislém laně mezi stanicemi mimo trať | Volně létající kabina       |
| bank           | Geometrie náspu, `near.stones`                                                         | Souvislé                | Kolej nad svahem                                  | Kámen v průjezdném profilu  |
| near 0,35–0,85 | `animal.sheep`, `near.boulder`, úplný plot                                             | 2–5 ovcí, 2–4 kameny    | Pastvina s úplným okrajem                         | Ovce na prudké skalní stěně |

## FH-02 — Podhorská osada a seno

Vzdálené lesy ustoupí několika loukám a střechám.
Za tratí stojí tři až pět chalup na suchých terasách u společné cesty.
U koleje zůstává travnatá mez bez stavby přes její profil.
Před vlakem leží posečená louka s řádky sena.
Traktor s lisem pomalu zpracuje jeden krátký pruh a hotové balíky zůstávají v připravených místech.
Nad střechami plyne obloha a za chladného dne vystoupí jemný kouř z jednoho komína.

| Zóna           | Objekty                                           | Počet               | Vztahy a závislosti     | Zakázáno                   |
| -------------- | ------------------------------------------------- | ------------------- | ----------------------- | -------------------------- |
| far            | Podhorské pozadí                                  | Souvislé            | Osada vložená do luk    | Husté město bez přechodu   |
| back 0,30–0,80 | `back.chalet`, `back.house-a/b`, `back.hayrack`   | 3–5 domů, 0–1 seník | Terasy u společné cesty | Dům nakloněný podle koleje |
| bank           | Travnatá mez                                      | Souvislá            | Volný koridor           | Plot ukončený na kolejích  |
| near 0,40–0,85 | `back.tractor`, lis z countryside, `back.haybale` | 1 stroj, 2–5 balíků | Pracovní dráha na louce | Seno v zimním sněhu        |

## FH-03 — Zářez a malý kamenolom

V dálce jsou lesnaté hřbety a na jednom svahu odkrytá světlá skála.
Za tratí leží malý lom s nízkými etážemi a vlastní obslužnou cestou.
Kolej prochází mělkým zářezem, jehož přední hrana zůstává pod vlakem.
V popředí je suchá kamenitá půda, keře a několik menších balvanů.
Bagr v zadní části pomalu přesune materiál z hromady do připraveného místa.
Obloha je klidná a nic se neodstřeluje ani nesesouvá k vlaku.

| Zóna           | Objekty                                             | Počet           | Vztahy a závislosti              | Zakázáno                   |
| -------------- | --------------------------------------------------- | --------------- | -------------------------------- | -------------------------- |
| far            | Podhorské pozadí                                    | Souvislé        | Skála zasazená do svahu          | Izolovaná skála bez terénu |
| back 0,40–0,90 | NEW: lomová stěna 512 × 180 u; NEW: bagr 100 × 70 u | 1 stěna, 1 bagr | Suchá pracovní plocha a přístup  | Rameno do koleje           |
| bank           | Geometrie zářezu                                    | 1 průchod       | Přední hrana pod chráněným pásem | Skalní stěna přes vlak     |
| near 0,35–0,85 | `near.boulder`, `near.stones`, `near.bush`          | 4–8 skupin      | Na okolním terénu                | Padající kameny            |

## FH-04 — Údolí s mostem a lesním svahem

Daleko se otevře širší údolí mezi dvěma hřbety.
Za tratí klesá lesní svah k potoku a několika vzdáleným loukám.
Kolej přejde údolí po mostu a na druhé straně pokračuje dlouhým stoupáním.
Před vlakem je vidět dno údolí s vodou, kameny a nízkou vegetací.
Ptáci mohou přelétnout mezi svahy a člověk na vzdálené pěšině se pomalu pohne.
Nad údolím zůstává dost oblohy, aby most i stoupající souprava měly jasnou siluetu.

| Zóna           | Objekty                                 | Počet       | Vztahy a závislosti                | Zakázáno                    |
| -------------- | --------------------------------------- | ----------- | ---------------------------------- | --------------------------- |
| far            | Podhorské hřbety                        | 2–3 vrstvy  | Viditelná hloubka údolí            | Stejně vysoká plochá kulisa |
| back 0,35–0,90 | Lesní skupiny z forest, geometrie údolí | 2–4 skupiny | Svahy směřují k toku               | Stromy uvnitř pilířů        |
| bank           | Most TB-01 nebo TB-03                   | 1 stavba    | Skutečné údolí a rezervované opěry | Most bez překážky           |
| near 0,40–0,90 | Potok, `near.stones`, `near.bush`       | 3–6 skupin  | Dno pod mostem                     | Voda stoupající po náspu    |

## Činnosti a odezvy

| Scéna | Samostatná činnost                      | Reakce na vlak; cooldown            |
| ----- | --------------------------------------- | ----------------------------------- |
| FH-01 | Pastva, pomalá vzdálená lanovka         | Jedna ovce zvedne hlavu; 16 s       |
| FH-02 | Lisování 25–45 s, místní pracovní stopa | Zemědělec zamává; 20 s              |
| FH-03 | Bagr přesune jednu dávku po 18–35 s     | Obsluha reaguje jen při stání; 24 s |
| FH-04 | Potok a řídké ptactvo                   | Jeden chodec nebo malé hejno; 20 s  |

Lanovka je nenápadný zadní motiv bez nastupování hráče a bez nového režimu.
Velká vesnice může nahradit osadu FH-02, ale používá celý vlastní kontrakt a potřebný prostor.

## Profil a sezóny

Cíl jádra: výška −260 až +260 u, běžné stoupání i klesání s absolutním sklonem 0,04–0,09.
Výjimečný souvislý úsek smí dosáhnout 0,10; globální limit 0,12 zůstává nepřekročitelný.
Region má cílové převýšení alespoň 260 u mezi lokálním dnem a vrcholem a oba směry svahu.
Stoupání trvá přibližně 1 024–3 072 u, oddělují je nepravidelně dlouhé roviny a zaoblení.
Stanice je vždy na rezervované rovině; mění se skutečný profil, nikoli jen natočení kresby.

Jaro: zelené louky, kvetoucí listnáče a silnější potok.
Léto: seno, lisování a pastva; podzim: sklizené louky, barevné břízy a listí.
Zima: sníh na chalupách, skalních římsách a loukách, traktor s radlicí na cestě.
Děti se mohou sáňkovat daleko za tratí na krátké oplocené louce, jejíž dojezd míří od dopravy.

## Zvuky a nové kresby

Použít vítr, luční i lesní ptáky, potok a ovce.
Nové audio: tlumený lis, jemná hydraulika bagru; bez odstřelů a skalních pádů.
NEW: lanovkový sloup 20 × 80 u, kabina 56 × 48 u a malá stanice 70 × 45 u.
Červená kabina s tmavým obrysem, tmavé sloupy a souvislé lano tvoří jeden
čitelný motiv. Lano má 6 u (přibližně 1,66 px na telefonu 1140 × 512),
kabina přibližně 15,5 × 13,3 px; rozezná se u podpory i uprostřed rozpětí.
V lanovkové scéně stojí stromy výše ve svahu (hloubka 0,85–0,90), aby jejich
koruny a kmeny nezakrývaly lano, kabinu ani vstupy obou stanic.
NEW: lomová stěna 512 × 180 u a bagr 100 × 70 u s odděleným ramenem.
NEW: sáňky s dítětem 32 × 24 u; malá vzdálená zimní postava, bez jízdy k trati.
Chalupy, seno, traktor, lesní skupiny a mosty se sdílejí; nevzniká druhá sada totožných rekvizit.

### Sezónní život D-027

Sezónní části a činnosti používají společný [kontrakt D-027](README.md#sezónní-vzhled-a-život--d-027)
a řádky SEA-01 až SEA-08 v [akceptaci](acceptance.md). Jedna váha podle x řídí
koruny, podklad i intenzitu částic; stání pouze nechává pokračovat animaci.

Zimní světlina `winter-sled` má jednu sáňkující postavu za tratí v hloubce
0,55–0,70. Krátký 48u pohyb při 6 u/s zůstává uvnitř celé povolené stopy;
břízy a borovice stojí ještě dál. Jarní, letní ani podzimní plán scénku nevybírá.

### Sezónní dálka — obrazová oprava D-027

Zimní far/mid pásy mají sněhovou půdu, bílé střechy a holé listnaté větve;
jehličnany si zachovávají vlastní tmavou kresbu. Podzim ukazuje sklizená pole
s barevným lesíkem, jaro jemné květové akcenty. Pásy a částice se prolínají
prostorovým postupem world-core; stojící vlak sezónu nemění.

## Implementační řez water-mountains-1

FH-01 otevřená louka střídá lesíky, FH-03 lom a skalní zářez. Lom je
kompozice stěny a rovné pracovní terasy na skutečném svahu; bagr má
odkaz na stěnu a otáčí oddělené rameno. Zimní lom používá sněhovou kresbu.
Lanovka má dvě opory, spojité lano a kabinu připojenou ke stejné dráze.
Skalní skupiny se umísťují podél skutečného profilu a jejich základ se
ponořuje do svahu; nic neleží v chráněném pásu.
Lanovka má opory v zadní hloubce 0,55, aby sloupy a kabina zůstaly čitelné
pod horizontem telefonu; výškový rozdíl obou podpor dál vychází z profilu.

Review water-mountains-2: jedna scéna vlastní právě jednu přijatou instalaci
lanovky. Obě věže a obě krajní stanice stojí ve výškách vzorkovaných v jejich
vlastních světových x; stanice nepřebírají výšku sousední věže.
