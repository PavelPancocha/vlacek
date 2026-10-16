# D-030: Atlasy světa podle regionu a sezóny

Datum: 2026-10-13, revize 2026-10-16. Stav: přijato. Změna [D-019](019-journey-atlas-and-npc-fleet.md), bez změny geometrie a save.

## Důvod

Kresba world-v2 se nevejde do jediné stránky 2048². Původní odhad přehlížel Phaser ImageData a mezisnímkový souběh alokací; pozdější paušálních 26 MiB pro ostatní textury také nebylo horní mezí. Seed 1 a legální souprava 1544 u (`steam_express`, `passenger_double`, `cargo_excavator`, `passenger_panorama`, `fun_balloons`, `cargo_tractor`, `fun_windmill`, `service_crane`) s NPC sadou na původní kameře při resize 3840 → 4096 CSS px měnila atlas z 2022 × 890 na 2008 × 1196. Starý GPU atlas + nový canvas + nový GPU atlas znamenaly 25,187 MiB před zemí, sky a pomocnými texturami. Ani pozdějších 93,28 MiB neplatilo pro skutečně integrovaný obsah: matice vynechala 18 sezónních pásů pozadí, déšť, dva zimní keře, šest dílů `life.*` a další díly sousedních linek. Se skutečnými metadaty a původním výběrem vycházelo 106 205 864 B = 101,29 MiB.

## Výběr a vlastnictví

