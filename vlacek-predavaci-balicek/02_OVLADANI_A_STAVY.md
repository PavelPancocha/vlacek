# 02 — Ovládání, rozhraní a stavové přechody

[Zpět na rozcestník](../README.md)

## 1. Základní kontrakt

**Držím herní svět = plyn. Nedržím = dojezd. Držím brzdu nebo táhnu doleva = brzdím.**

Zvolená interpretace nejednoznačné varianty z rozhovoru: **velká viditelná brzda vlevo dole**, nikoli neviditelná brzdová zóna přes celou levou část obrazovky. Kdekoli jinde ve světě, včetně levé poloviny, dotyk pohání vlak. Tím dítě může klepat na objekty bez překvapivých rozdílů podle jejich polohy. Zvětšená dotyková oblast tlačítka umožní brzdit držením vlevo. Levé gesto poskytuje druhou možnost.

Výchozí parametry jsou v [13_VYCHOZI_KONFIGURACE.md](13_VYCHOZI_KONFIGURACE.md).

## 2. Rozdělení vstupních ploch

| Plocha                    | Chování                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------- |
| Herní svět                | Dotyk vytvoří požadavek na plyn. Případný zasažený objekt zároveň reaguje.         |
| Brzda vlevo dole          | Po dobu držení aktivní brzda. Nikdy současně plyn ani zásah objektu pod tlačítkem. |
| Píšťala                   | Jedno zahoukání při stisku, s omezením opakování. Tlačítko samo nepohání vlak.     |
| Pauza, zvuk, menu         | Spotřebují událost; dotyk nepropadne do světa.                                     |
| Obrazovka depa a výběru   | Neexistuje vstup do jízdy. Posouvání a klepání slouží pouze rozhraní.              |
| Modální vrstva / načítání | Všechny dotyky světa jsou blokované.                                               |

Běžná jízda nezobrazuje páku rychlosti ani tlačítko automatického rozjezdu. Stav jízdy lze jemně ukázat animací kol a páry. Numerický rychloměr není potřebný.

## 3. Jednotná cesta zpracování vstupů

Existuje **jeden InputRouter**, který rozhodne, kdo událost vlastní. Nelze nezávisle poslouchat DOM `click`, Phaser `pointerdown` a `touchstart` a třikrát na ně reagovat.

Na dotykových zařízeních přednostně Pointer Events s evidencí `pointerId`. V herní ploše nastavit `touch-action: none`; v rodičovských textových panelech ponechat normální posouvání. Zrušení prohlížečového gesta může vést na `pointercancel`, které je nutné odbavit stejně jako ukončení dotyku. Vlastnosti Pointer Events a `touch-action` viz zdroje S03/S04 v dokumentu 12.

Implementátor zvolí buď jediný DOM adaptér pro plátno a explicitní hit-testy, nebo jednotný Phaser adaptér. Doménový reducer nesmí záviset na Phaseru. Eventy z DOM ovládacích tlačítek se předávají stejnému routeru a označí jako spotřebované. Podpora více prstů je povinná; Phaser konfigurace ji musí skutečně umožňovat.

### Záznam prstu

```ts
type PointerRole = 'drive' | 'brake' | 'ui';
interface PointerState {
  id: number;
  role: PointerRole;
  startClientX: number;
  startClientY: number;
  downAtMs: number;
  brakeLatched: boolean;
  activatedObjectId?: string;
}
```

Souřadnice gest jsou v **CSS pixelech**, nikoli v pixelech renderovacího bufferu. Převod do světa se používá jen pro zasažení herních objektů.

### `pointerdown`

1. Nejprve modální vrstva a prvky UI, teprve potom svět.
2. Brzda vytvoří roli `brake`. Píšťala a ostatní UI roli `ui`.
3. Svět vytvoří roli `drive` a požadavek na plyn okamžitě; nečeká se na rozpoznání klepnutí.
4. Jednou se provede hit-test nejvýše jednoho prioritního interaktivního objektu. Jeho reakce může začít **hned při dotyku**.
5. Dlouhé držení objektu reakci neopakuje. Přejíždění přes další objekty nová zasažení nevytváří.
6. Zachytit prst pomocí pointer capture tam, kde je podporována. Selhání capture nesmí shodit hru.

Reakce na objekt i plyn jsou úmyslně společné. Krátké klepnutí při stání může vlak maličko posunout; nejde o chybu. Vlak lze při prohlížení držet brzdou druhým prstem. Není zde skryté rozlišování „chtěla jet“ versus „chtěla pohladit krávu“.

### `pointermove` a gesto doleva

U prstu, který začal ve světě, během prvních 500 ms vyhodnotit posun vlevo nejméně 64 CSS px a podmínku `abs(dx) >= 1.5 * abs(dy)`. Po splnění se `brakeLatched = true` drží až do zvednutí tohoto prstu. Otočení gesta doprava ve stejném dotyku brzdu neruší. Nový dotyk začíná znovu jako plyn.

