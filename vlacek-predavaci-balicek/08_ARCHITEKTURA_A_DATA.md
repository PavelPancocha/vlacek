# 08 — Architektura, data a ukládání

[Zpět na rozcestník](../README.md)

## 1. Technologická volba

Výchozí stack je **TypeScript ve strict režimu, Phaser 4.2.1, Vite, Vitest a Playwright**, bez frontendového aplikačního frameworku. Phaser 4.2.1 byl v ověřeném přehledu vydání k 9. říjnu 2026 uveden jako nejnovější vydání; přesné verze všech skutečně instalovaných závislostí se uzamknou lockfilem. Technická fakta a primární zdroje S01/S02/S11/S12/S13 jsou v dokumentu 12.

Phaser poskytne vykreslování 2D světa a práci s assety. DOM/CSS pokryjí menu, katalog soupravy, rodičovský panel a velká HUD tlačítka. Nemíchat dva nezávislé systémy vlastnictví vstupů. Herní matematika, generátor a automaty nesmějí záviset na Phaseru ani browser API.

Nezavádět Django, databázový server, React, Redux, síťový websocket, ECS framework ani fyzikální engine bez konkrétního nového požadavku. Nejde o to předem abstrahovat všechno, ale mít malé testovatelné moduly a jednoduchý tok dat.

## 2. Navržená struktura skutečného projektu

```text
src/
  main.ts
  app/
    AppController.ts
    AppState.ts
  domain/
    input/InputReducer.ts
    train/TrainMotion.ts
    train/TrainGeometry.ts
    world/Hash.ts
    world/TrackProfile.ts
    world/ArcLengthTable.ts
    world/WorldGenerator.ts
    world/WorldWindow.ts
    world/EnvironmentClock.ts
    scenes/CrossingController.ts
    scenes/StationController.ts
    scenes/ActorController.ts
    scenes/InteractionController.ts
    types.ts
  content/
    locomotives.ts
    wagons.ts
    biomes.ts
    templates.ts
    catalogValidation.ts
  render/
    GameHost.ts
    RideScene.ts
    TrainRenderer.ts
    WorldRenderer.ts
    CameraController.ts
    QualityController.ts
  platform/
    InputRouter.ts
    AudioManager.ts
    SaveRepository.ts
    SaveValidation.ts
    CapabilityProbe.ts
    ServiceWorkerRegistration.ts
  ui/
    HomeView.ts
    TrainBuilderView.ts
    RideHud.ts
    PauseView.ts
    ParentSettingsView.ts
  config/gameConfig.ts
  styles/
public/
  manifest.webmanifest
  icons/
  assets/
scripts/
  build-sw.mjs
  validate-assets.mjs
  report-budgets.mjs
tests/
  unit/
  integration/
  e2e/
  fixtures/
docs/
  spec/
  decisions/
  device-tests/
```

Toto je navržené členění, nikoli povinnost vytvořit prázdnou třídu pro každý řádek ještě před první jízdou. Související malé funkce lze zpočátku držet v jednom souboru. Zachovat však oddělení domény, renderu, UI a platformních efektů.

## 3. Tok jednoho simulačního kroku

1. InputRouter předá normalizovaný snapshot dotyků reduceru.
2. Reducer vrátí `THROTTLE`, `COAST` nebo `BRAKE`; pauza se řeší nad smyčkou.
3. TrainMotion vypočte novou rychlost a polohu hlavy.
4. WorldWindow doplní geometrii v předstihu, přepočítá držené reference a připraví potřebné chunky.
5. Automaty přejezdů a aktérů vyhodnotí obsazení a přiblížení, včetně intervalu minulá–nová poloha.
6. Interakce, stanice a simulační čas se posunou o jeden fixní tick.
7. Renderer přečte stav; AudioManager zpracuje omezené události. Nikdo z nich neposouvá doménový čas.
8. SaveRepository dostane snapshot pouze při naplánovaném checkpointu, ne při každém snímku.

Před první aktualizací jízdy musí být svět připraven. Průběžné generování nesmí dovolit, aby vlak na jeden tick předjel konec existující geometrie. Přejezdová predikce se kontroluje před povolením pohybu silničních aktérů v daném kroku; pořadí update nesmí vytvořit kolizi o jeden frame.