- `atlasGroup` se slučuje **po jednotlivých polích**: `landscapes = part ?? package ?? scene rules`, `seasons = part ?? package ?? všechny sezóny`. Obsahové linky mohou deklarovat pouze sezónu, aniž rozšíří díl do celého světa. Nepřímé použití (kola, nářadí, pózy, střešní sníh a sezónní paralaxa) má explicitní hostitelské krajiny. Společné nástupiště/lavička a všechny částicové rámečky patří do společného základu. Šest bezsněžných horských variant má podle water-mountains@2e64ad3 jaro až podzim; v zimě je nahrazují varianty `-snow`.
- Pás pozadí (`backdrop.*`) se v dané sezóně nevybírá, je-li registrovaná jeho varianta `<klíč>-<sezóna>`: kreslení pozadí (`Backdrop`, `backdropFrames` linky seasons-life) ji v té sezóně použije místo něj. Pobřeží a duny kreslí základní pásy vždy. Platí i pro městské siluety `backdrop.town-sparse/dense`, které na podzim a v zimě nahrazují jejich varianty. Test projde všechny krajiny, sezóny a podzóny (`''`, `village`) a ověří, že okno obsahuje každý pás, který `backdropFrames` kreslí.
- Sezónní varianta bez vlastních krajin (`<díl>-<sezóna>`, `<díl>-snow`, `<díl>-winter-snow`) se vybírá všude, kde se kreslí její základní díl; `seasonalFrame` a `backdropFrames` ji za něj dosazují. Proto mají zimní a podzimní městské siluety jen město a zimní domy, chalupa, dřevo i keř krajiny svých základních dílů. Výjimku tvoří díly, které generátor kreslí všude (stanice, ploty, zimní popředí).
- Kromě pravidel scén se počítají i generátory, které díly kladou mimo pravidla. Druhy osad (`SETTLEMENT_KINDS`) dostanou krajiny scén osad (vesnice na venkově, město). Keře a kameny u služební cesty dlouhých stanic (`STATION_SERVICE_KINDS`) a auta na silničních úsecích podél trati (`ROAD_STRETCH_KINDS`) jsou společné, protože tyto generátory běží v libovolné krajině.
- Okno zahrnuje viditelné chunky, ponechaný chunk po obou stranách, přechod 8192 u a dalších **8192 u předstihu**. Nezávisí na rychlosti ani čase jízdy. Přechodový blok regionu míchá klima se sousedním regionem (D-027 `effectiveClimateAt`), takže díly jeho krajiny mohou kreslit varianty sezóny následujícího regionu. `worldAtlasWindowKeys` je proto vybere i pro kombinaci „krajina regionu × sezóna dalšího regionu“, kromě pozadí: to se prolíná, každá vrstva ve své sezóně. Seed 1, chunk 91 (forest/summer → foothills/winter) tak kreslí `back.bush-b-winter`.
- Svět má nejvýše **dvě stránky do 2 px/u**, pozadí **dvě do 1 px/u**, každá ≤2048². Vozidla aktuální soupravy a seedované NPC sady mají jednu stránku ≤2048² do 2 px/u. Profil low má strop 1,25 px/u pro svět a vozidla a 0,75 px/u pro pozadí podle paměťové obálky níže; katalog se nemění. Samotné omezení efektů rozlišení atlasů nesnižuje.
- Nová sada se připraví mimo kreslicí volání a aktivuje na hranici snímku; obrázky se přesměrují před uvolněním starých stránek. Nezměněné rámečky se kopírují. Efekty a pozadí zachovávají pooly. Při změně regionu se zem nepřekresluje, při změně jejího měřítka se obnoví.
- Vozidla používají stejnou asynchronní přípravu jako svět, s vynucenou jedinou stránkou. **Ani vozidla již trvale nedrží dekódované zdroje celého katalogu** (dříve 19,37 MiB). Vlastněný cache drží lokální SVG jako text; bitmapy jen během přípravy, nejvýše v pixelovém rozpočtu čtyř největších vozidlových dílů. Starý atlas zůstává platný do publikace. Změna jízdy i obnova kontextu ruší starý požadavek včetně jeho callbacku.
- Živé přípravy vozidel, světa a pozadí jsou sériové. Nejprve skončí příprava a publikace vozidel, pak světa, potom pozadí. Požadavek vozidel (nová jízda, výjezd z depa, změna měřítka) podrží začátek nové práce světa i pozadí (`WorldAtlasRequests.requestVehicles`). Rozpracovaná příprava doběhne a publikuje se, potom se připraví vlak, svět a pozadí v tomto pořadí. Dříve vozidla čekala, až svět i pozadí doběhnou úplně, takže se vlak po změně měřítka přerastroval až po celém okně. Nová výměna vozidel nezačne ani nad již dokončeným, ale ještě nepublikovaným světovým/pozadovým bufferem. Tím se nemíchají maxima různých fází. První načtení/obnova kontextu dovoluje pod clonou souběh světa a pozadí, ale ještě bez chunků; model má samostatnou fázi `cold`.
- **Zrušená příprava se nepřekrývá s náhradní.** Nativní `image.decode()` a `createImageBitmap` nejde přerušit. Nová příprava téhož atlasu proto nic nealokuje, dokud předchozí, i zrušená, příprava nedoběhne včetně úklidu. Zobrazená sada mezitím zůstává; další požadavek jen nahradí ten čekající. Zrušená příprava nechá rozběhnuté `decode()` doběhnout: odpojení `src` během něj nechá slib v Chromiu navždy nevyřízený, což by náhradní přípravu zablokovalo. Po dekódování už bitmapu nezačne. Nepublikované stránky (GPU i dokončené Canvas stránky) vrátí hned při zrušení, pozdě dokončenou bitmapu zavře a evidenci dekodéru (`sources`, během `createImageBitmap` dvojnásobnou) drží až do skutečného dokončení nativní práce. Mezi vlastníky platí totéž (`ArtAtlas.settling`, `WorldAtlasRequests`): vozidla nezačnou, dokud svět nebo pozadí mají nedoběhnutou přípravu, a svět ani pozadí nezačnou nad doznívajícími dekodéry vozidel. Nový požadavek okna zruší rozpracované pozadí a nejnovější světový požadavek čeká ve frontě, dokud zrušené pozadí nedoběhne. Pozadí začíná až po publikaci světa, takže opačný souběh nevzniká. Výjimkou zůstává první načtení pod clonou (fáze `cold`). Regrese prochází orchestrací se skutečnými atlasy a zpožděnou bitmapou pozadí ve WebGL i Canvasu, včetně již registrované náhradní stránky. Regrese se zpožděnými bitmapami a resize 0,75 → 1 → 1,25 px/u dříve držela tři nepublikované stránky (4 579 488 B v testu, 12 596 192 B v sondě recenze), nyní nejvýše jednu, tu publikovanou.
- `frameTexture(frame, fallback)` je jediný přístup ke stránce rámečku pro přílohy, animace, částice i kompozice. RideScene do něj instaluje rezidentní resolver publikovaných stránek světa a pozadí a při zániku ho odebere; nerezidentní rámeček vrátí náhradní texturu a diagnostika `world-part` ho hlásí. Každý obrázek světa nese `world-part`, takže ho publikace nové sady přesměruje. Obrázek s originem z autorského pivotu (úchop klády, zrcadlený pivot portálu nebo sezónní přílohy) ho zaznamená přes `setWorldPivot`. Když jeho rámeček na zobrazené stránce chyběl, `rebindWorldImage` po publikaci přepočítá origin z tohoto pivotu, ne z pivotu katalogu. Jinak by se po pozdní publikaci posunuly klády harvestoru a vyvážečky o 38 u a zrcadlené kopce portálů vedlejší trati.
- Kompozice farm/forest si přes tentýž resolver vyhledají konkrétní stránku. Canvas půjčí výřez; WebGL dočasně přečte pouze daný rámeček (otočení řádků a převod premultiplikované alfy), po malbě jej uvolní. Výsledek je neměnná textura bez ImageData, na GPU bez plného drženého canvasu. Ořezané kompozice drží pixely jen v chunku protínajícím viewport s 64u okrajem; popis a ostatní aktéři žijí dál s chunkem. Opakovaný vstup/odchod má test cleanupu. Kola, nářadí a animované pózy `FarmForestView` vždy používají resolver a diagnostický klíč rámečku.
- Každý dekodér, bitmapa, Blob URL, message port a rAF má cleanup při zrušení. Selhání ponechá starou platnou kresbu nebo označený fallback; chybějící pozadí použije starou vrstvu/sky, nikdy první libovolný snímek atlasu. Stejný neúspěšný požadavek se neopakuje každý snímek.

