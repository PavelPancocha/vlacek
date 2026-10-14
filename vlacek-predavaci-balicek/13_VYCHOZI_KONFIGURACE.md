# 13 — Výchozí konfigurace a jednotky

[Zpět na rozcestník](../README.md)

Tento soubor vlastní výchozí číselné parametry. Hodnoty jsou **návrh k implementaci a ověření**, ne empiricky prokázané optimum pro konkrétní dítě nebo zařízení. Po ladění se mají změnit zde, v kódu a v souvisejících testech společně.

```json
{
  "specVersion": "1.0",
  "generatorVersion": 2,
  "contentVersion": 1,
  "simulation": {
    "fixedHz": 60,
    "maxCatchUpSteps": 5,
    "pauseOnHidden": true,
    "resumeSpeedUPerSec": 0
  },
  "train": {
    "maxConsistLengthU": 2000,
    "maxVehicleLengthU": 220,
    "couplerGapU": 8,
    "maxSpeedUPerSec": 480,
    "accelerationUPerSec2": 160,
    "coastDecelerationUPerSec2": 96,
    "brakeDecelerationUPerSec2": 480,
    "stopEpsilonUPerSec": 0.5,
    "uphillSpeedReduction": 0.1,
    "gradeAccelerationFactor": 0.25,
    "slowModeSpeedFactor": 0.65
  },
  "input": {
    "maxPointers": 5,
    "leftSwipeDistanceCssPx": 64,
    "leftSwipeMaxDurationMs": 500,
    "leftSwipeHorizontalRatio": 1.5,
    "minTargetCssPx": 64,
    "primaryControlTargetCssPx": 80,
    "parentGateHoldMs": 2000
  },
  "world": {
    "chunkWidthU": 1024,
    "chunksPerBiomeBlock": 8,
    "blocksPerRouteCycle": 8,
    "maxTrackGrade": 0.12,
    "profile": {
      "blockChunks": 8,
      "maxHeightU": 400,
      "blockHeightRangeU": 160,
      "flatMinU": 384,
      "flatMaxU": 1536,
      "slopeMinU": 768,
      "slopeMaxU": 2304,
      "gradeRangeMin": 0.03,
      "gradeRangeMax": 0.08,
      "transitionU": 192,
      "lengthStepU": 64
    },
    "terrain": {
      "latticeU": 512,
      "maxEmbankmentU": 40
    },
    "arcSampleSpacingU": 8,
    "geometryLookAheadU": 2048,
    "geometryTailMarginU": 1600,
    "renderMarginChunks": 1,
    "logicalActivationAheadU": 2048,
    "maxPlacementAttempts": 8,
    "rebaseAfterU": 16384,
    "spawnChunkIndex": 0,
    "spawnLocalXU": 512,
    "secondaryTrackOffsetU": 64,
    "secondaryRailProbability": 0.3333333333333333,
    "forcedSecondaryBiomeBlock": 1,
    "npcTriggerBeforeFeatureU": 512,
    "npcHiddenPathMarginU": 256,
    "catenaryPoleSpacingU": 256,
    "catenaryContactHeightU": 128
  },
  "camera": {
    "trainWidthFraction": 0.6,
    "trainCenterFraction": 0.46,
    "bandAnchor": 0.5,
    "verticalFollowPerSec": 3,
    "manualPanDuringRide": false
  },
  "crossing": {
    "roadClearanceSeconds": 2.0,
    "warningSeconds": 1.2,
    "maxWarningSeconds": 4.0,
    "openHysteresisSeconds": 0.5,
    "closingSeconds": 0.8,
    "openingSeconds": 0.8,
    "safetySeconds": 0.5,
    "distanceMarginU": 80,
    "maxQueuedCars": 6,
    "maxQueuedBikes": 2
  },
  "station": {
    "stopSpeedThresholdUPerSec": 4,
    "stopDetectionSeconds": 0.5,
    "sceneCooldownSeconds": 12,
    "autoStop": false
  },
  "interaction": {
    "defaultCooldownSeconds": 1.5,
    "hornMinIntervalSeconds": 0.7,
    "npcHornCooldownSeconds": 8,
    "hornResponseRadiusU": 800,
    "maxMajorForegroundActions": 1,
    "npcTrainMaxWagons": 5,
    "npcTrainMinSpeedUPerSec": 100,
    "npcTrainMaxSpeedUPerSec": 160
  },
  "environment": {
    "dayCycleSeconds": 480,
    "initialDayPhase": 0.18,
    "dayFraction": 0.55,
    "duskFraction": 0.15,
    "nightFraction": 0.2,
    "dawnFraction": 0.1,
    "weatherWindowSeconds": 120,
    "weatherTransitionSeconds": 12,
    "clearWeatherProbability": 0.75
  },
  "audio": {
    "defaultSfxEnabled": true,
    "defaultMusicEnabled": false,
    "maxVoices": 8,
    "maxLoopVoices": 3,
    "maxOneShotVoices": 5
  },
  "save": {
    "schemaVersion": 1,
    "intervalSeconds": 5,
    "editDebounceMs": 250,
    "targetBytes": 131072,
    "maxBytes": 524288,
    "maxRuntimeComponents": 512
  },
  "quality": {
    "low": { "maxDpr": 1, "targetFps": 30, "maxDecorativeParticles": 96 },
    "standard": {
      "maxDpr": 1.5,
      "targetFps": 60,
      "maxDecorativeParticles": 240
    },
    "minimumModeSwitchIntervalSeconds": 10
  },
  "assetBudgets": {
    "initialTransferMiB": 10,
    "completeOfflineTransferMiB": 45,
    "lowDecodedTextureMiB": 96,
    "standardDecodedTextureMiB": 192,
    "preferredMaxAtlasEdgePx": 2048
  }
}
```

