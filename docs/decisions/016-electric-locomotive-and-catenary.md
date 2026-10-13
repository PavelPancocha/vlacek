# D-016: Elektrická lokomotiva, pantograf a trolejové vedení

Datum: 2026-10-10; proporce upraveny 2026-10-13 (catenary-1). Stav: přijato.

AGENTS.md a dokument 03 §9 chtějí, aby elektrická lokomotiva měla vedení v celé trase, v každém zachovaném i nově vygenerovaném chunku, ne jen kolem kamery. Další požadavky:

- Stožáry stojí v jedné globální fázi, výchozí rozteč je 256 u a kontaktní drát je 128 u nad kolejí.
- Pantograf dosáhne na drát s omezeným přizpůsobením a v bodě kontaktu nesmí viditelně končit pod drátem.
- Dokument 14 §4 chce elektriku bez kouře, nanejvýš s občasnou jiskrou na troleji.

Katalog dosud elektrickou lokomotivu neměl; test to výslovně hlídal, dokud vedení neexistovalo.

## Rozhodnutí

1. **Lokomotiva `electric_retro`** (dokument 06): Hranatá elektrická, 188 u, dva dvounápravové podvozky, `requiresCatenary: true`, bez efektu.
   - Kresba je vlastní detailní vektor `assets/vehicles/electric_retro.*`:
     - modrá hranatá skříň s krémovým pásem oken;
     - výrazné přední světlomety;
     - střecha s izolátory, odporníkem a sklopeným předním pantografem;
     - bez log a bez obličeje.
   - Zdvižený zadní pantograf má dva samostatné díly: kosočtverečná ramena a sběrač s uhlíkovou lištou.
2. **Elektrifikace patří jízdě.**
   - `RideSetup.electrified` se odvodí z `requiresCatenary` lokomotivy a platí pro celou cestu, i po obnově ze save.
   - Výměna lokomotivy zakládá novou cestu, takže se infrastruktura za jízdy nepřepíná.
   - Save se nemění: elektrifikace plyne z ID lokomotivy.
3. **Vedení jako čistá funkce** (`src/domain/world/Catenary.ts`). Geometrii trati nemění (GEN-12).
   - `catenaryPoleXs(seed, fromX, toX)` dává stožáry po `world.catenaryPoleSpacingU` v jedné globální fázi; validace configu hlídá, že rozteč dělí šířku chunku.
   - Stožár, který by padl na silnici přejezdu, se posune o 48 u vedle ní.
   - `contactWireHeightU` vede drát rovně mezi sousedními stožáry, u každého `catenaryContactHeightU` nad kolejí.
   - Na šesti seedech po 128 chunků se drát od výšky kontaktu nad kolejí odchyluje nejvýš o 3,2 u. Test hlídá mez 6 u.
4. **Kresba vedení** (`src/render/CatenaryView.ts`, vlastní ji `ChunkView`).
   - Příhradový stožár stojí 12 u za kolejí, ve vrstvě za vlakem. Jeho úchyt troleje je přesně nad bodem stožáru, kde drát drží doména. Původní vektorový rám stožáru se svisle zmenší podle kontaktu: `(128 − 12) / (192 − 44) = 29/37`. Stejné měřítko má rozestup nosného lana a kontaktního drátu; fallback má tutéž výšku stožáru. Manifest světa ani polohy podpěr se nemění.
   - Pole drátu (nosné lano s průvěsem, věšáky, trolej) visí nad vlakem ve vrstvě `wires`. Natahuje se na skutečné rozpětí a sklání se podle koleje.
   - Každý chunk kreslí své stožáry a pole k dalšímu stožáru, i když ten stojí už v dalším chunku. Na švech tak vedení nepřerušuje.
   - U tunelu rozhoduje společná doménová hranice `TUNNEL_MAST_CLEARANCE_U` (60 u od portálu, bez krajních bodů): uvnitř kreslí `TunnelView` závěs ze stropu, vně včetně hranice zůstává stožár ([D-018](018-bridges-and-tunnels.md), R6). Polohy podpěr ani drát se nemění.
5. **Pantograf.**
   - `pantographReachU` spočítá vzdálenost od základny na střeše po drát podél osy nakloněné lokomotivy, v bodě, kde se sběrač drátu skutečně dotkne.
   - Všechna tři elektrická vozidla sdílejí nová široká nízká ramena 56 × 34 u a menší hlavu 40 × 6 u; kontakt leží 5 u nad pivotem hlavy. Přední sklopený pantograf v překryvu vozidla zůstává.
   - `vehicleArtLayers` přizpůsobí ramena délce k drátu (`PANTOGRAPH_STRETCH`, 0,07–1,6 násobku kresby), hlava se nenatahuje. Fyzická mez je nyní 59,4 u včetně hlavy, šířka ramen zůstává větší než maximální výška ramen 54,4 u. `pantographReachU` přijímá pracovní dosah 34–59,4 u; drát mimo dosah omezí na tuto mez místo dalšího natahování. `pantographReach` vrací `{ reachU, outOfRange }` pro diagnostiku; číselný vstup rendereru `pantographReachU` používá tentýž výsledek a nevyhazuje výjimku. Nekonečný dosah se omezí na příslušný kraj, `NaN` na dolní mez, vždy s příznakem chyby. Výška sklopené sestavy nad patou je 7,38 u.
   - V depu není drát, a tak pantograf leží sklopený.
   - Kamera u elektrické jízdy drží v obraze i výšku kontaktu.
   - Jiskra: nad 30 % nejvyšší rychlosti v místě kontaktu občas odletí jedna nebo dvě, asi jednou za tři sekundy.
