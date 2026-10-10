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

Příklady klíčů: `terrain-boundary`, `route-template`, `major-feature`, `tree-position`, `animal-species`, `npc-train`, `cloud-shape`. Číselné indexy validovat jako bezpečná celá čísla. `generatorVersion` je součástí vstupního klíče.

ID entity má podobu `g1:chunk:42:animal:3`; není to náhodné UUID při každém vykreslení. Kosmetické částice mohou mít vlastní omezený generátor a neovlivňují layout ani save.

## 4. Kontinuita kolejí: profil generátoru v1

Zadání [14 §6](14_UPRAVY_PRVNI_VERZE.md) mění charakter tratě: roviny a delší rovná stoupání a klesání spojená krátkými plynulými přechody, bez souvislého vlnění. Původní konstrukce tohoto oddílu (hraniční výšky `H(k)` v ±32 u a smootherstep přechody s nulovým sklonem na každé hranici chunku) zůstává jen jako generátor v0 verze 0.1. Měření ukázalo, že v ní se sklon mění na 91–95 % délky ([D-009](../docs/decisions/009-track-generator-v1.md)).

Generátor v1 (`src/domain/world/TrackProfile.ts`, parametry `world.profile` v dokumentu 13):

- **Bloky.** Trať se plánuje po blocích `blockChunks` (8) chunků. Každý blok začíná a končí rovinou ve výšce hranice bloku, kterou určuje klíč `block-height`; výška leží v intervalu ±`blockHeightRangeU` (160 u). Chunk se tak počítá jen ze svého bloku, nezávisle na pořadí a i daleko od startu.
- **Plán bloku.** Lomená čára rovina → sklon → rovina → … → rovina. Roviny mají `flatMinU`–`flatMaxU` (384–1536 u), sklony `slopeMinU`–`slopeMaxU` (768–2304 u) v násobcích `lengthStepU` (64 u). Sklon se volí mezi `gradeRangeMin` a `gradeRangeMax` (0.03–0.08), směr nahoru nebo dolů podle seedu (klíče `flat`, `slope`, `grade`, `direction`). Výška nikdy nepřekročí ±`maxHeightU` (400 u): sklon, který by ji překročil, se otočí.
- **Proveditelnost bez losování naslepo.** Náhodný sklon se přijme jen tehdy, když zbytek bloku ještě pojme rovinu a jediný závěrečný sklon na výšku další hranice při `gradeRangeMax`. Jinak plán skončí závěrečným sklonem a minimální rovinou. Validace konfigurace ověřuje, že blok vždy pojme nejdelší počáteční rovinu a nejdelší závěrečný sklon.
- **Přechody.** Každý zlom lomené čáry nahrazuje parabola (výškový oblouk) délky `transitionU` (192 u). Sklon se v ní mění lineárně, takže výška i sklon jsou spojité a nevzniká ostrý zlom. Každý úsek plánu je alespoň tak dlouhý jako přechod, takže se oblouky nepřekrývají.

Výška a sklon jsou spojité na každém švu chunku i bloku. Sklon nikdy nepřekročí `gradeRangeMax`, a tedy ani absolutní mez `world.maxTrackGrade` (0.12), se kterou počítá model pohybu. Změna kteréhokoli parametru `world.profile` mění geometrii a vyžaduje nové `generatorVersion`.

Nádraží a přejezdy (M2) se umístí na existující roviny plánu, mosty a tunely na terén kolem tratě, který může být členitější než kolejové těleso. Geometrie v1 se kvůli nim nemá měnit.

Terén kolem tratě je samostatná seedovaná funkce, ne součást profilu koleje ([D-012](../docs/decisions/012-track-tiles-and-terrain.md)). `embankmentU(seed, x)` určuje výšku kolejového tělesa nad loukou v popředí: hodnotový šum s uzly po `world.terrain.latticeU` do `world.terrain.maxEmbankmentU`, spojitý se spojitým sklonem a počítaný jen z x. Klíč obsahuje verzi generátoru.

## 5. Biomy a návaznost krajiny

Šest základních biomů:

- `countryside`: pole, louky, vesnice, sad a farma; výchozí prostředí.
- `forest`: smíšený les, paseka, potok, hájovna.
- `lakes`: rybník, řeka, mokřad, lodě a vodní mlýn.
- `foothills`: údolí, louky, skalní zářezy, menší viadukty.
- `mountains`: skály, vysoká údolí, tunely, horské louky a sníh.
- `coast`: pobřeží, pláž, přístav, maják a moře.

Vesnice, malé město a technické areály jsou scénické motivy, ne sedmý plnohodnotný biome. Tím nevznikají další systémy pouze kvůli jedné budově.

### Jednoduchá deterministická gramatika trasy

Jeden biomový blok má osm chunků. Osm takových bloků tvoří cyklus. Pro každý cyklus hash vybere jeden z následujících itinerářů:

```text
A: countryside → forest → foothills → mountains → foothills → lakes → coast → lakes
B: countryside → lakes → coast → lakes → forest → foothills → mountains → foothills
C: countryside → forest → lakes → coast → lakes → foothills → mountains → foothills
```

Všechny začínají venkovem a končí biomem, který na další venkov přirozeně naváže. Pro záporné indexy používat matematické floor dělení a kladné modulo. Žádná potřeba generovat všechny předchozí bloky kvůli určení současného biomu.

