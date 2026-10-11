# 10 — Implementační plán a předání vývoje

[Zpět na rozcestník](../README.md)

## 1. Princip postupu

Implementovat po funkčních vertikálních řezech. Nejdřív ověřit ovládání a to, že dlouhý vlak opravdu sleduje kolej. Teprve na stabilní základ přidávat katalog, krajinu a atmosféru. Malý průběžný prototyp nemění rozsah finální V1.

Úkol není „vymyslet další návrh hry“, ale postavit hru podle tohoto balíčku. Nejasné nepodstatné detaily řešit výchozími volbami, zapsat je a pokračovat. Úprava potvrzeného záměru vyžaduje viditelné rozhodnutí, ne tiché zjednodušení při vývoji.

## 2. M0 — Technická průchodnost a skeleton

**Výstup:** reprodukovatelný projekt, malá online demo scéna a diagnostika.

Založit TypeScript/Vite projekt, připnout zvolenou verzi Phaseru a testů, vytvořit lockfile a požadované npm skripty. Nastavit formátování, lint, strict typecheck a první CI. Připravit čistou doménovou funkci pro pohyb a jednotný InputRouter.

Do scény dát jednoduchou lokomotivu, 100 geometrických vagonků, jeden kopec, jeden interaktivní objekt, brzdu, píšťalu a pauzu. Ověřit WebGL a dostupnou Canvas cestu, skutečnou velikost dotykových cílů, zvuk po gestu a návrat po ztrátě fokusu.

Nasadit statickou testovací verzi a spustit ji na fyzickém tabletu a Tesle, jsou-li dostupné. Není-li Tesla dostupná, uložit prázdný testovací protokol se stavem NEOVĚŘENO a pokračovat, nikoli její test vymyslet.

**Brána dokončení:** build a základní testy fungují, je dostupná URL demo buildu, existuje zaznamenané rozhodnutí o rendereru a poctivý stav testů zařízení. Závažný problém ovládání či výkonu se řeší dříve než plná produkce assetů.

## 3. M1 — Celá herní smyčka s malým obsahem

**Výstup:** výběr → depo → jízda → pauza → obnovení.

Implementovat výběr několika dočasných lokomotiv a vagonků, přidávání, odebírání, pořadí a návrat poslední editace. Od první verze dat podporovat celý cílový limit soupravy. Vytvořit první SaveRepository, validaci a bezpečný start z uložené cesty.

Dokončit reducer vstupů včetně více prstů, gestech, koncových událostí, UI priority a potvrzení návratu bez propadnutí dotyku. Kolej zatím může být opakovaná testovací, ale vozidla musí mít samostatnou geometrii a nápravy.

**Brána:** splněné testy INP a základní TRN; žádná náhodná samovolná jízda po návratu. Dospělý zvládne vytvořit soupravu bez instrukcí v konzoli. Placeholdery jsou označené.

## 4. M2 — Nekonečná trať a prostředí

**Výstup:** streaming po libovolně dlouhé trati, šest biomů v základní podobě.

Implementovat hash a deterministické layouty, profily, LUT délky, podklady pro záporné chunky, rebase, dva rozsahy simulačního/renderovacího okna a cleanup. Přidat všechny biomy a jejich přechody; zpočátku mohou sdílet jednoduché grafické prvky, ale route grammar musí fungovat.

Implementovat most a tunel s průjezdem jednotlivých vozidel a automatickou elektrifikaci. Přidat základ den/noc a počasí, navázané na simulační čas. Ukládání musí obnovit správný chunk a fázi prostředí.

**Brána:** deterministické testy GEN, geometry stress test a dlouhá simulace nevykazují nárůst historie. Celá souprava má existující kolej včetně nejdelší počáteční sestavy.

## 5. M3 — Živý svět a interakce

**Výstup:** nádraží, přejezd s dopravou, protijedoucí vlak a zvířata.

Začít bezpečným přejezdovým automatem a testy predikce. Až potom přidat auta a kola. Implementovat stanici bez automatického zastavení, druhou kolej a jeden kompletní tříchunkový motiv. Přidat jednotný interaction controller, první zvířata, balónky a odpovědi na píšťalu.

Rozšířit ukládání o relevantní runtime stavy. Ověřit, že renderovací culling nevypne přejezd pod zadní částí dlouhého vlaku. Reakce katalogových vagonků jsou místní; nesmějí přidat vazbu scénky na náklad.

**Brána:** SCN testy, průjezd všech scén bez jediné povinné interakce, dotykové spam testy a obnovení vlaku stojícího přes přejezd.

