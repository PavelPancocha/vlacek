# D-018: Mosty přes potoky a krátké tunely

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §5 chce v krajině potoky, mosty a tunely. Požadavek na průsvitný kryt v dokumentu 14 §2 nahrazuje zadání world v2 z 2026-10-13 (§6–7): vlak skutečně vjede do neprůhledného tunelu; pokračující jízdu ukazuje pohyb kamery a vjezd do portálu. Další pravidla:

- **Dokument 04 §6.**
  - V prvním bloku stojí most ve slotu 4 a krátký tunel ve slotu 6.
  - V blocích bez souběhu kolejí se volí biomově vhodný most a tunel, případně most a volná krajina.
  - Přejezd není na mostě ani v tunelu.
- **Dokument 03 §8.**
  - Tunel má portály a vrstvy. Vozidla se zakrývají jednotlivě podle vlastní polohy za portálem; starší požadavek na viditelný průřez je nahrazen neprůhledným krytem.
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
   - **Neprůhlednost (tunnel-1, TRN-06).** Kryt má vždy alpha 1, včetně prvního obnoveného snímku a zastavení v portálu. Otevřené ústí ukazuje postupný vjezd a výjezd; plně zakrytá část hlavního tunelu začíná 52 u za každým portálem. Kamera a ovládání pokračují beze změny.
   - **Společné pravidlo vozidel.** `vehicleInCover` klasifikuje vlastní interval každého vozidla jako `outside`, `partly`, `inside`. Hlavní vlak se kreslí pod neprůhledným kopcem; NPC se úplně skryje až za otevřeným ústím. Částečné vozidlo vždy zakrývá skutečná kresba portálu, nikoli přepínač celé soupravy.
   - **Sklon vedlejší koleje.** Portál a kopec se natáčejí podle vlastního profilu. Zadní polovina ústí je tmavá, neprůhledná a její hrana sleduje normálu vlastní koleje včetně přesahu střechy: simulace odstraní NPC při dosažení středu portálu posledním vozem, takže jeho poslední pixely musí zmizet už před touto hranicí. Dvě doplňující neprůhledné paty kopce vzorkují přímo NPC kolej; kola proto neprosvítají pod rovným spodkem SVG ani ve fallbacku bez artu. Paty a zadní polovina ústí patří vykreslenému portálu: scéna je vytváří s jeho chunkem a ničí při uvolnění tohoto chunku, resetu i zániku scény. Vznik ani odstranění NPC nemění jejich pixely; nevznikají další emitery ani timery.
   - **Částice.** Zdroj uvnitř zakrývajícího kopce nevypouští kouř, páru, jiskry, fantazijní obláčky ani vířený sníh/listí. Hodiny emise běží dál bez nahromaděného výbuchu při výjezdu. Živé částice mohou dožít venku, ale kreslí se mezi příslušným vlakem a krytem (hráč 7,55; NPC 4,32). Neprůhledná geometrie tak zakryje každý pixel včetně kouře vzniklého před vjezdem. Toto vrstvení funguje v Canvas i WebGL bez rendererově odlišné masky. Okolní život zůstává ve vrstvě 10. Stejné `TunnelView.coversPoint` filtruje již vypuštěné bubliny v hit-testu, seznamu viditelných bublin i při prasknutí; dotyk zakryté části kruhu také nezasáhne bublinu. Odkrytá bublina zachovává současně reakci a plyn.
   - **Ztmavení.** Pás v prostoru tunelu s měkkým přechodem 40 u u portálů zůstává pro otevřená ústí; neprůhlednost krytu se nemění.
5. **Vedení.**
   - Stožár stojí 80 u od středu potoka, tedy vedle opěr mostu.
   - V tunelu a méně než 60 u od jeho portálů nestojí stožár. Tam drát drží závěs ze stropu s izolátorem a svorkou (`catenarySupport` v doméně: `'mast'` nebo `'hanger'`). Klasifikace i kreslení používají společnou doménovou hranici `TUNNEL_MAST_CLEARANCE_U`; na hranici a za ní stojí stožár. Zapečené nitro dál přesahuje portály o 64 u (4 u za hranici závěsů).
   - **Oprava R6.** Dřívější klasifikace závěsu do 72 u nesouhlasila s kreslením jen do 60 u. Podpěra v mezeře proto nebyla vidět (svět 25, chunk 6, x = 6912 u). Mimo nitro nyní zůstává stožár na původním místě; podpěry se neposouvají a kresba kopce i nitra se nemění.
   - Drát vede rovně přes most i tunelem. V tunelu je za neprůhledným krytem; v otevřených ústích je vidět.
   - Stožáry stojí před boky kopce.
