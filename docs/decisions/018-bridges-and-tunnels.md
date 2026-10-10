# D-018: Mosty přes potoky a krátké tunely

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §5 chce v krajině potoky, mosty a tunely. Podle §2 dítě v tunelu nesmí ztratit svůj vlak. Další pravidla:

- **Dokument 04 §6.**
  - V prvním bloku stojí most ve slotu 4 a krátký tunel ve slotu 6.
  - V blocích bez souběhu kolejí se volí biomově vhodný most a tunel, případně most a volná krajina.
  - Přejezd není na mostě ani v tunelu.
- **Dokument 03 §8.**
  - Tunel má portály a vrstvy. Vlak zůstává vidět, ztmavený podle polohy každého vozidla, bez stencil masky.
  - Most podpírá souvislou kolej, voda a údolí jsou pod tratí. Sloupy a zábradlí patří do různých vrstev.
- **Dokument 03 §9 a AGENTS.md.** Vedení vede celou trasou včetně mostů a tunelů; v tunelu visí u stropu.
- **Dokument 04 §4.** Geometrie koleje se nemění.

## Rozhodnutí

1. **Místa** (`src/domain/world/Structures.ts`, čisté funkce seedu a indexu chunku).
   - `bridgeSite(seed, k)` dává most ve slotu 4 každého bloku bez souběhu, tedy vždy v bloku 0. Potok kříží trať na seedem vybraném místě: aspoň 192 u od okrajů chunku a 192 u od interaktivního zvířete. ID má tvar `g1:chunk:k:bridge:0`.
   - `tunnelSite(seed, k)` dává tunel ve slotu 6: v bloku 0 vždy, v ostatních blocích bez souběhu podle biomu z klíče `tunnel` (hory 1, podhůří 0,9, les 0,6, jinde 0,3). Je dlouhý 448 u a drží se aspoň 96 u od okrajů chunku. ID má tvar `g1:chunk:k:tunnel:0`.
   - Přejezd (slot 3), most (4) a tunel (6) se tak nikdy nepotkají.
2. **Údolí a potok.**
   - Louka před tratí pod mostem klesá o 56 u: rovné dno ±80 u, náběh 220 u (`valleyDepthU`). Výška břehu je `bankHeightU` = max(násep, údolí). Kolej se nemění.
   - Potok je u trati 80 u široký a před tratí i za ní mírně meandruje (14 u).
   - Voda za tratí se kolem potoka rozdělí. Rekvizity drží odstup 96 u od jeho středu, u blízké louky úměrně hloubce. Zvíře stojí mimo údolí.
3. **Most.**
   - Kamenný mostek (`bridge.stone`, 160 × 84 u) má oblouk, římsu s odkapy a křídla až ke dnu údolí. Kreslí se ve vrstvě koleje a natáčí se podle sklonu. Otvor oblouku je průhledný a potok jím protéká.
   - Zábradlí na vzdálené straně (`bridge.railing`) je za vlakem, těsně pod vrstvou koleje.
4. **Tunel** (`src/render/TunnelView.ts`).
   - **Vrstvy.**
     - Za vlakem jsou boky kopce a vnitřek: tmavé zdivo se světly.
     - Přes vlak jde ztmavující pás mezi portály.
     - Před vlakem je kryt: kopec mezi portály až k louce, nad portály jen výš než 214 u (nad stožáry i vlakem), a kamenné portály. Portál `tunnel.portal` má otvor 116 × 186 u, takže se vejde pantograf i drát.
   - **Jednolitý kopec.** Kryt a boky mají stejný tón i stejnou mřížku pruhů, keřů, kamenů a kvítí. Spoje se schovají za portály a od paty portálu se kopec svažuje k louce.
   - **Průhlednost** (dokument 14 §2).
     - Kryt zprůsvitní na 0,3, když je kterákoli část vlaku v tunelu nebo do 80 u od portálu. Po odjezdu se vrátí na 1.
     - Mění se plynule (6/s) v čase simulace, takže ho pauza drží.
   - **Ztmavení (TRN-06).** Ztmavení je pás v prostoru tunelu s měkkým přechodem 40 u u portálů. Každé vozidlo je tedy tmavé podle vlastní polohy. Celou soupravu nepřepíná žádná maska ani přepínač, Canvas fallback kreslí totéž.
5. **Vedení.**
   - Stožár stojí 80 u od středu potoka, tedy vedle opěr mostu.
   - V tunelu ani 72 u kolem něj nestojí stožár. Tam drát drží závěs ze stropu s izolátorem a svorkou (`catenarySupport` v doméně: `'mast'` nebo `'hanger'`).
   - Drát vede rovně přes most i tunelem. V tunelu je za krytem a průsvitným krytem je vidět.
   - Stožáry stojí před boky kopce.
6. **Diagnostika.** Snímek `?debug=1` hlásí `tunnels`: ID, průhlednost krytu a zda je vlak venku, částečně nebo celý uvnitř (`outside`, `partly`, `inside`).

## Důsledky

- Unit testy ověřují:
  - místa (sloty, biomy, blok 0), údolí a výšku břehu;
  - odstup rekvizit a stožárů od potoka, šířku potoka u trati;
  - stožáry a závěsy u tunelu;
  - rozměry a pivoty nových assetů;
  - průsvitnost krytu, její plynulou změnu a polohu vlaku vůči tunelu.
- E2E: elektrická souprava ve světě 123 přejede most a projede tunelem.
  - Sběrač je celou dobu na drátu.
  - Žádná blízká rekvizita nepřekrývá vlak.
  - Při částečném vjezdu je kryt průsvitný, po výjezdu znovu neprůhledný.
- Krajina u stejného seedu se mění: přibyly potoky, údolí a posunuté stožáry. Scenérie se neukládá.

## Kompatibilita

Save, trať ani ID katalogu se nemění. Generátor trati zůstává v1: most i tunel jsou dekorace nad stejnou geometrií, takže rozehraná trasa se nezmění.

## Dočasná omezení a podmínky odstranění

- **Zvuk lokomotivy v tunelu** (dokument 03 §8) se zatím nemění. Doplní se se skutečnými zvuky lokomotiv místo dočasných syntetizovaných tónů.
- **Světla lokomotivy v tunelu** zatím chybí. Přijdou se světly lokomotiv (den a noc, dokument 04 §10), stejně jako v D-017.
- **Mostní konzoly** (dokument 03 §9, „lze použít“) nejsou potřeba, protože stožáry stojí vedle opěr. Doplní se s delšími mosty, kde rozteč stožárů nestačí.
- **Varianty mostů** (CNT-04): zatím je jen kamenný mostek přes potok. Další varianty (ocelový přes řeku, viadukt) přijdou s infrastrukturou podle biomů při rozšíření katalogu.
- **Fyzická zařízení:** NEOVĚŘENO.