Stačí jednoduché typované události jako `ObjectActivated`, `PlayerHorn`, `NpcHorn`, `EnteredTunnel`, `SaveRequested`. Nezavádět globální neuspořádaný event bus, v němž pořadí listenerů rozhoduje o pohybu.

## 4. Základní datové kontrakty

Níže uvedené typy jsou normativní jádro, které lze rozšířit o konkrétní assetové vrstvy. Všechny hodnoty z JSON a úložiště se musí validovat za běhu; TypeScript sám vstupní data neověřuje.

```ts
export type Power = 'steam' | 'diesel' | 'electric' | 'fantasy';
export type BiomeId =
  'countryside' | 'forest' | 'lakes' | 'foothills' | 'mountains' | 'coast';
export type MotionIntent = 'THROTTLE' | 'COAST' | 'BRAKE';
export type EffectId =
  'none' | 'steam' | 'diesel' | 'stars' | 'bubbles' | 'rainbow';
export type WagonGroup = 'passenger' | 'cargo' | 'service' | 'fun';

export interface VehicleBase {
  id: string;
  labelCs: string;
  lengthU: number; // > 0, nejvýše 220
  bogieOffsetU: number; // oba symetrické opěrné body, < lengthU/2
  wheelRadiusU: number; // kladné
  bodyAsset: string;
  previewAsset: string;
  interactionId?: string;
}
export interface LocomotiveDefinition extends VehicleBase {
  kind: 'locomotive';
  power: Power;
  requiresCatenary: boolean; // musí přesně odpovídat power === 'electric'
  hornAudio: string;
  effect: EffectId;
}
export interface WagonDefinition extends VehicleBase {
  kind: 'wagon';
  group: WagonGroup;
}
export interface WagonInstance {
  instanceId: string; // unikátní v sestavě, pořadí není identita
  definitionId: string;
  visualSeed: number;
}
export interface Consist {
  locomotiveId: string;
  wagons: WagonInstance[]; // 0 až 100, duplicity definitionId povolené
}
export interface TrackCursor {
  chunkIndex: number; // bezpečné celé číslo, může být záporné
  arcOffsetU: number; // [0, délka konkrétního chunku)
}
export interface TrackSample {
  x: number;
  y: number;
  grade: number; // dy/dx
}
export interface TrackProfile {
  kind: 'smooth' | 'hill' | 'dip' | 'flat-middle';
  startHeightU: number;
  endHeightU: number;
  middleHeightU?: number;
}
export interface EntityDescriptor {
  id: string;
  templateId: string;
  localX: number;
  localY: number;
  layer: number;
  visualSeed: number;
  interactionId?: string;
}
export interface FeatureReservation {
  featureId: string;
  kind: 'station' | 'crossing' | 'bridge' | 'tunnel' | 'secondary-rail';
  ownerChunkIndex: number;
  firstChunkIndex: number;
  lastChunkIndex: number;
  templateId: string;
}
export interface ChunkDescriptor {
  id: number;
  generatorVersion: number;
  biome: BiomeId;
  nextBiome?: BiomeId;
  profile: TrackProfile;
  reservations: FeatureReservation[];
  entities: EntityDescriptor[];
}
```

Profily a chunky neobsahují instance Phaser objektů. Specifická data přejezdu, nástupiště a cest aktérů jsou v typed template registru podle `templateId`. Rozsahy rezervací slouží pro konfliktové testy i odstraňování.

## 5. Runtime komponenty scén

Pro známé komponenty ukládat diskriminovanou unii, nikoli nekontrolovaný `Record<string, any>`.