## Časové řezy

Balení se dělí na kroky po nejvýše 32 umístěných dílech (`packRectsInSteps`); jízda, pauza i clona berou v jednom snímku nebo message úloze kroky do 2 ms. Jeden kandidát tak už nevytvoří nerozdělenou špičku `plan` (D-032 naměřilo až 80 ms při CPU ×4). Rasterizace před další operací kontroluje **spotřebovaných 4 ms**, nezávisle na tom, zda jde o jízdu nebo pauzu; limit čtyř položek za jízdy je další podmínka. Studený/pozastavený dekodér zaplní stejný pixelový rozpočet i více drobnými díly; samostatný limit 16 dílů zbytečně serializoval dokončování malých bitmap. **Vědomé omezení:** rozpracovaná SVG (od `decode()` do hotové bitmapy) nejsou v RGBA evidenci a Chromium na každé drží asi 0,31 MiB paměti rendereru. Současně jich bylo naměřeno 19–37 při studeném startu (asi 6–11 MiB) a 19–25 při pozastaveném přestavění po změně měřítka (asi 6–8 MiB). Limit 8 souběžných dekódování (asi 2,5 MiB) zpomalil start Canvasu o 27–48 % a resize o 13–17 %, proto se nezavádí (rozhodnutí 2026-10-16: nekomplikovat). Možným pokračováním je klouzavé okno dekódování místo kol. Pixelový limit ani 4ms řezy se tím nezvyšují. Do stejného řezu patří synchronní vstup `svgSource` včetně startů uvnitř dekódovací dávky. Regrese s řízenými hodinami účtuje kopii, malbu i vstup dekodéru po 5 ms a vyžaduje snímek před druhou operací.

**Změna měřítka: rozhodnutí vlastníka (2026-10-16).** Resize, rotace nebo celá obrazovka dekódují celé okno znovu, na 0,75 px/u asi 223 SVG. Do publikace zůstávají kreslené stránky ve starém měřítku: nic nechybí, při zvětšení je obraz několik sekund měkčí. Nejdřív se přerastruje vlak, potom svět a pozadí. V headless Chromiu na desktopu je svět publikovaný za 1,6–4,6 s s jednou stránkou a za 3,5–8,6 s se dvěma současně, podle zátěže stroje; tablet bude pomalejší. d2fff15 bez D-030 potřeboval 0,2–0,45 s, protože držel všech 422 zdrojů dekódovaných od startu. Čas tvoří zpracování SVG na hlavním vlákně: sériově asi 12 ms `decode()` a 15 ms `createImageBitmap` na díl. Vykreslení již dekódovaného SVG v novém měřítku trvá 0,5–0,8 ms a zůstává vektorově ostré. Držet dekódovaná SVG zobrazeného okna by ale stálo 0,23–0,31 MiB paměti rendereru na obrázek, pro okno startu 52–69 MiB, a to se do rozpočtu low 96 MiB nevejde. Vlastník proto latenci přijal jako cenu paměťové meze a držení zdrojů zamítl. Jen dvě atlasové aserce linky, `art.spec` (svět v 0,75 px/u po resize) a `world-atlas-regions` (seed 1, obnova a resize, `pending`), čekají na publikaci nejvýše 15 s místo výchozích 5 s. Test `world-atlas-regions` seed 1 (obnova a dvě změny měřítka) má navíc `test.slow()`, tedy trojnásobnou lhůtu testu, protože se při `--workers=2` do 30 s nevešel (druhé rozhodnutí vlastníka téhož dne). Ostatní lhůty se nemění.

