# 05 — Scénky, doprava a dotykové reakce

[Zpět na rozcestník](../README.md)

## 1. Společná pravidla

Vše se odehrává ve stejném herním pohledu. Interakce nedává skóre, nepřepíná obrazovku, nevynucuje zastavení a není podmínkou pokračování. Scénky nezkoumají, zda vlak veze správný druh nákladu. Souprava bez vagonků má stejně zajímavý svět.

Zásah objektu je úmyslně prostý: dotyk spustí krátkou animaci nebo zvuk. Objekt reaguje jednou na jeden nový `pointerdown`; další dotyk respektuje jeho cooldown. Vlak přitom dál následuje řízení z dokumentu 02.

Povolit nejvýše jednu výraznou scénickou akci v popředí a několik malých reakcí. Nekopit frontu deseti zvuků, které se začnou přehrávat až po odjezdu zvířete z obrazovky. Nevýznamnou opožděnou reakci raději zahodit.

## 2. Jednotný model interakce

```ts
type InteractionState = 'idle' | 'playing' | 'cooldown' | 'consumed';
interface InteractionRuntime {
  entityId: string;
  state: InteractionState;
  untilTick: number;
  variantIndex: number;
}
```

`idle → playing → cooldown → idle` pro opakovatelná zvířata a objekty. Balónek přechází `idle → playing → consumed` a v daném chunku se sám znovu neobjeví. Bublinky vznikající z mašinky jsou samostatné krátkodobé částice; neukládají se jako trvalé entity.

Během `playing` další dotyk animaci nevrací na první frame. Lze přidat drobné škubnutí ucha nebo jemnou vizuální odpověď, ale nesmí to restartovat hlavní zvuk. Cooldown běží podle simulačního času. Výchozí cooldown běžného zvířete je 1.5 s po reakci; konkrétní délky jsou data katalogu.

Hit oblasti jsou větší než malé obrázky. Při překryvu vyhrává vrchní viditelná interaktivní vrstva, pak bližší střed. Objekty za plnou překážkou, pod UI nebo mimo renderovací výřez nejsou aktivní dotykové cíle.

## 3. Nádraží bez povinné zastávky

Stanice má ploché nástupiště, budovu, světla a několik lidí. Při přiblížení nebo houkání může výpravčí zamávat. Jízda se nikdy automaticky nezmění.

### Zastavení hráčem

Pokud je střed lokomotivy v intervalu nástupiště a rychlost zůstane pod 4 u/s alespoň 0.5 s, stanice může spustit jednu klidnou scénku: výpravčí zvedne plácačku, lidé přijdou blíž, zamávají nebo se otevřou dveře budovy. Není nutné zastavit přesně u značky.

V1 neukazuje cestující vstupující do libovolného nákladního vagónu. Scénka se odehraje na nástupišti nezávisle na vozech. Animace dveří osobních vagonků je místní reakce jejich grafiky, ne důkaz o přepravě cestujících.

Při rozjezdu se lidé plynule vrátí do klidné animace a vlak může ihned odjet. Příliš dlouhý vlak nevyžaduje nástupiště pro všechny vagonky. Po první zastávkové scénce platí pro tutéž stanici cooldown 12 s; opakované přidržování brzdy ji necyklí po půl sekundě.

### Stavy

`IDLE → APPROACH_WAVE → IDLE`, případně `IDLE → STOP_SCENE → COOLDOWN → IDLE`. Žádný stav neuděluje povolení vlaku k odjezdu. Aktivace stanice není podmíněná složením soupravy.

## 4. Přejezdy: věrohodné a bez kolize

Přejezd má definovaný konfliktový interval na obou kolejích, světla, dvě závory a cestu silničních aktérů. Hráčův vlak má vždy přednost. Závory jsou reálný stavový automat, ne dekorace spouštěná až v okamžiku, kdy vlak přejíždí silnici.

### Obsazení

Pro hráče používat **celý interval `[tailS, frontS]`**, nikoli jen polohy vozidel. Mezery mezi vagonky nejsou důvod otevřít závory. U protijedoucího vlaku obdobně min/max jeho celé soupravy na jeho dráze. Přejezd je obsazený, pokud některý interval zasahuje konfliktní zónu rozšířenou o bezpečnostní rezervu.

### Včasné zavření

Výchozí bezpečný předstih je odvozen z maximální rychlosti, ne jen aktuální nulové rychlosti:

```text
Dclose = Vmax * (TclearRoad + Twarning + Tclosing + Tsafety) + distanceMargin
       = 180 * (2.0 + 1.2 + 0.8 + 0.5) + 80
       = 890 u
```

Aktér se může ihned rozjet, proto se detekce nesmí odkládat jen kvůli aktuálně stojícímu vlaku. Přejezd i jeho kolej musí být v logické simulaci dříve, než se čelo vlaku přiblíží na Dclose. Při změně rodičovského rychlostního limitu přepočítat horizont; standardní limit nelze překročit.

