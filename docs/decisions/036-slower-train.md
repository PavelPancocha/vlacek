# D-036 — Poloviční rychlost vlaku a rytmus páry

Datum: 2026-10-21. Stav: přijato. Navazuje na [D-035](035-steam-chuff-rhythm.md).

## Důvod a volba majitele

Po poslechu nahrávek před/po omezení páry v buildu `0.1.0+fee81b6`
(480 u/s, strop 6 rázů/s) majitel uvedl:

> "Start even slower, go max 1/2 of current"
> "Train can go slower"

Na upřesnění zvolil **„Train + sound“** a zrychlení **„Half“**: zpomalit
vlak i zvuk, s jemnějším rozjezdem. Toto rozhodnutí nahrazuje dřívější
požadavek svižnější jízdy v dokumentu 14 §6.

## Konfigurace pohybu

| Klíč `train`                | Před D-036 | Aktuálně |
| --------------------------- | ---------: | -------: |
| `maxSpeedUPerSec`           |        480 |      240 |
| `accelerationUPerSec2`      |        160 |       80 |
| `coastDecelerationUPerSec2` |         96 |       48 |
| `brakeDecelerationUPerSec2` |        480 |      240 |

Všechny tři sazby klesají na polovinu: na rovině `240 / 80 = 3 s`
rozjezdu, `240 / 48 = 5 s` dojezdu a `240 / 240 = 1 s` brzdění.
Samotné snížení rychlosti by změnilo zamýšlené časy z dokumentu 03.
Držení, puštění i priorita brzdy zůstávají. Zastavovací vzdálenosti
`v²/(2a)` jsou nyní 600 u při dojezdu a 120 u s brzdou.
`slowModeSpeedFactor = 0.65`, sklonové faktory, epsilon, NPC 100–160 u/s
a kamera se nemění; pomalý režim má limit 156 u/s.

### Aktuální kamera a starší čísla ve specifikaci

Základ `fee81b6` už používá `camera-1`: zoom `0.60 × šířka / 2000`
pro všechny povolené sestavy. Proto se skutečná rychlost obrazu mění
**0,144 → 0,072 šířky/s**, stejně pro krátký i nejdelší vlak.
Test `gameConfig` ověřuje právě tuto současnou kameru. Starší čísla
0,216 / 0,1728 šířky/s by při stejné tehdejší kameře klesla na
0,108 / 0,0864; nepopisují aktuální build. Kamera se kvůli jejich dosažení
nepřelaďuje. Specifikace 03 a komentář configu nyní odpovídají skutečnosti.

## Přejezdy, streaming a stavba chunků

- `crossingCloseDistanceU` zůstává odvozené: `240 × (2 + 1,2 + 0,8 + 0,5) + 80 = 1160 u`.
  [D-021](021-crossing-closes-in-view.md) používá nejčasnější příjezd,
  nikoli pevný trigger všech fází. Nejvyšší hráčovo zrychlení je nyní
  `80 × (1 + 0,25) = 100 u/s²`; rezerva `80 / 240 = 0,333 s`
  místo 0,167 s. Příklad z klidu na vzdálenost 1 160 u k hranici zóny:
  zrychlení 2,4 s a 288 u, poté 872/240 s, celkem 6,033 s;
  na plném limitu 4,833 s. Ostatní fáze a bezpečnost se nemění.
- `RideSimulation` předává aktuální limit i zrychlení z configu.
  Přejezdový simulační předstih se odvozuje z nových 1 160 u; traťový
  koridor zůstává nejméně 2 048 u před čelem a 1 600 u za koncem.
  Nemění se LUT, počet vozidel, horizont rendereru ani 8 192u předstih
  regionálních atlasů. Geometrický koridor je delší než nový Dclose.
- Jeden 1 024u chunk trvá na rovině `1024 / 240 ≈ 4,27 s`
  místo `1024 / 480 ≈ 2,13 s`. Práce na jeden chunk se nezmenšila;
  pouze vzniká méně často. To je vstup do druhého kola měření
  [D-034](034-ride-frame-pacing-instrumentation.md), nikoli důkaz
  menšího nejhoršího snímku. `measure:perf` tento běh nespouští.
- Region 24 576–57 344 u trvá na plném limitu asi 102–239 s.
  `validate:world` dále kontroluje stejné seedy, chunky a invarianty;
  počet průchodů ani hranice generátoru se nesnižují.
- Elektrifikace, podpěry, kontakt pantografu a průjezd mostů/tunelů se
  řídí geometrií. Unit i E2E je ověřují také s novou jízdní rychlostí;
  fyzická geometrie, kamera a generátor se nemění.

## Zvuk

Koleno/strop páry klesá **4/6 → 2/3 rázů/s**, překryv zůstává 1,5.
Kolena jsou 47,123890 / 59,690260 u/s pro `steam_local` / `steam_express`.
Při 240 u/s oba typy hrají přibližně 3 rázy/s s délkou 0,5 s.
Pod kolenem je přesně jeden ráz na takt kola, fáze se neresetuje.
Tabulku a regresní kontrakt včetně čekajícího rázu vlastní
[aktuální dodatek D-035](035-steam-chuff-rhythm.md).

`wheelSound(speed)` zůstává **absolutní v u/s**: původní referenci
480 u/s drží lokálně v audio mapování, nesmí se normalizovat aktuálním
maximem vlaku. Při 240 u/s je playback rate 1,175 a gain 0,425;
původně na 480 u/s byly 1,7 a 0,7. Diesel a elektrika odvozují mix
od stejného gainu kol, takže s nižší rychlostí přirozeně znějí pomaleji.
Nahrávky, limity zdrojů, filtry a hlasitost páry se nemění.

## Uložená cesta a kompatibilita

