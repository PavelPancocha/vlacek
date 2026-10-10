# D-008: Celý vlak v obraze a délkový limit soupravy

Datum: 2026-10-10. Stav: přijato. Nahrazuje limit 100 vagonků z dokumentů 01, 03, 11, 12 (D-05) a 13.

Zadání [14 §2](../../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md) požaduje, aby byla od prvního snímku po Vyjet vidět lokomotiva i poslední vagonek, a to i ve stoupání, po zastavení, po obnovení a po změně velikosti okna. Verze 0.1 držela lokomotivu na 30 % šířky v pevném měřítku 720 u na výšku obrazovky. Už druhý ze tří vagonků proto začínal mimo obraz a u 100 vagonků byl vidět jen začátek vlaku.

**Rozhodnutí.**

- **Délkový limit, ne počet vozů.** `train.maxConsistLengthU = 1600` u měří od čela lokomotivy po konec posledního vagonku včetně spřáhel. Počítá jej stejná funkce `layoutConsist` jako jízda (`consistLengthU` v `ConsistEditor`). Limit odpovídá lokomotivě a zhruba 8 průměrným vagonkům, nebo 9 krátkým. V depu lze přidat jen vagonek, který se vejde, takže kratší druh se někdy ještě vejde, když delší už ne. Stav naznačuje proužek délky a text „Vláček je plný“, bez dialogu.
- **Stabilní měřítko podle obrazovky.** Kamera (`src/render/cameraFraming.ts`) volí měřítko tak, aby nejdelší povolená souprava zabrala `camera.trainWidthFraction = 0.72` šířky. Měřítko nezávisí na aktuální délce vlaku, takže se nepřibližuje ani neoddaluje po každém vagonku. Za koncem vlaku zůstává 6 % šířky. Čelo krátkého vlaku stojí nejméně na 35 % šířky, aby byl vidět výhled dopředu.
- **Svislé vedení.** Kamera zná výšku koleje pod celou soupravou (vzorky po 32 u od konce po čelo) i nejvyšší vozidlo katalogu. Plynule (3/s) vede střed vlaku do 55 % pásu, který nechávají volný tlačítka v rozích a brzda. Pevný strop a podlaha pásu mají přednost před plynulostí, takže vlak nikdy nezajede pod ovládání. Pásy měří `AppController` při každé změně obrazovky a rozměru. Vodorovné sledování zůstává přesné.
- **Starší delší soupravy.** Formát save zůstává schéma 1 s horní mezí 100 vagonků (`SAVE_V1_MAX_WAGONS`). Cesta z 0.1 s delší soupravou se jako jízda neobnoví, protože by vlak nebyl celý vidět. Všechny vagonky ale zůstanou v depu a v uložené hře a dítě nebo rodič vidí upozornění („Vláček je delší, než se vejde na obrazovku…“). Proužek je červený a Vyjet neaktivní, dokud se souprava ubráním nevejde. Nic se tiše nemaže. Poloha staré cesty se tím ztratí; je to vědomá a ohlášená cena.

**Důsledky.** Testy UI-03, TRN-01, TRN-07, GEN-09 a PERF-01 pracují s nejdelší povolenou soupravou místo 100 vagonků. E2E testy ověřují rámeček celé soupravy přes `window.__vlacek.snapshot().trainBox` na prvních snímcích po Vyjet, během jízdy přes kopce, po změně velikosti a po obnovení. Měření `npm run measure:perf` jezdí s nejdelší soupravou.

Vlak je na obrazovce menší než v 0.1: na tabletu široké 1280 px má vagonek asi 100 px, na telefonu 844 px asi 65 px. Rozpoznatelnost v tomto měřítku musí zajistit grafická iterace (dokument 14 §3). V softwarovém WebGL kontejneru kleslo měření z mediánu 30 na 20 FPS, protože výřez je asi dvakrát širší a v obraze jsou všechny vozy. Ověřit a řešit se to má spolu s novou grafikou trati; jako příčina se zatím jen předpokládá vektorové kreslení trati v každém snímku. Fyzická zařízení: NEOVĚŘENO.

**Kompatibilita.** Bez změny formátu uložené hry. Konfigurace: `train.maxWagons` nahrazuje `train.maxConsistLengthU`, nová sekce `camera`. Ladění měřítka nebo limitu je změna konfigurace, ne formátu, a nesmí tiše zkrátit uložené soupravy.
