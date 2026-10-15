# Mosty a tunely v krajině

Tyto kompozice se vkládají do hostitelských scén a mají jediného vlastníka napříč chunky.
Most potřebuje skutečnou překážku; tunel potřebuje souvislou hmotu kopce nebo hory.
Elektrická lokomotiva má odpovídající vedení také na mostech, ve stanicích a uvnitř tunelu.

## TB-01 — Nízký kamenný most přes potok

V dálce pokračuje louka, les nebo podhorské údolí.
Za tratí přitéká potok a jeho břehy směřují k mostu.
Kolej překročí vodu po nízkém kamenném oblouku.
Před vlakem potok pokračuje mezi kameny a nízkými rostlinami.
Voda se pomalu třpytí a žába zůstává u jednoho bezpečného břehu.
Nad mostem je otevřená obloha a nic dalšího nezahlcuje krátký motiv.

| Zóna           | Objekty                                          | Počet                     | Vztahy a závislosti               | Zakázáno                   |
| -------------- | ------------------------------------------------ | ------------------------- | --------------------------------- | -------------------------- |
| far            | Pozadí hostitele                                 | Souvislé                  | Most je vložený do krajiny        | Změna biomu kvůli mostu    |
| back 0,25–0,85 | Geometrie potoka, `back.reeds`                   | 1 tok, 2–4 rákosiny       | Přítok k oblouku                  | Rákosí na suché skále      |
| bank           | `bridge.stone`, `bridge.railing`                 | 1–2 pole podle šířky toku | Opěry na březích, otvor nad vodou | Most na rovné suché louce  |
| near 0,35–0,85 | Pokračování potoka, `near.stones`, `animal.frog` | 3–5 skupin, 0–1 žába      | Voda skutečně pod mostem          | Pilíř uzavírající celý tok |

## TB-02 — Ocelový most přes řeku

V dálce se rozprostírá širší říční údolí.
Za tratí je souvislá řeka s otevřeným průhledem na protější břeh.
Kolej vede po ocelové konstrukci, jejíž hlavní nosníky jsou za vlakem nebo pod ním.
Před soupravou zůstává nízké zábradlí pod chráněným pásmem vozidel.
Loďka může pomalu projet vyhrazeným vodním koridorem mezi opěrami.
Nad řekou se pohybují ptáci a obloha zůstává čitelná mezi vzdálenými stromy.

| Zóna           | Objekty                                        | Počet                   | Vztahy a závislosti              | Zakázáno                         |
| -------------- | ---------------------------------------------- | ----------------------- | -------------------------------- | -------------------------------- |
| far            | Pozadí hostitele                               | Souvislé                | Údolní průhled                   | Neodůvodněné moře                |
| back 0,25–0,90 | Geometrie řeky, `tree.willow`, `back.rowboat`  | 1 tok, 2–5 vrb, 0–1 loď | Loď v průjezdném vodním koridoru | Loď přes pilíř                   |
| bank           | NEW: ocelové pole 256 × 90 u, opěra 50 × 100 u | 2–4 pole, 2 opěry       | Konstrukce podepírá kolej        | Přední příhradovina přes vlak    |
| near 0,40–0,90 | Voda, `near.reeds`, nízké břehy                | 3–6 skupin              | Tok pokračuje pod mostem         | Voda jen jako modrý sprite vedle |

## TB-03 — Vysoký viadukt

Daleko jsou podhorské nebo horské hřbety v několika hloubkách.
Za tratí padá svah do údolí s potokem nebo cestou.
Kolej vede přes řadu kamenných oblouků a na koncích navazuje na skutečné svahy.
Před vlakem je vidět konstrukce pod kolejí a nízké dno údolí.
Po vzdálené cestě může přejít člověk nebo projet jedno auto mimo mostní podpěry.
Nad údolím pomalu plynou mraky a vlak zůstává hlavní vodorovnou siluetou.

| Zóna           | Objekty                                              | Počet                  | Vztahy a závislosti                                    | Zakázáno                       |
| -------------- | ---------------------------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------------------ |
| far            | Hřbety hostitele                                     | 2–3 vrstvy             | Skutečný výškový rozdíl                                | Plochá zem těsně pod mostovkou |
| back 0,30–0,90 | Geometrie svahů a údolí, lesní skupiny               | 2 svahy, 2–4 skupiny   | Údolí pokračuje za most                                | Strom v opěře                  |
| bank           | NEW: viaduktový oblouk 160 × 160 u, pilíř 40 × 160 u | 4–8 oblouků            | Podpěry dosahují k terénu, délka přibližně 640–1 280 u | Plovoucí pilíř                 |
| near 0,40–0,95 | Tok nebo údolní cesta, `near.stones`, `near.bush`    | 1 překážka, 3–6 skupin | Volná cesta mezi podpěrami                             | Auto v toku bez mostu          |

## TB-04 — Krátký zděný tunel

V dálce pokračují kopce a za tratí se přiblíží nižší lesnatý hřbet.
Kolej vstoupí zděným portálem do souvislé hmoty kopce.
Výjezd je skutečný druhý portál téže stavby, nikoli dekorace dalšího chunku.
Před vlakem zůstává nízké okolí a otevřené přístupové úseky.
Vozidla mizí postupně a u krátké varianty může být část soupravy současně před i za tunelem.
Nad kopcem pokračuje obloha, ptáci a sezónně správná vegetace.

