# D-035 — Plynulé omezení rytmu parních rázů

Datum: 2026-10-20. Stav: přijato; poslech na zařízení **NEOVĚŘENO**.
Upřesňuje zvuk páry v [D-022](022-recorded-sounds.md); kouř podle
[D-014](014-particles-and-small-animations.md) se nemění.

## Dodatek 2026-10-21 — strop 4 rázy/s (steam-ceiling-1)

Majitel po poslechu živého buildu `0.1.0+0848f72` (240 u/s, koleno 2 rázy/s,
strop 3 rázy/s, délka při plné rychlosti 0,5 s) odpověděl **„Now too slow“**
na nabídku zvýšit strop na 4 rázy/s při nezměněné rychlosti vlaku.
Aktuálně platí `CHUFF_KNEE_PER_SEC = 2`, `CHUFF_CEILING_PER_SEC = 4`
a `CHUFF_MAX_OVERLAP = 1.5`. Toto nahrazuje původní zvukové hodnoty D-036
níže; pohyb zůstává 240 u/s a 80/48/240 u/s².

Pro vzorec v historické části tedy platí K = 2, M = 4, F = 1,5.
Nad kolenem je `f = 1 + 0,5 × (r − 2) / 2` a délka `min(0,58, f/r)`;
už není konstantní. Při 240 u/s vychází pro `steam_local`
`b = 10,185916357881302/s`, `r = 3,9666204218414993/s`,
délka `0,37605188972628634 s`; pro `steam_express`
`b = 8,041512914116817/s`, `r = 3,9024713674098033/s`,
délka `0,37812393812177186 s`. Asymptotická délka je 0,375 s.
Kolena zůstávají **47,123890 / 59,690260 u/s**; pod nimi se časování,
délka i přírůstek fáze nemění. Při stání není ráz ani přírůstek fáze.
Tabulka uvádí četnost křivky a délku, nikoli celé události v krátkém okně.

| Rychlost u/s | `steam_local` rázů/s | Délka ms | `steam_express` rázů/s | Délka ms |
| ------------ | -------------------- | -------- | ---------------------- | -------- |
| 0            | 0,000000             | —        | 0,000000               | —        |
| 30           | 1,273240             | 580,000  | 1,005189               | 580,000  |
| 47           | 1,994742             | 501,318  | 1,574796               | 580,000  |
| 60           | 2,478179             | 451,761  | 2,010351               | 498,713  |
| 100          | 3,348787             | 399,308  | 2,982008               | 417,672  |
| 150          | 3,774616             | 382,464  | 3,559492               | 390,470  |
| 200          | 3,921995             | 377,486  | 3,809382               | 381,255  |
| 240          | 3,966620             | 376,052  | 3,902471               | 378,124  |

`AudioDirector.test.ts` ověřuje 10 s při configovém limitu (240 u/s),
pásmo 3,9–4 rázy/s a délku odvozenou z K/M/F a rychlosti. Zachovává
pomalý rytmus po snímcích, kolena, hladkou monotónní křivku se směrnicí
nejvýše 1 do 600 u/s, přenos fáze a zahození celých doháněných taktů.
Přesné fáze se přepočítaly podle nové křivky: první plný ráz malé parní
při 60 FPS přichází v 16. snímku; primovaný start 40 u/s při +80 u/s²
má po počátečním rázu další požadavky ve snímcích 26 a 45, bez odkladu.
Rampy 0/40 → 240 → 0, +80 a −48/−80/−240 u/s², oba poloměry a 30/60 FPS
stále používají skutečný manager: žádný zahozený ráz, nejvýše dva živé
rázy a 11 zdrojů, zachovaná požadovaná délka a odklad nejvýše 10,0011 ms.
Přijetí čekajícího rázu, 10ms rampa i cleanup zůstávají podle D-022.

Nemění se train config, nahrávka, gain, obálka, kouř, tunelový filtr,
limity zdrojů, diesel ani elektrika. Save, katalog a generátor zůstávají
beze změny, migrace není potřeba. Nový poslech na fyzickém tabletu/Tesle
včetně konkrétního zařízení a firmwaru: **NEOVĚŘENO**.

## Historická změna 2026-10-21 — původní pomalejší vlak a pára (D-036)

Po poslechu předchozího buildu majitel zvolil poloviční rychlost vlaku i rytmus
páry; důvod a pohybové konstanty vlastní [D-036](036-slower-train.md).
Původně platilo `CHUFF_KNEE_PER_SEC = 2`, `CHUFF_CEILING_PER_SEC = 3`
a nezměněné `CHUFF_MAX_OVERLAP = 1.5`. Vzorec křivky a přenos fáze zůstávají.
Koleno je **47,123890 u/s** pro `steam_local` a **59,690260 u/s** pro
`steam_express`. Pod kolenem zůstává přesně jeden ráz na takt kola;
nad kolenem je `f/r = 0,5 s`, tedy pod délkovým stropem 0,58 s.
Při stání žádný ráz nevzniká.

