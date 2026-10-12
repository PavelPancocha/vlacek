# D-011: Grafika vozidel z vektorových dílů, manifest a atlas za běhu

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §3 žádá detailní semi-realistickou grafiku místo placeholderů. Vlastník zvolil pro vozidla vlastní vektorovou kresbu ve stylu referenčních listů; scenérie se bude vyřezávat z listů. Dokument 07 §4 požaduje manifest s pivoty a offsety (žádné „magické posuny“ v kódu vykreslování), atlasy do 2048 × 2048 a stejný vzhled v náhledu i ve hře. Dokument 06 §2 chce u malé parní mašinky viditelná táhla.

**Rozhodnutí.**

1. **Zdroje.** Ručně psané SVG díly v `assets/vehicles/`, 1 jednotka SVG = 1 u. Díly vozidla:
   - karoserie: vše za koly;
   - překryv: vše před koly a táhly;
   - sdílená kola;
   - táhla.

   Světlo svítí vždy zleva shora. Kola se otáčejí, proto mají jen středově souměrné přechody. Lesk a stín obručí nese neotáčivý překryv.

2. **Manifest.** `src/content/artManifest.ts` je čistá data:
   - díly: soubor, rozměr v u, pivot a u ojnice druhý kloub;
   - vozidla: výška rámu nad kolejnicí, kola a parní rozvod.

   `vehicleArtLayers` vrací díly v pořadí kreslení pro ujetou vzdálenost. Kolo se otočí o vzdálenost / poloměr. Táhla počítá kinematika `steamGear` z klikového čepu hlavního kola. Jízda i depo používají stejné rozložení.

3. **Validace (CNT-02).** `validateVehicleArt` běží v `npm run validate:assets` i v unit testech a kontroluje:
   - každé vozidlo má buď grafiku, nebo označený placeholder;
   - soubory existují a jejich `viewBox` odpovídá rozměru v u;
   - nikde neleží nepoužitý soubor;
   - rám karoserie i překryvu má přesně `lengthU`, s pivotem na kolejnici;
   - kola stojí na kolejnici uvnitř vozu a nepřekrývají se;
   - největší kolo odpovídá `wheelRadiusU`;
   - ojnice dosáhne na křižák v každé poloze klik;
   - spřažená kola mají stejný průměr;
   - každý typ má vlastní kresbu karoserie (nový typ není přebarvená kopie, dokument 10);
   - každý díl manifestu používá aspoň jedno vozidlo.

   Release (`--release`) navíc odmítne každé vozidlo označené `placeholder: true` (`releaseErrors`).

4. **Atlas za běhu.** Phaser loader načte SVG díly. `ArtAtlas` je nakreslí do jednoho canvasu (řádkové skládání v `atlasPacking.ts`) jako jednu texturu s pojmenovanými rámečky.
   - Měřítko rasterizace je nejbližší krok 0,25 px/u nad zoomem kamery (`artScaleFor`, rozsah 0,5–2 px/u; strop podle D-013 a [D-019](019-journey-atlas-and-npc-fleet.md)).
   - Díly vozidel jedné jízdy a její NPC sady mají vlastní atlas; svět a pozadí mají samostatné atlasy. Při výjezdu z depa a obnově se přestaví jen atlas vozidel ([D-019](019-journey-atlas-and-npc-fleet.md)).
   - Po změně velikosti okna se atlas překreslí z dekódovaných zdrojů.
   - Prohlížeč tak vyhlazuje vektor přímo ve zobrazené velikosti. První verze s pevnými 2 px/u byla na 1280 × 720 (zoom 0,58) zubatá, protože GPU zmenšovalo bitmapu 3,5×.
