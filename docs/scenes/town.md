# České město a předměstí

Městský region postupuje přes předměstí k hustším ulicím a zpět přes nádraží nebo průmyslový okraj.
Větší hustota vzniká hlavně seskupenými zadními vrstvami, nikoli vysokými objekty před vlakem.
Posloupnost má alespoň tři různé místní obrazy; město není pouze řada stejného domu.

## TO-01 — Předměstí se zahradami

Na obzoru jsou nízké městské střechy a několik vzdálených bytových domů.
Za tratí střídají rodinné domy malé řadovky podél jedné souvislé ulice.
Mezi domy jsou zahrady a průhledy, takže příchod do města je postupný.
Běžný celý dvouchunkový obraz TO-01 přijme 6–10 domů na oddělených parcelách s vlastními přístupy; menší počet patří pouze k prostorově omezené variantě s objížďkou nebo zakrytým úsekem ulice.
U koleje pokračuje tráva a nízké oplocení mimo průjezdný profil.
Před vlakem leží zahrádkářské záhony, keře a bezpečná pěšina.
Po ulici občas projede auto, zatímco nad střechami pomalu plují mraky.

| Zóna           | Objekty                                         | Počet                  | Vztahy a závislosti      | Zakázáno             |
| -------------- | ----------------------------------------------- | ---------------------- | ------------------------ | -------------------- |
| far            | NEW: městský pás 1 024 × 180 u                  | 1 navazující pás       | Řídký okraj města        | Mrakodrapy           |
| back 0,30–0,85 | `back.house-a/b/c`; NEW: řadový dům 120 × 100 u | 6–10 domů              | Ulice, příjezdy, parcely | Dům ve vozovce       |
| bank           | Tráva a úplný plot                              | 1–2 úseky              | Oddělení dráhy od zahrad | Náhodné krátké ploty |
| near 0,35–0,80 | Záhony z village, `near.bush`, `back.person-a`  | 3–6 skupin, 0–1 člověk | Pěšina mezi zahrádkami   | Vysoká zahradní zeď  |

## TO-02 — Městská ulice

V dálce se střechy spojí do hustší české městské siluety.
Za tratí stojí několik menších bytových domů a řadových fasád.
Ulice prochází před nimi a v mezerách ukazuje boční dvory.
U koleje je přehledný železniční pás, který domy neobsadí.
V popředí ho doprovází nízké keře a cesta s jednotlivým chodcem.
Autobus a auto jedou každý vlastním směrem a nad střechami zůstává klidný kus oblohy.

| Zóna           | Objekty                                                           | Počet                   | Vztahy a závislosti            | Zakázáno                     |
| -------------- | ----------------------------------------------------------------- | ----------------------- | ------------------------------ | ---------------------------- |
| far            | Městský pás TO-01                                                 | 1–2 skupinové vrstvy    | Hustší střed, tlumený kontrast | Americká metropole           |
| back 0,35–0,90 | NEW: bytový dům 180 × 150 u, panelový dům 220 × 180 u; řadový dům | 5–9 samostatných staveb | Souvislá ulice a suché parcely | Všude stejné fasády          |
| back 0,15–0,45 | `back.car`, autobus z village                                     | 1–3 vozidla             | Na společné vozovce            | Směr podle pohybu kamery     |
| bank           | Geometrie železničního pásu                                       | Souvislá                | Rezervace kolejí a vedení      | Lavičky v průjezdném profilu |
| near 0,40–0,80 | `near.bush`, `back.person-a/b/c`                                  | 2–5 keřů, 1–2 lidé      | Pěší cesta oddělená od koleje  | Chodec přes trať             |

## TO-03 — Park mezi čtvrtěmi

Městské domy se v dálce ukazují mezi korunami.
Za tratí se otevře park s cestou, lipami a lavičkami.
Mezi parkem a kolejí je travnatá mez a nízké oplocení.
Před vlakem pokračuje trávník s květinovým záhonem a keři.
Pes jde s člověkem po cestě a ptáci občas přeletí mezi dvěma stromy.
Obloha a otevřený trávník dávají po husté ulici očím chvíli oddechu.

