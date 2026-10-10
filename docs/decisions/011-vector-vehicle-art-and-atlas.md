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
   - spřažená kola mají stejný průměr.
4. **Atlas za běhu.** Phaser loader načte SVG díly. `ArtAtlas` je nakreslí do jednoho canvasu (řádkové skládání v `atlasPacking.ts`) jako jednu texturu s pojmenovanými rámečky.
   - Měřítko rasterizace je nejbližší krok 0,25 px/u nad zoomem kamery (`artScaleFor`, rozsah 0,5–2,5 px/u).
   - Po změně velikosti okna se atlas překreslí z dekódovaných zdrojů.
   - Prohlížeč tak vyhlazuje vektor přímo ve zobrazené velikosti. První verze s pevnými 2 px/u byla na 1280 × 720 (zoom 0,58) zubatá, protože GPU zmenšovalo bitmapu 3,5×.
5. **Build.** Soubory vozidel se nevkládají do JS jako `data:` URI (`assetsInlineLimit` ve `vite.config.ts`). Phaser 4.2.1 dekóduje každé `data:` URI jako base64. Vite ale malé SVG vkládá URL-kódované, takže `atob` vyhodilo výjimku, načítání scény se zastavilo a s ním celé UI.
6. **Fallback (PWA-10).** Když se díl nenačte, scéna chybu zapíše do konzole. Vozy se pak kreslí označenou placeholder siluetou a jízda pokračuje.
7. **Depo.** Náhled je `<svg>` s jedním `<image>` na díl ze stejných souborů. Id přechodů jednotlivých souborů se tak v dokumentu nepřekrývají.

**Důsledky.**

- Přidání vozidla znamená SVG díly, záznam v manifestu a odebrání `placeholder` z katalogu. Řídicí logika se nemění (dokument 06 §1).
- Dekódované zdroje zůstávají v paměti, aby šel atlas překreslit.
- Atlas všech dílů se při největším měřítku musí vejít do 2048 × 2048; hlídá to test `atlasPacking`.
- [D-010](010-webgl-single-texture-batches.md) (`maxTextures: 1`) platí dál, dokud se placeholdery a kolo `wheel` kreslí z vlastních textur.

**Podmínka změny.** Celý katalog V1 (10 lokomotiv a 32 vagonků) se do jednoho atlasu při 2,5 px/u nevejde. Až test `atlasPacking` selže, atlas bude obsahovat jen vozidla aktuální jízdy a depo zůstane u SVG.

**Kompatibilita.** Save, katalogová ID ani geometrie se nemění. U `steam_local` zmizel `placeholder`, protože vozidlo má grafiku.
