# 06 — Katalog obsahu V1

[Zpět na rozcestník](README.md)

## 1. Jak katalog používat

ID jsou stabilní technické identifikátory pro data, assety, save a testy. Názvy jsou české texty rozhraní. Všechny řádky lokomotiv a vagonků níže patří do finální V1; jednotlivé milníky mohou začít menším počtem. Přidání dalšího typu má znamenat data a assety, ne změnu řídicí logiky hry.

Rozměry se zadávají ve světových jednotkách podle dokumentu 03. Uvedené délky jsou výchozí, dovolují rozumný souběh dlouhých a krátkých vozů. Přizpůsobení grafice nesmí překročit maximální délku 220 u bez přetestování geometrie.

Lokomotivy jsou vlastní ilustrace inspirované obecnými železničními typy. Nemají vyžadovat značku konkrétního výrobce, loga dopravce ani licenci ke známé dětské postavě.

## 2. Přesně deset lokomotiv

| ID | Název | Pohon | Délka u | Charakter a animace |
|---|---|---|---:|---|
| `steam_local` | Malá parní mašinka | steam | 156 | Krátký kotel, vysoký komín, tři výrazná kola, viditelná táhla; měkké bafání. |
| `steam_express` | Velká parní lokomotiva | steam | 216 | Delší kotel, větší hnací kola, robustní zadní část; hlubší píšťala. |
| `diesel_shunter` | Naftový posunovač | diesel | 148 | Kratší hranatý stroj s kabinou a ochozem, nízké motorové brumlání. |
| `diesel_mainline` | Velká naftová lokomotiva | diesel | 196 | Dvě kabiny, robustní skříň a mřížky větrání; rozdílná silueta od posunovače. |
| `electric_retro` | Hranatá elektrická | electric | 188 | Hranatá skříň a pantograf, jasně rozpoznatelné přední světlomety. |
| `electric_modern` | Moderní elektrická | electric | 204 | Zaoblená čela, hladké plochy, jiná okna a zvuk než retro typ. |
| `electric_mountain` | Horská elektrická | electric | 160 | Kratší robustní horský stroj, odlišný tvar kabiny, pantograf. |
| `magic_stars` | Hvězdičková mašinka | fantasy | 164 | Pohádkový komín pouští pomalé hvězdičky místo kouře; jinak má kola a kabinu. |
| `magic_bubbles` | Bublinková mašinka | fantasy | 164 | Zaoblené tvary, několik průhledných bublin; viditelné bubliny lze dotykem prasknout. |
| `magic_rainbow` | Duhová mašinka | fantasy | 176 | Barevné díly a měkké barevné obláčky; vlastní silueta, ne jen přebarvená první mašina. |

Sedm realistických a tři fantazijní typy je záměrný poměr. Elektrické typy mají `requiresCatenary: true`; ostatní false. Všechny mají stejný pohybový kontrakt. Žádný typ se neodemyká a žádný není „nejlepší“.

Velká parní lokomotiva nemá povinný samostatně připojovaný tendr v této verzi. Zásobu uhlí lze výtvarně zahrnout do její zadní části, aby lokomotiva vždy tvořila jeden jednoznačný výběr. Samostatný dekorativní uhlák z katalogu zůstává volitelný.

## 3. Třicet dva druhů vagonků

### Osobní — 6 druhů

| ID | Název | Délka u | Vzhled / volitelná místní reakce |
|---|---|---:|---|
| `passenger_classic` | Osobní vagón | 176 | Řada oken, různí cestující; dotyk vyvolá zamávání. |
| `passenger_double` | Patrový vagón | 192 | Dvě řady oken, zřetelně vyšší karoserie; mávání. |
| `passenger_sleeper` | Lůžkový vagón | 184 | Závěsy a klidné teplé osvětlení; po dotyku vykoukne cestující. |
| `passenger_dining` | Jídelní vagón | 184 | Stolky v oknech a malý jídelní piktogram; kuchař zamává. |
| `passenger_panorama` | Vyhlídkový vagón | 192 | Velká prosklená část; cestující se rozhlédnou. |
| `passenger_open` | Otevřený výletní vagónek | 144 | Lavice a lehká stříška; krátké mávání lidí. |