| Rychlost u/s | `steam_local` rázů/s | Délka ms | `steam_express` rázů/s | Délka ms |
| ------------ | -------------------- | -------- | ---------------------- | -------- |
| 0            | 0,000000             | —        | 0,000000               | —        |
| 30           | 1,273240             | 580,000  | 1,005189               | 580,000  |
| 47           | 1,994742             | 501,318  | 1,574796               | 580,000  |
| 60           | 2,421015             | 500,000  | 2,010325               | 500,000  |
| 100          | 2,893980             | 500,000  | 2,740923               | 500,000  |
| 150          | 2,987301             | 500,000  | 2,951488               | 500,000  |
| 200          | 2,998479             | 500,000  | 2,990916               | 500,000  |
| 240          | 2,999721             | 500,000  | 2,997622               | 500,000  |

Tehdejší testy v `AudioDirector.test.ts` ověřovaly 10 s při limitu z configu
(240 u/s): obě lokomotivy 2,9–3 rázů/s a každý ráz 0,5 s. Přesný původní
rytmus a délka se kontrolují při 30 u/s po každém snímku. Rampy 0/40 →
240 → 0 při +80 u/s² a dojezdu −48, zpomalení −80 i brzdě −240 u/s²,
30/60 FPS, oba poloměry používají skutečný `AudioManager`: žádný požadavek
se nezahodí, žijí nejvýše dva rázy, celkem nejvýše 11 zdrojů. Každý
přehraný požadavek zachová délku a čeká nejvýše 10,0011 ms při modelovaném
`ended` o 1 µs po konci. Nové rampy nemusí vyvolat stejný počet odkladů
jako historický protipříklad; samotné čekání, 10ms rampa, náhrada a cleanup
zůstávají chráněné regresními testy manageru podle D-022/D-035.
Přechod fáze se tehdy ověřoval přes 40 → 55 → 40 a následně 30 u/s,
se zrychlením/zpomalením 5 u/s²; přesná posloupnost snímků se přepočítala
podle nové křivky. Spojitost a monotónnost zůstávají testované do 600 u/s.
Poslech a pocit z jízdy na fyzických zařízeních: **NEOVĚŘENO**.

## Historický kontrakt 2026-10-20 (před D-036)

Následující důvody, konstanty, tabulky a výsledky zachycují původní D-035
pro 480 u/s a koleno/strop 4/6 rázů/s. Aktuální číselné hodnoty a testy
nahrazuje dodatek výše; pravidlo přijetí čekajícího rázu zůstává v platnosti.

## Důvod

Majitel při hraní buildu `0.1.0+3961229` na Android tabletu uvedl:

> "fix sound for steam locomotives. It goes from nice "šššh šššh šh" to "trrr" -> eaither it cannot go that fast or it needs different sound for that"

Volíme první možnost: rytmus páry nesmí tak zrychlit. Ponecháváme původní
nahrávku `steam-chuff` a oblíbený zvuk při pomalé jízdě; přesnou shodu časování
a výjimku při zrychlení vymezuje kontrakt níže.
Dosavadní čtyři rázy na otáčku hnacího kola při vysoké rychlosti vytvářely
příliš časté a zároveň příliš krátké zvuky. Jeden ráz trval právě interval
mezi rázy (nejvýše 0,58 s), s měkkými hranami nejvýše 15 ms:

| Lokomotiva      | Poloměr kola u | Rázů/s při 100 u/s | Rázů/s při 480 u/s | Délka při 480 u/s |
| --------------- | -------------- | ------------------ | ------------------ | ----------------- |
| `steam_local`   | 15             | 4,244              | 20,372             | 49,087 ms         |
| `steam_express` | 19             | 3,351              | 16,083             | 62,177 ms         |

## Rozhodnutí

`AudioDirector.ts` vlastní tři sousední konstanty:

- `CHUFF_KNEE_PER_SEC = 4` (K): konec nezměněného rytmu.
- `CHUFF_CEILING_PER_SEC = 6` (M): asymptotický strop rázů/s.
- `CHUFF_MAX_OVERLAP = 1.5` (F): nejvyšší poměr délky rázu k intervalu;
  musí zůstat **striktně pod 2** pro ustálený překryv. Samo F < 2 nezaručuje
  přijetí rázu při zrychlování, kdy mohou ještě žít starší delší rázy.

Pro `intervalU = 2π × wheelRadiusU / 4` a `b = speedUPerSec / intervalU`:

