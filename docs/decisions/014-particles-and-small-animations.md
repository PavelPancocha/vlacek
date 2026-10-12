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

   Částice žijí ve světových souřadnicích, takže kouř zůstává ve vzduchu a za jedoucím vlakem se táhne doleva. Kreslí je `EffectsView` z poolu obrázků z atlasu světa, ve vrstvě 10 dokumentu 07. Vozidla používají samostatný atlas jedné jízdy podle [D-019](019-journey-atlas-and-npc-fleet.md).

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
   - **Bublinková mašinka:** katalogové `bubbles` se mapuje na `bubble`, nikdy na hvězdičky. Vlastní perleťová SVG bublina pomalu stoupá a unáší se větrem, žije 3–5 s. Emitor je na hraně kruhového ústí `(127,12)` v rámu 164 × 96 u.
   - **Duhová mašinka:** katalogové `rainbow` se mapuje na `rainbow-puff`. Pět měkkých SVG obláčků (červený, okrový, zelený, modrý, švestkový) se vybírá při vzniku; barva se během života nemění. Životnost 3–4 s, emitor na širokém ústí `(138,10)` v rámu 176 × 100 u.
   - Fantazijní lokomotivy do NPC sady podle D-019 nevstupují. Oba nové efekty používají společný strop částic a poloviční hustotu při omezených efektech; čas běží jen se simulací. Osvětlení SVG zleva shora se neotáčí. Každá emise má stabilní číselné ID a světovou polohu i při přesunu v poolu; opětovně použitý záznam dostane nové ID. Viditelné bubliny lze prasknout dotykem (H3, dokument 06 §2). Renderer hledá nejvyšší bublinu podle aktuální vykreslené polohy a poloměru; `GameSession.setWorldHitTest` předá stabilní ID zpět rendereru. Zásah odstraní právě tuto bublinu a vyšle jedinou událost `bubblePopped`. Opakovaný nebo minutý zásah nic nepraskne. Stejný dotyk zůstává současně plynem; priorita brzdy se nemění.
   - **Prasknutí bubliny:** jedna drobná SVG částice `bubble-pop` v místě zásahu žije 0,25–0,45 s. Nahrazuje odstraněnou bublinu, takže nepřekročí společný dekorativní strop; v úsporném profilu má poloviční velikost. Krátký syntetický zvuk (sinus 900 → 300 Hz, 0,12 s) používá stávající audio manager, ztišení efektů a rozpočet hlasů. Prasknutí nemá vlastní timer ani uložený stav.
   - **Jiskry:** jen při brzdění nad 30 % nejvyšší rychlosti. Jsou to nejvýš čtyři krátké záblesky za sekundu u náhodného kola, žádný ohňostroj.
   - **Sníh a listí:** víří je přední kola, ale jen při jízdě nad 40 u/s. Sníh na sněhovém podkladu blízké louky, listí na lesním.
4. **Občasný život.** `AmbientLife` pustí po 14–28 s simulačního času malé hejno ptáků přes oblohu, nebo nad loukou dva motýly. Nikdy nespustí dvě události najednou.
5. **Drobné stálé pohyby** (`ambientMotion.ts`, čisté funkce času):
   - tráva, květiny, rákosí a kapradí se houpou o několik stupňů, stromy jen nepatrně, stavby a kameny vůbec;
   - na každé vodní nádrži občas zableskne šest odlesků;
   - zvířata v klidu jemně dýchají, kresba se jen mírně zplošťuje, takže nikdy nedosáhne výš.
6. **Kvalita.** `gameConfig.quality` převádí profily dokumentu 13 do typované konfigurace s validací.
   - Efekty profilu `low` platí při `settings.quality = 'low'` nebo při omezených efektech. Snižují strop částic na 96 a hustotu emisí na polovinu; událostí života je méně.
   - Samotné `settings.quality = 'low'` navíc snižuje hustotu vykreslování na 1 a omezí snímky na 30 za sekundu (`renderProfile`, Phaser `fps.limit`). Standardní profil snímky neomezuje: limit na úrovni obnovovací frekvence by Phaser nechal snímky vynechávat. Profil platí od startu hry; nastavení, které by ho za běhu měnilo, zatím ve hře není (Codex review PR #2).
   - Omezené efekty (a profil `low`) zmenší na čtvrtinu také houpání rostlin a větví, odlesky na vodě a dýchání zvířat (`motionScale`, dokument 07 §9; Codex review PR #2).
   - Funkční signalizace se tím neomezuje: světla přejezdu blikají dál naplno a zatřesení plného vlaku v depu zůstává.
7. **Kresba částic.** Dvacet tři malých SVG dílů `fx.*` v `assets/world/` s pivotem uprostřed, v atlasu světa:
   - kouř, pára a výfuk;
   - hvězdička a jiskra;
   - perleťová bublina, její prasknutí a pět barevných obláčků;
   - tři listy a vločka;
   - vlaštovka a dva motýli, každý ve dvou fázích křídel;
   - odlesk.

## Důsledky

- Diagnostika hlásí `effects` (živé částice, kapacita, počty podle druhu, součet poloh a počítadlo `bubblePops`). Pole `bubbles` uvádí stabilní ID a aktuální viditelný střed i poloměr v CSS px; mimo obraz nebo před náběhem viditelnosti bublinu neuvádí. Počítadlo se při změně jízdy vynuluje. E2E podle ní kontroluje:
  - kouř při jízdě;
  - strop částic;
  - zastavení v pauze;
  - čistý diesel;
  - strop 96 při omezených efektech;
  - dotykové prasknutí konkrétní bubliny při souběžném plynu a pokračující jízdě.
- `RideSimulation.lastIntent` nese záměr posledního kroku (plyn, brzda, dojezd), aby efekty věděly o rozjezdu a brzdění.
- Výkon s nejdelší soupravou v softwarovém WebGL se nezměnil: medián 30 FPS, p95 50 ms.

## Kompatibilita

Save, trať a generátor se nemění. Částice ani jejich stav se neukládají; dokument 04 §9 říká, že staré dekorativní částice se po obnově nevracejí.

## Dočasná omezení a podmínky odstranění

- **Elektrická lokomotiva** přibyla v kroku G2 ([D-016](016-electric-locomotive-and-catenary.md)) i s občasnou jiskrou na pantografu; toto omezení je odstraněné.
- **Déšť a sníh z počasí** (dokument 07 §5) nejsou součástí této změny, přijdou s počasím. Zde je jen sníh rozvířený koly.
- **Fyzická zařízení:** NEOVĚŘENO.
