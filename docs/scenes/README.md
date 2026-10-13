# Textový katalog scén světa V2

Tento katalog určuje, **jak má krajina vypadat a co se v ní děje**, ještě před implementací generátoru.
Číselné hustoty, hloubky, časování a krajinné profily níže jsou návrhové cíle, nikoli tvrzení o dokončené implementaci.
Platí společně se specifikacemi [světa](../../vlacek-predavaci-balicek/04_PROCEDURALNI_SVET.md), [interakcí](../../vlacek-predavaci-balicek/05_SCENKY_A_INTERAKCE.md), [obsahu](../../vlacek-predavaci-balicek/06_KATALOG_OBSAHU.md) a [výtvarného směru](../../vlacek-predavaci-balicek/07_VIZUAL_AUDIO_UX.md).
Pro svět V2 platí schválená výjimka: skutečný tunel vlak zakrývá neprůhlednou horninou.

## Soubory a jejich význam

| Soubor                                   | Co vlastní                                         |
| ---------------------------------------- | -------------------------------------------------- |
| [countryside.md](countryside.md)         | Pole, sad, remízek, statek, pastvina a polní cesta |
| [village.md](village.md)                 | Velká vesnice vložená do venkova nebo podhůří      |
| [town.md](town.md)                       | Předměstí, české město, park a průmyslový okraj    |
| [forest.md](forest.md)                   | Lesní okraj, hustý les, paseka, práce a potok      |
| [lakes.md](lakes.md)                     | Rybníkářsko, řeka, mlýn a sladkovodní pláž         |
| [foothills.md](foothills.md)             | Vysočina, podhorské louky, osady a zářezy          |
| [mountains.md](mountains.md)             | Výrazná stoupání, hřebeny a hlubší údolí           |
| [coast.md](coast.md)                     | Souvislé moře, pláž, přístav a pobřežní cesta      |
| [dunes.md](dunes.md)                     | Suché písečné duny s borovicemi a vřesem           |
| [station.md](station.md)                 | Malá zastávka, střední stanice a velké nádraží     |
| [tunnels-bridges.md](tunnels-bridges.md) | Společné kompozice mostů a tunelů                  |
| [acceptance.md](acceptance.md)           | Testovatelné podmínky a obrazové kontroly          |

Krajinné typy jsou `countryside`, `forest`, `lakes`, `foothills`, `mountains`, `coast`, `dunes` a `town`.
Velká vesnice a hustý les jsou místní scény; stanice, mosty a tunely jsou vložené stavby.
Zmínka o stejné stanici v městské scéně nevytváří druhou stanici ani druhého vlastníka.

## Postup: obraz → data → test → generátor

1. Vyber místní scénu a napiš její prostorový obraz včetně klidných míst.
2. Urči její rozsah, povrchy, cesty, rezervace, závislosti a povinné nosné objekty.
3. Přelož tabulku scény do současných dat a kompozičních funkcí; nezakládej nový obecný framework.
4. Napiš test pojmenovaného výsledku z `acceptance.md`, potom implementuj minimální generování.
5. Ověř stejné místo obrazem, pohybem i stáním s nejdelší podporovanou soupravou.

Každá scéna má stabilní ID, světový interval, vlastníka, hostitelskou krajinu a sezónní preset.
Objekt nese art key, vrstvu, hloubku, rozměry, půdorys, případnou dráhu, závislosti a identitu.
Aktivita přidává povolený pohybový obal, fázi, spouštěč a cooldown; zvuk odkazuje na její skutečný zdroj.
Hustota v tabulkách znamená počet **za celou místní scénu**, není-li výslovně uvedeno `/1 024 u`.
Nosný objekt je součást definice scény; tráva, kamínky a další výplň mohou být při nedostatku místa vynechány.