Prst mimo krátké rozpoznávací okno nadále pohání vlak; může se ale přesunout přímo na viditelnou brzdu. Vstup prstu s rolí `drive` do její rozšířené hit oblasti zapne a do zvednutí zachová brzdění. Prst, který začal na jiném UI, nelze přesunutím proměnit na plyn.

Protože interakce probíhá při `pointerdown`, může rychlé brzdové gesto začít náhodným zamáváním zvířete. To je přijatelný neškodný vedlejší efekt, ne důvod zpozdit celou hru nebo zavést rollback animací.

### `pointerup`, `pointercancel`, ztráta zachycení

Odstranit příslušný prst z mapy. Přepočítat požadavek na jízdu. Není-li žádný plyn ani brzda, přejít na dojezd. Ignorovat následný syntetický `click`, který by duplikoval již zpracovaný dotyk.

Při ukončení mimo plátno musí vstup také skončit. Kromě pointer capture musí existovat úklid při `window.blur`, `visibilitychange`, změně scény a ztrátě kontextu.

## 4. Priorita a více prstů

```text
není aktivní jízda / aplikace není viditelná → PAUSE, vymazat dotyky
jinak existuje brake nebo brakeLatched       → BRAKE
jinak existuje drive                        → THROTTLE
jinak                                       → COAST
```

Brzda vždy vítězí. Po zvednutí brzdy při stále drženém jiném prstu se znovu uplatní plyn. Toto chování musí být stejné při 30 i 60 snímcích za sekundu.

Až pět aktivních dotyků se eviduje samostatně. Další se mohou ignorovat bez chyby; již držená brzda se kvůli novému prstu nesmí zrušit. Interakce se stejným objektem respektují cooldown a limit souběžných zvuků.

Dospělý může jedním prstem držet brzdu a druhým ukazovat zvířata. Rodičovská pauza ale blokuje všechny herní interakce; není to alternativní herní režim.

## 5. Myš a klávesnice

Myš funguje stejným principem: levé tlačítko ve světě = plyn, uvolnění = dojezd, tažení doleva může brzdit. Pohyb kurzoru bez stisku nic neaktivuje.

Pro vývoj a desktop: držení `ArrowRight` nebo mezerníku = plyn; `ArrowLeft` = brzda; `H` = píšťala; `Escape` = pauza. V textovém vstupu rodičovského panelu se herní klávesy neuplatňují. `keyup` i ztráta fokusu vždy uklidí stav. Opakování klávesy nepřidává několik „držených plynů“.

## 6. Stavový automat aplikace

```text
BOOT → LOADING → HOME / SELECT_LOCO
HOME → SELECT_LOCO → BUILD_TRAIN → STARTING_RIDE → RIDING
HOME → RESTORING_RIDE → PAUSED_RESUME → RIDING
RIDING ↔ PAUSED
RIDING → PAUSED_EXTERNAL
PAUSED / PAUSED_EXTERNAL → RIDING (po novém potvrzení)
PAUSED → BUILD_TRAIN (kopie sestavy)
BUILD_TRAIN → STARTING_RIDE (nová cesta) nebo zpět do PAUSED
libovolný stav → RECOVERABLE_ERROR (pouze při skutečné chybě)
```

`RIDING` zahrnuje i stojící vlak; není totožný s `v > 0`. Doménové režimy pohybu `THROTTLE/COAST/BRAKE` jsou vnořené a nevyžadují přepnutí obrazovky.

### Pauza a návrat

Pauza zmrazí simulační čas, dopravu, částice i ambientní zvuky. Vymaže mapu prstů a kláves. Pozice vlaku zůstane zachována. Při obnovení je **rychlost nula**, nezávisle na rychlosti před přerušením; nedojde k okamžitému rozjezdu.

Tlačítko „Pokračovat“ pouze odstraní pauzu. Tentýž dotyk se nepoužije jako plyn. Vstup se znovu odemkne po zvednutí všech prstů, které existovaly při potvrzení. Teprve další nový dotyk může rozjet vlak. Dotyk, který začne ještě před tímto odemčením, zůstane neaktivní po celou dobu svého držení; vlak se tedy nerozjede ani ve chvíli, kdy se zvedne poslední starý prst. Totéž platí pro klávesy: klávesa držená při potvrzení řídí až po novém stisku.

Totéž platí po načtení uložené cesty. Návrat z neviditelné stránky nikdy automaticky neaktivuje zvuk ani jízdu. Audio se případně znovu odemkne potvrzujícím dotykem, viz dokument 09.

## 7. Výběr lokomotivy a depo

### Výběr

