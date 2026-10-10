# D-014: Částice a drobné animace v simulačním čase

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §4 chce, aby vlak ani prostředí nepůsobily jako nehybné obrázky:

- kouř a pára z komína, výraznější při jízdě a rozjezdu;
- odlišný projev nafty, elektrika bez kouře;
- občasné jiskry při brzdění;
- listí a sníh jen tam, kde skutečně jsou;
- jemný pohyb trávy, větví a vody, občas pták či motýl.

Emitery mají sedět na modelu se sklonem a vypuštěné částice se nesmí pohybovat s vlakem. Počet a životnost musí být omezené, v pauze se vše zastaví. Dokument 13 dává strop dekorativních částic 240 ve standardním a 96 v úsporném profilu.

## Rozhodnutí

1. **Vlastní malé částicové pole místo emitorů Phaseru.** `ParticleField` (`src/render/particles/`) je čistý modul:
   - pevná kapacita a znovupoužívané záznamy;
   - pohyb vlastní rychlostí, vztlakem nebo tíhou, odporem vzduchu a větrem;
   - náhodnost se předává zvenku;
   - čas dodá volající.

   Scéna pole posouvá o simulační čas (ticky / `fixedHz`). V pauze se tick nemění, takže částice stojí a po pokračování letí dál.

   Částice žijí ve světových souřadnicích, takže kouř zůstává ve vzduchu a za jedoucím vlakem se táhne doleva. Kreslí je `EffectsView` z poolu obrázků z hlavního atlasu, ve vrstvě 10 dokumentu 07.

2. **Emitery v manifestu.** `VehicleArt.emitters` určuje bod v rámu kresby:
   - hlavu komína parní mašinky;
   - korunku komína hvězdičkové mašinky;
   - výfuk na střeše dieselu.

   `emitterWorldPoint` jej převede podle pózy vozidla včetně sklonu; kouř vychází podél osy komína.

   `validate:assets` kontroluje dvě věci:
   - lokomotiva s efektem (`effect` v katalogu) má aspoň jeden emitter uvnitř rámu;
   - vagon ani lokomotiva bez efektu žádný nemá.

3. **Pravidla vlaku** (`TrainEffects`, čistá a testovaná):
   - **Pára:** kouř v taktech výfuku, čtyři takty na otáčku hnacích kol podle ujeté dráhy. Při rozjezdu pod plynem přibývá bílá pára, ve stání jen slabý obláček.
   - **Diesel:** lehký výfuk, pod plynem silnější.
   - **Hvězdičková mašinka:** pouští hvězdičky, nikdy kouř. Lokomotiva bez emitoru (elektrická) nekouří.
   - **Jiskry:** jen při brzdění nad 30 % nejvyšší rychlosti. Jsou to nejvýš čtyři krátké záblesky za sekundu u náhodného kola, žádný ohňostroj.
   - **Sníh a listí:** víří je přední kola, ale jen při jízdě nad 40 u/s. Sníh na sněhovém podkladu blízké louky, listí na lesním.
4. **Občasný život.** `AmbientLife` pustí po 14–28 s simulačního času malé hejno ptáků přes oblohu, nebo nad loukou dva motýly. Nikdy nespustí dvě události najednou.
5. **Drobné stálé pohyby** (`ambientMotion.ts`, čisté funkce času):
   - tráva, květiny, rákosí a kapradí se houpou o několik stupňů, stromy jen nepatrně, stavby a kameny vůbec;
   - na každé vodní nádrži občas zableskne šest odlesků;
   - zvířata v klidu jemně dýchají, kresba se jen mírně zplošťuje, takže nikdy nedosáhne výš.
6. **Kvalita.** `gameConfig.quality` převádí profily dokumentu 13 do typované konfigurace s validací.
   - Profil `low` platí při `settings.quality = 'low'` nebo při omezených efektech.
   - Snižuje strop částic na 96 a hustotu emisí na polovinu; událostí života je méně.
   - Funkční signalizace se tím neomezuje.
7. **Kresba částic.** Šestnáct malých SVG dílů `fx.*` v `assets/world/` s pivotem uprostřed, ve stejném atlasu jako vozidla:
   - kouř, pára a výfuk;
   - hvězdička a jiskra;
   - tři listy a vločka;
   - vlaštovka a dva motýli, každý ve dvou fázích křídel;
   - odlesk.

## Důsledky

- Diagnostika hlásí `effects` (živé částice, kapacita, počty podle druhu a součet poloh). E2E podle ní kontroluje:
  - kouř při jízdě;
  - strop částic;
  - zastavení v pauze;
  - čistý diesel;
  - strop 96 při omezených efektech.
- `RideSimulation.lastIntent` nese záměr posledního kroku (plyn, brzda, dojezd), aby efekty věděly o rozjezdu a brzdění.
- Výkon s nejdelší soupravou v softwarovém WebGL se nezměnil: medián 30 FPS, p95 50 ms.

## Kompatibilita

Save, trať a generátor se nemění. Částice ani jejich stav se neukládají; dokument 04 §9 říká, že staré dekorativní částice se po obnově nevracejí.

## Dočasná omezení a podmínky odstranění

- **Elektrická lokomotiva** zatím v katalogu není. Pantograf a občasná jiskra na troleji přijdou s ní v kroku G.
- **Déšť a sníh z počasí** (dokument 07 §5) nejsou součástí této změny, přijdou s počasím. Zde je jen sníh rozvířený koly.
- **Fyzická zařízení:** NEOVĚŘENO.