### Automat

| Stav       | Co se děje                                                                            | Přechod                                                          |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `OPEN`     | Závory nahoře, auta a kola mohou projet.                                              | Přibližuje se vlak do Dclose.                                    |
| `CLEARING` | Nový silniční vjezd je zablokován; stávající účastník dokončí průjezd, začnou světla. | Konfliktní prostor je prázdný, nejvýše 2 s podle zvolených cest. |
| `WARNING`  | Světla a tiché výstražné zvonění, silnice prázdná.                                    | Uplyne 1.2 s.                                                    |
| `CLOSING`  | Závory se 0.8 s plynule sklápějí.                                                     | Závory dole.                                                     |
| `CLOSED`   | Vlaky projíždějí nebo stojí v blízkosti.                                              | Žádný vlak neobsazuje zónu a žádný se neblíží v Dclose.          |
| `OPENING`  | Závory se zvedají; silnice stále čeká.                                                | Úplně otevřeno, pak vypustit provoz.                             |

Blikání přejezdových světel je lokální klidná signalizace, nikoli celoplošný intenzivní záblesk. V úsporném režimu nelze signalizaci vypnout, jen zjednodušit její kresbu.

Pokud se během otevírání blíží nový vlak, silnice zůstává zablokovaná a závory se vrátí do zavírání. Žádné zrychlené proskočení automobilu před vlakem.

### Silniční provoz a bezpečnostní invariant

Silniční aktér dostane povolení vstoupit do konfliktového prostoru pouze v `OPEN`, není-li predikovaný blízký příjezd vlaku. Cesta skrz konflikt trvá nejvýše TclearRoad; není v ní zastavení ani reakce na dotyk. Během uzavření stojí před stop čárou. Fronta je omezená na šest aut a dvě kola, nové objekty se dál negenerují.

Vždy testovat, že `trainOccupiesConflict && roadActorOccupiesConflict` není pravda. Ve vývojovém buildu porušení vyvolá diagnostiku se seedem a snapshotem. Produkční oprava chybného stavu zabrání dalšímu vjezdu a bezpečně odvede silniční aktér po jeho trase; není dovoleno ukázat náraz. Tato nouzová větev nenahrazuje správné plánování.

Při obnově save, kdy vlak už stojí přes přejezd, inicializovat závory uzavřené **před prvním zobrazeným snímkem** a vytvořit auta jen mimo konflikt. Není nutné dohrávat otevření a zavření, které proběhlo před zavřením aplikace.

Pokud dlouhý vlak stojí přes silnici nebo těsně před ní, auta čekají libovolně dlouho. Hra ho nenutí odjet a žádné auto nejede přes koleje z netrpělivosti.

## 5. Okolní auta, kola a pracovní stroje

Silniční provoz běží po předem definovaných 2D cestách; nepotřebuje obecný pathfinding. Na vesnické cestě jede osobní auto či autobus, na polní cestě traktor, na cyklostezce cyklista. Dotyk může vyvolat krátké zamávání nebo klakson, ale nesmí zastavit aktéra v přejezdové konfliktní zóně.

Traktor na poli může přejet část pole, zastavit mimo kolej a pokračovat. Kombajn může po sobě vizuálně nechat posečený pás jako krátkou lokální animaci; nezavádět persistentní simulaci zemědělství. Žádný silniční aktér nevjede do hlavní koleje mimo ovládaný přejezd.

U běžných zvířat volit cesty kolem lesa, vody či pastviny. Nechodí před vlak přes kolej. Drobní ptáci mohou letět nad ní; nekreslí se srážka s lokomotivou.

## 6. Druhý vlak

Povinná V1 scénka: vlak jede zprava doleva na oddělené souběžné koleji. Má 1–5 vagonků, rychlost 100–160 u/s, jasně jinou hloubkovou vrstvu a nikdy není na hlavní hráčově trase.

Aktivuje se jednou, když se čelo hráče dostane nejvýše 512 u před začátek viditelné vedlejší tratě. Začíná ve skrytém pravém pokračování motivu a plynule z něj vyjíždí. Na levé straně obdobně postupně zajede za připravený překryv/portál; zruší se až po skrytí posledního vozidla. Pokud překryv ještě není v záběru, může vzniknout a zaniknout mimo obrazovku, ale nikdy skokem v otevřené krajině. Celá souprava má po celou dobu existující geometrii včetně skrytých koncových rezerv z dokumentu 04.

Pro směr `d = -1` používat polohy vozů `s[i] = sHead - d * prefixOffset[i]`; vagonky tedy následují za lokomotivou vpravo. Čelo a konec soupravy se pro konfliktové testy převedou na uspořádaný min/max interval. Neobracet znaménko hráčovy rychlosti ani sdílenou hlavní kolej. Vykreslení čel a sprite flip řeší samostatně renderer.

Když dítě před scénkou dlouho stojí, může druhý vlak projet dříve, než k němu dojede. To není prohra ani důvod vlak teleportovat zpět; další souběhy se objeví později. NPC nepotřebuje zastavovat společně s hráčem.

