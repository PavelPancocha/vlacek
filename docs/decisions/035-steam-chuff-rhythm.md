# D-035 — Plynulé omezení rytmu parních rázů

Datum: 2026-10-20. Stav: přijato; poslech na zařízení **NEOVĚŘENO**.
Upřesňuje zvuk páry v [D-022](022-recorded-sounds.md); kouř podle
[D-014](014-particles-and-small-animations.md) se nemění.

## Důvod

Majitel při hraní buildu `0.1.0+3961229` na Android tabletu uvedl:

> "fix sound for steam locomotives. It goes from nice "šššh šššh šh" to "trrr" -> eaither it cannot go that fast or it needs different sound for that"

Volíme první možnost: rytmus páry nesmí tak zrychlit. Ponecháváme původní
nahrávku `steam-chuff` a přesně zachováváme oblíbený zvuk při pomalé jízdě.
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
  musí zůstat **striktně pod 2** kvůli dvěma souběžným rázům v D-022.

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
Pod kolenem zůstává původní akumulátor dráhy i výraz pro délku
`min(0.58, intervalU / max(1, speedUPerSec))` beze změny výpočtu.
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

Nemění se nahrávka, gain, obálka, limity `AudioManager`, tunelový filtr,
diesel, elektřina, kouř, save, katalog ani generátor. Nevzniká timer,
listener, fronta, další zvukový zdroj ani kontinuální parní smyčka.
Plánovaný engine dál spotřebuje jeden loop slot a nejvýše dva současné
rázy, tedy beze změny celkového stropu 11 zdrojů podle D-022.

Ladění po poslechu: změň jediný řádek požadované konstanty v
`AudioDirector.ts`, zachovej `0 < K < M` a `1 ≤ F < 2`, přepočti tabulku
a znovu ověř testy. K/M/F jsou jediným místem pro tato čísla v produkčním kódu.

`tests/unit/platform/AudioDirector.test.ts` ověřuje původní pomalý rytmus
snímek po snímku (60 u/s, 10 s, 60 FPS), plnou rychlost obou poloměrů
(10 s, 60 FPS, 5,5–6 rázů/s, délka 0,25 s), tvar křivky po 0,1 u/s
v rozsahu 0–600 u/s a mezní stavy dráhy/fáze. Horní mez přírůstku četnosti
je `0.1 / intervalU + 1e-12` rázů/s mezi sousedními vzorky.
Model živých rázů používá polootevřené intervaly `[start, start + duration)`
při rampách 0 → 480 → 0 u/s, akceleraci +160 u/s² a zpomalování
−96 (dojezd), −160 (symetrická rampa) i −480 u/s² (brzda), při 30 i 60 FPS,
pro oba poloměry. Nejvýše dva současné rázy brání odmítnutí třetího
rázu v `AudioManager.chuff`; test vyžaduje také skutečný překryv dvou rázů.
Původní test čtyř taktů na otáčku i testy `AudioManager` zůstávají.

Numerické testy a cílené browserové průchody nepotvrzují kvalitu poslechu.
Poslech na Android tabletu, model/verze Androidu a Chrome, konkrétní
Tesla a firmware: **NEOVĚŘENO**. Konečný rytmus posoudí majitel na zařízení.