6. **Diagnostika.** Snímek `?debug=1` hlásí `catenary`: elektrifikaci, počet stožárů ve vykreslených chuncích a mezeru mezi sběračem a drátem.
7. **Bez grafiky (PWA-10).** Když se grafika nenačte, stožáry a drát se kreslí jednoduchými čarami na stejných místech a ve stejné výšce, takže vedení vede celou trasou i tehdy ([D-011](011-vector-vehicle-art-and-atlas.md)).

## Důsledky

### Měření a důvod snížení (2026-10-13)

Výšky jsou konzervativní horní obálky `vehicleArt.heightU` nad kolejnicí, včetně střechy, nákladu a dekorace, nikoli výška prázdné korby. Vlastní kresba může být nižší; rám poskytuje bezpečnou mez i pro auta, složený bagr, klády a slámu. Nejvyšší rám katalogu má 108 u (`steam_express`), nejvyšší připojitelný vůz 104 u (`fun_balloons`).

| Výška u | Vozidla (stabilní ID)                                                                                     |
| ------: | --------------------------------------------------------------------------------------------------------- |
|     108 | `steam_express`                                                                                           |
|     104 | `fun_balloons`                                                                                            |
|     100 | `steam_local`, `magic_stars`, `magic_rainbow`, `passenger_double`, `fun_windmill`                         |
|      96 | `electric_mountain`, `magic_bubbles`, `cargo_cars`, `cargo_excavator`, `fun_lights`                       |
|      92 | `electric_retro`, `passenger_panorama`                                                                    |
|      90 | `electric_modern`, `cargo_tractor`                                                                        |
|      88 | `fun_stars`, `fun_garden`, `fun_aquarium`                                                                 |
|      86 | `diesel_mainline`                                                                                         |
|      84 | `service_crane`, `cargo_grain`, `fun_toyblocks`                                                           |
|      82 | `diesel_shunter`, `passenger_classic`, `passenger_sleeper`, `passenger_dining`, `cargo_hay`, `cargo_tank` |
|      80 | `service_tools`, `service_snowplow`, `cargo_refrigerated`                                                 |
|      78 | `cargo_mail`                                                                                              |
|      76 | `passenger_open`, `cargo_box`, `cargo_logs`, `cargo_milk`                                                 |
|      74 | `cargo_container`                                                                                         |
|      72 | `cargo_apples`                                                                                            |
|      68 | `cargo_coal`, `cargo_gravel`                                                                              |
|      66 | `cargo_sand`                                                                                              |

Původní drát 160 u nechával nad nejvyšším rámem 52 u a nad nejvyšším vagonkem 56 u. Staré rameno 40 × 60 u s hlavou 48 × 8 u mělo složený dosah 11,2 u, maximální dosah 103 u a na rovině pracovní dosah 74 / 84 / 78 u pro retro / moderní / horskou elektriku. Základny jsou ve výšce 86 / 76 / 82 u nad kolejí.

Nový kontakt 128 u dává na rovině 20 u nad celým katalogem a 24 u nad nejvyšším vozem (poměr 1,23), nad patrovým vozem 28 u, auty a bagrem 32 u, panoramou 36 u, slámou 46 u a kládami 52 u. Pracovní dosahy jsou 42 / 52 / 46 u. Čistý config nesmí importovat manifest grafiky: validátor proto vyžaduje konečnou výšku nejméně `108 + 20` u. Katalogový test nezávisle prochází všechny obálky v manifestu a odmítne build, pod jehož drát by se nevešel nový vyšší náklad. Rezerva zahrnuje i odchylku rovného drátu na přechodu sklonů a natočení celého vozidla.

Výška se mění pouze v konfiguraci. `Catenary.ts`, kresba mostů i běžných stanic, tunelové závěsy a pantograf ji používají společně. `TunnelView` již odvozuje konec závěsu z `catenaryContactHeightU`; portálová hranice R6 zůstává 60 u bez krajních bodů. Save, katalogová ID, profil koleje, seed a verze generátoru se změnou proporcí nemění; stará cesta se obnoví na stejné koleji s nižším vedením.

Unit testy ověřují obálky všech 42 vozidel, pracovní meze a skutečný bod kontaktu všech tří elektrik na seedech 0, 1, 7, 123, 2026, 98765, 2147483647 a 4294967295, včetně záporného chunku, svahů, mostů a tunelů. TRN-08 v `electric.spec.ts` navíc kontroluje kompaktní obálku a kontakt na Canvasu i WebGL; snímky slouží k vizuální kontrole hlavy a drátu.