```text
r(b) = b                                             pro b ≤ K
r(b) = K + (M − K) × (1 − exp(−(b − K) / (M − K)))    pro b > K
f = 1                                                pro b ≤ K
f = 1 + (F − 1) × (r − K) / (M − K)                  pro b > K
durationSec = min(0.58, f / r)
phaseIncrement = (distanceU / intervalU) × (r / b)
```

Křivka je spojitá, má v koleni z obou stran směrnici 1, je monotónní
a nepřekročí M. Nad kolenem je derivace podle b
`exp(−(b − K) / (M − K))`, tedy v intervalu (0, 1].
Pod kolenem zůstává výraz pro délku
`min(0.58, intervalU / max(1, speedUPerSec))` beze změny výpočtu.
Pro každou historii, která zůstává na koleni nebo pod ním, je plánované
časování i délka přesně shodná s buildem `3961229`. Po návratu pod koleno
z rychlejší jízdy jsou kadence a délka opět původní, ale přenáší se získaný
fázový posun: absolutní místa rázů už nemusejí souhlasit s `3961229`.
Fázi při přechodu ani při návratu neresetujeme a nezarovnáváme na kola.
Při zvolených K/M/F se nad kolenem výraz zjednoduší na délku **0,25 s**;
poměr překryvu přesto plynule roste z 1 k 1,5. Z kolene délka navazuje
spojitě. Hlasitost zůstává 0,9 pod plynem a 0,35 při dojezdu.

Normalizovaná fáze je stávající zbytek dráhy dělený `intervalU`.
Násobení vstupní dráhy poměrem `r / b` dává přesně uvedený přírůstek fáze;
pod kolenem je tento poměr 1. Nečteme dt, hodiny ani skutečný čas.
Při rychlosti ≤0 nebo dráze ≤0 nevznikne ráz ani přírůstek fáze.
První ráz čeká na celou jednotku fáze; za frame vznikne nejvýše jeden,
celé doháněné takty se zahodí a zlomkový zbytek zůstává.

Nad kolenem už zvuk není pevně svázaný s každým taktem kol. Zachování fáze
a plynulé křivky brání skokům rytmu při zrychlování i zpomalování.
Celočíselné vynechávání každého druhého taktu by při přepnutí rytmus
slyšitelně rozpůlilo. Kouř dál drží čtyři takty na otáčku podle D-014,
takže zvuk a kouř nad kolenem nesplývají při každém rázu.

## Přijetí rázu při zrychlení — revize steam-chuff-2

Ustálený překryv je menší než 2. To ale nestačí při změně rychlosti:
pro poloměr 15 u spusť ráz při 40 u/s s nulovým zbytkem fáze (délka
0,58 s) a zrychluj +160 u/s² při 60 FPS s trapezoidní dráhou
`distance[n] = (v[n−1] + v[n]) / 120`. Další požadavky vzniknou
v 0,350 s a 0,566667 s, oba s délkou 0,25 s. Při třetím požadavku
ještě žijí první dva rázy. Původní manager třetí ráz zahodil.

Při dvou živých rázech `AudioManager.chuff` nyní nejstaršímu zachytí
aktuální gain, zruší automatizaci, nastaví lineární rampu k nule za
**10 ms** a naplánuje konec. Nový požadavek uchová jako **jeden čekající
ráz s požadovanou délkou**, bez source uzlu. Spustí jej až `ended`
tohoto konkrétního nejstaršího rázu, stejnou cestou uvolnění uzlů a
rekonciliace jako dosud. Ani dřívější konec druhého rázu čekání neobejde.
Novější požadavek pouze nahradí čekající délku; neprodlouží rampu,
nevytvoří zdroj ani frontu. Požadovaný ráz tak v tomto zrychlovacím
případu nezmizí, pouze čeká 10 ms plus doručení `ended`. Delší zdržení
browserové události není synchronní audio garance.

Jde o výjimku z plné délky starého pomalého rázu: pouze při tomto
konfliktu se jeho konec zkrátí. Jinak původní délku neměníme.
`stopAll`, suspendování, mute, dispose, změna vrstvy z pulzní páry
nebo ztráta vlastnictví enginu zruší čekání, i když obsazené taily
odloží samotnou změnu vrstvy. Pozdní `ended` nic neobnoví. Každý source
a jeho obálka se odpojí právě jednou. Změna vrstvy neprodlouží už
zkrácený ráz; již bližší konec dohasínajícího hlasu se také neodkládá.
10ms zkrácení končí nejpozději na vlastním konci rázu, takže jej náhradní rampa nikdy nepřesáhne.
Limit dvou souběžných parních rázů počítá i rázy starého
enginu, který už doznívá v tailech; nový engine čeká na uvolnění stejně
jako další ráz téhož hlasu. Dva tail zdroje a celkový strop 11 zdrojů
podle D-022 zůstávají.

## Číselné výsledky

