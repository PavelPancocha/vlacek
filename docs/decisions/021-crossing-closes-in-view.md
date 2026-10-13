# D-021: Přejezd zavírá v záběru před vlakem

Datum: 2026-10-13. Stav: přijato. Aktualizuje [D-015](015-level-crossings.md).

## Důvod

Pevný předstih 2 240 u spouštěl výstrahu i závory mimo obrazovku. Při pomalé jízdě dítě vidělo až zavřený přejezd. Zadání chce vidět čekající auta, červenou výstrahu a sklápění závor před příjezdem vlaku, při zachování bezpečnosti celé soupravy.

## Rozhodnutí a časový model

`LevelCrossing` přijímá jeden vlak nebo seznam všech relevantních vlaků. Každý uvádí čelo, konec, směr, aktuální rychlost, rychlostní limit a maximální zrychlení. `earliestArrivalSeconds` je čistý výpočet nejčasnějšího příjezdu: nejprve maximální zrychlení, potom jízda na limitu. Pro vzdálenost `d`, rychlost `v`, limit `V` a zrychlení `a`:

```text
ta = (V - v) / a
da = (v + V) * ta / 2
pokud d <= da: tArr = 2*d / (sqrt(v*v + 2*a*d) + v)
jinak:         tArr = ta + (d - da) / V
pro a = 0:     tArr = d / v (při v = 0 nekonečno)
```

Měříme vzdálenost v x od čela k bližšímu okraji rozšířené zóny ±62 u. Obsazená zóna má čas 0, projetý vlak nekonečno. Obsazení používá celý interval min/max čela a konce, včetně mezer mezi vozidly a směru −1. Hráč používá rychlostní limit rodičovského nastavení a nejvyšší možné zrychlení `160 × (1 + 0,25) = 200 u/s²`, tedy i maximum při klesání. Rychlost po délce trati je konzervativní horní mez rychlosti v x.

Pro každý vlak platí časová rezerva `Tmargin = distanceMarginU / V`. Silnice blokuje nový průjezd stop čárou při `tArr ≤ 2 + 1,2 + 0,8 + 0,5 + Tmargin`. Již rozjetý aktér dokončí průjezd v `CLEARING`. Následuje `WARNING`, nejméně 1,2 s. Sklápění začne, když `tArr ≤ 0,8 + 0,5 + Tmargin`, nebo po 4 s výstrahy, vždy až po jejím minimu. Maximální výstraha umožňuje viditelné zavření i při pomalé jízdě nebo stání.

Otevření začíná pouze při prázdné rozšířené zóně a časech všech vlaků nad prahem blokování plus 0,5 s hystereze. Nový blízký vlak při `OPENING` vrátí automat do `CLOSING`; silnice stále čeká. Přejezd vzniká zavřený, jestliže je již obsazený nebo uvnitř predikovaného předstihu, tedy i po obnově před prvním snímkem (SCN-08).

Původní `crossingCloseDistanceU` zůstává konzervativním dosahem streamování, 2 240 u při 480 u/s. Není spouštěčem všech fází. Seedování provozu, stop čáry, rychlosti a limity front se nemění.

## Bezpečnostní argument

Při platném pohybu nemůže nejkratší čas příjezdu klesnout o více než uplynulý simulační čas: skutečné zrychlení i rychlost nepřekročí predikované horní meze. Po prvním zablokování tedy zbývá vyklizení silnice, minimální výstraha, zavření a `Tsafety`. Po spouštěcím prahu sklápění zbývá zavření a `Tsafety`. Rezerva 80 u / 480 u/s = 0,167 s kryje i přechody automatu v diskrétních krocích 1/60 s. Maximální výstraha může zavřít pouze dříve. Závory se neotevřou mezi lokomotivou a posledním vagónem; žádný čekající aktér nepřejíždí z netrpělivosti.

## Konfigurace a diagnostika

