# Zemědělský venkov

Region spojuje práci na polích, sady, remízky a pastviny; pole jsou za tratí i před vlakem.
Používá pravidla a jednotky z [README](README.md); velká vesnice se vkládá podle [village.md](village.md).

## CR-01 — Pole s traktorem a sklizní

Daleko se táhnou nízké kopce s dlouhými pruhy polí.
Za tratí leží větší lán, jehož brázdy směřují k polní cestě.
U náspu zůstává travnatý pás s několika máky a odvodňovací strouhou.
Před vlakem pokračuje druhé pole, kde traktor pomalu projíždí připraveným pracovním pruhem.
Za pluhem zůstává krátká stopa tmavší půdy a při suchu nepatrný prach.
Nad zoráním někdy krouží několik bílých ptáků; v létě může práci převzít kombajn.

| Zóna           | Objekty                                                              | Počet                  | Vztahy a závislosti            | Zakázáno                    |
| -------------- | -------------------------------------------------------------------- | ---------------------- | ------------------------------ | --------------------------- |
| far            | `backdrop.countryside-far`, `backdrop.countryside-mid`               | Souvislé pásy          | Pole pokračují k horizontu     | Drobné interaktivní stroje  |
| back 0,25–0,85 | Geometrie pole a polní cesty                                         | 1–2 lány               | Cesta dosahuje okraje pole     | Osamocená silnice pod autem |
| bank           | `near.grass-a`, `near.poppies`                                       | 3–6/1 024 u            | Mimo kolej a příkop            | Vysoké obilí přes kola      |
| near 0,35–0,75 | `back.tractor`; NEW: pluh 44 × 24 u; alternativně kombajn 110 × 60 u | 1 stroj, 1 nářadí      | Celý pracovní obal uvnitř pole | Jízda do náspu              |
| near 0,20–0,85 | NEW: nízké řádky plodin 128 × 22 u; `back.haybale`                   | 3–8 skupin, 0–4 balíky | Balíky jen na sklizené ploše   | Sklizeň v zimě              |

## CR-02 — Ovocný sad

Na obzoru zůstávají pole a několik střech statku.
Za tratí stojí nepravidelné, ale čitelné řady jabloní a švestek.
Mezi sadem a kolejí vede úzká travnatá mez.
V popředí jsou bedýnky, nízká tráva a koncový úsek plotu s brankou.
Zemědělec občas přejde od stromu k bedýnkám a při průjezdu zamává.
Mraky se pomalu posouvají a nad kvetoucí částí sadu mohou poletovat motýli.

| Zóna           | Objekty                                 | Počet               | Vztahy a závislosti          | Zakázáno                 |
| -------------- | --------------------------------------- | ------------------- | ---------------------------- | ------------------------ |
| far            | Venkovské pozadí, `back.farmhouse`      | 0–1 vzdálený statek | Za sadem, u přístupové cesty | Druhá výrazná dominanta  |
| back 0,30–0,85 | `tree.apple`, `tree.plum`               | 8–16                | Řady uvnitř sadu s průchody  | Stromy na silnici        |
| bank           | `near.grass-b`                          | 3–5/1 024 u         | Souvislá mez                 | Plot přes průjezd        |
| near 0,30–0,70 | `back.crates`; NEW: zemědělec 16 × 36 u | 2–4 bedny, 1 člověk | U branky a pěšiny            | Bedny v koleji           |
| near 0,45–0,80 | Úplný plot z README, `near.bush`        | 1 úsek, 1–3 keře    | Ohraničuje sad, má oba konce | Náhodné nespojené panely |

## CR-03 — Remízek mezi poli

Vzdálené lány se na chvíli schovají za nízký hřbítek.
Za kolejí houstne skupina dubů, lip a bříz, která má jasný začátek a konec.
Násep zůstává otevřený a podél něj pokračuje travnatá mez.
Před vlakem jsou keře, kameny a několik nízkých květinových ostrůvků.
Ježek pomalu obejde keř a ptáci občas přeletí k sousednímu stromu.
Obloha je stále vidět mezi korunami a scéna slouží jako klidná mezera mezi pracemi.