```ts
export type CrossingPhase =
  'OPEN' | 'CLEARING' | 'WARNING' | 'CLOSING' | 'CLOSED' | 'OPENING';
export type EntitySnapshot =
  | {
      kind: 'interaction';
      id: string;
      phase: 'idle' | 'playing' | 'cooldown' | 'consumed';
      remainingTicks: number;
      variantIndex: number;
    }
  | {
      kind: 'station';
      id: string;
      phase: 'idle' | 'wave' | 'stop' | 'cooldown';
      remainingTicks: number;
      stoppedTicks: number;
    }
  | {
      kind: 'crossing';
      id: string;
      phase: CrossingPhase;
      phaseTicks: number;
      roadQueueIds: string[];
    }
  | {
      kind: 'actor';
      id: string;
      pathId: string;
      progressU: number;
      direction: 1 | -1;
      phase: 'moving' | 'waiting' | 'reacting';
      remainingTicks: number;
    }
  | {
      kind: 'npc-train';
      id: string;
      featureId: string;
      consist: Consist;
      cursor: TrackCursor;
      direction: -1;
      speedUPerSec: number;
      hornCooldownTicks: number;
    };
```

Přesná cesta auta nebo zvířete je v deterministickém template registru. Snapshot ukládá jen jeho posun a stav. U NPC vlaku se validate počet vagonků omezuje na pět; u hráče na sto. `remainingTicks` je nezáporné číslo relativně k obnově, nikoli skutečný čas v kalendáři.

Při načtení nejsou platné žádné rezervace na neexistující entity. Záznam pro objekt, který už není v aktuálním rozsahu generátoru, zahodit. Přejezdy se před zobrazením navíc bezpečnostně rekoncilují s reálnou polohou souprav.

## 6. Save formát a místní úložiště

Výchozí úložiště V1 je **malý verzovaný JSON v localStorage**, ne backend a ne přenos textur do save. Pro tento rozsah stačí jedna rozehraná cesta a omezené aktivní stavy. Pokud implementace prokáže potřebu větších transakcí, lze SaveRepository nahradit IndexedDB bez změny domény; není to předem povinná komplikace.

```ts
export interface Settings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  reducedEffects: boolean;
  maxSpeedFactor: 0.65 | 1;
  quality: 'auto' | 'low' | 'standard';
}
export interface JourneySave {
  seed: number;
  generatorVersion: number;
  consist: Consist;
  head: TrackCursor;
  simulationTick: number;
  activeEntities: EntitySnapshot[];
}
export interface SaveEnvelopeV1 {
  schemaVersion: 1;
  contentVersion: 1;
  savedAtIso: string;
  appBuildId: string;
  settings: Settings;
  lastConsist: Consist;
  builderDraft?: Consist;
  journey?: JourneySave;
}
```

Rychlost, aktivní prsty, audio kontexy, bitmapy, cache a celý historický svět se **neukládají**. Po obnově je vlak zastavený. Den a počasí se obnoví ze simulačního ticku, seedu a pravidel jejich generátoru. `savedAtIso` je pouze diagnostický údaj; neurčuje ujetou vzdálenost po přestávce.

### Kdy ukládat

Každých pět sekund aktivní hry, při pauze, odchodu do menu, změně soupravy či nastavení a při `visibilitychange` do skrytého stavu. U editací seskupit rychlé změny do jednoho zápisu přibližně po 250 ms. Spoléhat pouze na `beforeunload` není přijatelné; aplikace může být ukončena bez něho.

Dočasný rodičovský průchod do depa uloží původní journey a samostatný draft. Nové „Vyjet“ nahradí journey až po validaci sestavy a vytvoření počátečního světa. Když start nové cesty selže, původní save má zůstat obnovitelný.

### Zápis a obnova

Klíče `vlacek.save.v1` a `vlacek.save.backup.v1`. Před přepsáním primáru ponechat poslední validní primár jako zálohu. Každý jednotlivý zápis obalit `try/catch`; celou dvojici neprezentovat jako atomickou databázovou transakci. Při chybě primáru načíst validní zálohu. Poškozený JSON nesmí shodit boot.

Před `setItem` validovat serializovatelný snapshot. Cílit do 128 KiB, tvrdý aplikační limit 512 KiB. Uchovávat jen aktivní či stále relevantní záznamy, nejvýše 512 komponent; dekorativní částice nikdy. Pokud by rozpočet nestačil, nejprve zahodit nepodstatné kosmetické stavy, ne polohu vlaku a sestavu. Bezpečnostní stav přejezdů lze rekonstruovat.