## Odvozené hodnoty a pravidla

`world.catenaryContactHeightU = 128` je vizuální kontakt nad kolejnicí, společný drátu, stožárům, tunelovým závěsům a pantografu ([D-016](../docs/decisions/016-electric-locomotive-and-catenary.md)). Čistý config nesmí importovat art manifest: validace vyžaduje konečné číslo nejméně `108 + 20` u a katalogový test nezávisle ověřuje `max(vehicleArt.heightU) + 20`, včetně všech nákladů. Geometrický test navíc chrání alespoň 12 u skutečné mezery na přechodu sklonů. Katalog má obálku 108 u, nejvyšší vagonek 104 u. Ramena 56 × 34 u se přizpůsobují v dosavadním měřítku 0,07–1,6, hlava 40 × 6 u má kontakt 5 u nad pivotem: složený dosah je 7,38 u a pracovní mez 34–59,4 u. Nedosažitelný drát omezí pracovní dosah s příznakem `outOfRange`, nevyhodí výjimku ani dále nenatáhne ramena. Při `world.profile.transitionU = 192` je ověřen celý `world.maxTrackGrade = 0,12` pro rovina ↔ svah; pro přímý obrat +sklon ↔ −sklon je ověřená mez 0,098. Jiná délka přechodu nebo rozmístění podpěr vyžaduje nové měření (D-016). Výška vedení nemění profil koleje, layout světa ani uloženou polohu, takže její změna ze 160 u nevyžaduje novou verzi generátoru.

Limit soupravy je 2 000 u včetně spřáhel. [D-028, camera-1](../docs/decisions/028-longer-consist.md) rámuje střed na 46 % šířky, nejdelší vlak na 60 % a výřez na 3 333,33 u. Zoom je pevný pro jízdu a viewport: `0.60 × šířka / max(2000, délka soupravy)`. Geometricky zbývá nejméně 16 % šířky za vlakem a 24 % před ním; výhled před 1 600u vlakem je 1 000 u a před 2 000u vlakem 800 u. Streamování musí pokrývat celý viditelný kontext i skutečnou soupravu; zadní rezerva je 1 600 u a předstih 2 048 u. `geometryTailMarginU` musí být konečná hodnota nejméně 1 600 u; změna retence nemění geometrii generátoru ani save. Svislý cíl je polovina volného pásu, follow 3/s.

`interaction.npcTrainMinSpeedUPerSec` a `interaction.npcTrainMaxSpeedUPerSec` musí být konečná kladná čísla, minimum nejvýš maximum. Validace odmítne také nekonečné maximum, aby protijedoucí vlak nemohl opustit svoji dráhu skokem do nekonečna (R2). Výchozí hodnoty 100–160 u/s ani uložená data se nemění.

`Dclose` není druhá nezávislá konstanta. Je konzervativním dosahem simulace a blokováním silnice při plné rychlosti: `Vmax × (roadClearanceSeconds + warningSeconds + closingSeconds + safetySeconds) + distanceMarginU`, při nynějších 480 u/s tedy 2 240 u. Jednotlivé fáze řídí nejkratší možný čas příjezdu se zrychlením podle dokumentu 05 a [D-021](../docs/decisions/021-crossing-closes-in-view.md). Vzdálenost se měří od čela k bližšímu okraji rozšířené zóny (±62 u). `roadClearanceSeconds` nesmí být kratší než nejhorší doba opuštění konfliktu aktérem za stop čárou (2,0 s, D-015). `maxWarningSeconds` je kladná konečná hodnota nejméně `warningSeconds`: i při stání spustí závory po nejvýše 4 s výstrahy. Kladná konečná `openHysteresisSeconds` prodlužuje práh pro otevření o 0,5 s. Časová rezerva pro každou predikci je `distanceMarginU / Vmax` daného vlaku; validace odmítá neplatné hodnoty.