Naměřený pracovní dosah na uvedených seedech a vzorcích po 128 u: retro 39,20–44,39 u, moderní 49,35–54,18 u, horská 43,19–48,61 u. Odchylka drátu od nominální výšky byla nejvýše 3,38 u. Kontrola obálek všech vozidel ve světech 123 a 2026 přes první stanici, most a tunel našla nejmenší mezeru 16,28 u (rám parní `steam_express`, seed 123, chunk 7, x = 768 u, zadní horní roh); test chrání nejméně 12 u i na výškovém přechodu.

### Bezpečný dosah a mez sklonu (2026-10-13, catenary-2)

Per-frame výpočet pro nedosažitelný drát nevyhazuje výjimku: pracovní ramena zůstanou v intervalu 34–59,4 u a `outOfRange = true` hlásí chybu geometrie. Kód volající číselnou variantu zůstává kompatibilní; integrační linka může diagnostický příznak počítat po přechodu na `pantographReach`. Omezení zabraňuje pádu, nezaručuje kontakt s nedosažitelným drátem.

Test používá skutečné `TrackWindow`, polohy podvozků a `contactWireHeightU`, syntetický profil s `world.profile.transitionU = 192` a všechny tři elektriky. Pro přechody rovina ↔ svah podporuje celé `world.maxTrackGrade = 0,12` (12 %); hustší měření na seedech 0, 123 a 2026, v chuncích 0, 4 a 6, s posunem výškového přechodu po 8 u a vozidla po 4 u našlo dosah 36,97–56,26 u.

Přímý přechod +sklon ↔ −sklon, který současný generátor nevytváří, má přísnější mez kvůli dvojnásobné změně sklonu a posunutým podpěrám u mostů/přejezdů. Konzervativně ověřená mez je **0,098 (9,8 %)**: dosah 34,21–59,37 u. Hustý sweep našel poslední vyhovující vzorek 0,0983 (59,3945 u), první nevyhovující 0,0984 (59,4022 u); jde o naměřenou mez, nikoli analytický důkaz pro všechny možné profily. Při 12 % a přímém obratu je potřeba 32,49–61,08 u, a proto se výsledek omezuje a hlásí. Pro nejhorší dolní i horní mez: seed 0, chunk 4, přechod ve světovém x = `4 * 1024 + 136`, poloha vozidla 176 / 188 u, retro / moderní elektrika. Nová linka světa musí zachovat mez 9,8 % pro přímé obraty nebo znovu ověřit geometrii při změně délky přechodu či rozteče/posunu podpěr; samotný sklon 12 % nestačí jako záruka.

Test `CatenaryView` nyní kreslí přes `chunkCatenary` se stubem platformy. Kontroluje oba konce kontaktního drátu a skutečný úchyt transformovaného obrázku stožáru na rovině i při ±12 %. Vrácení svislého měřítka stožáru na původní hodnotu test shodí (úchyt o 32 u výše).

Vozidlový fallback v `RideScene` zatím sběrač nekreslí; jeho doplnění vlastní integrační linka. Fallback samotného vedení již respektuje stejnou výšku drátu a stožáru.

- E2E (TRN-08) ověřuje:
  - Při jízdě přes několik chunků a jejich švy jsou v každém vykresleném chunku stožáry.
  - Sběrač se drátu dotýká s mezerou pod 0,5 u.
  - Celý vlak zůstává v obraze a lokomotiva nekouří.
  - Parní jízda vedení nemá, obnovená elektrická jízda ho má.
- Výkon s nejdelší soupravou za elektrickou lokomotivou (`PERF_LOCOMOTIVE=electric_retro`) je stejný jako s parní: medián 30 FPS, p95 50 ms.
- Katalog má čtyři lokomotivy; výběr mašinky i depo ukazují elektriku se sklopeným pantografem.

## Kompatibilita

- Save, trať a verze generátoru se nemění.
- Starší save neznají `electric_retro`, takže se jich změna netýká.
- Nová lokomotiva je doplněné ID katalogu dokumentu 06, žádné stávající ID se nemění.

## Dočasná omezení a podmínky odstranění

- **Portálové podpěry ve stanici** (dokument 03 §9) zatím nejsou; ve stanici stojí běžné stožáry. Přijdou s vícekolejnými nádražími. Tunelový závěs a stožáry vedle opěr mostu doplnil [D-018](018-bridges-and-tunnels.md).
- **Souběžná kolej** ([D-017](017-second-track-and-oncoming-train.md)) vedení zatím nemá; protijedoucí vlak je parní nebo naftový. Doplní se s další elektrickou lokomotivou katalogu.
- **Zvuk elektrické lokomotivy** je dočasný syntetizovaný tón jako u ostatních. H1 mu dává vlastní identitu `audio.horn.electric_retro` (triangle, 330 a 415 Hz, 0,65 s, hlasitost 0,14) místo původního sdíleného naftového zvuku; hráč i náhled používají tentýž tón ([D-006](006-runtime-architecture.md)). Nahraný zvuk jej nahradí při dokončení zvukových assetů.
- **Fyzická zařízení:** NEOVĚŘENO.