WebGL nahrává nové díly po dlaždicích ≤256 × 256 px. CPU nedrží celostránkový canvas; Canvas používá neměnné `Texture` bez `CanvasTexture.imageData`. D-010 `maxTextures: 1` a pořadí vrstev zůstávají. Limit řezu není preempce jedné nativní operace: její skutečnou délku kontroluje samostatná výkonová brána.

## Paměť a diagnostika

`worldAtlases.memory` eviduje `canvas`, `imageData`, `sources`, `gpu`, `bytes`, `highWaterBytes` a rozpis `allocations`. Maximum se mění při alokaci, nikoli až po snímku. Převod canvasu do textury převede vlastnictví evidence před Phaser `addtexture`, aby reference na stejné pixely nebyla počítána dvakrát. Jde o známé RGBA8 kopie; DOM, komprimované SVG, renderovací backbuffer a neznámé kopie ovladače nejsou zahrnuty.

`atlasLifetimePeak` modeluje odděleně výměnu vozidel, svět, obnovu země a pozadí. Vstupem jsou skutečné rozměry starého/nového atlasu hráče a NPC, world/backdrop stránek, držené země a pomocných textur. SVG a bitmapa se překrývají, ale uploadový canvas vzniká až po uvolnění SVG. Historická synchronní větev modelu počítá i starý GPU atlas + nový celý canvas + nový GPU atlas; produkční dlaždicová větev pouze starý/nový atlas a omezený dekódovací/uploadový buffer.

Profil **low omezuje atlas vozidel i světa na 1,25 px/u při libovolné šířce viewportu** (`profileArtScale`) a **pozadí na 0,75 px/u** (`profileBackdropScale`); standard ponechává 2 a 1 px/u a limit 192 MiB. Kamera a geometrie soupravy se nemění. Kamera D-028 má při DPR 1 zoom 0,6 × šířka CSS / 2000 u. Strop světa a vozidel se proto projeví až nad 4096 CSS px, strop pozadí nad 2500 CSS px: referenční telefon 1140 px kreslí pozadí při 0,5 px/u, 1920 px (Tesla) při 0,75 px/u jako dosud. Nad těmito šířkami se low kresba více zvětšuje; vzdálené pozadí nejvýše o třetinu proti 1 px/u. Změna profilu ze standardního na low může do uvolnění starých textur nést původní standardní alokace.

**Integrovaný katalog (integrate-4).** Obě obsahové linky jsou registrované:
379 dílů včetně tunelů/mostů a vody/hor. Jejich položky byly odstraněné ze
snapshotu `tests/fixtures/world-catalogue-snapshot.ts`; seznam čekajících modulů
je prázdný. Zbývající základní snapshot hlídá rozměry vydaných dílů. Registry
vznikly generátorem, hostování zachovává obě linky. Historická báze d2fff15
používala 381 dílů včetně dvou později odstraněných duplicit mlýna.

Test ověřuje všech 258 sousedních dvojic krajin a sezón, oba renderery a **všechny rastrové kroky obou profilů**: low 0,5/0,5, 0,75/0,75, 1/0,75 a 1,25/0,75 px/u (svět/pozadí), standard 0,5–2 px/u pro svět s pozadím do 1 px/u. U každého okna kontroluje nejvýše dvě stránky ≤2048², umístění všech dílů a model životností. Zobrazená (stará) sada je největší okno téhož profilu. Balení řadí shodné rozměry podle klíčů v pořadí kódových jednotek, nikoli podle jazyka procesu; matice dává totéž pod `cs_CZ.UTF-8` i `C.UTF-8`. Případy jsou rozdělené do čtyř souborů podle rastru světa, takže úplné balení běží na více workerech; lokálně žádný případ netrval ani sekundu. Doplňkový test prochází okna seedů 1/7/123/2026 po 512 u přes tři cykly regionů: okno nejdelší soupravy (nejvýše 23 940 u) nikdy nedrží víc než dva regiony, protože nejkratší region má tři bloky (24 576 u), a každá dvojice je v matici.

