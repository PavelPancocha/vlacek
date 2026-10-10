# D-017: Druhá kolej a protijedoucí vlak

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §5 chce druhou kolej s jiným vlakem, který nikdy nejede po hráčově koleji. Další pravidla:

- **Dokument 04 §6–7.**
  - Souběh kolejí zabírá sloty 4–6 bloku: v druhém bloku vždy, jinak s pravděpodobností 1/3 z klíče `secondary-rail`.
  - Trať je rovnoběžná s hlavní, v jiné hloubce s odsazením 64 u.
  - Na obou koncích má skryté pokračování aspoň o délku soupravy plus 256 u, schované v připraveném portálu.
  - Vozidla se odkrývají a zakrývají postupně.
- **Dokument 05 §6.**
  - Vlak jede zprava doleva, má 1–5 vagonků a jede 100–160 u/s.
  - Vyjede jednou, když se čelo hráče přiblíží na 512 u.
  - Nezastavuje s hráčem a zruší se až po skrytí posledního vozidla.
  - Při setkání může jednou zahoukat. Na píšťalu odpoví nejvýš jednou za 8 s a sám další odpověď nespouští (SCN-10).
- **Dokument 03 §9.** U hráčů bez elektriky jede parní či naftový vlak.

## Rozhodnutí

1. **Místo** (`src/domain/world/SecondaryTrack.ts`).
   - `secondarySite(seed, block)` dává viditelný úsek přes sloty 4–6 s ID `g1:block:b:secondary:0`. Platí ve vynuceném bloku 1, v blocích od 2 s pravděpodobností z configu.
   - Blok 0 souběh nemá, protože dokument 04 tam dává most a tunel (krok G4).
   - Kolej leží 64 u za hlavní, a proto se kreslí o 64 u výš.
   - `SecondaryLine` má vlastní okno chunků od skrytého levého konce po skrytý pravý, nezávislé na hráčově koridoru. Vlak tak dojede, i když hráč odjede.
2. **Volné místo kolem tratě.**
   - Pás druhé koleje a portálové kopce sahají 320 u za portály. Na nich nestojí zadní rekvizita blíž než hloubka 0,45 a voda začíná až za pásem.
   - Přejezd ve slotu 3 se drží 64 u od levého kopce.
   - Kopec a vlak se tak nikdy chybně nepřekrývají s rekvizitami.
3. **Vlak** (`src/domain/interaction/OncomingTrain.ts`).
   - Seed vybere parní nebo naftovou lokomotivu z dodaného výběru (`RideSetup.npcFleet`), 1–5 vagonků a rychlost.
   - Souprava se rozloží v měřítku hlubší vrstvy 0,9, stejně jako zadní rekvizity v té hloubce.
   - Platí `s[i] = sHead + centerOffset[i]` (d = −1), vagonky jsou vpravo od lokomotivy.
   - Začíná celá ve skrytém pravém konci a je hotový, až když konec soupravy projde levým portálem.
4. **Jízda** (`RideSimulation`).
   - Vlak vyjede jednou, když čelo hráče v kroku projde bodem 512 u před levým portálem.
   - Po obnově ze save za tímto bodem nevyjede, takže se v krajině nikdy neobjeví skokem.
   - Při setkání v otevřeném úseku jednou zahouká, pokud mu to dovolí vlastní cooldown 8 s.
   - Na hráčovu píšťalu v dosahu 800 u odpoví nejvýš jednou za 8 s. Jeho houkání nic dalšího nespouští.
   - Zvuk je klakson jeho lokomotivy (dočasný syntetizovaný tón).
5. **Kresba.**
   - `SecondaryView` kreslí koleje druhé tratě ve viditelném úseku a na obou koncích tunelový portál, napravo zrcadlený. Portál má dvě vrstvy: tmavé ústí pod vlakem a kopec s kamennou zdí a obloukem nad ním, otvor oblouku je průhledný.
   - Vlak se kreslí zrcadlený (jede doleva) v měřítku 0,9 mezi těmito vrstvami, za hlavní tratí a stožáry. Vozidlo hluboko v portálu se nekreslí.
   - Parní a naftový protijedoucí vlak kouří; mimo portály `emitterWorldPoint` zrcadlí emitor.
6. **Diagnostika.** Snímek `?debug=1` hlásí `oncoming`: soupravy s intervalem x, úsek mezi portály a počet vozidel vykreslených v otevřené krajině.

## Důsledky

- Unit testy ověřují:
  - rozmístění souběhu;
  - geometrii o 64 u hlouběji se skrytými konci;
  - jízdu celou trasou na existující geometrii (SCN-09);
  - jediný výjezd a žádný výjezd po obnově;
  - odpovědi s cooldownem (SCN-10);
  - volné místo ve scenérii.
- E2E ověřuje, že vlak vyjede, ukáže se v krajině a vozidla mizí po jednom; zruší se až po skrytí posledního.
- U přejezdů v blocích se souběhem ubyla místa napravo od 640 u. Krajina u stejného seedu se mění (neukládá se).

## Kompatibilita

Save ani trať se nemění a stav protijedoucího vlaku se neukládá. Po obnově vyjede jen ten, k jehož bodu výjezdu hráč teprve dojede.

## Dočasná omezení a podmínky odstranění

- **Elektrifikace souběžné tratě** a elektrický protijedoucí vlak (dokument 03 §9, „může“) zatím nejsou. Doplní se, až přibude další elektrická lokomotiva katalogu.
- **Rozsvícení světel** při setkání (dokument 05 §6) zatím chybí. Přijde se světly lokomotiv (den a noc, dokument 04 §10).
- **Fyzická zařízení:** NEOVĚŘENO.
