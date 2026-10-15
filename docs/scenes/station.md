# Zastávky a nádraží

Stanice je vložená stavba s jedním vlastníkem a souvislým použitelným nástupištěm.
Budova, přístup, lidé a okolí se přizpůsobí hostitelské krajině.
Každou stanici lze bez následků projet; žádná scénka nevyžaduje určitý vagón.

## ST-01 — Malá zastávka u cesty

V dálce pokračuje krajina, kterou vlak právě projíždí.
Za tratí stojí malý přístřešek nebo skromná budova u přístupové cesty.
Nástupiště má jasný začátek, krátký střed a skutečný konec.
Vedle koleje je lavička a jeden nebo dva čekající lidé.
Před vlakem zůstává nízká tráva, keř a otevřený pohled na kola.
Jeden člověk může při přiblížení zamávat, aniž by vstoupil k hraně koleje.
Nad zastávkou jsou vidět mraky a okolní stromy se pohybují vlastním rytmem.
Po průjezdu pokračuje cesta i krajina bez změny herního režimu.

| Zóna           | Objekty                                                       | Počet                          | Vztahy a závislosti                          | Zakázáno                              |
| -------------- | ------------------------------------------------------------- | ------------------------------ | -------------------------------------------- | ------------------------------------- |
| far            | Pozadí hostitele                                              | Souvislé                       | Zastávka nemění biom                         | Městská kulisa na každé zastávce      |
| back 0,15–0,65 | Přístřešek z village nebo `back.station`, `back.bench`        | 1 budova, 1 lavička            | Přístup k nástupišti ze suché cesty          | Budova v rezervaci koleje             |
| bank           | NEW: modulární nástupiště, střed 128 × 24 u a konce 32 × 24 u | Použitelná délka nejméně 448 u | Skutečná rovina včetně celé použitelné délky | Počítání přechodových ramen do roviny |
| back 0,05–0,25 | `back.person-a/b/c`, `back.lamp`                              | 1–2 lidé, 1–2 lampy            | Uvnitř bezpečné části nástupiště             | Člověk v koleji                       |
| near 0,35–0,80 | `near.grass-a`, `near.bush`                                   | 3–6 skupin                     | Pod vlakem, mimo UI                          | Vysoké přední vybavení                |

## ST-02 — Střední stanice s autobusem

Za vzdálenými stromy se ukáže nádražní budova a menší obec.
Podél koleje pokračuje delší nástupiště se dvěma skupinami vybavení.
Za budovou je přednádraží s cestou a autobusovou zastávkou.
U koleje stojí výpravčí a několik lidí v dostatečném odstupu.
Před vlakem vede nízká servisní cesta s trávou a jednou skupinou beden na suché ploše.
Autobus občas zastaví u silnice a lidé na nástupišti se pohybují každý jinak.
Nad střechou plyne obloha a praporek nebo drobná textilie se mírně hýbe ve větru.
Zastavení hráče může vyvolat zamávání, ale vlak smí ihned pokračovat.

| Zóna           | Objekty                                                           | Počet                                     | Vztahy a závislosti               | Zakázáno                      |
| -------------- | ----------------------------------------------------------------- | ----------------------------------------- | --------------------------------- | ----------------------------- |
| far            | Pozadí hostitele, vzdálené domy                                   | 1–2 skupiny                               | Stanice patří k obci nebo krajině | Nové město kvůli jedné budově |
| back 0,20–0,75 | `back.station`, autobus a přístřešek z village                    | 1 budova, 0–1 autobus                     | Souvislé přednádraží a silnice    | Autobus v kolejovém pásu      |
| bank           | Modulární nástupiště ST-01                                        | 1 024–1 536 u                             | Jedna rovina a jeden vlastník     | Konec na každém chunku        |
| back 0,05–0,30 | `back.dispatcher`, `back.person-a/b/c`, `back.bench`, `back.lamp` | 1 výpravčí, 3–5 lidí, 2 lavičky, 3–5 lamp | Vybavení mimo průchod a hranu     | Synchronní mávání všech       |
| near 0,35–0,80 | `back.crates`, `near.bush`                                        | 1–2 bedny, 2–4 keře                       | U servisní cesty                  | Bedny v cestě nebo pod vlakem |