**Jedna stránka, je-li skoro stejně velká.** Dvě kompaktní stránky mohou vyjít o několik set pixelů menší než jedna, každá stránka však znamená další vazbu textury v dávce (D-010). Když by se dvě stránky vešly do jedné, plánovač zkusí i nejnižší jednostránkovou výšku. Jednu stránku zvolí, pokud je nejvýše o jeden 128px pás plné šířky (1 MiB) větší. Příklad: lakes/summer + countryside/summer při 1 px/u vychází 1774 × 384 místo 2048 × 256 + 610 × 256.

**Snížení rezidence.** S reálným katalogem se nevešlo pozadí: okno foothills/spring → town/spring mělo při 1 px/u 2048 × 1441 = 11 804 672 B a low vycházel na 101,29 MiB. Vozidla ani blízký svět se nezhoršují:

1. Pás pozadí ustoupí registrované sezónní variantě (výše). Samotné toto pravidlo dávalo 94,70 MiB.
2. Strop pozadí 0,75 px/u na low. Samotný by dal 87,92 MiB.

Po přistání obou linek je maximum low **97 951 432 B = 93,414 MiB**,
rezerva **2 711 864 B = 2,586 MiB** do 96 MiB. Standard má maximum
**147 406 304 B = 140,578 MiB**, rezervu 51,422 MiB do 192 MiB.
Původní obálky 88,06/127,66 MiB platily pouze pro historickou bázi.
Countryside pásy ve městě zůstávají podle amendment 12, ačkoli je backdropFrames
nekreslí. Jde o maximum souběžných životností v modelu, včetně pracovních
ploch struktur a kompozic; nárůsty samostatných linek nelze prostě sečíst.

| Profil   | Největší starý svět B | Největší staré pozadí B |    Vrchol B |     MiB | Limit MiB |
| -------- | --------------------: | ----------------------: | ----------: | ------: | --------: |
| Low      |            10 485 760 |               4 696 968 |  97 951 432 |  93,414 |        96 |
| Standard |            26 017 792 |               9 191 424 | 147 406 304 | 140,578 |       192 |

Nejhorší je WebGL publikace nového world okna: low foothills/spring →
town/winter při 1,25/0,75 px/u (shodná maxima mají i další teplé sezóny),
standard foothills/autumn → town/winter při 2/1 px/u. Ve standardu samotné
nové společné hostování zvětšilo největší packed world z 25 165 824 na
26 017 792 B. Umění ani limit se nezmenšují ani nezvyšují.

| Fáze nejhoršího low okna |          B |    MiB |
| ------------------------ | ---------: | -----: |
| Studený start            | 34 427 336 | 32,832 |
| Výměna vozidel           | 94 781 064 | 90,390 |
| Příprava světa           | 97 951 432 | 93,414 |
| Obnova země/kompozic     | 83 132 392 | 79,281 |
| Příprava pozadí          | 92 069 392 | 87,804 |

Konstanty vlastní `ATLAS_BOUND` (`tests/helpers/atlasResidency.ts`). Čtyři
atlasBound soubory stále ověřují 814 případů, všechny stupně a oba renderery.
Red před přepočtem: 813 PASS / 1 FAIL (standard packed world
26 017 792 > 25 165 824 B). Výpočet používá skutečný společný katalog.

`groundPixelEnvelope` odvozuje rozměry země ze sklonu, náspu, předního pásu včetně 8u přesahu ploch, tunelu a kamery. `compositionPixelEnvelope` odvozuje vrstvy z reálných pravidel, rozměrů dílů, projekce a ořezu na chunk. Vozidlová obálka používá poličkové balení a plochu všech katalogových obdélníků s paddingem: každá uzavřená řada má šířku větší než šířka stránky minus nejširší díl a její výška není menší než výška následující řady. Tím kryje každý podvýběr hráče i NPC bez neplatného předpokladu monotónnosti balení podmnožin. Browserová regrese navíc modeluje **skutečné** rozměry dané soupravy, NPC a držených textur. Historické rozměry 2022 × 890 při 1,75 a 2008 × 1196 při 2 px/u zůstávají samostatnou regresí; současná kamera při 3840 i 4096 CSS px používá 1,25 px/u a test navíc provede skutečnou výměnu 3200 → 4096 CSS px (1 → 1,25) a ověří zachování limitu při 5120 CSS px.

