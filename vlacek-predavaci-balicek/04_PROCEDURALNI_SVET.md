# 04 — Procedurální svět a jeho životní cyklus

[Zpět na rozcestník](../README.md)

## 1. Cíl generátoru

Generátor vytváří nekonečnou **souvislou trať**, ne náhodné samostatné obrazovky. Kvalitní ručně připravené motivy a pravidla se skládají do nových kombinací. Kolej, terén, biomy, stavby, cesty a dekorace vznikají odděleně, aby přidání jedné květiny nezměnilo všechny následující mosty.

Čistá funkce `generateChunk(seed, generatorVersion, chunkIndex)` vrací datový popis chunku. Nekreslí, nepřehrává zvuk, nečte čas a nemění uloženou hru. Elektrifikace se doplní deterministickým infrastrukturním dekorátorem podle typu lokomotivy; nesmí přeseedovat svět.

Layout je stejný při 30 i 60 FPS, online i offline a při libovolném pořadí generování. Průběh animací může záviset na době návštěvy a vstupech; layout nikoli.

## 2. Souřadnice a velikost chunku

Chunk má šířku 1 024 u v ose x a identitu `chunkIndex`, včetně záporných celých hodnot. Levý okraj je `chunkIndex * 1024`; uvnitř se používá `localX ∈ [0,1024]`. Hraniční bod patří logicky pravému chunku, kromě potřeby vzorkovat společný konec předchozího profilu.

Výška hranic a jejich sklony se musí shodovat bez znalosti pořadí generování. Délka po oblouku je samostatná veličina; není přesně 1 024 u, pokud kolej stoupá nebo klesá. Přechod hráče mezi chunky vyhodnocovat podle LUT délky, nikoli pomocí `floor(s / 1024)`.

## 3. Seed a stabilní náhodnost

Seed nové cesty je nezáporné 32bitové číslo. Při startu jej lze získat přes `crypto.getRandomValues`; v nepodporovaném prostředí je přípustný nekryptografický lokální fallback. Seed zde chrání reprodukovatelnost, ne bezpečnost.

Uvnitř generátoru žádné `Math.random()`. Použít vlastní stabilní 32bitový hash a oddělené jmenné klíče. Referenční algoritmus:

```ts
export function hash32(...parts: readonly (string | number)[]): number {
  const text = JSON.stringify(parts);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
export function unitRandom(...parts: readonly (string | number)[]): number {
  return hash32(...parts) / 4294967296;
}
```

Příklady klíčů: `terrain-boundary`, `route-template`, `major-feature`, `tree-position`, `animal-species`, `npc-train`, `cloud-shape`. Číselné indexy validovat jako bezpečná celá čísla. Kompatibilita a RNG jsou oddělené: nezměněné algoritmy drží sůl 1, nové regiony/scénky/umístění mají explicitní jmenné prostory `regions-v2:*`, `scenes-v2:*`, `placement-v2` a `fences-v2`. Změna vydané geometrie či umístění stále vyžaduje rozhodnutí kompatibility ([D-023](../docs/decisions/023-world-generator-v2.md)).

ID entity má podobu `g2:chunk:42:prop:rule:3:candidate:1`; není to náhodné UUID při každém vykreslení. Kosmetické částice mohou mít vlastní omezený generátor a neovlivňují layout ani save.

Částicové efekty mají vlastní 32bitový generátor, seedovaný jednou při změně
instance jízdy z čísla cesty, klíče `effects` a počátečního ticku nové nebo
obnovené jízdy, před resetem okolního života. Další emise posouvají jeho stav
bez nového hashování během snímků. Stejná posloupnost snímků,
profilu kvality a vstupů od stejného počátečního stavu opakuje i částice;
nejde o shodu částic při různých FPS ani o ukládání kosmetického stavu.
Podrobnosti a obrazové regrese vlastní [D-027](../docs/decisions/027-seasons-and-life.md).

## 4. Kontinuita kolejí: profil generátoru v2

Zadání [14 §6](14_UPRAVY_PRVNI_VERZE.md) mění charakter tratě: roviny a delší rovná stoupání a klesání spojená krátkými plynulými přechody, bez souvislého vlnění. Původní konstrukce tohoto oddílu (hraniční výšky `H(k)` v ±32 u a smootherstep přechody s nulovým sklonem na každé hranici chunku) zůstává jen jako generátor v0 verze 0.1. Měření ukázalo, že v ní se sklon mění na 91–95 % délky ([D-009](../docs/decisions/009-track-generator-v1.md)).