## ST-03 — Velké nádraží delší než vlak

Městský nebo větší obecní horizont se otevírá do rozsáhlejšího drážního prostoru.
Za tratí se táhne dlouhé nástupiště s několika přístřešky a jednou hlavní budovou.
Jeho začátek, střed a konec jsou odlišné části skutečné stavby.
U koleje se střídají malé skupiny lidí, laviček a lamp s prázdnějšími úseky.
Před vlakem zůstává nízké servisní okolí, aby délka soupravy byla stále dobře vidět.
Výpravčí stojí jen na jednom vhodném místě a neobjevuje se znovu v každém chunku.
Pokud je zde plánovaná vedlejší kolej, může po ní projet samostatný NPC vlak.
Nad nádražím zůstává otevřená obloha a stanice pokračuje i za hranici prvního záběru.

| Zóna           | Objekty                                                 | Počet                                         | Vztahy a závislosti                             | Zakázáno                       |
| -------------- | ------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------- | ------------------------------ |
| far            | Městský pás nebo pozadí hostitele                       | Souvislé                                      | Nižší hustota u drážního prostoru               | Vysoká kulisa před vlakem      |
| back 0,25–0,85 | `back.station`; NEW: přístřešek nástupiště 160 × 60 u   | 1 hlavní budova, 3–5 přístřešků               | Přístup a souvislý nástupištní prostor          | Zvětšený sprite místo délky    |
| bank           | Modulární nástupiště ST-01                              | 2 304–3 072 u                                 | Použitelná délka větší než podporovaná souprava | Rozpad na nezávislé stanice    |
| back 0,05–0,30 | `back.dispatcher`, `back.person-a/b/c`, lavičky a lampy | 1 výpravčí, 6–10 lidí, 4–6 laviček, 6–10 lamp | Rozdělené skupiny a volné průchody              | Lidé pod přístřeškovými sloupy |
| near 0,35–0,85 | Servisní cesta, `near.bush`, `near.stones`              | 4–8 skupin                                    | Nízké okolí po celé délce                       | Sklad zakrývající soupravu     |

## Činnosti a reakce

| Situace                                  | Chování                                                                              | Cooldown              |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | --------------------- |
| Přiblížení k malé zastávce               | Jeden čekající krátce zamává                                                         | 12 s                  |
| Přiblížení ke střední nebo velké stanici | Jeden výpravčí zvedne ruku nebo plácačku                                             | 12 s                  |
| Píšťala hráče                            | Odpoví jediný viditelný vhodný aktér podle společných priorit                        | Nejméně 8 s           |
| Dobrovolné zastavení                     | Při lokomotivě v intervalu, rychlosti pod 4 u/s po 0,5 s vznikne jedna klidná scénka | 12 s                  |
| Samostatný život                         | Lidé popojdou nebo se otočí po 12–30 s, s různými fázemi                             | Nezávislé na průjezdu |

Cestující nevstupují do libovolných nákladních vagónů.
Rozjezd okamžitě umožňuje odjet; nečeká se na dokončení mávání ani animace dveří.
Autobusové intervaly jsou nezávislé na staničním mávání a respektují silniční provoz.
Skrytí lidé a objekty pod UI nejsou dotykové cíle.

## Profil, hostitel a sezóny

