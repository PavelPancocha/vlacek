# 03 — Souprava, pohyb, trať a kamera

[Zpět na rozcestník](../README.md)

## 1. Jednotky a souřadnice

Používat návrhové světové jednotky `u`; nejde o metry ani reálné km/h. Ve výchozím návrhovém výřezu 1280 × 720 odpovídá 1 u přibližně jednomu návrhovému pixelu. Vykreslení mění měřítko podle dostupného výřezu, nikoli hodnoty simulace.

Doménový svět má osu `x` doprava, `y` nahoru. Phaser má obrazovou osu `y` dolů: převod provádí jen renderovací vrstva. Globální trať je monotónní v `x`, bez smyček a odbočení hráčova vlaku. Délková souřadnice `s` se měří **po křivce koleje**, nikoli jen po ose x.

## 2. Kinematika bez fyzikálního enginu

Nepoužívat rigid-body fyziku, pružinová spřáhla ani výpočet tažné síly podle hmotnosti. Vlak je geometricky vedená souprava. Neexistuje prokluz, vykolejení, zlomení spřáhla ani neschopnost vyjet kopec.

Základní hodnoty (dokument 14 §6): maximální rychlost 480 u/s, rozjezd 160 u/s², dojezdové zpomalení 96 u/s², brzda 480 u/s². Rozjezd na plnou rychlost trvá 3 s, prostý dojezd 5 s a aktivní brzda 1 s. Na obrazovce to odpovídá asi 0,22 šířky za sekundu na každém zařízení, protože měřítko vychází z nejdelší soupravy ([D-008](../docs/decisions/008-whole-train-in-view.md)); obrazovku vlak přejede asi za 4,6 s. Verze 0.1 měla 180 u/s při větším měřítku (0,14 šířky za sekundu na 16:9). Hodnoty jsou laditelné; jejich zamýšlený pocit hlídá test `gameConfig` (0,18–0,30 šířky/s, rozjezd 2–4 s, dojezd 4–7 s).

### Aktualizace rychlosti

```text
g = clamp(sklon koleje pod lokomotivou / 0.12, -1, 1)
vTarget = nastavené maximum * (1 - 0.10 * max(g, 0))
aDrive = accelerationUPerSec2 * (1 - 0.25 * g)

THROTTLE: posuň v směrem k vTarget;
          při zrychlování nejvýše aDrive * dt,
          při snižování cílové rychlosti nejvýše coastDecelerationUPerSec2 * dt
COAST:    posuň v směrem k 0 nejvýše coastDecelerationUPerSec2 * dt
BRAKE:    posuň v směrem k 0 nejvýše brakeDecelerationUPerSec2 * dt
```

`moveTowards` nikdy nepřekročí cílovou rychlost. Výsledné `v` omezit na interval `[0, nastavené maximum]`. Hodnoty pod 0.5 u/s nastavit na nulu. Z kopce vlak při puštěném prstu **stále zpomaluje**. Sklon vytváří jen lehký pocit námahy při jízdě, nikoli reálnou gravitaci.

Pozici integrovat trapezoidně: `s += (vOld + vNew) / 2 * dt`. Brzdění během posledního ticku nesmí vytvořit záporný posun. Při přerušení aplikace není dovoleno dopočítat hodiny jízdy z reálného času.

### Časový krok

Doménová simulace běží fixně po `1/60 s`. Render může mít jiné FPS a interpoluje minulý a aktuální stav. Na frame povolit maximálně pět simulačních kroků. Velký časový skok po přerušení vymazat; nevytvářet spirálu dohánění. Pozadí / pauza nepřičítá simulační čas.

Vstupní reducer se vyhodnotí před pohybem. Události tratě se řeší nad intervalem stará–nová poloha, nikoli pouze přesným trefením jednoho bodu. Výkonový limit může snížit počet renderovaných snímků, ne měnit fyzikální konstanty podle FPS.

## 3. Definice vozidla

Každý typ má délku `lengthU` mezi jmenovitými konci spřáhel, polohu předního a zadního podvozku, obrázkový pivot a vlastní vizuální vrstvy. Základní mezera mezi sousedními vozidly je 8 u. Asset musí odpovídat deklarovaným rozměrům; délka nesmí být náhodně odvozena z průhledného okraje PNG.

Pro typ s jednou grafickou nápravou lze používat dva pomocné opěrné body, které určují natočení. U parní lokomotivy se kola a táhla animují podle ujeté vzdálenosti, ne náhodnou rychlostí. U stojícího vlaku se pojezd netočí.

## 4. Poloha jednotlivých vozidel