Deset velkých obrázkových karet, posouvatelných po stránkách nebo v mřížce podle šířky. Každá ukáže název pro dospělého, ale dítě vybírá podle obrázku. Klepnutí lokomotivu označí a krátce předvede její zvuk či efekt. Následuje velké tlačítko pro přechod k vagonkům.

### Sestavování

Horní část: souprava v bočním pohledu. Spodní část: katalog vagonků s obrázkovými skupinami osobní / nákladní / zvláštní. Klepnutí na katalog přidá **jeden** vagónek za poslední. Typy lze opakovat. Žádné automatické přidávání při dlouhém stisku.

Klepnutí na připojený vagónek jej vybere; samo ho neodebere. Vedle výběru se zobrazí velké akce „odebrat“, „posunout blíž k mašince“ a „posunout dozadu“. U krajních pozic je neplatná akce neaktivní. Lokomotiva se nepřesouvá mezi vagonky. Odebrání a změny pořadí mají jednou dostupné „vrátit poslední změnu“.

Pás soupravy je horizontálně posouvatelný. Gesto zde slouží výhradně posunu, nikdy brzdě. Lokomotiva má vlastní tlačítko rychlého návratu na začátek pásu. Pás ukazuje soupravu stejně jako jízda (dokument 14 §1): lokomotiva vpravo čelem doprava, vagonky za ní doleva v pořadí výběru, nový vagonek na levém konci; pozice počítá stejná funkce `layoutConsist` jako jízda. Krátká souprava stojí u pravého okraje pásu; šipky přesunu míří k lokomotivě (doprava) a ke konci (doleva). Na nízkém displeji (výška do 500 px, telefon na šířku) sdílí ovládací tlačítka jeden řádek, katalog se posouvá vodorovně a Vyjet zůstává v pravém dolním rohu. Na užším telefonu (šířka do 760 px, např. 667 × 375 a 568 × 320) jsou řádky pod sebou: horní tlačítka bez popisků, pod nimi úpravy a Vyjet, pás soupravy využije zbylou výšku (nejméně 76 px kvůli 64px dotykovým cílům vagonků) a katalog se posouvá. U dlouhé soupravy virtualizovat náhledy; nepočítat trvale stovky složitých DOM komponent mimo výřez.

Tlačítko **Vyjet** funguje i s nulou vagonků. Při limitu 100 se další přidávání vypne, souprava krátce jemně zareaguje a rodič může vidět „Vláček je plný“. Nic se automaticky nesmaže.

### Změna během rozehrané cesty

Z pauzy lze otevřít kopii sestavy v depu. Původní rozehraná cesta se tím ještě nenahradí. „Zpět“ vrátí původní cestu, „Vyjet s tímto vlakem“ založí nový seed a novou cestu. Tato volba je zřetelná, ale nepotřebuje heslo ani potvrzování každého vagónku.

V1 neprodlužuje vlak v místě, kde už právě stojí přes několik přejezdů. Tím se zamezí zbytečné složitosti přepočítávání živé krajiny.

## 8. Rodičovské nastavení

Přístup držením ikony ozubeného kola po dvě sekundy, s viditelným průběhem. Jde o ochranu před náhodným dotykem, nikoli bezpečnostní autentizaci. Běžná pauza zůstává okamžitě dostupná.

Panel obsahuje samostatně zvuky / hudbu, nižší maximální rychlost, omezení dekorativních efektů, výběr profilu výkonu Auto / Úsporný / Standard, informace o offline dostupnosti a číslo buildu. Volbu „Smazat uloženou cestu a nastavení“ doprovází druhé výslovné potvrzení. Žádná tlačítka s externími odkazy v dětské části.

## 9. Rozhraní nesmí překážet

Brzda a píšťala mají minimálně 80 CSS px dotykovou plochu a odstup od ostatních tlačítek. Běžné ikony minimálně 64 CSS px. Pro vizuálně malá zvířata se rozšiřuje hit oblast, nikoli nutně samotná kresba. Rodičovský panel může být textový.

Při překryvu se vybírá nejbližší střed viditelného prioritního objektu v horní interaktivní vrstvě. Klikání skrz tunelovou stěnu na skrytý objekt není povolené. Horní UI vždy vítězí nad zvířetem za ním.

Otočení zařízení a resize vymaže dotyky, přepočítá souřadnice i hit oblasti a přejde na pauzu pro návrat. Na výšku se zobrazí klidná výzva k otočení; rodičovský panel musí zůstat přístupný. Uzamčení orientace není předpoklad fungování.

## 10. Povinné testovací situace

Součástí akceptace jsou současně držený plyn a brzda, puštění mimo plátno, `pointercancel`, ztráta fokusu uprostřed gesta, reakce zvířete při drženém plynu, přechod prstu na brzdu, dotyk „Pokračovat“ bez samovolného rozjezdu a nemožnost řídit přes otevřené menu. Konkrétní testy jsou v dokumentu 11.