Nedostupnost localStorage nebo překročení kvóty přepne ukládání do paměti a zobrazí rodiči informaci „Na tomto zařízení se teď nepodařilo uložit pokračování“. Hra zůstane hratelná. Data browser může později odstranit; žádné sliby o trvalé záloze. Viz S08 v dokumentu 12.

## 7. Validace a migrace

Validovat seed a indexy, existenci typů vozidel, limit vagonků, délky řetězců, bezpečné celé tick hodnoty a konečnost všech čísel. `NaN`, `Infinity`, záporné délky, gigantické pole ani vložené HTML se nesmějí dostat do runtime. Texty z diagnostiky vkládat přes textContent, ne jako HTML.

Při známé starší `schemaVersion` provést explicitní čistou migraci a otestovat ji. Vyšší neznámou verzi nezkoušet naslepo načíst a nepřepsat její data; nabídnout novou dočasnou hru s rodičovským upozorněním.

`generatorVersion` mění geometrii. V rámci V1 jej držet na 1. Při budoucí nekompatibilní změně buď zachovat starý generátor pro rozehranou cestu, nebo zachovat soupravu a po jasném upozornění začít novou cestu. Nikdy neregenerovat jiný most pod starou soupravou potichu.

Změna `contentVersion` má mapování přejmenovaných ID. Chybějící vagón se bez upozornění nezahodí; zachovat zálohu, nabídnout obnovu sestavy s dostupnou náhradou. V produkční V1 se však všechny katalogové ID zavazují jako stabilní.

## 8. Životní cyklus a chyby

AppController vlastní přechody aplikace, pauzu a jediný simulační loop. Platformní adaptér hlídá viditelnost, resize a audio. RideScene nemá sama od sebe rozjíždět svět při každém `resume` od Phaseru.

Při ztrátě WebGL kontextu zastavit simulaci, vymazat vstupy, uložit malý snapshot a zobrazit klidnou obnovovací vrstvu. Po úspěšné obnově znovu vytvořit render z doménového stavu a čekat na potvrzení. Při opakovaném selhání nabídnout úsporné/Canvas spuštění, pokud projde capability testem. Neukazovat dítěti stack trace.

Neplatný jednotlivý dekorativní asset může mít řízený fallback. Neplatná kolej nebo chybějící lokomotiva je blokující chyba daného buildu: nabídnout návrat, ne pokračovat s náhodně rozbitým světem. Síťový výpadek nesmí změnit fyziku ani vyvolat přepnutí do reklamy či externí stránky.

## 9. Výkon bez zbytečné architektury

Vykreslovat pouze relevantní výřez, používat atlasy a omezené počty částic. Předpočítat LUT a prefixové délky vozidel při sestavení soupravy. Nepočítat délku celé soupravy přes DOM nebo bounding boxy v každém frame.

Žádné synchronní síťové požadavky v herním loopu. Žádná serializace celé hry každý tick. Podle potřeby lze mutovat malý interní doménový stav; není nutné kopírovat tisíce objektů do immutable stromu 60× za sekundu. Testovatelnost znamená jasné vstupy a výstupy, nikoli povinný konkrétní programovací styl.

Auto kvalita začíná konzervativně. Při dlouhodobém zpomalení omezí dekorativní částice, hustotu pozadí a rozlišení. Nepřestane vyhodnocovat brzdění, neotevře závory a nesníží počet připojených vagonků. Profil je měřitelná konfigurace, ne permanentní podmínka podle názvu user-agentu.

## 10. Reprodukovatelnost vývoje

Použít Node 24.x jako výchozí vývojovou řadu a ověřit skutečné požadavky zvolených verzí nástrojů; přesný patch zaznamenat do `.nvmrc` či ekvivalentu. Lockfile je součást repozitáře. Produkce servíruje statické soubory a Node server pro hru nepotřebuje.

Povinné skripty skutečné implementace: `dev`, `typecheck`, `lint`, `test`, `test:e2e`, `build`, `preview`, `validate:assets`, `report:budgets`. V běžném předání se používá `npm ci`, nikoli pokaždé aktualizace na nejnovější verze.

Tento dokument definuje kontrakty a strukturu. Neobsahuje tvrzení, že zmíněné soubory již existují nebo že byl spuštěn build hry.