Nechť `s0` je střed lokomotivy a `Li` délka vozidla i. Vozidlo 0 je lokomotiva.

```text
s[0] = s0
s[i] = s[i-1] - (L[i-1]/2 + mezera + L[i]/2)
frontS = s[0] + L[0]/2
tailS  = s[poslední] - L[poslední]/2
```

Pro každé vozidlo vzorkovat kolej v předním a zadním opěrném bodě:

```text
A = samplePath(s[i] + bogieFrontOffsetU)
B = samplePath(s[i] - bogieRearOffsetU)
angle = atan2(A.y - B.y, A.x - B.x)
```

U symetrických podvozků je střed karoserie střed A/B. Pro asymetrický asset dopočítat pivot z definovaných offsetů, ne předpokládat symetrii. Pro V1 je zjednodušení na symetrické podvozky přípustné a preferované; přesný kontrakt je v dokumentu 08.

Nápravy a případné podvozky se umístí do svých vzorků koleje, karoserie sleduje sečnu. Spřáhlo se vykreslí mezi sousedními konci karoserií. Na jemně zakřivené trati se připouští malá délková odchylka; překryv karoserií ani viditelné odpojení nejsou přípustné. Chybu řešit geometrií a omezením zakřivení, nikoli přidáním fyziky.

Celý vlak nesmí být jediný nakloněný kontejner nebo dlouhý sprite. Na vrcholu kopce musí přední i zadní část soupravy mít různý sklon. Maximální běžná délka vozidla je 220 u; generátor i testy s ní počítají.

## 5. Tabulka délky křivky

Pro každý chunk vytvořit vzorky křivky nejvýše po 8 u v ose x a kumulativní délky segmentů. `samplePath(s)` najde chunk a dvojici sousedních vzorků binárním hledáním a interpoluje polohu i sklon. Odvození profilu a návaznosti je v dokumentu 04.

Vzorky uchovávat pro celý rozsah od konce vlaku po generovaný předstih. Celá souprava je v obraze (dokument 14 §2, [D-008](../docs/decisions/008-whole-train-in-view.md)); kdyby některý vagonek přesto byl mimo výřez, lze vynechat transformace jeho obrázků, nikoli jeho existenci nebo délku soupravy.

Chyba vzorkování do 0.5 u a šev mezi chunky do 0.1 u jsou akceptační cíle. Při potřebě zpřesnění se zjemní LUT, nepřepíše model na pixely obrazovky.

## 6. Dlouhé soupravy a inicializace

Limit je délkový (dokument 14 §2, [D-008](../docs/decisions/008-whole-train-in-view.md)): `train.maxConsistLengthU` (výchozí 1600 u) od čela lokomotivy po konec posledního vagonku včetně spřáhel, spočítaný stejným rozložením jako jízda. V depu lze přidat jen vagonek, který se vejde. Původní limit 100 vagonků neplatí. Výkonový profil nesmí tiše zahodit část vagonků nebo zkrátit vlak; delší souprava ze starší uložené hry zůstane celá v depu a vyjede až po ubrání.

Na nové cestě se hlava umístí do chunku 0. **Před zobrazením** se vygeneruje dostatečná trať i za ní, včetně záporných indexů chunků. Celá souprava existuje od prvního snímku. Nesmí být nejprve vidět vagonky ve vzduchu a později pro ně přibýt koleje.

V depu se simuluje rovná kolej, nikoli celá krajina. Náhled celé soupravy je posuvný. Měřítko jízdy je pro danou obrazovku pevné a vychází z nejdelší povolené soupravy; nemění se podle aktuální délky vlaku.

## 7. Kamera

Od prvního snímku je vidět celá souprava (dokument 14 §2, [D-008](../docs/decisions/008-whole-train-in-view.md)). Nejdelší povolená souprava zabere `camera.trainWidthFraction` (0.72) šířky, za koncem zůstává `camera.rearMarginFraction` (0.06) a čelo krátkého vlaku stojí nejméně na `camera.minFrontFraction` (0.35) šířky. Vodorovné sledování je přesné. Svislé vedení zná výšku koleje pod celou soupravou a vede její střed plynule (`camera.verticalFollowPerSec`) do `camera.bandAnchor` pásu volného od tlačítek v rozích a brzdy; hranice pásu mají přednost, takže vlak nikdy nezajede pod ovládání ani mimo obraz. Výpočet je čistý modul `src/render/cameraFraming.ts` s jednotkovými testy.

Žádné třesení při houkání či průjezdu mostem. Žádné automatické zoomování při přidávání vagonků. Objekty musí být rozpoznatelné při běžném měřítku. Na širokém displeji je vlak větší a zabírá stejný podíl šířky; na užším (4:3) je menší, ale celý.