Tohle je výchozí gramatika, nikoli tvrzení, že celá mapa je unikátní bez opakování. Konkrétní profily, stavby, fauna, dekorace a rozložení se dál generují podle samostatných klíčů. Jednoduchá gramatika zaručuje návštěvu všech prostředí bez složitého hledání cesty.

Poslední chunk biomového bloku provádí postupný vizuální přechod k dalšímu biomu. Krajinu míchat prostorově, ne časovým přepnutím celé obrazovky. Vzdálené hory či moře se objeví před hlavním přechodem. Nesmí následovat okamžitý skok ze zasněženého tunelu do tropické džungle.

Implementace ([D-013](../docs/decisions/013-landscape-localities-and-backdrops.md)) má tři části.

- **Biom a lokalita.** `biomeAt(seed, k)` počítá biom z gramatiky pro libovolný, i záporný chunk. `chunkScenery(seed, k)` vybere lokalitu ze šablon v `sceneryTemplates.ts`, například pastvinu, pole, farmu, vesnici, les, paseku, rybník, mlýn, přístav nebo horskou chatu. Pak rozmístí její rekvizity se stabilními ID `g1:chunk:k:prop:n`.
- **Sloty.** Slot 0 je klidný, nádraží stojí ve slotu 1 nebo 2 na rovině aspoň 448 u. Slot 7 přepíná od x = 512 na klidnou lokalitu dalšího biomu, takže přechod je prostorový. Pozadí navíc změnu biomu prolne.
- **Voda.** Je to rovná nádrž v rámci jednoho chunku se zaoblenými konci. Lodě i se svou trasou zůstávají na vodě, stavby a stromy na suchu, nádraží je suché. Traktor, auto a lodě nejezdí v polovině přechodového chunku.

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

Implementace přejezdu ([D-015](../docs/decisions/015-level-crossings.md)): `crossingSite(seed, k)` ve slotu 3 vybere seedem jedno z míst, kde je kolej aspoň 96 u na obě strany rovná a silnice je aspoň 120 u od interaktivního zvířete. Bez takového místa blok přejezd nemá. Pruh silnice ±64 u je rezervovaný: voda se kolem něj rozdělí a žádná rekvizita ani její trasa do něj nezasahuje.

Každý template deklaruje rezervované oblasti, rozměry, povolené biomy, případné navazující chunky a bezpečné oblasti pro dotykové cíle. Konfliktní kandidát se odmítne nejvýše osmkrát a pak se použije `safe-meadow` nebo biomová obdoba. Generátor se nikdy nesmí zacyklit ani vytvořit chybějící kolej.

## 7. Sekundární trať jako vícedílný motiv

Protijedoucí vlak používá rezervaci slotů 4–6 společně. Ve všech třech chunkech musí existovat jeho kolej. Zjednodušený profil může být paralelní s hlavní kolejí, v jiné hloubkové vrstvě a s výškovým odsazením přibližně 64 u. Začátek a konec trati se schovají do scénického pokračování, nikoli uprostřed viditelného vlaku.

V1 nekombinuje tento motiv v témže místě s nepřipraveným tunelem či složitým mostem. Jediný validovaný tříchunkový template je lepší než nezávisle losované kusy kolejí. Délka protijedoucí soupravy nesmí překročit bezpečnou délku motivu.

Tři chunky vymezují **viditelnou** vedlejší trať. Její geometrie má na obou koncích skryté pokračování alespoň o délku NPC soupravy plus 256 u. Může využít tentýž vzorkovač hlavního profilu s odsazením a držené sousední chunky. Skrytý nájezd a odjezd překrývá připravený terén nebo portál; jsou součástí tohoto template, ne další náhodně přidaný tunel. Vozidla se postupně odkrývají a zakrývají, nesmí všechna vzniknout nebo zmizet jedním přepnutím visibility. Logická reference na tuto rozšířenou dráhu trvá až do odjezdu celé soupravy.

Implementace ([D-017](../docs/decisions/017-second-track-and-oncoming-train.md)):

- `secondarySite` dává souběh ve slotech 4–6: vždy v bloku 1, nikdy v bloku 0, jinak s pravděpodobností z configu.
- `SecondaryLine` je hlavní profil o 64 u hlouběji s vlastním oknem chunků, se skrytými konci o délku soupravy plus 256 u.
- Pás tratě a portálové kopce (320 u za portály) drží zadní rekvizity za hloubkou 0,45 a vodu za tratí. Přejezd se drží mimo levý kopec.
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

Roční období se v první verzi globálně nesimuluje. Sníh v horách je vlastnost prostředí; podzimní či zimní varianta celé mapy je pozdější rozšíření.

## 11. Diagnostika

Vývojový overlay ukáže seed, generatorVersion, chunkIndex, počet zachovaných chunků, počet renderovaných entit, délku vlaku, režim vstupu, v, simulační tick a profil kvality. Barevné švy a rezervace lze zapnout pouze v debug režimu.

Musí existovat deterministické testovací seedy a profil, který postupně předvede stanici, přejezd, most, tunel a druhou kolej. Debug zkratky nejsou součást dětského menu. Chyby layoutu se mají dát reprodukovat seedem a indexem chunku. Pauza ukazuje drobně číslo světa (seed) pro dospělého a parametr adresy `?seed=N` založí každou novou cestu s tímto seedem; uloženou cestu nemění (rozhodnutí [D-007](../docs/decisions/007-world-seed-in-url.md)).