### Nákladní — 16 druhů

| ID | Název | Délka u | Rozpoznatelný obsah |
|---|---|---:|---|
| `cargo_box` | Krytý nákladní | 164 | Posuvné dveře a dřevěné či plechové boky. |
| `cargo_logs` | Klády | 176 | Zajištěné kmeny stromů. |
| `cargo_coal` | Uhlák | 152 | Tmavé uhlí v otevřeném voze. |
| `cargo_sand` | Písek | 152 | Světlý náklad s jiným tvarem a barvou než uhlí. |
| `cargo_gravel` | Kamení | 152 | Viditelné šedé a hnědé kameny, ne přebarvený písek. |
| `cargo_container` | Kontejnerový | 188 | Dva barevně odlišené kontejnery bez cizích log. |
| `cargo_tank` | Cisterna | 176 | Válcová cisterna na vodu, jednoduchý symbol kapky. |
| `cargo_milk` | Mléčný vagón | 168 | Světlá menší cisterna a piktogram mléka. |
| `cargo_grain` | Obilný vagón | 172 | Násypné tělo, malé symboly obilí. |
| `cargo_hay` | Sláma | 164 | Několik svázaných balíků slámy. |
| `cargo_apples` | Jablka | 156 | Bedýnky s viditelným červeným a zeleným ovocem. |
| `cargo_cars` | Přepravník aut | 204 | Dvě až tři malá auta; jedno může na dotyk zatroubit. |
| `cargo_tractor` | Vagón s traktorem | 184 | Nízká plošina s připevněným traktorem, krátký zvuk na dotyk. |
| `cargo_excavator` | Vagón s bagrem | 192 | Zajištěný bagr; malý pohyb ramene v bezpečném obrysu. |
| `cargo_mail` | Poštovní vagón | 164 | Poštovní symbol a balíky za okénkem, nikoli skutečný dopravce. |
| `cargo_refrigerated` | Chladírenský vagón | 176 | Světlá skříň, chladicí jednotka a jednoduchá vločka. |

### Služební — 3 druhy

| ID | Název | Délka u | Vzhled / reakce |
|---|---|---:|---|
| `service_crane` | Jeřábový vagón | 188 | Malý železniční jeřáb; lehké otočení ramene při dotyku. |
| `service_tools` | Dílenský vagón | 164 | Nářadí a servisní označení; otevření malého okénka. |
| `service_snowplow` | Vagón s pluhem | 156 | Složený nebo zvednutý pluh v obrysu vozu, nic před vlakem neodhrnuje. |

### Hravé — 7 druhů

| ID | Název | Délka u | Vzhled / reakce |
|---|---|---:|---|
| `fun_balloons` | Balónkový vagónek | 164 | Přivázané balónky se pohupují; dotyk přidá krátké zavlnění, nemaže celý náklad. |
| `fun_stars` | Hvězdičkový vagónek | 164 | Dekorace hvězd a jemné rozsvícení. |
| `fun_garden` | Zahrádkový vagónek | 172 | Truhlíky a květiny; po dotyku vyletí motýl. |
| `fun_aquarium` | Akvarijní vagónek | 176 | Zřetelně pohádková průhledná nádrž s několika rybkami. |
| `fun_windmill` | Větrníkový vagónek | 160 | Dva velké barevné větrníky se po dotyku roztočí. |
| `fun_lights` | Světýlkový vagónek | 168 | Lampičky a teplá světla, pomalé zesílení bez blikání. |
| `fun_toyblocks` | Vagónek s kostkami | 164 | Velké dřevěné kostky; po dotyku se lehce zhoupnou, nevypadávají. |

Místní reakce vagonků jsou dekorativní. Nevyžadují zastávku a nemění scénky světa. U vagonků bez uvedené reakce stačí drobný pružný vizuální pohyb vybraného dílu nebo žádná zvláštní interakce; nesmí z toho vzniknout potřeba 32 odlišných herních mechanik.

## 4. Variace, které nejsou novým druhem

Několik barevných variant, různý počet klád, barva kontejneru nebo mávající cestující se mohou volit ze seedu instance. Takové variace **nenahrazují** požadovaných 32 druhů. Každý druh musí být rozpoznatelný z náhledu v depu.