| Zóna           | Objekty                                                        | Počet                   | Vztahy a závislosti          | Zakázáno                      |
| -------------- | -------------------------------------------------------------- | ----------------------- | ---------------------------- | ----------------------------- |
| far            | Městský pás za zelení                                          | 1 pás                   | Město zůstává rozpoznatelné  | Úplný přechod do jiného biomu |
| back 0,30–0,85 | `tree.linden`, `tree.oak`, `back.bench`                        | 5–9 stromů, 2–3 lavičky | Podél parkové cesty          | Lavička v kmeni               |
| bank           | Tráva, úplný plot                                              | 1 souvislý úsek         | Bez pěší zkratky přes kolej  | Neřízený přechod              |
| near 0,35–0,80 | `near.wildflowers`, `near.bush`, `animal.dog`, `back.person-b` | 3–6 skupin, 1 dvojice   | Pes i člověk na stejné cestě | Pes volně běžící do dopravy   |

## TO-04 — Nádražní čtvrť

V dálce se střídají městské střechy s nižšími drážními budovami.
Za tratí se objeví dlouhé nástupiště a přístupové přednádraží.
Stanice se skládá podle ST-03 a její délku nehraje jen zvětšená budova.
U koleje jsou čisté hrany nástupiště a vedení bez dekorativních překážek.
Před vlakem leží nízká servisní cesta a několik keřů, které nechávají soupravu čitelnou.
Na obloze přechází mrak, lidé na nástupišti se jednotlivě pohnou a jeden výpravčí může zamávat.

| Zóna           | Objekty                                    | Počet       | Vztahy a závislosti             | Zakázáno                          |
| -------------- | ------------------------------------------ | ----------- | ------------------------------- | --------------------------------- |
| far            | Městský pás TO-01                          | Souvislý    | Nižší hustota u kolejiště       | Věžáky bez odstupu                |
| back 0,15–0,85 | Kompozice ST-03 z [station.md](station.md) | 1 stanice   | Jeden vlastník, rovina, přístup | Druhé nástupiště z lokálního losu |
| bank           | Rezervovaný staniční koridor               | Podle ST-03 | Stejná geometrie koleje         | Zkrácení stanice na chunk         |
| near 0,35–0,80 | Servisní cesta, `near.bush`, `near.stones` | 2–4 skupiny | Nízké okolí před vlakem         | Sklad před lokomotivou            |

## TO-05 — Sklad, pila a odjezd z města

Městský horizont postupně řídne a za ním jsou znovu vidět kopce.
Za tratí stojí jeden menší sklad nebo pila s vlastním dvorem.
Sklad má bedny a kryté nakládací místo, pila má svázané řezivo a klády.
U koleje zůstává volný servisní odstup a žádná manipulace nesahá k vozům hráče.
Před vlakem může ležet nízká skládka dřeva nebo pás keřů.
Nákladní auto projede obslužnou cestou a vzácně je dál za areálem vidět dálnice pod otevřenou oblohou.

| Zóna           | Objekty                                                | Počet                          | Vztahy a závislosti                                   | Zakázáno                   |
| -------------- | ------------------------------------------------------ | ------------------------------ | ----------------------------------------------------- | -------------------------- |
| far            | Řídnoucí městský pás; geometrie vzdálené dálnice       | 0–1 dálniční úsek/region       | Souvislá cesta za areálem                             | Dálnice jako nový biom     |
| back 0,30–0,80 | NEW: sklad/pila 180 × 90 u; `back.crates`, `back.logs` | 1 provoz, 3–6 skupin materiálu | Uzavřený dvůr a obslužná cesta                        | Bedny na veřejné silnici   |
| back 0,25–0,65 | NEW: malé depo 200 × 100 u nebo jeřáb 140 × 100 u      | 0–1 alternativa                | Depo u existující vedlejší koleje; jeřáb uvnitř dvora | Nová železniční síť        |
| bank           | Servisní pás                                           | Souvislý                       | Mimo dosah manipulace                                 | Náklad nad hráčovým vlakem |
| near 0,40–0,85 | `back.logs`, `near.bush`; nákladní auto z forest       | 2–4 skupiny, 0–1 auto          | Dřevo na suché ploše, auto na cestě                   | Volně padající klády       |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                                            | Reakce na vlak; cooldown                       |
| ----- | ----------------------------------------------------------------------------- | ---------------------------------------------- |
| TO-01 | Auto projede ulicí, člověk zalévá záhon po 20–40 s                            | Jeden člověk zamává; 18 s                      |
| TO-02 | Lehký provoz, lidé po krátkých chodníkových drahách                           | Nejvýše jeden chodec zamává; 20 s              |
| TO-03 | Procházka, drobný pohyb korun                                                 | Pes zvedne hlavu nebo ptáci vzlétnou; 18 s     |
| TO-04 | Podle ST-03                                                                   | Výpravčí podle společného staničního kontraktu |
| TO-05 | Kláda se pomalu posune dovnitř pily nebo jeřáb přenese bednu mezi dvěma místy | Pracovník zamává; 20 s                         |