Existující názvy v backticích jsou klíče z `src/content/worldArt.ts`.
Označení **NEW** znamená potřebnou novou kresbu nebo oddělený pohyblivý díl, nikoli již existující asset.
Rozměr `šířka × výška u` je výchozí velikost kresby před hloubkovým měřítkem.
Předpona klíče `back.` sama neurčuje vrstvu: například `back.tractor` lze použít v bezpečné zóně `near`.
Plošné pole, voda, silnice a terén jsou označené jako **geometrie**; nepotřebují obří natažený sprite.

## Obrazové vrstvy

| Vrstva              | Význam a kresba                                                        |
| ------------------- | ---------------------------------------------------------------------- |
| Obloha              | Barevné pozadí a `cloud.a/b/c`; řídké ptactvo, žádné výrazné blikání   |
| Vzdálené kopce      | Tlumené velké tvary, pomalá paralaxa, bez samostatných interakcí       |
| Horizont            | Souvislá silueta lesa, města nebo moře; nesmí končit na hranici chunku |
| Střední plán        | Seskupené lesy, pole a střechy; několik čitelných dominant             |
| `back`, hloubka 0–1 | Skutečné objekty za tratí; 0 u koleje, 1 směrem k horizontu            |
| `bank`              | Kolejové těleso, násep, zářez a odvodnění; prostor dopravy má přednost |
| Vlak                | Kolej, vozidla a potřebné elektrické vedení                            |
| `near`, hloubka 0–1 | Před vlakem; 0 u paty náspu, 1 nejblíže divákovi                       |
| UI                  | Ovládání zůstává čitelné a nedostává pod sebe interaktivní cíle        |

`far` v tabulkách zahrnuje vzdálené kopce, horizont a seskupený střední plán.
Pro `back` současná projekce používá hloubkový rozsah 220 u a měřítko `1 − 0,35 × depth`.
Pro `near` používá rozsah 440 u od paty náspu směrem dolů a měřítko `1 + 0,5 × depth`.
Hodnoty nejsou metry ani procenta výšky obrazovky; konečnou polohu určuje sdílená projekce.

## Čitelnost a popředí

Chráněný pás zahrnuje obálku celé soupravy, kol, nákladu a sběrače nad skutečným profilem koleje.
Kontroluje se přes celou šířku objektu, včetně animace, náklonu, otočení a částic; nestačí jeho kotevní bod.
Výchozí výšková podmínka popředí je vykreslená výška nejvýše `26 + 440 × depth` u.
Tato podmínka je předběžný filtr; na svahu rozhoduje úplný test proti chráněnému pásu.

Před vlak patří nízké plodiny, traktory, balíky, klády, keře, mladé stromky a úplné ploty.
Vyšší stroje se posouvají hlouběji do `near`; nemají se svévolně zmenšovat na nerozpoznatelné ikony.
Pokud nosný objekt nevychází v dostupném výřezu, upraví se kompozice v povolené zóně.

**Les před vlakem tvoří nízká silueta lesního okraje a jednotlivé mladé stromky.**
Dospělé vysoké stromy patří do `back`; nepoužíváme kmeny přes vlak ani kamerou uříznuté koruny.
Tato volba zůstává stabilní při změně rozlišení, svahu i vystředění kamery.
Nízká silueta může pokračovat pod spodní okraj obrazovky, její horní obrys však vždy zůstává pod vlakem.

Mostní zábradlí a vybavení nástupiště se skládají tak, aby nepřekryly těla vozidel.
Tunel je výslovná výjimka: zakrývá jen příslušnou kolej a skutečně zakryté části vozidel i částic.
Kamera rámuje celou soupravu přibližně uprostřed herní plochy s výhledem před čelem i za koncem.
Přesné zarámování musí ověřit příslušná implementace; scénérie nesmí vyžadovat konkrétní screenshotové rozlišení.

## Regiony, střídání a přechody