- Zachováno: vyklizení 2 s, minimum výstrahy 1,2 s, zavření/otevření 0,8 s, bezpečnost 0,5 s, rezerva 80 u, šest aut a dvě kola.
- Nové: `maxWarningSeconds: 4`, konečné kladné číslo nejméně `warningSeconds`; `openHysteresisSeconds: 0.5`, konečné kladné číslo. Konfigurace odmítá neplatné hodnoty.
- `crossings[].worldX` uvádí střed přejezdu ve světě, `screenX` jeho projekci v CSS px podle horizontálního rámování. Aktualizace `camera-1` v [D-028](028-longer-consist.md) používá přímo poslední vykreslený pohled `RideScene.worldScreenX`, včetně interpolace a rebase; aplikace nekopíruje rámovací vzorec. Testy sledují každý browserový snímek, aby neminuly začátek sklápění. `crossings[].tailX` uvádí konec hráčovy soupravy ve světových u a umožňuje přesně pozorovat uvolnění rozšířené zóny.

## Geometrie

Deck již používal výšku a sklon koleje v místě silnice. `roadPointY` nyní pro nulový bod používá přesně tutéž výšku, nikoli interpolaci mezi hlavou kolejnice a patou náspu. Příčné body silnice, stop čar, pat zařízení a dráhy aktérů používají sklon společného bodu (`railSlope`, render dy/dx). Výstražníky stojí za krajem silnice o další 4 u. Obě kreslicí vrstvy vozovky se setkávají v `roadU = 0`: vzadu −220 až 0, vpředu 0 až pokračování louky. Tím mizí nekreslený úsek −20 až +22 i odkrytý násep mezi deckem a přední silnicí. Pokračování pod loukou má přesah odpovídající sklonu, takže se na krajích nerozejde. Potok pod mostem nadále používá původní sdílený hloubkový profil bez sklonového crossing rámce. Orientaci aut ani jejich assety tato změna neřeší.

## Ověření

Jednotkové testy pokrývají příjezdy z klidu, za jízdy a na limitu, minimum i maximum výstrahy, hysterezi, druhý vlak směrem −1, obnovu a 40 reprodukovatelných seedů s reálným plynem/brzdou/dojezdem a soupravou 1 600 u. Kontrolují závory dole nejméně `Tsafety` před vstupem do rozšířené zóny i nepřítomnost souběžného konfliktu silnice a vlaku. Geometrie ověřuje oba sklony a obě strany silnice. Renderový test vytváří skutečný `ChunkView` s art i fallback cestou a kontroluje patu auta a sloupku proti vykreslenému asfaltovému polygonu na rovině i obou sklonech; zachytí i vynechané předání společného rámce v konstruktoru.

E2E `crossings.spec.ts` ověřuje krátkou soupravu při plném plynu a kolem 240 u/s: začátek sklápění je uvnitř viewportu. Původní souprava 1 600 u při starém rámování vstupovala do viewportu se závorami v pohybu nebo dole. Širší rámování `camera-1` a skutečné maximum 2 000 u nově vyžadují také viditelný začátek sklápění. Žádné očekávání bezpečného průjezdu se nemění. Zachovává průjezd celé soupravy a dokončený průjezd čekajícího silničního aktéra. Fronta se pozoruje každý browserový snímek: test zachytí existující konečný `crossedBefore` a vyžaduje zvýšení `crossed` na stále existujícím otevřeném přejezdu se závorami nahoře a vlakem mimo silnici. Ihned po uvolnění rozšířené zóny koncem soupravy deterministicky zapne brzdu přes veřejný vstup; vlak se zastaví před dosahem odstranění přejezdu, takže provoz stihne dokončit průjezd. Odstranění instance nepředstírá průjezd auta pomocí nekonečného čítače. Regrese fronty začíná platným save se stojícím vlakem na přejezdu, takže pomalý runner nemůže minout místo při následném brzdění.

## Kompatibilita a omezení

Save schema, katalogová ID, umístění přejezdů a generátor se nemění. Stav přejezdu se neukládá a po obnově se bezpečně odvodí. Geometrická oprava mění kresbu, nikoli rozehranou kolej.

Aktuální druhá kolej ve slotech 4–6 nikdy nevede přes přejezd ve slotu 3. Není tedy relevantní k jeho konfliktu; seznam více vlaků ověřuje syntetický test. Až generátor přidá skutečné křížení další koleje, její vlaky musí volající zahrnout do seznamu. Zvonění patří samostatné zvukové lane. Fyzický tablet a Tesla jsou NEOVĚŘENO.
