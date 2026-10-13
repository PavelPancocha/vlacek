# Rybníkářsko a říční údolí

Sladkovodní region střídá rybníky připomínající Třeboňsko, řeku, mlýn a břeh s malou pláží.
Voda je skutečný souvislý podklad scény; obrázek loďky nebo mlýna ji nenahrazuje.
Každá vodní aktivita odkazuje na konkrétní plochu, tok nebo břeh.

## LA-01 — Rybníky, hráze a rybář

Daleko je nízký horizont s lesy a několika vzdálenými střechami.
Za tratí se rozloží skupina různě velkých rybníků oddělených hrázemi a loukami.
Násep vede po suchém okraji a do vody vstupuje jen plánovaná stavba.
Před vlakem je blízký břeh jednoho rybníka s rákosím a rybářem.
Kachny pomalu plují v jeho vodě a rybář občas zvedne prut bez dramatického úlovku.
Na otevřené obloze se pohybují ptáci, zatímco hladina ukazuje jen několik měkkých odlesků.

| Zóna           | Objekty                                                                     | Počet                             | Vztahy a závislosti                       | Zakázáno                          |
| -------------- | --------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------- | --------------------------------- |
| far            | `backdrop.lakes-far`, `backdrop.lakes-mid`                                  | Souvislé                          | Nízký rybniční horizont                   | Vysoké alpské štíty               |
| back 0,20–0,90 | Geometrie rybníků; `tree.willow`, `back.reeds`                              | 3–5 rybníků v souboru             | Různé tvary, velikosti, hráze a mezery    | Kopie stejného oválu              |
| bank           | Suchá hráz nebo travnatý okraj                                              | 1 souvislý koridor                | Kolej má vlastní suchou oporu             | Voda přes násep                   |
| near 0,35–0,85 | Geometrie blízkého břehu; `near.reeds`, `animal.duck`; NEW: rybář 28 × 30 u | 4–8 rákosin, 2–4 kachny, 1 člověk | Kachny uvnitř stejné vody, rybář na břehu | Kachna na louce s vodou jen vzadu |

## LA-02 — Řeka a malý přívoz

V dálce se údolí stáčí mezi vrbami a nízkými svahy.
Za tratí teče souvislá řeka s jasným směrem proudu.
U koleje zůstává suchý břeh a případný most má vlastní rezervaci.
Před vlakem se ukazuje širší říční zákrut se dvěma přistávacími místy přívozu.
Malý přívoz se pomalu přesune mezi břehy a po přistání chvíli odpočívá.
Nad vodou létají vážky a v obloze prochází řídký mrak.

| Zóna           | Objekty                                                  | Počet                           | Vztahy a závislosti              | Zakázáno                       |
| -------------- | -------------------------------------------------------- | ------------------------------- | -------------------------------- | ------------------------------ |
| far            | Jezerní pozadí, údolní silueta                           | Souvislé                        | Řeka pokračuje za terén          | Slepé vodní konce              |
| back 0,25–0,85 | Geometrie řeky, `tree.willow`                            | 1 tok, 3–6 vrb                  | Stálý proud a souvislé břehy     | Samostatné rybníčky místo řeky |
| bank           | Suchý břeh, případně TB-02                               | 1 koridor                       | Most odkazuje na tuto řeku       | Pilíř v dráze přívozu          |
| near 0,40–0,90 | NEW: přívoz 90 × 35 u; `back.pier`; NEW: vážka 16 × 10 u | 1 přívoz, 2 přístupy, 1–3 vážky | Celá dráha na vodě mezi přístupy | Loďka pohybující se po trávě   |

## LA-03 — Vodní mlýn s náhonem

Za řekou stojí nízký mlýn s červenou střechou a zahradou.
Náhon přichází od toku, vede ke kolu a vrací vodu zpět.
Kolej míjí areál po suché straně a mezi mlýnem a tratí zůstává přístupová cesta.
V popředí jsou kameny, nízký břeh a několik rákosin u skutečné vody.
Mlýnské kolo se pomalu otáčí a člověk u dveří občas zamává.
Nad střechou plyne klidná obloha, bez druhého mlýna hned za komínem.