Generátor v1 (`src/domain/world/TrackProfile.ts`, parametry `world.profile` v dokumentu 13):

- **Bloky.** Trať se plánuje po blocích `blockChunks` (8) chunků. Každý blok začíná a končí rovinou ve výšce hranice bloku, kterou určuje klíč `block-height`; výška leží v intervalu ±`blockHeightRangeU` (160 u). Chunk se tak počítá jen ze svého bloku, nezávisle na pořadí a i daleko od startu.
- **Plán bloku.** Lomená čára rovina → sklon → rovina → … → rovina. Roviny mají `flatMinU`–`flatMaxU` (384–1536 u), sklony `slopeMinU`–`slopeMaxU` (768–2304 u) v násobcích `lengthStepU` (64 u). Sklon se volí mezi `gradeRangeMin` a `gradeRangeMax` (0.03–0.08), směr nahoru nebo dolů podle seedu (klíče `flat`, `slope`, `grade`, `direction`). Výška nikdy nepřekročí ±`maxHeightU` (400 u): sklon, který by ji překročil, se otočí.
- **Proveditelnost bez losování naslepo.** Náhodný sklon se přijme jen tehdy, když zbytek bloku ještě pojme rovinu a jediný závěrečný sklon na výšku další hranice při `gradeRangeMax`. Jinak plán skončí závěrečným sklonem a minimální rovinou. Validace konfigurace ověřuje, že blok vždy pojme nejdelší počáteční rovinu a nejdelší závěrečný sklon.
- **Přechody.** Každý zlom lomené čáry nahrazuje parabola (výškový oblouk) délky `transitionU` (192 u). Sklon se v ní mění lineárně, takže výška i sklon jsou spojité a nevzniká ostrý zlom. Každý úsek plánu je alespoň tak dlouhý jako přechod, takže se oblouky nepřekrývají.

Výška a sklon jsou spojité na každém švu chunku i bloku. Sklon nikdy nepřekročí `gradeRangeMax`, a tedy ani absolutní mez `world.maxTrackGrade` (0.12), se kterou počítá model pohybu. Změna kteréhokoli parametru `world.profile` mění geometrii a vyžaduje nové `generatorVersion`.

Nádraží a přejezdy (M2) se umístí na existující roviny plánu, mosty a tunely na terén kolem tratě, který může být členitější než kolejové těleso. V2 před volnými sklony vyhradí prvnímu bloku počáteční rovinu do x = 2 144 u; ve slotu 1 tak zůstane minimálně 448 u použitelné roviny i po přechodových ramenech. Ostatní bloky zachovávají konstrukci v1 i její RNG sůl. Viz [D-023](../docs/decisions/023-world-generator-v2.md).

Terén kolem tratě je samostatná seedovaná funkce, ne součást profilu koleje ([D-012](../docs/decisions/012-track-tiles-and-terrain.md)). `embankmentU(seed, x)` určuje výšku kolejového tělesa nad loukou v popředí: hodnotový šum s uzly po `world.terrain.latticeU` do `world.terrain.maxEmbankmentU`, spojitý se spojitým sklonem a počítaný jen z x. Klíč obsahuje verzi generátoru.

## 5. Regiony, scénky a návaznost krajiny

Generátor **v2** odděluje geometrické bloky od regionů. Blok zůstává osm chunků, region má 3–7 celých bloků, tedy 24 576–57 344 u (asi 102–239 s při 240 u/s). Zastavení nepřepne krajinu. Pevný cyklus má 12 regionů a 60 bloků; seed řadí multiset délek `[3,4,4,4,4,5,5,5,6,6,7,7]`. Dvě explicitní trasy a tabulka sousedností kontrolují i spoj cyklů; záporné a vzdálené pozice mají omezený náhodný přístup bez generování minulosti.

Krajiny: `countryside`, `forest`, `lakes`, `foothills`, `mountains`, `coast`, **`dunes`**, **`town`**. Duny inspirované Moravskou Saharou mají písek, borovice, dunovou trávu a kameny. Pobřeží zůstává samostatné. `town` dočasně používá vesnické skladby; odstranění omezení: **replaced by the settlements-stations lane in the same PR**.