| Zóna           | Objekty                                            | Počet             | Vztahy a závislosti                 | Zakázáno                   |
| -------------- | -------------------------------------------------- | ----------------- | ----------------------------------- | -------------------------- |
| far            | Venkovské pozadí                                   | 1 souvislý motiv  | Kopce navazují na pole              | Náhlá horská stěna         |
| back 0,25–0,80 | `tree.oak`, `tree.linden`, `tree.birch`            | 6–12              | Jeden shluk s nepravidelným okrajem | Rovnoměrné solitéry všude  |
| bank           | `near.grass-c`, `near.stones`                      | 4–7/1 024 u       | Podél meze                          | Kmeny v průjezdném profilu |
| near 0,30–0,80 | `near.bush`, `near.wildflowers`, `animal.hedgehog` | 3–6 keřů, 1 zvíře | Dráha ježka uvnitř remízku          | Vysoké stromy před vlakem  |

## CR-04 — Statek se dvorem

Za poli se objeví obytná část statku a stodola s taškovou střechou.
Obě budovy stojí u společného suchého dvora napojeného na cestu.
Mezi dvorem a tratí je travnatý odstup, nikoli další nahodilý dům.
Před vlakem leží nízké balíky a oplocený výběh se slepicemi.
Jedna slepice popojde k zrní a pes krátce proběhne podél vnitřní strany plotu.
Nad komínem se za chladného počasí zvedne jemný kouř pod klidnou oblohou.

| Zóna           | Objekty                                                | Počet                            | Vztahy a závislosti              | Zakázáno                |
| -------------- | ------------------------------------------------------ | -------------------------------- | -------------------------------- | ----------------------- |
| far            | Venkovské pozadí                                       | Souvislé                         | Statek zůstává místní dominantou | Druhý statek hned vedle |
| back 0,25–0,75 | `back.farmhouse`, `back.barn`                          | 1 + 1                            | Společný dvůr a přístup          | Budova v cestě          |
| bank           | Geometrie meze, `near.grass-a`                         | 1 pás                            | Odděluje dvůr od trati           | Vrata ústící do koleje  |
| near 0,30–0,75 | `back.haybale`, `animal.hen`, `animal.dog`, úplný plot | 2–5 balíků, 2–4 slepice, 0–1 pes | Zvířata uvnitř výběhu            | Pes běžící přes kolej   |

## CR-05 — Pastvina a napajedlo

Daleko jsou louky rozdělené mezemi, nikoli souvislá zástavba.
Za tratí se pase malá skupina krav nebo ovcí pod několika stromy.
U koleje zůstává nízká tráva a nepřerušený bezpečný odstup.
Před vlakem pokračuje pastvina s napajedlem a uzavřeným plotem.
Jedna kráva občas dojde k vodě, ostatní se pasou každá vlastním rytmem.
Nad loukou proletí pták a za teplého dne se v trávě ozvou cvrčci.

| Zóna           | Objekty                                                                | Počet                    | Vztahy a závislosti            | Zakázáno                     |
| -------------- | ---------------------------------------------------------------------- | ------------------------ | ------------------------------ | ---------------------------- |
| far            | Venkovské pozadí                                                       | Souvislé                 | Otevřené louky                 | Velké vodní plochy bez scény |
| back 0,35–0,75 | `tree.oak`, `animal.cow` nebo `animal.sheep`                           | 1–3 stromy, 2–4 zvířata  | Uvnitř zadní pastviny          | Zvířata na trati             |
| bank           | `near.grass-a/b/c`                                                     | 4–8/1 024 u              | Travnatý okraj                 | Vysoká ohrada přes vlak      |
| near 0,35–0,80 | `animal.cow` nebo `animal.sheep`; NEW: napajedlo 60 × 20 u; úplný plot | 2–4 zvířata, 1 napajedlo | Souvislá bezpečná cesta k vodě | Napajedlo mimo výběh         |