Chunk má 1 024 u, geometrický blok 8 192 u a region 3–7 celých bloků, tedy 24 576–57 344 u.
Běžná scéna zabírá 512–4 096 u; velká vesnice je celek o 3 072–6 144 u.
Pořadí scén je plánované ze seedu, nikoli znovu losované pro každý zobrazený chunk.
Stejná scéna bezprostředně nenásleduje sama po sobě; mezi výraznými motivy je alespoň 512 u klidnějšího obrazu.
„Klidnější“ znamená bez další dominantní činnosti, nikoli prázdnou nebo nehybnou krajinu.

Přechod regionů zabírá celkem 6 144–8 192 u kolem společné hranice.
Společný prostorový postup mění kopce, horizont, střední plán, půdu, vegetaci a hustotu staveb.
Domy, stroje a stromy zůstávají neprůhledné; jejich přípustnost určuje celá místní podzóna.
Jádro regionu je jeho část mimo přechodové intervaly; garance výskytu se posuzují tam, pokud není uvedeno jinak.
Sezóna zůstává stabilní přibližně přes 2–3 vhodné regiony, nikoli podle skutečného kalendáře nebo délky stání.

Sloty staveb zůstávají zachované: stanice 1, přejezd 3, most 4, tunel 6.
Dlouhá stavba obsadí potřebný interval jednoho bloku a nahradí soupeřící motivy; další stavba se přes ni nevylosuje.
Povinné demonstrační prvky počátečních bloků mají přednost před běžnou četností scén.

## Vztahy, pohyb a zvuk

Nejprve vzniká podklad a přístup: voda → břeh → mlýn, cesta → dvůr → domy, pastvina → napajedlo → krávy.
Celý půdorys a pohybový obal musí zůstat na přípustném povrchu a mimo cizí rezervace.
Volitelný objekt má nejvýše osm pokusů o umístění; neplatná složená scéna se nahradí platnou kompozicí.
Povinné regionální motivy se rezervují před výplní; jejich tiché vynechání není splnění akceptace.

Aktivity používají simulační čas: při stání pokračují, při pauze stojí a po návratu nedohánějí zmeškané události.
Instance mají fáze odvozené ze své identity; několik krav ani strojů nezačíná současně.
Průjezdová reakce se spouští při prvním přiblížení viditelného vlaku do 400 u podél x.
Cooldown běží od konce reakce; opakování vyžaduje opuštění dosahu alespoň o 96 u a nové přiblížení.
Píšťala používá existující dosah 800 u, priority a cooldown alespoň 8 s; neodpovídá celý obraz současně.
Běžný dotyk zvířete zachovává vlastní reakci a cooldown 1,5 s; nerestartuje probíhající animaci.
Žádný pozemní aktér nevstupuje do koleje mimo řízený přejezd a žádná scénka nepodmiňuje další jízdu.

V jednom výřezu běží nejvýše jedna výrazná scénická akce; ostatní život je drobný a klidný.
Počáteční limity jsou 80 samostatných dekorací/chunk, z toho 48 `near`, a 32/12 viditelných animovaných objektů standard/low.
Hustotu tvoří zejména skupinová grafika; její členění nesmí sloužit k obcházení měření skutečných nákladů.
Lokálních zdrojů je nejvýše 16/8; audio současně dodržuje osm hlasů, tři smyčky a pět jednorázových zvuků.
Nové zvuky uvedené v souborech jsou požadavky na audio, nikoli tvrzení, že již existují.

## Společné výtvarné doplnění

**NEW:** úplný plot: panel přibližně 64 × 22 u, sloupek 8 × 26 u, branka 48 × 26 u; dřevo navazuje bez volných konců.
**NEW:** sezónní varianty používaných listnáčů v původních rozměrech; jarní květ, podzimní koruny a holé zimní větve.
**NEW:** sněhové kryty střech v modulech přibližně 64/128 × 20 u s kotevními body konkrétních budov.
**NEW:** listová půda 100 × 15 u a jemný prach 16 × 12 u; omezené, měkké kresby bez zakrývání vlaku.
Vše má podobu současné ilustrované knihy: přirozené materiály, měkký stín, střídmé kontury a žádné obličeje na strojích.