`RegionPlan` nese sezónu a počasí z explicitní tabulky podporovaných presetů. Sezóna i počasí drží skupiny 2–3 regionů; vybírá se společný podporovaný preset všech jejich krajin, i přes šev cyklu. Nová cesta má letní jasno. Existující sněhové šablony patří pouze k zimě. Sezónní kresbu a ambientní projevy doplňuje [D-027](../docs/decisions/027-seasons-and-life.md): efektivní klima a jeho váhy jsou čistý dotaz podle x, animace používají herní sekundy.

`WorldPlan` skládá uspořádané 2 048u scénky z explicitně importovaných modulů `src/domain/world/scenes/`. Infrastrukturní rezervace mají přednost. `contextAt(seed, worldXU)` určuje konkrétní podzónu, povrch a klima; přípustnost celého obrysu i patrolovacího rozsahu se kontroluje v jednotlivých místech, včetně hranic.

Přední pole a lesní půda mají oblé nepravidelné zakončení s travnatým lemem. Brázdy nepokračují do souvrati a sousední plochy se nedotýkají hroty. Podpora a celý pohybový obal používají stejný světový obrys.

`PlacementCatalog` je validovaný numerický adaptér rozměrů/pivotů `worldArt` předaný doméně. Sdílený `SceneryGeometry` vlastní projekci, stopy, vodní obrysy a vesnické cesty včetně zatáček; renderer nevytváří druhou silnici. `Reservations` chrání kolej a průjezdný prostor, silnice, řeky, kopce portálů, nástupiště a podpěry vedení. Záměrné překryvy mají pojmenovaný vztah ke konkrétnímu prvku.

Nejdřív se filtrují přípustné druhy a podpory, potom se losuje. Osm pokusů je konečná mez. Dům potřebuje cestu, loď vodu i pod celou svojí dráhou, mlýn tekoucí náhon a kachna přední rybníček. Neplatné dítě nevznikne. Moře je jedna souvislá regionová plocha s otevřenými řezy chunků, včetně stanic; na pláži nejsou samostatné vnitrozemské rybníčky.

Prominentní rybníky mají plánový odstup 4 096 u, mlýn jedinou příležitost za region a odstup nejméně 8 192 u, maják jedinou přístavní příležitost. Paměť fasád a motivů se rekonstruuje z plánu, nikoli z historie kamery. Plot je celá 512u cesta se sloupky po 64 u délky, skutečnými konci a případnou brankou; fragment nevytváří falešný konec ani duplicitní sloupek.

Posledních 8 192 u regionu nese společný postup přechodu podle světového x. Používají jej far/mid/výplň Backdropu, palety země a hustota vegetace. Břeh příchozího moře se otevírá už v přechodovém bloku předchozího regionu a zužuje se při odchodu; nevzniká uzavřená nádrž. Od poloviny přechodu používá admissibility incoming povrch; rybníček ani květiny nesmějí zasáhnout písek/sníh. Pevné budovy mají plnou neprůhlednost, při stání se postup nemění. Nová cesta resetuje pozadí (R10). Kontrakty, identity a omezení jsou v [D-023](../docs/decisions/023-world-generator-v2.md).

## 6. Rozvržení výrazných motivů

Generovat v pořadí: **biome → profil → rezervace velkých objektů → komunikace → vegetace → zvířata → drobné interakce**.

Výchozí blok osmi chunků:

| Slot     | Obsah                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| 0        | Klidná krajina a navázání předchozího bloku.                                     |
| 1 nebo 2 | Jedna stanice; druhý slot je volná krajina.                                      |
| 3        | Jeden přejezd s bezpečnou silniční cestou.                                       |
| 4–6      | Buď tříchunkový souběh kolejí, nebo kombinace mostu, krajiny a tunelu dle biomu. |
| 7        | Přechod do příštího biomu, bez nového dominantního objektu.                      |

V prvním bloku nové cesty jsou pro rychlé předvedení pevně stanice ve slotu 1, přejezd ve slotu 3, most ve slotu 4 a krátký tunel ve slotu 6. V následujícím bloku je ve slotech 4–6 zaručený souběh kolejí. V ostatních blocích se pro tuto rezervaci použije pravděpodobnost 1/3 z klíče `secondary-rail`; jinak se vyberou biomově vhodný most a tunel, případně most a volná krajina. Jejich konkrétní vzhled a okolí se stále odvíjí od seedu. Stanice v běžném bloku volí slot 1 nebo 2 pomocí nezávislého seedového klíče.