| Zóna           | Objekty                                                           | Počet                  | Vztahy a závislosti                     | Zakázáno                                |
| -------------- | ----------------------------------------------------------------- | ---------------------- | --------------------------------------- | --------------------------------------- |
| far            | Jezerní pozadí                                                    | Souvislé               | Mlýn je místní dominanta                | Další dominantní atrakce vedle          |
| back 0,35–0,75 | `back.watermill`, upravený na tělo a kolo                         | 1                      | Suchý základ, cesta, náhon              | Mlýn na silnici                         |
| back 0,20–0,80 | Geometrie přítoku, náhonu a odtoku; NEW: kolo přibližně 52 × 52 u | 1 propojený systém     | Kolo zasahuje do svého tekoucího kanálu | Pouhý modrý tah v SVG jako náhrada toku |
| bank           | Suchý travnatý odstup                                             | Souvislý               | Rezervace trati a případného přejezdu   | Přístup přes kolej bez přejezdu         |
| near 0,35–0,80 | `near.stones`, `near.reeds`, `back.person-a`                      | 3–6 skupin, 0–1 člověk | Rákosí u vody, člověk na suchu          | Rákosí na cestě                         |

## LA-04 — Sladkovodní pláž a louka

Na vzdáleném břehu je les a několik nízkých domků.
Za tratí se rozprostírá jeden větší rybník nebo jezero.
Jeho břeh se na jednom místě mění v malou písečnou pláž.
Před vlakem pokračuje stejný pobřežní okraj s trávou, pískem a nízkými keři.
U vody stojí lavička a loďka se drží vlastní klidné zátoky.
Na obloze jsou mraky a v létě se nad navazující loukou mihnou motýli.

| Zóna           | Objekty                                             | Počet                             | Vztahy a závislosti                 | Zakázáno                                 |
| -------------- | --------------------------------------------------- | --------------------------------- | ----------------------------------- | ---------------------------------------- |
| far            | Jezerní pozadí                                      | Souvislé                          | Viditelný protější sladkovodní břeh | Mořský maják                             |
| back 0,25–0,90 | Geometrie jedné vody; `back.rowboat`, `tree.willow` | 1 voda, 0–1 loď, 2–4 vrby         | Loď i břeh patří téže vodě          | Další rybník vložený do pláže            |
| bank           | Suchý odstup od vody                                | Souvislý                          | Kolej oddělená od rekreace          | Písek zakrývající kolej                  |
| near 0,35–0,85 | `back.bench`, `near.sand-toys`, `near.bush`         | 1–2 lavičky, 0–1 hračky, 2–4 keře | Hračky jen na pláži                 | Mušle jako univerzální sladkovodní výplň |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                      | Reakce na vlak; cooldown                              |
| ----- | ------------------------------------------------------- | ----------------------------------------------------- |
| LA-01 | Kachny plují, rybář upraví prut po 25–45 s              | Rybář zamává nebo nejbližší kachna zvedne hlavu; 20 s |
| LA-02 | Přeplutí 20–35 s, pobyt 8–16 s, nezávislé fáze vážek    | Převozník zamává, nehýbe lodí mimo trasu; 20 s        |
| LA-03 | Kolo podle simulačního času, občasný drobný vodní třpyt | Člověk u mlýna zamává; 20 s                           |
| LA-04 | Loďka se jemně pohupuje, žába může skočit do vody       | Jedna klidná odezva u břehu; 18 s                     |

Ryba může výjimečně krátce vyskočit uvnitř vyznačené vody; další taková akce nejdříve za 30 s.
Pohyb hladiny nemění tvar vodní plochy a nevyžaduje fyzikální simulaci.

## Profil a sezóny

Cíl koleje: −60 až +60 u, absolutní sklon 0–0,025; údolní přístupy mohou využít delší mírné klesání.
Hladina rybníka je vodorovná a nezvlní se podle každého vzorku koleje.
Jaro: svěží břehy, ptáci a kachny; léto: vážky, rybář, přívoz a plážové detaily.
Podzim: okrové rákosí, barevné vrby, méně hmyzu a listí jen od stromů.
Zima: zasněžené břehy a klidná studená voda; přívoz je vyvázaný, rybář a plážové hračky chybějí.
Kachny zůstávají pouze na otevřené vodě; nepřidává se chůze lidí ani zvířat po ledu.
Mlýn v zimě může stát, ale náhon a jeho propojení zůstávají čitelné.

## Zvuky a nové kresby

Použít potok, vítr, ptáky, kachny a žábu; mořský příboj sem nepatří.
Nové audio: tiché vodní kolo, jemné šplouchnutí a tlumený motor přívozu pouze při plavbě.
NEW: rybář 28 × 30 u s klidnou sedící pózou a samostatným prutem.
NEW: přívoz 90 × 35 u s rozpoznatelnou přídí; vážka 16 × 10 u; ryba 24 × 12 u.
NEW: hráz/výpust 100 × 35 u a břehový rákosový shluk 100 × 45 u.
Upravit `back.watermill`: oddělit kolo přibližně 52 × 52 u, zachovat společný pivot a kontaktní bod náhonu.
Vodní tvary se generují z geometrie; `near.pond` se nekopíruje jako univerzální náhrada různých rybníků.