Za jízdy nejsou gesta kamery. To je vědomý rozdíl proti dřívějšímu návrhu: levé gesto je brzda a běžný dotyk je plyn. Celou soupravu dítě vidí v depu.

## 8. Tunely a mosty

### Tunel

Tunel je souvislý úsek koleje s portály a několika vrstvami. Vlak zůstává vidět v ilustrovaném průřezu či odhalené boční části, přirozeně ztmavený. Portálové pilíře mohou postupně překrýt část karoserie. Přední část nesmí zmizet nebo zesvětlat současně s posledním vagónkem.

Stav „uvnitř tunelu“ se vyhodnocuje podle vlastní polohy každého vozidla. Osvětlení a zvuk lokomotivy podle její polohy. Není potřeba drahá stencil maska přes celou soupravu: preferovat připravené vrstvy, jednoduché překryvy a stejné řešení v Canvas fallbacku.

### Most

Kolej má souvislý průběh, mostní konstrukce ho podpírá. Voda a údolí jsou pod tratí. Sloupy a zábradlí patří do různých vrstev, aby mohl vlak projet uvěřitelně mezi nimi. Nebudovat fyzikální pružnost mostu. Mostní stín není důležitější než čitelný vlak.

## 9. Elektrifikace

Při vytvoření jízdy se stanoví `electrified = locomotive.power === 'electric'`. Hodnota platí pro celou cestu a **všechny zachované i nově generované chunky**. Výměna lokomotivy zahajuje novou cestu, takže se nemusí za jízdy přepínat infrastruktura.

Vedení má pravidelný rozestup podpěr, který respektuje společnou globální fázi, nikoli začíná znovu v každém chunku. Ve stanici lze použít portálové podpěry, na mostě konzoly a v tunelu zavěšené vedení u stropu. Vedení není placený upgrade a nikdy nedojde energie.

Drát sleduje výšku koleje s konstantní přibližnou výškou kontaktu. Pantograf má jednoduchou animaci a dosáhne na drát i na mírném zlomu sklonu. Rozdíl sklonu lokomotivy a lokálního vedení řešit omezeným přizpůsobením délky pantografu. Ve vzorkovacím bodě kontaktu nesmí viditelně končit pod drátem.

Výchozí rozteč běžných podpěr je 256 u a kontakt vedení 160 u nad kolejí. Konkrétní konzoly a tunelové závěsy se přizpůsobí infrastruktuře; výška kontaktu u lokomotivy zůstává konzistentní. Tyto hodnoty patří do společné konfigurace, ne do každého assetu zvlášť.

Parní, naftové a fantazijní lokomotivy vedení ve V1 automaticky nedostávají. Na jejich druhé koleji proto generovat parní či naftový protijedoucí vlak. V elektrifikované jízdě může být elektrifikovaná i souběžná trať. Geometrie ani seed krajiny se změnou pohonu jinak nemění.

Implementace ([D-016](../docs/decisions/016-electric-locomotive-and-catenary.md)):

- Jízda za `electric_retro` je elektrifikovaná celá, i po obnově ze save.
- Stožáry stojí v globální fázi po 256 u. Stožár, který by padl na silnici přejezdu, se posune 48 u vedle ní.
- Drát vede rovně mezi stožáry, u každého 160 u nad kolejí. Od této výšky se odchyluje nejvýš o 3,2 u.
- Pantograf natahuje ramena k drátu v bodě dotyku, v mezích 0,07–1,6 násobku kresby. V depu leží sklopený.
- Portálové podpěry, mostní konzoly a tunelové závěsy zatím chybějí.

## 10. Nekonečná jízda bez ztráty přesnosti

Trvalá identita polohy je `chunkIndex + offset po oblouku v daném chunku`. Pro běžnou simulaci používat lokální rozsah s a renderovací origin poblíž vlaku. Při překročení 16 384 u lokálního posunu provést konzistentní rebase všech lokálních souřadnic; seed ani indexy chunků se nemění.

Neukládat pouze absolutní počet pixelů od začátku. Částice, kamera, NPC, mosty i interakční hit oblasti musí posunout origin společně; nesmí při rebase vzniknout snímek se starými hitboxy a novými obrázky. Převod do lokálního renderu je jednodušší než mutování každého objektu: preferovat uchování identity chunku a lokálních souřadnic.

Extrémní číselný overflow `chunkIndex` ošetřit validací save; běžná dlouhá jízda nesmí narazit na konec předem vytvořené mapy. Praktickou nekonečnost potvrzuje dlouhý automatický test streamingu, nikoli přídavné jméno v UI.