Stanice dostane rovinu; přejezd není na otevřeném mostě ani uvnitř tunelu. Traktor dostane pole nebo cestu, vodní mlýn vodu, maják pobřeží. Jedna dekorace nesmí zabrat rezervovanou obslužnou dráhu silničního provozu.

Implementace přejezdu ([D-015](../docs/decisions/015-level-crossings.md)): `crossingSite(seed, k)` ve slotu 3 vybere seedem jedno z míst, kde je kolej aspoň 96 u na obě strany rovná a přejezd se rezervuje před umístěním zvířete. Zvíře ustoupí nejméně 120 u; první blok přejezd neztratí (R3, seed 1226). Pruh silnice ±64 u je rezervovaný: voda se kolem něj rozdělí a žádná rekvizita ani její trasa do něj nezasahuje.

Implementace mostu a tunelu ([D-018](../docs/decisions/018-bridges-and-tunnels.md)):

- `bridgeSite(seed, k)` dává ve slotu 4 každého bloku bez souběhu kamenný mostek přes potok, tedy vždy v bloku 0. Potok drží 192 u od okrajů chunku i od interaktivního zvířete; voda za tratí se kolem něj rozdělí.
- Louka pod mostem klesá do údolí 56 u hlubokého. Kolej se nemění.
- `tunnelSite(seed, k)` dává ve slotu 6 krátký tunel (448 u): v bloku 0 vždy, jinde v blocích bez souběhu podle biomu (hory 1, podhůří 0,9, les 0,6, ostatní 0,3, klíč `tunnel`).

Každá scénka deklaruje podpory a rezervace; rozměry pocházejí z validovaného katalogu stop. Konfliktní kandidát se odmítne nejvýše osmkrát a pak se volitelná rekvizita či neplatná závislá část vynechá; nevzniká globální náhradní seznam. Generátor se nikdy nesmí zacyklit ani vytvořit chybějící kolej.

## 7. Sekundární trať jako vícedílný motiv

Protijedoucí vlak používá rezervaci slotů 4–6 společně. Ve všech třech chunkech musí existovat jeho kolej. Zjednodušený profil může být paralelní s hlavní kolejí, v jiné hloubkové vrstvě a s výškovým odsazením přibližně 64 u. Začátek a konec trati se schovají do scénického pokračování, nikoli uprostřed viditelného vlaku.

V1 nekombinuje tento motiv v témže místě s nepřipraveným tunelem či složitým mostem. Jediný validovaný tříchunkový template je lepší než nezávisle losované kusy kolejí. Délka protijedoucí soupravy nesmí překročit bezpečnou délku motivu.

Tři chunky vymezují **viditelnou** vedlejší trať. Její geometrie má na obou koncích skryté pokračování alespoň o délku NPC soupravy plus 256 u. Může využít tentýž vzorkovač hlavního profilu s odsazením a držené sousední chunky. Skrytý nájezd a odjezd překrývá připravený terén nebo portál; jsou součástí tohoto template, ne další náhodně přidaný tunel. Vozidla se postupně odkrývají a zakrývají, nesmí všechna vzniknout nebo zmizet jedním přepnutím visibility. Logická reference na tuto rozšířenou dráhu trvá až do odjezdu celé soupravy.

Implementace ([D-017](../docs/decisions/017-second-track-and-oncoming-train.md)):

- `secondarySite` dává souběh ve slotech 4–6: vždy v bloku 1, nikdy v bloku 0, jinak s pravděpodobností z configu.
- `SecondaryLine` je hlavní profil o 64 u hlouběji s vlastním oknem chunků, se skrytými konci o délku soupravy plus 256 u.
- Pás tratě a portálové kopce (380 u za portály) drží zadní rekvizity za hloubkou 0,45 a vodu za tratí. Přejezd se drží mimo levý kopec.
- Portál tvoří tmavé ústí pod vlakem a kopec s kamenným obloukem nad ním. Vozidla tak mizí po jednom.

## 8. Streaming a paměť

Udržovat dva odlišné rozsahy:

**Simulační koridor:** od `tailS - zadníRezerva` po `frontS + předstih`. Obsahuje kolej pro celou soupravu, infrastrukturu a stavy přejezdů. Předstih je nejméně 2 048 u a současně musí pokrýt obrazovku, bezpečnostní horizont přejezdů a vstup protijedoucích vlaků.

**Renderovací okno:** skutečný výřez kamery plus přibližně jeden chunk na obou stranách pro plynulé příchody. Jen zde je nutné vytvářet plné obrázky, částice, zvuky a hit oblasti. Statické popisy mimo výřez zůstávají levná data.

Chunk lze odstranit až když leží celý za posledním vozidlem všech aktérů, kteří jeho geometrii ještě potřebují, a není potřebný aktivní vícedílnou scénou. Referenční dráha druhého vlaku může žít odděleně do jeho odjezdu. Přejezd, který je daleko za kamerou, ale pod zadní částí hráčova vlaku, zůstává logicky uzavřený.

Pro renderovací objekty používat malé pooly jen tam, kde je časté zakládání a rušení: balónky, obláčky, jednoduchá auta. Není potřeba obecný ECS. Při odstranění chunku odpojit listenery, timery a zvukové zdroje. Nesmí zůstávat odkaz v globálním poli „všechny kdy navštívené objekty“.

## 9. Determinismus versus runtime stav

Geometrie a počáteční umístění objektů jsou čistě ze seedu. Otevřená závora, prasklý balónek, pozice jedoucího auta a cooldown zvířete jsou runtime stav.

Aktivace živé scénky je dána vstupem hlavy vlaku do předem definovaného simulačního předstihu, nikoli náhodně tím, zda renderer zrovna vykreslil frame. Velikost okna pro logickou aktivaci je pevná; renderovací culling ji nesmí měnit. Kosmetické stíny, listí a oblaka mohou mít volnější vizuální fázi.

Po návratu ze save se nejprve obnoví layout a relevantní runtime záznamy. Staré dekorativní částice se neobnovují. Přejezdy se navíc bezpečně odvodí z aktuálního obsazení tratě, takže chybějící kosmetický snapshot nemůže otevřít přejezd pod vlakem.

Neuchovávat neomezenou historii všech prasklých balónků. Záznamy se zahazují spolu s definitivně opuštěným chunkem; v této verzi není couvání ani návrat kamery do již smazané oblasti.

## 10. Den, noc a počasí

Simulační čas plyne, když je hra ve stavu `RIDING`, včetně stání. Stojící dítě tak vidí živé okolí. Pauza a neviditelná aplikace zastaví i herní hodiny. Offline čas mezi návštěvami se nepřičítá.

Jeden cyklus má výchozí délku 480 s. Nová cesta začíná v denní fázi. Barevnost a intenzitu světla interpolovat plynule, nikoli náhle měnit textury všech objektů. Cca 55 % cyklu tvoří den, 15 % soumrak, 20 % noc a 10 % svítání. Fáze noci má minimální jas a rozsvícená okna, lampy i světla vlaku.

Počasí používá oddělený seedový plán po 120 s simulačního času: převážně jasno, občas lehký déšť. V horách může srážkový stav znamenat sníh; změnu na hranici biomu jemně prolínat. Žádné bouřky, ostré blesky ani omezení přilnavosti. Výkonnostní profil snižuje počet vloček a kapek, ne zastavuje změnu atmosféry.

V2 plánuje sezónu a mírné počasí prostorově v regionech podle §5. Sezónní vzhled, lokální listí, třívrstvé sněžení a lehký déšť používají váhy `effectiveClimateAt(seed, worldXU)` ze stejného přechodu jako svět. Simulační čas ovládá pohyb, nikoli změnu krajiny při stání; podrobnosti vlastní [D-027](../docs/decisions/027-seasons-and-life.md).

## 11. Diagnostika

Vývojový HUD při jízdě ukazuje nejvýše dva krátké řádky: medián FPS, p95 snímku, renderer, profil kvality; seed, chunkIndex, rychlost a počet vozidel. Český podrobný vzorek v dev menu doplní verzi generátoru, počty chunků, délku vlaku, režim vstupu, tick, přejezdy, atlasy a zvuk; celý snapshot lze kopírovat pro hlášení chyby ([D-020](../docs/decisions/020-developer-menu.md)). Barevné švy a rezervace lze zapnout pouze v debug režimu.