`world.chunksPerBiomeBlock` je pevně 8, stejně jako `world.blocksPerRouteCycle`. Rozvržení motivů podle dokumentu 04 §6 používá sloty 0–7; validace proto odmítá jinou velikost bloku, včetně 4 (R8). Odvození slotů pro jiné velikosti se zavede až při konkrétním požadavku spolu s novou verzí generátoru. Výchozí konfigurace ani uložené cesty se touto kontrolou nemění.

`world.geometryLookAheadU` musí být konečné číslo nejméně 2048 u. Validace odmítne i `Infinity`, aby generování předstihu při startu nebo obnově cesty nemohlo běžet donekonečna (R9). Výchozí hodnota 2048 u ani uložená data se nemění. Předstih se zvětší, pokud širší viewport nebo vícedílná scénka vyžaduje více geometrie. `logicalActivationAheadU` je naopak základ deterministických spouštěčů scén a nesmí náhodně záviset na výkonnosti rendereru. Renderovat daleko viditelné statické objekty lze bez předčasného spuštění jejich scénky.

`spawnLocalXU` se při startu převádí na `arcOffsetU` pomocí LUT; tyto hodnoty nejsou zaměnitelné.

`generatorVersion: 2` patří aktuálnímu generátoru podle dokumentu 04 a D-023; dříve vydaná verze 1 je historicky popsána v D-009. Průběžná verze 0.1 používá dočasný generátor 0 se stejnými hranicemi a profily, ale bez biomů a rezervací ([D-005](../docs/decisions/005-provisional-track-generator-v0.md)). Geometrické parametry `world.*` jsou vstupem generátoru; jejich změna vyžaduje novou verzi generátoru, nikoli jen úpravu konfigurace. Všechny další konstanty s příponou U se vztahují ke světu, `CssPx` ke skutečné dotykové ploše a atlasové `Px` k souboru textury.

Počasí má při prvním okně nové cesty vždy jasno. Další okna se vybírají samostatným seedovým klíčem; zbývající pravděpodobnost po jasnu je lehká srážka vhodná pro daný biom. Denní fáze je `(initialDayPhase + simulationSeconds/dayCycleSeconds) mod 1`.

Cílové FPS je limit nebo preference renderu, nikoli fyzikální frekvence. Není povoleno měnit `fixedHz` při přechodu na úsporný režim. Omezení částic se vztahuje na dekoraci; funkční aktéři a závory se neztrácejí kvůli stejnému čítači.

Výše uvedený JSON není hotový konfigurační soubor běžící aplikace. Implementátor jej převede do typed konfigurace, přidá validaci rozsahů a odvozené hodnoty nebude duplikovat ručně na více místech.

Pro měření lze profil při načtení přepsat adresou `?quality=auto|standard|low`. Jiná hodnota se ignoruje. Volba platí jen pro toto načtení a nemění uložené `settings.quality`; bez parametru se použije uložená kvalita. Stejný efektivní profil řídí DPR, limit FPS i efekty. Diagnostika `window.__vlacek.snapshot().renderProfile` při `?debug=1` uvádí efektivní `quality`, `maxDpr`, `fpsLimit` (0 = bez limitu) a `effects`.

Uložené `settings.quality` a `settings.reducedEffects` lze nastavit skrytou rodičovskou brankou v pauze ([D-020](../docs/decisions/020-developer-menu.md)). Platná adresa má před uloženou kvalitou přednost; neplatný parametr se ignoruje. Menu změny použije přes reload, takže renderer i profil startují se stejnými efektivními volbami.

## Svět v2 — hodnoty D-023