Schéma/content/generátor zůstávají 1/1/2, katalogová ID i geometrie beze
změny. Rychlost v save podle dokumentu 08 vůbec není. Integrační regrese
vytvoří historický vlak s limitem 480 u/s a starými sazbami, skutečně
jej rozjede nad 240 u/s, uloží periodickým checkpointem po 5 s ještě
za jízdy a obnoví novým configem.
Poloha x/y, kurzor a tick jsou stejné; rychlost je 0, potvrzení návratu
bez dalšího vstupu vlak neposune a nový dotyk respektuje limit 240 u/s.
Není potřeba migrace ani skokové omezování uložené rychlosti.

## Testy a jízdní rozpočty

Konfigurační a zvukové změny vznikly red → green. Přesné příkazy/výsledky
kontrol jsou součástí předání tohoto běhu; následující seznam vysvětluje
změněné testovací kontrakty.

- `gameConfig.test.ts`: 0,072 šířky/s při obou délkách, hodnoty
  240/80/48/240 a původní meze rozjezdu/dojezdu/brzdy.
- `AudioDirector.test.ts`: 30 u/s pod oběma novými koleny, 10 s na
  configovém limitu s 2,9–3 rázy/s a 0,5s délkou, koleno 47/60 u/s,
  hladká křivka a fáze. Skutečný manager přehraje všechny požadavky
  ramp 0/40 → 240 → 0, +80 a −48/−80/−240 u/s², při 30/60 FPS,
  s nejvýše dvěma živými rázy a zdrojovým stropem 11.
- `RideSimulation.test.ts`: tři fixture přejezdu začínají v chunku 1 /
  450 u, takže kratší předstih instanci již obsahuje a počáteční vzdálenost
  stále přesahuje Dclose. Dva testy pozdravu NPC jedou do otevřené části
  druhé koleje (`site.fromX + 200`), místo pevného třísekundového rozjezdu;
  jinak by pomalejší vlak zastavil před portálem a k setkání vůbec nedošlo.
  `longestConsist.test.ts` simuluje původní obálku 24 000 u:
  `50 × 480 / Vmax = 100 s` místo 50 s, se stejnými mezemi 7 chunků /
  903 vzorků a požadavkem na skutečné setkání.
- `LevelCrossing.test.ts`: původní 1 500u stojící přístup odpovídal
  přibližně 3 s dráhy na limitu; nový přístup je přesně
  `CROSSING_ZONE_HALF_U + Vmax × 3 = 782 u`. Očekávání WARNING,
  minimální/maximální výstrahy a uzavření se nemění. Příklady nejčasnějšího
  příjezdu počítají z configu. Revize 2026-10-21 po nezávislé recenzi
  rozlišuje příjezd během zrychlování z nenulové rychlosti (120 u/s,
  vzdálenost 120 u < 216 u do dosažení limitu, kvadratický čas přibližně
  0,7595917942 s) a příjezd po dosažení limitu (240 u, 1,3 s). Obě
  očekávání používají výslovnou přesnost 10 desetinných míst; produkční
  výpočet se nemění. Seedové bezpečnostní testy zůstávají.
- `electric.spec.ts`, tři průjezdy TRN-08: původní vzorkovací obálka
  `300 × 0,05 × 480 = 7200 u` nyní používá `7200 / Vmax / 0,05`
  vzorků, tedy 600 místo 300 (30 místo 15 s). Stejně
  `structures.spec.ts`, TRN-06/08. Existující limity celého testu
  60/90 s stačí; očekávání kontaktu a průjezdu jsou stejná.
- `crossings.spec.ts`, průjezd všech fází: obálka
  `200 × 0,1 × 480 = 9600 u` má nyní 400 místo 200 vzorků
  (40 místo 20 s); celý test zůstává 60 s. Výchozí kurzor tohoto testu
  se přesouvá z chunku 0 / 800 u do chunku 1 / 450 u: po zkrácení
  streamovacího dosahu už původní místo nemá instanci přejezdu. Nové
  místo stále obnovuje skutečně OPEN přejezd mimo Dclose, což test dál vyžaduje. Krátká poloviční varianta
  reguluje kolem `Vmax / 2` (120 místo 240 u/s) a rychlostní meze
  jsou původní poměry 220/480–270/480, plná varianta ≥430/480.
  Bezpečnost, viditelnost začátku sklápění a průjezd posledního vozu
  nemají oslabené očekávání. Dosavadních 2 400 snímků (40 s při 60 FPS)
  těchto tří přístupů stačí i při nové rychlosti; rozpočet neroste.
- `seasonal-rendering.spec.ts`, osm kombinací sněhu a víření: po
  stejných 360 herních ticích vyžaduje původní podíl >400/480 maxima,
  nyní >200 u/s. Žádný pixelový práh ani počet snímků se nemění.
- `tunnel-occlusion.spec.ts`: šest míst simulujících plnou rychlost
  přijímá serializovaný limit z configu namísto 480. Pixelové prahy,
  brzdové/tunelové potlačení, animace NPC a čekání zůstávají stejné.
- Částicové unit/renderové testy a `AudioTunnelWindow` přebírají
  plnou rychlost z configu; geometrické kroky 480 u a 480chunkové
  sweeps nejsou rychlosti a zůstávají. Historické hodnoty v regresi
  obnovy i absolutní zvukové referenci jsou záměrné.

## Omezení

Pocit z jízdy, poslech a hlasitost na fyzickém tabletu a Tesle včetně
konkrétního zařízení/firmwaru: **NEOVĚŘENO**. Desktopová emulace není
ověření zařízení. Pomalejší jízda nezaručuje vyřešení snímkových špiček
při stavbě chunku; to vyžaduje nové měření D-034 na cílovém zařízení.