| Zóna           | Objekty                             | Počet                      | Vztahy a závislosti               | Zakázáno                          |
| -------------- | ----------------------------------- | -------------------------- | --------------------------------- | --------------------------------- |
| far            | Pozadí hostitele                    | Souvislé                   | Kopec patří do okolí              | Náhodná zelená bublina            |
| back 0,30–0,90 | Geometrie kopce, stromy hostitele   | 1 těleso, 3–6 skupin       | Vegetace mimo portálové rezervace | Strom uvnitř otvoru               |
| bank           | `tunnel.portal`, neprůhledné těleso | 2 portály, délka 448–768 u | Jedna stavba, správná kolej       | Průhlednost místo zakrytí         |
| near 0,35–0,85 | `near.bush`, `near.stones`          | 3–6 skupin                 | Mimo těleso a příjezdy            | Dodatečné zakrytí otevřené koleje |

## TB-05 — Dlouhý skalní tunel

Vzdálené hřbety a zadní svah vytvářejí souvislou horu.
Kolej do ní vchází skalním portálem a výjezd leží skutečně daleko za vstupem.
Uvnitř stavby pokračuje stejná geometrie koleje i potřebný elektrický kontakt.
Přední nízké kameny nechávají otevřené části trati přehledné.
Celá souprava může na určitou dobu zmizet za horninou, zatímco kamera dál sleduje její cestu.
Obloha a venkovní počasí pokračují nad horou, ale kouř ani jiskry nesmějí prosvítat jejím tělesem.

| Zóna           | Objekty                                          | Počet                            | Vztahy a závislosti                        | Zakázáno                              |
| -------------- | ------------------------------------------------ | -------------------------------- | ------------------------------------------ | ------------------------------------- |
| far            | Horské nebo podhorské hřbety                     | Souvislé                         | Délku vysvětluje hora                      | Dva portály bez hmoty mezi nimi       |
| back 0,30–0,90 | Geometrie skalního tělesa a hostitelský les      | 1 stavba, fragmenty podle výřezu | Společné hraniční vzorky                   | Jedna neomezeně dlouhá textura        |
| bank           | NEW: skalní portál 180 × 240 u; neprůhledný kryt | 2 portály, délka 1 024–4 096 u   | Varianta 3 072–4 096 u přesahuje celý vlak | Skrytí všech kolejí podle samotného x |
| near 0,40–0,90 | `near.boulder`, mladé stromky hostitele          | 3–6 skupin                       | Mimo příjezd a otvor                       | Částice kreslené skrz skálu           |

## Činnosti, profil a čitelnost

TB-01 až TB-03 používají proud, ptactvo a případnou loď; průjezdová odezva má cooldown nejméně 20 s.
Tunel nepřidává výraznou scénickou akci; odezvu pohybu dává kamera a existující zvuk jízdy.
Most má rovinu nebo konstantní mírný sklon do 0,03; zaoblení leží mimo hlavní konstrukční pole.
Tunel může pokračovat konstantním sklonem hostitele, vždy do `world.maxTrackGrade`, s ověřeným průjezdným profilem.
Žádná stavba nesmí dodatečně narovnat pouze kresbu a odpojit ji od skutečné geometrie vozidel.
Kryt tunelu pracuje pro jednotlivé části hráčovy i NPC soupravy a příslušnou kolej, v obou směrech.
Portál má rezervu pro nejvyšší vozidlo, sběrač a vedení; konkrétní světlost ověří katalogová geometrie.
Mostní konzoly a tunelový kontakt jsou součást elektrifikované trasy, ne volitelná dekorace.

## Sezóny a zvuky

Jaro a léto přebírají zeleň hostitele; podzim přidává listí pouze od jeho listnáčů.
Zima pokrývá římsy, zem a vhodné části konstrukcí, ale nezakrývá čitelnost koleje ani portálových otvorů.
Pobřežní a dunové stavby používají svůj preset bez automatického sněhu; horské jen léto nebo zimu.
Venkovní sněžení pokračuje nad tunelem, lokální sníh od kol vzniká jen na skutečně zasněžené otevřené trati.
Použít potok, vítr a hostitelské ptactvo; nové audio: jemný mostní dozvuk a tlumená tunelová odezva vlaku.
Žádné dunivé nárazy, lekavá ozvěna ani zvuk jako podmínka pokračování.

## Nové kresby

NEW: ocelové pole 256 × 90 u a opěra 50 × 100 u; nosná struktura převážně pod kolejí.
NEW: viaduktový oblouk 160 × 160 u a navazující pilíř 40 × 160 u; čitelné kamenné zdivo.
NEW: skalní portál 180 × 240 u; oddělené boční části, otvor a překrývající hornina.
NEW: mostní konzola vedení 36 × 170 u, tunelový kontakt 128 × 12 u a staniční nosník 256 × 180 u.
Kryty a dlouhá tělesa vznikají z omezených fragmentů, nikoli z natažení jednoho obřího SVG.
Použít existující zděný portál, kamenný most a zábradlí tam, kde odpovídají potřebné geometrii.

### Sezónní život D-027

Sezónní části a činnosti používají společný [kontrakt D-027](README.md#sezónní-vzhled-a-život--d-027)
a řádky SEA-01 až SEA-08 v [akceptaci](acceptance.md). Jedna váha podle x řídí
koruny, podklad i intenzitu částic; stání pouze nechává pokračovat animaci.

### Vedlejší zimní portály — D-027

Sníh kryje travnaté křídlo obou vedlejších kopců bez zásahu do oblouku
či kamenné zdi. Počasí kontroluje omezenou siluetu portálu a rohy celého
sprite; pod otevřeným obloukem platí jeho skutečný otvor. Sněžení venku
pokračuje, bez vypínače vázaného na polohu vlaku. Snow caps hlavních tunelů
sdílejí běžný střešní díl; atlas musí zahrnout všechny zimní hostitele.