Sklad a pila jsou varianty, neskládají se povinně do jednoho přeplněného areálu.
Řezání není zobrazené jako odkrytý nebezpečný mechanismus; manipulace nikdy nečeká na náklad hráče.

## Profil, sezóny a zvuky

Cíl koleje v jádru je −120 až +120 u, absolutní sklon 0–0,03; nádraží leží na skutečné rovině.
Jaro: mladé listy, kvetoucí park a zahrádky; léto: plné koruny a otevřené dvory.
Podzim: park a uliční listnáče mění kresbu, listí zůstává u jejich zdrojů.
Zima: sníh na střechách, parcích a okrajích cest, tichý provoz a ojedinělý kouř.
Použít ptáky a vítr v parku; nové audio: tlumené městské okolí, autobus a tichý motor nákladního auta.
Pila může mít vzdálený měkký pracovní šum, bez ostré pily, sirén a couvacích alarmů.

## Nové kresby

NEW: městský pás 1 024 × 180 u; střechy, menší bloky a česká silueta ve třech hustotách.
NEW: řadový dům 120 × 100 u, bytový dům 180 × 150 u, panelový dům 220 × 180 u; střídmé fasády.
NEW: sklad/pila 180 × 90 u; společný stavební základ s odlišnými vraty a pracovním okolím.
NEW: malé depo 200 × 100 u a dvorní jeřáb 140 × 100 u s odděleným ramenem.
Autobus, nákladní auto, ploty, lidé a sezónní střechy se sdílejí s příslušnými katalogy.
Žádná varianta nepřidává reklamní značky, lidské obličeje vozidel ani povinnou logistiku.

## Implementační řez D-024

Region začíná a končí předměstím TO-01. Vnitřní dvouchunkové obrazy střídají ulici TO-02, park TO-03 a obslužný areál TO-05; stanice ST-03 má infrastrukturní přednost. Rodinné domy a řadovky mají přístupy ze společné ulice, bytové a panelové domy stojí pouze za tratí. Areál má právě sklad nebo pilu a obslužnou cestu; klády a bedny zůstávají v dvoře. Dálniční alternativa TO-06 zůstává dopravní lince, jeřáb ani depo nejsou součástí tohoto řezu. Městský horizont používá střídmý český pás, prostorové přechody regionu zůstávají podle D-023.

## Oprava kompozice settlements-2

TO-02 má souvislou nízkou pěší cestu a jednotlivce mimo chráněný pás. Na začátku a konci městského regionu se přední pěšina během posledních 160 u zúží do louky a končí v bodě, ne useknutá na hranici. Stejně končí před pracovním dvorem TO-05, který pěšinu nemá, a před oběma břehy řeky. Nízká servisní cesta stanice se na koncích nástupiště také zúží. Ulice přejde potok po malém silničním mostě s kamennou mostovkou, pokračujícím asfaltem a nízkým zábradlím; na březích se neusekne. TO-04 sdílí nízkou servisní cestu stanice. TO-05 rezervuje suchý pracovní dvůr, který obsahuje sklad/pilu i celý obal uloženého materiálu; přístup je veden kolem ostatních parcel. Zahrady rodinných domů patří k jejich parcelám; přední zahrádky sdílejí pěšinu a připojené branky. V osadě vlastní ulici a přístupy settlements; paralelní silniční linka se na hranici napojí nebo ustoupí do terénu.

### Sezónní život D-027

Sezónní části a činnosti používají společný [kontrakt D-027](README.md#sezónní-vzhled-a-život--d-027)
a řádky SEA-01 až SEA-08 v [akceptaci](acceptance.md). Jedna váha podle x řídí
koruny, podklad i intenzitu částic; stání pouze nechává pokračovat animaci.