## CR-06 — Polní cesta k přejezdu

Pole postupně ustoupí cestě lemované několika keři.
Za tratí cesta pokračuje k viditelnému statku nebo za vzdálený terén.
U koleje je jediný řízený přejezd se správně navazující vozovkou.
Před vlakem přichází stejná cesta od spodního okraje scény a traktor čeká před stop čárou.
Po bezpečném otevření projede předkem napřed a pokračuje po své cestě.
Nad polem zůstává otevřená obloha; průjezd nepotřebuje další souběžnou atrakci.

| Zóna           | Objekty                                         | Počet               | Vztahy a závislosti                   | Zakázáno                   |
| -------------- | ----------------------------------------------- | ------------------- | ------------------------------------- | -------------------------- |
| far            | Venkovské pozadí                                | Souvislé            | Cesta má věrohodné pokračování        | Slepý konec uprostřed pole |
| back 0,15–0,85 | Geometrie polní cesty, `back.bush-a`            | 1 cesta, 2–4 keře   | Napojení na přejezd                   | Keře ve vozovce            |
| bank           | `crossing.deck`, příslušné závory a výstražníky | 1 vlastněný přejezd | Používá společný dopravní automat     | Dekorativní druhé závory   |
| near 0,15–0,80 | `back.tractor`, `near.grass-c`                  | 0–1 traktor         | Jen schválená dráha silničního aktéra | Neřízený patrol přes kolej |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                             | Reakce na vlak; cooldown                  |
| ----- | -------------------------------------------------------------- | ----------------------------------------- |
| CR-01 | Pracovní průjezd 20–40 s; otáčení na souvrati, omezený prach   | Zemědělec krátce zamává; 16 s             |
| CR-02 | Přenesení bedýnky 18–35 s; v létě sběr, na jaře prohlídka sadu | Zamávání; 16 s                            |
| CR-03 | Ježek popojde po 15–30 s; ptáci mají vlastní fáze              | 2–3 ptáci klidně vzlétnou; 20 s           |
| CR-04 | Slepice hledají potravu, vrata občas odhalí zvíře              | Pes běží podél plotu 2–3 s; 18 s          |
| CR-05 | Napití jedné krávy po 25–45 s                                  | Nejbližší zvíře zvedne hlavu; 12 s        |
| CR-06 | Provoz podle přejezdu                                          | Žádná reakce nezdržuje aktéra v konfliktu |

## Profil a sezóny

Cíl koleje v jádru: výška −100 až +100 u, běžný absolutní sklon 0–0,035; dlouhé roviny a měkká zaoblení.
Příjezdy z vyšší krajiny využívají přechodový interval; výška se na hranici neusekne.
Jaro: nízké zelené řádky, kvetoucí sad, příprava půdy a několik motýlů.
Léto: dozrávající obilí; CR-01 střídá kombajn nebo traktor s lisem a již připravené balíky.
Podzim: strniště, orba, bedny ovoce, barevné listnáče a listí u jejich korun.
Zima: zasněžená pole a střechy; traktor s radlicí čistí polní příjezd, neorá sníh a nesklízí obilí.

## Zvuky a nové kresby

Použít luční ptáky, vítr, cvrčky a zvířata; stroje mají tichý motor pouze poblíž své činnosti.
Nové audio: klidný traktor/kombajn, jemné šustění sklizně; žádné ostré startování.
NEW: pluh 44 × 24 u, lis 60 × 38 u a radlice 36 × 22 u; rozpoznatelné pracovní nářadí.
NEW: kombajn 110 × 60 u; nízká boční silueta s oddělenými koly a žacím ústrojím.
NEW: zemědělec 16 × 36 u v pracovní a mávací póze; napajedlo 60 × 20 u s viditelnou vodou.
NEW: řádky plodin 128 × 22 u a strniště 100 × 18 u; krátké opakovatelné skupiny.
Ploty, prach a sezónní varianty sdílí katalog v README; stroje nepotřebují novou kresbu pro každý barevný lán.