Náklad je dekorace, ne entita pro logistický systém. Není dovoleno generovat vagón s neukotveným objektem, který by v kopci sklouzl; žádná gravitace nákladu se nesimuluje.

## 5. Minimální infrastrukturní knihovna

| Kategorie | Požadované varianty V1 |
|---|---|
| Stanice | Venkovská zastávka, menší nádraží, horská stanice, pobřežní zastávka. |
| Most | Nízký most přes potok, kamenný obloukový most, ocelový most, vysoký viadukt. |
| Tunel | Krátký zděný portál, skalní horský tunel; oba s čitelným průřezem. |
| Přejezd | Dvoupruhová silnice se závorami, menší venkovský přejezd; oba funkční. |
| Trať | Rovný úsek, kopec, klesání, násep, zářez, pobřežní vedení, souběh druhé koleje. |
| Elektrifikace | Běžný stožár, mostní konzola, nádražní portál, tunelový kontakt. |
| Technické okolí | Malé depo, skladiště a kontejnerový jeřáb; nemusí mít zvláštní herní režim. |

## 6. Minimální živý obsah

Alespoň 14 zvířecích typů: kráva, ovce, pes, kočka, slepice, liška, srnka, veverka, ježek, datel, kachna, žába, ryba a sova. Hory a pobřeží mohou sdílet část ptáků; racek je vhodný doplněk. Alespoň osm z uvedených typů má vlastní odlišnou dotykovou reakci, ostatní mohou sdílet jednoduché chování a mít vlastní podobu či zvuk.

Alespoň čtyři lidské role: výpravčí, cestující, cyklista, zemědělec. Různé podoby postav jsou přirozenou součástí grafiky, nikoli systémem profilů. Doprava: osobní auto, autobus, traktor, kombajn, jízdní kolo a malá loď. Druhý vlak využije existující katalog lokomotiv a vagonků, nikoli další desetidruhový katalog.

## 7. Scénické šablony

Požadovat alespoň 18 různých sestav okolí; lze je tvořit ze společných assetů:

1. Louka se zvířaty a plotem.
2. Pole s traktorem a polní cestou.
3. Sklizeň s kombajnem a balíky slámy.
4. Farma se stodolou a slepicemi.
5. Sad s bedýnkovým zázemím.
6. Vesnice se zahrádkami a cestou.
7. Nádraží se čekajícím autobusem.
8. Les s vykukující liškou nebo srnkou.
9. Paseka s pařezy a veverkou.
10. Rybník s kachnami a žábou.
11. Řeka s vodním mlýnem.
12. Most nad řekou s loďkou.
13. Podhorská louka a vzdálená lanovka.
14. Horské údolí s viaduktem.
15. Skály a tunelový portál.
16. Malé městské nebo průmyslové okolí se skladem.
17. Pobřeží s pláží a plachetnicí.
18. Přístav s majákem a moly.

Šablona není minihra. V základní scéně se nic nemusí stát; dítě ji může pouze pozorovat. Přesné rozmístění, barevnost, vegetaci, zvířata a oblohu obměňuje generátor.

## 8. Assetový manifest

Každá lokomotiva a vagón má minimálně náhled, karoserii a informaci o pojezdu; případně oddělená kola, pantograf, světla a částice. Assetový manifest obsahuje stabilní klíč, relativní cestu, rozměr, pivot a licenci/původ.

```json
{
  "id": "steam_local",
  "labelCs": "Malá parní mašinka",
  "kind": "locomotive",
  "power": "steam",
  "lengthU": 156,
  "bogieOffsetU": 46,
  "wheelRadiusU": 15,
  "bodyAsset": "vehicle.steam_local.body",
  "previewAsset": "vehicle.steam_local.preview",
  "hornAudio": "audio.horn.steam_local",
  "requiresCatenary": false,
  "effect": "steam"
}
```

Konkrétní schéma v dokumentu 08 dovolí doplnit další vrstvy. Produkční build nesmí potichu nahradit chybějící typ šedým obdélníkem. Dočasné generované tvary jsou vhodné pro M0/M1, ne důkaz dokončení vizuálního katalogu.