Paušál 26 MiB ani dřívější tvrzení 94,84/94,47/93,28/86,10 MiB již nejsou platným důkazem. Limity zůstávají **96 MiB low / 192 MiB standard**. Nový katalog, geometrie, viditelnost nebo alokační fáze musí projít přepočtem i browserovou kontrolou.

`performance.stages` rozlišuje přípravu, registraci/upload, aktivaci světa a pozadí; zaznamenává i následující snímky proti základu stejné jízdy. `resetAtlasMetrics()` začíná měření po cloně. Přírůstek p95 se porovnává s 33,33 ms low / 16,67 ms standard. 250 ms je pouze katastrofický strop. Injekce pomalé přípravy či aktivace pozadí musí bránu shodit i bez světové výměny. `atlasProof()` vlastní dočasnou čtyřstránkovou sondu; `closeAtlasProof()` ji uklidí.

## Kompatibilita a ověření

Rendererový výběr se neukládá. Schéma, katalogová ID, contentVersion, seed ani generátor se nemění. D-019 dál vlastní výběr NPC a unikátních vozidlových dílů; D-030 mění pouze načítání a životnost pixelů. Produkční build obsahuje všechny assety lokálně.

Báze integrate-4 je `5e3385d` včetně PWA; water-mountains a tunnels-bridges
jsou nyní přistálé. Historická atlasová báze byla `d2fff15`. Regresní `assertEmittedAtlasKeys` rekurzivně kontroluje rodiče, přílohy i animační klíče; adaptér farm/forest sbírá skutečné volby rendereru, 1200 chunků pro seedy 1/7/123. Vykreslovací průchod (`chunkEmissions`) chunk zviditelní, takže ořezané kompozice upečou a jejich čtení rámečků se počítá. `chunkPivotDrift` každý chunk postaví jednou s rezidentními rámečky a jednou bez nich, po pozdní publikaci porovná originy všech obrázků `world-part` a vyžaduje shodu. Po připojení dalšího obsahu musí jeho adaptér použít stejný helper. Nová jízda nebo diagnostický skok ponechá clonu do publikace všech potřebných atlasů; nesmí péct nový les z předchozího atlasu krajiny. Při opožděném nebo chybějícím snímku se kompozice odloží, její klíč je v `missingFrames` a po publikaci se vykreslí. Existující chunky se při přípravě dalšího okna dál kreslí. Testy diagnostického skoku s pozastavenými hodinami posouvají virtuální snímky do dokončení publikace atlasů a clony; pevný jednorázový krok není dokončení asynchronního skoku. Poruchová injekce vozidel míří na dočasný ImageBitmap v aktuálním měřítku, nikoli na dřívější trvale načtený obrázek ve 2 px/u.

Příkazy a výsledky integrace, paměťová a snímková tabulka patří do předání linky a vývojového návodu. Desktopový Chromium Canvas/WebGL není test fyzického tabletu ani Tesly; zařízení a firmware jsou **NEOVĚŘENO**.

Atlasové E2E ponechávají API/source trace, ale průběžné JPEG/DOM snímkování při měření vypínají: GPU readback soutěží s měřeným uploadem. Obraz dokládají samostatná PNG po měřeném úseku. Farmový cold boot používá nativní hodiny; virtuální hodiny se instalují až po připravení atlasů pro následné scénové kroky. Původní atlasové výjimky jsou 15 s pro publikaci po změně měřítka a `test.slow()` testu seed 1 (viz Časové řezy); pozdější výjimku pro start a obnovu jízdy popisuje rozhodnutí integrate-6 níže.