Koleno leží v **94,247780 u/s** pro `steam_local` a **119,380521 u/s**
pro `steam_express`. Níže jsou hodnoty křivky, nikoli počet celých událostí
v krátkém měřicím okně. Při stání není zvuk, proto délku neuvádíme.

| Rychlost u/s | `steam_local` rázů/s | Délka ms | `steam_express` rázů/s | Délka ms |
| ------------ | -------------------- | -------- | ---------------------- | -------- |
| 0            | 0,000000             | —        | 0,000000               | —        |
| 60           | 2,546479             | 392,699  | 2,010378               | 497,419  |
| 94           | 3,989484             | 250,659  | 3,149593               | 317,501  |
| 100          | 4,229820             | 250,000  | 3,350630               | 298,451  |
| 119          | 4,817195             | 250,000  | 3,987250               | 250,799  |
| 150          | 5,387344             | 250,000  | 4,802574               | 250,000  |
| 200          | 5,787961             | 250,000  | 5,481846               | 250,000  |
| 300          | 5,974601             | 250,000  | 5,902976               | 250,000  |
| 400          | 5,996958             | 250,000  | 5,981832               | 250,000  |
| 480          | 5,999443             | 250,000  | 5,995244               | 250,000  |

## Kompatibilita, ladění a ověření

Nemění se nahrávka, gain, běžná 15ms obálka, limity zdrojů, tunelový filtr,
diesel, elektřina, kouř, save, katalog ani generátor. Nevzniká timer,
listener, fronta, další zvukový zdroj ani kontinuální parní smyčka.
Plánovaný engine dál spotřebuje jeden loop slot a nejvýše dva současné
rázy, tedy beze změny celkového stropu 11 zdrojů podle D-022.

Ladění po poslechu: změň jediný řádek požadované konstanty v
`AudioDirector.ts`, zachovej `0 < K < M` a `1 ≤ F < 2`, přepočti tabulku
a znovu ověř testy včetně primovaného rozjezdu a skutečného přijímání v
manageru. Podmínka F < 2 omezuje ustálený překryv, nikoli přijetí všech
požadavků při změně rychlosti; to řeší výše uvedené čekání a 10ms rampa.
K/M/F jsou jediným místem pro tato čísla v produkčním kódu.

`tests/unit/platform/AudioDirector.test.ts` ověřuje původní pomalý rytmus
snímek po snímku (60 u/s, 10 s, 60 FPS), plnou rychlost obou poloměrů
(10 s, 60 FPS, 5,5–6 rázů/s, délka 0,25 s), tvar křivky po 0,1 u/s
v rozsahu 0–600 u/s a mezní stavy dráhy/fáze. Horní mez přírůstku četnosti
je `0.1 / intervalU + 1e-12` rázů/s mezi sousedními vzorky.
Rampy 0 → 480 → 0 i primovaný start při 40 u/s používají skutečný
`AudioManager` a sdílený AudioContext double z `tests/helpers/audioContextDouble.ts`
(tělo double přesunuto beze změny z managerových testů). Dráha je trapezoidní,
akcelerace +160 u/s² a zpomalování −96, −160 i −480 u/s², při 30 i 60 FPS
pro oba poloměry. Test porovnává každý požadavek s přehráním a počítá
zahájené, dosud neukončené zdroje. Pro konkrétní 40u/s regresi vyžaduje
právě jeden odklad nejvýše 10,0011 ms při modelovaném doručení `ended`
o 1 µs po konci. Testy manageru kontrolují náhradu čekající délky,
pozdní `ended`, cleanup všech uzlů i případ s 11 zdroji a blokovanou
změnou enginu; další regrese počítá také doznívající páru po výměně
hlasu. Původní testy stropu zdrojů zůstávají beze změny;
starší chuff cleanup test očekává nový 10ms konec nejstaršího rázu.

Přechodový test zrychluje 80 → 110 u/s při +10 u/s², zpomaluje zpět
při −10 u/s² a pak pokračuje při 60 u/s. Přesná posloupnost snímků
v obou směrech ověřuje zachování fáze bez extra nebo vynechaného rázu.
Pro změnu sousedních intervalů během rampy platí mez
`10 / (intervalU × (80 / intervalU)³) + 2 / 60`, tedy **44,18 ms**:
derivace četnosti je nejvýše `10 / intervalU` a dva snímky pokrývají
kvantování časů. Po návratu při 60 u/s se ověřuje původní délka se
zachovaným fázovým posunem. Původní test čtyř taktů na otáčku zůstává.

Numerické testy a cílené browserové průchody nepotvrzují kvalitu poslechu.
Poslech na Android tabletu, model/verze Androidu a Chrome, konkrétní
Tesla a firmware: **NEOVĚŘENO**. Konečný rytmus posoudí majitel na zařízení.