## 6. M4 — Kompletní obsah a audiovizuální sjednocení

**Výstup:** celý požadovaný katalog a finální výtvarný základ.

Doplnit 10 odlišných lokomotiv, 32 druhů vagonků, infrastrukturu a 18 scénických sestav z katalogu. Přidat zvířecí a dopravní typy včetně požadovaných odlišných reakcí. Všechny klíče assetů validovat při buildu.

Sjednotit výtvarný styl, proporce, pojezdy, stíny, noční čitelnost a zvuky. Sestavit kontaktní listy a testovací scény pro všechny vozidlové typy. Doplnit původ a podmínky použití assetů. Zkontrolovat, že „nový typ“ není pouze jiná barva prvního obrázku.

**Brána:** splněný katalog a vizuální kontrola, žádné neoznačené placeholdery, rozpoznatelné lokomotivy i vagonky, žádné neplatné licence nebo chybějící zdroje.

## 7. M5 — PWA, odolnost a vydání V1

**Výstup:** produkční webový build s bezpečným ukládáním a ověřenými volitelnými platformními funkcemi.

Implementovat manifest, ikony, service worker a cache aktualizace; doplnit skutečný offline test celého katalogu a všech prostředí. Otestovat neúplné stahování, změnu verze, více otevřených oken a případ bez service workeru.

Dokončit rodičovské nastavení, fullscreen fallback, problém s nedostupným úložištěm, ztrátou audio kontextu, resize a WebGL kontextu. Změřit finální obsah na skutečných cílových zařízeních. Připravit release notes, návod k lokálnímu spuštění, nasazení a aktualizaci a dokumentovaná omezení.

**Brána:** odpovídající sada funkčních, obsahových, offline a výkonových testů z dokumentu 11. Plná podpora Tesly se označí až po testu finálního buildu v autě. Pokud tento test chybí, vydání se smí popsat jako web/Android verze s neověřenou Teslou, nikoli jako kompletně ověřená podpora všech cílů.

## 8. Závislosti a paralelní práce

Input a TrainMotion se dají implementovat současně s přípravou prvních assetů. Generátor a renderer spolu potřebují stabilní typy a jedno společné vzorkování koleje. Přejezdové automaty potřebují správně spočtený `tailS` a předstih světa.

Grafický obsah lze tvořit paralelně po schválení rozměrů a pivotů. Offline lifecycle lze připravit před M5, ale přijímací test musí proběhnout nad úplným produkčním obsahem. Backend nebo nativní obálka nepředstavují žádnou závislost.

Nedělit první malou implementaci do mnoha nezávislých agentů se soupeřícími schématy. Nejprve stabilizovat data, jednotky, input contract a samplePath. Teprve potom paralelizovat obsah nebo samostatné testované moduly.

## 9. Požadovaný provozní návod skutečného repozitáře

Po implementaci musí fungovat následující ekvivalentní postup:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run validate:assets
npm run build
npm run preview -- --host 0.0.0.0
```

Vývojový server:

```bash
npm run dev -- --host 0.0.0.0
```

E2E prostředí podle lockfilem připnuté verze:

```bash
npx playwright install chromium
npm run test:e2e
```

Instalace dalších referenčních browserů se doplní podle testovacího projektu. LAN HTTP je užitečné pro ovládání a výkon, nikoli automaticky pro service worker na tabletu. Produkční PWA testovat na HTTPS.

Výše uvedené příkazy jsou požadavek na repozitář. Od verze 0.1 všechny existují; `npm run test:e2e` sám vytvoří build a `npm run measure:perf` měří jízdu s nejdelší povolenou soupravou. Přesný popis a omezení jsou ve [vývojovém návodu](../docs/development.md).

## 10. Definice hotové práce

Každá změna má konkrétní požadavek, test nebo zdokumentovaný důvod, žádné nové nevysvětlené závislosti a žádnou tichou změnu hry. Všechny automatické kontroly pro dotčenou oblast proběhnou před dokončením úkolu. Manuální testy mají skutečný výsledek, build a zařízení.

U bugů generátoru uvést seed, chunkIndex, stav soupravy a očekávaný výsledek. Oprava musí zahrnout regresní test. U ergonomických změn vedle kódu aktualizovat odpovídající část specifikace a parametry.

Finální předání obsahuje repozitář, spuštěný webový build, README k provozu, identifikátor verze, assetový manifest a zdroje, protokol testů, známé limity a seznam případných vědomě odložených položek. Žádný odložený potvrzený požadavek se nesmí vydávat za hotovou V1.
