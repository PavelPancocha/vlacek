# 13 — Výchozí konfigurace a jednotky

[Zpět na rozcestník](../README.md)

Tento soubor vlastní výchozí číselné parametry. Hodnoty jsou **návrh k implementaci a ověření**, ne empiricky prokázané optimum pro konkrétní dítě nebo zařízení. Po ladění se mají změnit zde, v kódu a v souvisejících testech společně.

```json
{
  "specVersion": "1.0",
  "generatorVersion": 1,
  "contentVersion": 1,
  "simulation": {
    "fixedHz": 60,
    "maxCatchUpSteps": 5,
    "pauseOnHidden": true,
    "resumeSpeedUPerSec": 0
  },
  "train": {
    "maxConsistLengthU": 1600,
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
    "arcSampleSpacingU": 8,
    "geometryLookAheadU": 2048,
    "geometryTailMarginU": 1024,
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
    "catenaryContactHeightU": 160
  },
  "camera": {
    "trainWidthFraction": 0.72,
    "rearMarginFraction": 0.06,
    "minFrontFraction": 0.35,
    "bandAnchor": 0.55,
    "verticalFollowPerSec": 3,
    "manualPanDuringRide": false
  },
  "crossing": {
    "roadClearanceSeconds": 2.0,
    "warningSeconds": 1.2,
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

`Dclose` není druhá nezávislá konstanta. Počítá se podle dokumentu 05 z rychlostního limitu a přejezdových časů. Při standardním limitu vychází 890 u. Každý relevantní konflikt má ještě vlastní fyzickou šířku; vzdálenost se měří od čela vlaku k bližšímu okraji rozšířené konfliktní zóny, ne k libovolnému středu budovy.

`geometryLookAheadU` je minimum. Zvětší se, pokud širší viewport nebo vícedílná scénka vyžaduje více geometrie. `logicalActivationAheadU` je naopak základ deterministických spouštěčů scén a nesmí náhodně záviset na výkonnosti rendereru. Renderovat daleko viditelné statické objekty lze bez předčasného spuštění jejich scénky.

`spawnLocalXU` se při startu převádí na `arcOffsetU` pomocí LUT; tyto hodnoty nejsou zaměnitelné.

`generatorVersion: 1` patří generátoru V1 podle dokumentu 04. Průběžná verze 0.1 používá dočasný generátor 0 se stejnými hranicemi a profily, ale bez biomů a rezervací ([D-005](../docs/decisions/005-provisional-track-generator-v0.md)). Geometrické parametry `world.*` jsou vstupem generátoru; jejich změna vyžaduje novou verzi generátoru, nikoli jen úpravu konfigurace. Všechny další konstanty s příponou U se vztahují ke světu, `CssPx` ke skutečné dotykové ploše a atlasové `Px` k souboru textury.

Počasí má při prvním okně nové cesty vždy jasno. Další okna se vybírají samostatným seedovým klíčem; zbývající pravděpodobnost po jasnu je lehká srážka vhodná pro daný biom. Denní fáze je `(initialDayPhase + simulationSeconds/dayCycleSeconds) mod 1`.

Cílové FPS je limit nebo preference renderu, nikoli fyzikální frekvence. Není povoleno měnit `fixedHz` při přechodu na úsporný režim. Omezení částic se vztahuje na dekoraci; funkční aktéři a závory se neztrácejí kvůli stejnému čítači.

Výše uvedený JSON není hotový konfigurační soubor běžící aplikace. Implementátor jej převede do typed konfigurace, přidá validaci rozsahů a odvozené hodnoty nebude duplikovat ručně na více místech.