Při setkání může jednou zahoukat a rozsvítit světla. Hráčova píšťala může vyvolat odpověď s cooldownem, ale nesmí vytvořit nekonečný dialog dvou píšťal. NPC odpověď sama další odpověď nespouští.

Předjíždění, třetí kolej a rozvětvená železniční síť jsou pozdější rozšíření. Již první protijedoucí vlak splní požadavek živého souběžného provozu.

## 7. Katalog základních reakcí

| Objekt                  | Spouštěč                                | Reakce                                            | Omezení                                   |
| ----------------------- | --------------------------------------- | ------------------------------------------------- | ----------------------------------------- |
| Kráva, ovce, pes, kočka | Dotyk                                   | Pohyb hlavy, zvuk, ocas.                          | Jeden zvuk a krátký cooldown.             |
| Liška / srnka v křoví   | Dotyk nebo klidné periodické vykouknutí | Vykoukne, krátce popojde po bezpečné cestě.       | Neutíká do kolejí.                        |
| Veverka                 | Dotyk                                   | Vyšplhá na kmen a sedne si na větev.              | Animaci nelze opakovaným tapem resetovat. |
| Datel                   | Dotyk                                   | Několik ťuknutí do kmene.                         | Ne neomezená smyčka zvuku.                |
| Kachna s káčaty         | Dotyk                                   | Zakváká a popoplave.                              | Zůstává na vodě.                          |
| Žába                    | Dotyk                                   | Skočí do vody s drobným šplouchnutím.             | Nevelká, přívětivá reakce.                |
| Ryba                    | Dotyk vody v označené oblasti           | Krátce vyskočí a vrátí se.                        | Není nutná přesnost na malý obrázek.      |
| Strom / keř             | Dotyk                                   | Zahoupání větví, pár listů; někdy vykoukne zvíře. | Jen připravené interaktivní varianty.     |
| Balónek                 | Dotyk                                   | Prasknutí a krátká barevná reakce.                | Jednorázový, měkký zvuk, bez bodů.        |
| Větrník / mlýn          | Dotyk                                   | Krátké zrychlení otáčení.                         | Nepřeruší vlak.                           |
| Výpravčí / člověk       | Dotyk nebo hráčova píšťala              | Zamávání.                                         | Ne všichni lidé na scéně najednou.        |
| Loď                     | Dotyk                                   | Krátké zahoukání a zamávání.                      | Nekoliduje s mostním pilířem.             |
| Maják                   | Dotyk                                   | Pomalé zesílení světla a otočení kuželu.          | Žádný ostrý záblesk.                      |
| Stodola                 | Dotyk vrat                              | Vrata se otevřou, vykoukne zvíře.                 | Není to nová obrazovka.                   |
| Jeřáb v areálu          | Dotyk                                   | Přesune bednu mezi dvěma místy v areálu.          | Nikdy nečeká na správný vagón.            |

## 8. Píšťala a scénická odezva

Hráčova píšťala je dostupná za jízdy i při stání. Jeden stisk přehraje jednu krátkou verzi zvuku podle lokomotivy. Držení nespouští nekonečně další zvuky.

Může aktivovat nanejvýš jednu výraznější odpověď v dosahu 800 u: druhý vlak, výpravčí, člověk nebo pes. Priority: viditelný druhý vlak → viditelný výpravčí → jiný blízký aktér. Není-li vhodný příjemce, zazní jen píšťala. NPC reakce mají vlastní cooldown alespoň 8 s.

Odezva není garantovaná při každém stisku. Píšťala nesmí ovlivnit závory, rozsvítit návěst k povolení jízdy ani odblokovat trať. Hráč nepotřebuje znát železniční pravidla.

## 9. Náhodná překvapení bez zahlcení

Nad rámec běžného života mohou být horkovzdušný balón, světlušky, hejno ptáků, vlak s auty nebo malá slavnost u nádraží. V1 požaduje alespoň tři takové motivy. Výrazné překvapení se objeví nejvýše jednou v jednom biomovém bloku a není v konfliktu s dominantní právě probíhající scénou.

Po stání několik minut se nemá nahromadit fronta všech „zmeškaných“ akcí. Časová okna, která uplynula mimo výřez, se nepřehrávají dodatečně. Nic z toho není sběratelský úkol a neukazuje se ukazatel toho, co dítě propáslo.

## 10. Ukládání a úklid

Uložit jen relevantní runtime záznamy aktuálně zachovaných scén: stav balónků, cooldowny, stavy aktivních aktérů a ovladačů přejezdů. Zvukové přehrávače, DOM elementy a částice do save nepatří.

Dlouho neviditelná zvířata lze přestat animovat; jejich počáteční layout zůstává reprodukovatelný. Bezpečnostní automat přejezdu pod dlouhou soupravou se naopak nesmí vypnout podle viditelnosti kamery.
