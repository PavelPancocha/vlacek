# D-016: Elektrická lokomotiva, pantograf a trolejové vedení

Datum: 2026-10-10. Stav: přijato.

AGENTS.md a dokument 03 §9 chtějí, aby elektrická lokomotiva měla vedení v celé trase, v každém zachovaném i nově vygenerovaném chunku, ne jen kolem kamery. Další požadavky:

- Stožáry stojí v jedné globální fázi, výchozí rozteč je 256 u a kontaktní drát je 160 u nad kolejí.
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
   - Příhradový stožár stojí 12 u za kolejí, ve vrstvě za vlakem. Jeho úchyt troleje je přesně nad bodem stožáru, kde drát drží doména.
   - Pole drátu (nosné lano s průvěsem, věšáky, trolej) visí nad vlakem ve vrstvě `wires`. Natahuje se na skutečné rozpětí a sklání se podle koleje.
   - Každý chunk kreslí své stožáry a pole k dalšímu stožáru, i když ten stojí už v dalším chunku. Na švech tak vedení nepřerušuje.
5. **Pantograf.**
   - `pantographReachU` spočítá vzdálenost od základny na střeše po drát podél osy nakloněné lokomotivy, v bodě, kde se sběrač drátu skutečně dotkne.
   - `vehicleArtLayers` natáhne ramena na tuto délku. Přizpůsobení je omezené (`PANTOGRAPH_STRETCH`, 0,07–1,6 násobku kresby) a sběrač se nenatahuje.
   - V depu není drát, a tak pantograf leží sklopený.
   - Kamera u elektrické jízdy drží v obraze i výšku kontaktu.
   - Jiskra: nad 30 % nejvyšší rychlosti v místě kontaktu občas odletí jedna nebo dvě, asi jednou za tři sekundy.
6. **Diagnostika.** Snímek `?debug=1` hlásí `catenary`: elektrifikaci, počet stožárů ve vykreslených chuncích a mezeru mezi sběračem a drátem.

## Důsledky

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

- **Portálové podpěry ve stanici, mostní konzoly a tunelový závěs** (dokument 03 §9) zatím nejsou. Ve stanici stojí běžné stožáry. Konzola a závěs přijdou s mosty a tunely v kroku G4.
- **Souběžná kolej** zatím vedení nemá. Přijde s druhou kolejí v kroku G3.
- **Zvuk elektrické lokomotivy** je dočasný syntetizovaný tón jako u ostatních.
- **Fyzická zařízení:** NEOVĚŘENO.