Celá použitelná délka nástupiště má nulový sklon; přechodová ramena leží mimo ni.
Výška stanice se přebírá z hostitele a rezervuje před generováním přilehlých svahů.
Velká stanice je delší než aktuální limit 2 000 u; při změně limitu se vztah znovu ověří.
Horská stanice používá chatu, kámen a letní/zimní hostitelský preset, nikoli novou kategorii krajiny.
Pobřežní zastávka má suchý přístup a navazující moře za sebou, bez vnitrozemského rybníka.
Jaro: kvetoucí okolí; léto: plné listí; podzim: barevné stromy a listí u jejich zdrojů.
Zima: sníh na střechách, okrajích nástupiště a záhonech; chodníky zůstávají čitelné.
Coast a dunes přebírají své jediné klimatické presety, nikoli automatický sníh.

## Zvuky a nové kresby

Použít okolí hostitele a tlumený pohyb lidí; žádné hlasité nádražní hlášení.
Nové audio: jemné staniční okolí a krátké dveře budovy; odjezdová píšťalka není podmínkou odjezdu.
NEW: nástupištní střed 128 × 24 u a konce 32 × 24 u s návaznými hranami a stíny.
NEW: přístřešek 160 × 60 u; samostatné sloupky a střecha s kotvením zimního sněhu.
NEW: mávací pózy cestujících 14–16 × 36–40 u a výpravčího 16 × 40 u.
NEW: malý praporek 20 × 16 u s jemným pohybem, bez závislosti na stavu jízdy.
Budovy, lavičky, lampy, autobus a bedny se sdílejí se stávajícím katalogem.

## Implementační řez D-024

Malá zastávka má 480 u celkové a 448 u použitelné délky, střední stanice 1 216 u, velké městské nádraží 2 368 u (32 + 18 × 128 + 32), z toho 2 336 u použitelných. Délka není perspektivně zmenšená: díly mají jednotkové světové měřítko a 2u přesah kresby. Dlouhá stanice má jediný ID a rozsah ve všech dotčených chunkech; obrázek patří chunku svého středu, nástupištní rezervace je dostupná také při samostatném dotazu uprostřed. Před generováním svahů se rezervuje rovina včetně přechodových ramen; slot 1 zůstává vlastníkem a přejezd ve slotu 3 zůstává mimo platformu. První blok zachovává R3 se zastávkou v chunku 1. Kontext volí zastávku mimo osady, střední stanici v plánované velké vsi a velké nádraží v městském regionu. Budova má přístup, cestující a výpravčí stojí na platformě mimo sloupy přístřešků.

Dosavadní jízda neobsahovala automat zastávkové scénky. D-024 doplňuje čistý kosmetický automat jediného aktéra: přiblížení do 640 u před platformou, dobrovolné zastavení uvnitř intervalu při rychlosti pod 4 u/s po 0,5 s a cooldown 12 s. Mává dvě sekundy, při stání neopakuje reakci bez nového zastavení. Čte výhradně simulační tick a polohu; nemění vstup, rychlost, náklad ani save. Stav vlastní view stanice a zaniká s ním; při znovunačtení scény může znovu pozdravit, bez dohánění zmeškaných událostí. Píšťalová odpověď a vlastní chůze cestujících nejsou v tomto obsahovém řezu dokončené.

## Oprava kompozice settlements-2

Staniční ulice a vstupní pěšiny se rezervují před okolními parcelami a kontrolují vůči vodě i infrastruktuře. Pouze pojmenované vstupy se smějí dotknout vlastní budovy/nástupiště. Pobřežní přístup se posune na suchý břeh. Střední stanice má složené zadní přednádraží s lavičkou a zelení i nízké přední servisní okolí; velká stanice má souvislou servisní cestu po celé délce a drobné keře/kameny mimo průjezdný profil. Druhé nástupiště není podmínkou tohoto řezu.

### Sezónní život D-027

Sezónní části a činnosti používají společný [kontrakt D-027](README.md#sezónní-vzhled-a-život--d-027)
a řádky SEA-01 až SEA-08 v [akceptaci](acceptance.md). Jedna váha podle x řídí
koruny, podklad i intenzitu částic; stání pouze nechává pokračovat animaci.