6. **Diagnostika.** Snímek `?debug=1` i `RideScene.stats.tunnels` hlásí ID, alpha 1, `train` pro soupravu a `vehicles` pro jednotlivá vozidla (`outside`, `partly`, `inside`). Hodnoty popisují zakrytý střed, nikoli otevřená ústí; audio linka může číst `train` bez nové závislosti.

## Důsledky

- Unit testy ověřují:
  - místa (sloty, biomy, blok 0), údolí a výšku břehu;
  - odstup rekvizit a stožárů od potoka, šířku potoka u trati;
  - stožáry a závěsy u tunelu;
  - rozměry a pivoty nových assetů;
  - neprůhlednost krytu, polohy vozidel u obou portálů ±100, ±35 a 0 u, patu NPC portálu na sklonu −0,07885, potlačení emisí a vrstvu živých částic.
- E2E: elektrická souprava ve světě 123 přejede most a projede tunelem.
  - Sběrač je celou dobu na drátu.
  - Žádná blízká rekvizita nepřekrývá vlak.
  - Při částečném vjezdu, zastavení i výjezdu je kryt neprůhledný. Pixelová regrese zahrnuje zastavenou hráčovu lokomotivu s vagónem u obou ústí v artu i fallbacku, zakryté i odkryté výřezy, pozitivní kontroly u obou NPC ústí a stálost portálu přes vznik/odjezd NPC. Porovnává snímek s vozidly/částicemi a bez nich v zakryté oblasti; skála nesmí změnit žádný pixel. Brzdění se ověřuje přes skutečné snímky efektů, aby jednorázový skok simulačního času neukončil krátce žijící jiskry před kontrolou.
- Původní zavedení struktur přidalo potoky, údolí a posunuté stožáry. Oprava tunnel-1 mění pouze kreslení a emise; místa struktur a rozehraná trať se nemění. Scenérie ani částice se neukládají.

## Kompatibilita

Save, trať ani ID katalogu se nemění. Generátor trati zůstává v1: most i tunel jsou dekorace nad stejnou geometrií, takže rozehraná trasa se nezmění.

Oprava R6 mění jen klasifikaci a kreslení podpěry u portálu. Geometrie, objekty, přejezdy, místa tunelů a polohy podpěr vedení zůstávají stejné; `TRACK_GENERATOR_VERSION` se nemění. Unit testy procházejí tunely 64 světů včetně záporných chunků a ověřují skutečně kreslené svorky závěsů i regresní svět 25, chunk 6.

Test kreslení `src/render/TunnelView.test.ts` běží v Node s náhradou pouze Phaseru. Leží u rendereru, takže jeho typy kontroluje stávající rendererový TypeScript projekt s DOM; doménový ani kořenový projekt bez DOM se nerozšiřují. Vitest zahrnuje i `src/render/**/*.test.ts`, lokálně a v CI stejným příkazem `volta run npm test`. Samostatně: `VITEST_MAX_WORKERS=4 volta run npm test -- src/render/TunnelView.test.ts`.

## Dočasná omezení a podmínky odstranění

- **Zvuk lokomotivy v tunelu** doplněn v [D-022](022-recorded-sounds.md): podíl soupravy v hlavním tunelu plynule tlumí kola i engine low-pass filtrem a krátkým echem. Poslech a kalibrace zařízení NEOVĚŘENO.
- **Světla lokomotivy v tunelu** zatím chybí. Přijdou se světly lokomotiv (den a noc, dokument 04 §10), stejně jako v D-017.
- **Mostní konzoly** (dokument 03 §9, „lze použít“) nejsou potřeba, protože stožáry stojí vedle opěr. Doplní se s delšími mosty, kde rozteč stožárů nestačí.
- **Varianty mostů** (CNT-04): zatím je jen kamenný mostek přes potok. Další varianty (ocelový přes řeku, viadukt) přijdou s infrastrukturou podle biomů při rozšíření katalogu.
- **Fyzická zařízení:** NEOVĚŘENO.