- Geometrický blok: 8 × 1 024 u; region: 3–7 bloků; cyklus: 12 regionů / 60 bloků. Staré `blocksPerRouteCycle: 8` je historická konfigurace v1, v2 plán regionů ji nepoužívá.
- Scénka: 2 048 u; prostorový přechod: posledních 8 192 u regionu.
- První rovina bloku 0: do x = 2 144 u, včetně 96u ramene; stanice slot 1 s minimálně 448 u použitelné roviny, přejezd slot 3 před zvířetem.
- Výrazné rybníky: plánový odstup 4 096 u; mlýny: nejvýše jeden za region / nejméně 8 192 u; maják: nejvýše jedna přístavní příležitost.
- Plot: 512 u cesty, rozteč sloupků 64 u po délce cesty, dřevěné/piketové díly 8 × 26 / 64 × 22 / 48 × 26 u.
- Stopy a podporované presety jsou normativní v `PlacementCatalog` a `ALLOWED_PRESETS`; nejvýše osm pokusů. Rozpočty 80 rekvizit / 48 blízkých rekvizit na chunk zůstávají.
- Cache: 8 cyklů, 256 scén, 128 geometrických bloků a přejezdů, 32 projekčních profilů, 64 celých plotů a 256 dvojic nedávných fasád na numerický katalog (WeakMap, žádná historie kamery).
- `volta run npm run validate:world`: pevná matice včetně auditů, záporných/vzdálených pozic a regionových hranic; samostatně 20 000 seedů pro první blok.

Verze generátoru 2 mění svět a obnovuje cesty v0/v1 od startu se zachovaným vlakem a seedem. Schéma a katalog zůstávají na 1. Nové plánování má explicitní RNG jmenné prostory, nezměněné algoritmy zachovávají sůl 1. Sezónní vzhled/počasí doplní seasons-life; fyzické zařízení a Tesla NEOVĚŘENO.

Kontaktní stopa má tloušťku 0,5 u; kmen zabírá 18 % šířky stromového assetu, koruna má celý obrys včetně maximálního kývání. Zadní projekční rovina má 220 u, blízká louka 440 u, pevné odsazení paty 8 u. Moře má nominální hloubky 0,70–0,98 a břeh sleduje společný 8 192u přechod. Relativní hustota pro přechod je 1,3 v lese, 0,7 v dunách a 1 jinde; nejde o naměřený výkonový slib.

### Krajinné profily a diagnostika — krok 2

`world.landscapeProfiles` vlastní následující obálky; roviny a svahy jsou délky přímého plánu před 192u přechody.

| Krajina     | Max výška ±u | Vnitřní uzel ±u | Rozsah sklonu | Roviny u  | Náhodné svahy u |
| ----------- | ------------ | --------------- | ------------- | --------- | --------------- |
| countryside | 100          | 50              | 0,015–0,035   | 768–1536  | 1024–2304       |
| forest      | 160          | 80              | 0,025–0,06    | 512–1280  | 1024–2560       |
| lakes       | 60           | 30              | 0,01–0,025    | 1024–1792 | 1024–2560       |
| foothills   | 260          | 180             | 0,04–0,09     | 512–1024  | 1024–3072       |
| mountains   | 380          | 320             | 0,08–0,10     | 768–960   | 1536–3072       |
| coast       | 60           | 30              | 0,01–0,025    | 1024–1792 | 1024–2560       |
| dunes       | 100          | 50              | 0,015–0,04    | 768–1536  | 1024–2560       |
| town        | 120          | 60              | 0,01–0,03     | 1024–1792 | 1024–2560       |

Konečný svah může být delší, aby blok přesně dosáhl dalšího uzlu; zůstává pod krajinným maximem. Globální strop výšky je 400 u, `world.maxTrackGrade` 0,12 a `world.pantographMaxTrackGrade` 0,12 pro rovina ↔ svah a `world.pantographMaxReversingGrade` 0,098 pro přímý obrat přes 192 u. Kontrola ověřuje konečnost, pořadí rozsahů a místo pro dosažení sousedního uzlu. Parametry původního společného profilu jsou geometrický základ, tabulka je ve v2 přepisuje; nejde o změnu vydaného v1.

Vzorek barvy země/spodní výplně: 16 u. Přední pole má hloubky 0,18–0,62, traktor 0,35–0,40 a patrolu 180 u při 26 u/s. Lesní práce mají podklad 0,15–0,90, klády 0,32–0,60 a mladé smrčky 0,25–0,70. Tyto hloubky jsou podmíněné úplnou bezpečnou stopou, nejsou povolením zasáhnout vlak. Suchý zadní vodní okraj má hloubku alespoň 0,12.

Build branka: alespoň 44 CSS px, stále pět aktivací během 3000 ms. Lokátor: nejvýše 1920 chunků, start 640 u před cílem přes LUT. Překryvy mají jediný objekt a nejsou v save. Stopa se vytváří pouze na žádost, vstup se validuje před generováním. Scan silnic/vody: 100 celých itinerářů vedle hlavní deterministické matice a 20000 prvních bloků R3.