**Původní pravidlo testů po D-019 (rozhodnutí vlastníka integrate-5, 2026-10-16).** Kontroly vykresleného stavu čekají na publikaci pomocí existujícího `waitForWorldAtlases`; záměrný fallback bez vozidlového artu používá stejnou podmínku bez požadavku na `vehicleAtlas`. Testy „od prvních snímků“ čekají u volajícího přes `page.waitForFunction` na `hidden` clony a potom vzorkují prvních 20 snímků: clona zmizí až po `rideFramesDrawn++` a `worldDrawn()`, nikoli po pouhé přípravě artu. Sampler ani kontrola celého vlaku nečekají na počet vykreslených vozidel. Nahrazuje se pouze synchronní předpoklad D-019; akcelerace zůstává nezávislá na kresbě, `driveUntilMoving`, aserce, timeouty, retries a `test.slow` se nemění. Případy závislé pouze na zátěži při dvou workerech (integrate-4 případy 4/5/9/17/25/34/38/43/44/48) se stejně jako H0 vykazují samostatně; nepřidává se jim synchronizace a rozhoduje CI v osmi shardech.

**Start a obnova jízdy (rozhodnutí vlastníka integrate-6, 2026-10-16).**
Vlastník přijal přibližně dvousekundovou clonu po Vyjet jako cenu paměťové
meze D-030: „Přijmout + 15 s v testech“. Měření a pokračování s přípravou
během depa vlastní [D-032](032-startup-and-ride-performance.md).
`tests/e2e/helpers.ts` má jedinou konstantu `RIDE_START_TIMEOUT_MS = 15_000`
a `waitForRideStart(page)`, který čeká na skrytí `.ride-curtain` nejvýše tuto
dobu. Nahrazuje se tím předchozí zákaz synchronizace startů citlivých na zátěž;
nejde o čekání neomezené až celkovým timeoutem testu.

Volání jsou pouze po startu/obnově a před stávající kontrolou:

| Místo                                                           | Navazující kontrola                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `helpers.ts` — `startRide` po `RIDING`                          | Dosavadní skrytí clony; sdílejí i testy `ride-reveal` pro Pokračovat, rotaci a nasycený buffer.                                                  |
| `helpers.ts` — `restoredTrain` po `resume`                      | `artVehicles === ids.length + 1`; nahrazuje dříve přidané `waitForWorldAtlases`, včetně volajících v `camera.spec.ts` a obnovy v `game.spec.ts`. |
| `electric.spec.ts` — compact contact po `RIDING`                | `artVehicles === 2`.                                                                                                                             |
| `effects.spec.ts` — oba bublinové výřezy po `RIDING`            | `bubbles.length > 1`.                                                                                                                            |
| `backdrop-reset.spec.ts` — první obnova po `resume`             | `scenery.biome === firstBiome`.                                                                                                                  |
| `oncoming.spec.ts` — `continueBeforeSecondTrack` po `RIDING`    | SCN-09, následný výjezd NPC a `secondaryTrackViews > 0`; sdílený PWA-10 ponechává svůj další fallback waiter.                                    |
| `structures.spec.ts` — obnova uvnitř tunelu po `PAUSED`         | Stav neprůhledného tunelu s `alpha === 1`.                                                                                                       |
| `ride-reveal.spec.ts` — mid-biome obnova po `continue` do pauzy | `backdrop.currentBiome === countryside`.                                                                                                         |

Navazující polly ponechávají své původní lhůty (výchozích 5 s; SCN-09 má
vlastní dosavadní poll výjezdu NPC). Aserce, samplery prvních snímků,
`observeReveal`, `driveUntilMoving`, retries a `test.slow()` se nemění.
Ostatní synchronizace z `4718efe`, včetně devíti čekání před vzorkováním
prvních snímků, zůstávají. Další zvýšení lhůt toto rozhodnutí nepovoluje.

## Integrate-4: publikace a původní diagnostický kontrakt

`pending` zahrnuje také hotové world/backdrop stránky čekající na frame-boundary
commit; společný snapshot navíc započítá hotový nepublikovaný atlas vozidel.
Regrese nejprve reprodukovala `pending: false` při `backdrop.ready: true`,
potom vyžaduje true až do publikace. Veřejný `snapshot().backdrop` zachovává
čtyři dosavadní pole; interní `missingFrames` dál přispívají do worldAtlases.
Tím se zachovají přesné kontroly R10 a obnoveného pohledu.

Při integrate-4 zůstaly browserové setupy, aserce, numerické timeouty a retries
beze změny; následné testovací výjimky vlastní rozhodnutí integrate-5 a
integrate-6 výše. Izolované běhy integrate-4 porovnávaly stejný grep na
integraci a bázi 5e3385d.