Diagnostické API `window.__vlacek.snapshot()` při `?debug=1` uvádí u každého protijedoucího vlaku také `oncoming.trains[].locomotiveId`: katalogové ID skutečně nasazené lokomotivy. E2E píšťaly porovnává odpověď s přesným tónem této identity, nikoli s pevně předpokládaným typem; seedovaná NPC sada podle D-019 se rozšiřuje s dostupnou kresbou. Tento diagnostický údaj se neukládá a nemění svět ani výběr vozidel.

Musí existovat deterministické testovací seedy a profil, který postupně předvede stanici, přejezd, most, tunel a druhou kolej. Debug zkratky nejsou součást dětského menu. Chyby layoutu se mají dát reprodukovat seedem a indexem chunku. Pauza ukazuje drobně číslo světa (seed) pro dospělého a parametr adresy `?seed=N` založí každou novou cestu s tímto seedem; uloženou cestu nemění (rozhodnutí [D-007](../docs/decisions/007-world-seed-in-url.md)).

Diagnostika v2: `snapshot().backdrop.world` obsahuje světové x, region/scénku, krajinu, podzónu, sezónu/počasí, prostorový postup a počty logických prvků, fragmentů, rekvizit a animovaných objektů. `volta run npm run validate:world` ověřuje deskriptory, pořadí dotazů, auditní reprodukce a 20 000 prvních bloků; nulová matice a tři mutační chyby jsou povinné důkazy validátoru. Krok 2 přidává rodičovské překryvy a lokátor: viz D-023 níže.

### Dokončení základu v2 (D-023, krok 2)

Kolej má profil podle krajiny: nížiny, pobřeží a duny zůstávají mírné, podhůří a hory mají skutečné delší svahy a údolí. Rozsahy jsou v dokumentu 13; absolutní sklon nepřekročí ani globální limit, ani validovaný strop pantografu 0,10. Výška/sklon navazují přes bloky i regiony a R3 zůstává.

Přední scény používají vlastní geometrické pole/lesní půdu, skutečné stopy a pojmenované podpory. První teplý řez má traktor na poli v `near`, první lesní práce mají klády a nízkou lesní hranu. Vysoké dospělé koruny do popředí nepatří. Obsahové linky doplní sezónní nářadí a pracovní stroje podle textového katalogu.

Skryté menu nabízí tři světové překryvy, stopu umístění podle ID/x a jedenáct cílených scén. Lokátor má mez čtyř cyklů; dočasná jízda nepřepíše běžnou cestu ani zálohu a při návratu ji obnoví v původní pauze. `snapshot().worldDebug` popisuje tento stav. Výplň země i spodní pokračování používají stejnou prostorovou paletu; hranice chunku nesmí vytvářet zelený obdélník. Podrobný postup rozšíření modulů a registrů vlastní [D-023](../docs/decisions/023-world-generator-v2.md).

Revize generátoru v2: přechod zachovává autorské pole a brázdy, také spodní výplň se vzorkuje podle světového x. Přední pole/lesní půda mají zúžené nepravidelné konce a společnou geometrii podpory i kreslení. Přístavní lodě/mola se odvozují od skutečného břehu, včetně zužujícího se moře; molo musí mít geometrický kontakt s odkazovanou vodou. Přímý obrat sklonu přes 192 u má mez 0,098 pro kompaktní sběrač, současné plány oddělují opačné svahy rovinou. Podrobnosti a nenulové validační svědky popisuje [D-023](../docs/decisions/023-world-generator-v2.md).

### Silniční úseky světa v2 (D-029)

[RD-01 až RD-03](../docs/scenes/roads.md) doplňují souběžnou okresku a vzácný
vzdálený dálniční úsek do existující krajiny. Celá cesta má identitu/rozsah;
chunkové fragmenty sdílejí světové vzorky a rezervují skutečnou šířku před
rekvizitami i ploty. Odstup od koleje se mění plynule, skutečné konce se stáčejí
za zadní horizont; žádné viditelné příčné zakončení nebo slepé odbočky.
Okreska se může spojit se zadním ramenem plánovaného přejezdu. Kolej protíná
pouze jeho silnice; tento invariant prochází velkým seedovým průchodem.
Dálnice je jeden motiv v regionu, ne nový biom. V2 není vydaná; doplnění
nemění schéma save ani verzi katalogu, RNG používá `roads-v2:*`.