5. **Build.** Soubory vozidel se nevkládají do JS jako `data:` URI (`assetsInlineLimit` ve `vite.config.ts`). Phaser 4.2.1 dekóduje každé `data:` URI jako base64. Vite ale malé SVG vkládá URL-kódované, takže `atob` vyhodilo výjimku, načítání scény se zastavilo a s ním celé UI.
6. **Fallback (PWA-10).** Když se díl nenačte, scéna chybu zapíše do konzole. Vozy se pak kreslí jednotnou neutrální siluetou se žlutými šrafami a jízda pokračuje. Totéž platí pro protijedoucí vlak: jede a píská, takže nikdy nesmí projet neviditelně (Codex review PR #2). Stejnou siluetu dostane i budoucí vozidlo katalogu, které ještě nemá grafiku (`placeholder: true`).
   - Funkční infrastruktura se bez grafiky kreslí jednoduchými tvary na stejných místech: přejezd se sloupky, břevny, blikajícími světly a provozem (`CrossingFallbackView`), stožáry a trolej elektrické jízdy (`chunkCatenaryFallback`), most jako mostovka s opěrami a tunel bez portálů s průhledným kopcem. Varování přejezdu tak platí dál a trolej vede celou trasou (Codex review PR #2).
   - Souběžná kolej se bez grafiky kreslí jednoduchými tvary ve stejném odsazení a na stejných místech jako s grafikou. Na obou koncích má tmavé ústí pod protijedoucím vlakem a portálový kopec nad ním, takže náhradní siluety mizí postupně v označeném portálu, nikoli na prázdné hranici (PWA-10, R7).
   - Selhat může i rasterizace atlasu na začátku jízdy nebo po změně rozměru (prohlížeč nedá plátno, textura nevznikne). Jízda se tím nezastaví: atlas, který už texturu má, zůstane u staré, a atlas bez textury scéna zahodí a kreslí siluety a jednoduché tvary. Neúspěšný krok měřítka se znovu nezkouší v každém snímku.
   - Atlas uvolní dekódované zdroje dílů (`art-source:*`) i tehdy, když jeho sestavení selže. Jinak by náhradní jízda držela v paměti celou sadu, která se načetla, právě na zařízení s potížemi. Diagnostika to ukazuje jako `artSourceTextures` (vždy 0).
   - Pravidlo se vyhodnocuje samostatně pro atlas vozidel, atlas světa a atlas pozadí ([D-019](019-journey-atlas-and-npc-fleet.md)). Selhání jednoho nevyřadí ostatní; atlas bez textury uvolní dekódované zdroje a přejde na příslušné náhradní kreslení.
7. **Depo.** Náhled je `<svg>` s jedním `<image>` na díl ze stejných souborů. Id přechodů jednotlivých souborů se tak v dokumentu nepřekrývají.

**Důsledky.**

- Přidání vozidla znamená SVG díly, záznam v manifestu a odebrání `placeholder` z katalogu. Řídicí logika se nemění (dokument 06 §1).
- Dekódované zdroje zůstávají v paměti, aby šel atlas překreslit.
- Atlas světa a atlas vozidel jedné jízdy s NPC sadou se při 2 px/u musejí každý vejít do 2048 × 2048; test `atlasPacking` hlídá oba a obě nejhorší vozidlové sady.
- Všech jedenáct vozidel katalogu 0.1 má grafiku (kontaktní list v [protokolu iterace](../validation/2026-10-10-iterace-upravy.md)). Vlak se tak kreslí z jediné textury. [D-010](010-webgl-single-texture-batches.md) (`maxTextures: 1`) přesto zůstává: fallback a budoucí krajina textury střídají a chyba Phaseru tam trvá.

**Podmínka změny splněna 2026-10-11 ([D-019](019-journey-atlas-and-npc-fleet.md)).** Nejhorší sada jízdy se světem se nevejde do 2048 × 2048 ani při autoritativních 2 px/u (údaj 2,5 px/u byl zastaralý); selhala i povolená souprava dlouhá 1 568 u. Vozidla aktuální jízdy a její NPC sady proto mají vlastní atlas, oddělený od světa. Při změně jízdy se přestaví pouze atlas vozidel; depo zůstává u SVG.

**Kompatibilita.** Save, katalogová ID ani geometrie se nemění. Barevné placeholder vzhledy (`PlaceholderLook`) zmizely, protože každé vozidlo má grafiku; z placeholderu zbyl jen příznak `placeholder: true`.
