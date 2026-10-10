# Start vývoje — M0

**Stav 2026-10-09:** řezy M0 + M1 jsou implementované jako průběžná verze 0.1. Ověření je v [protokolu v0.1](validation/2026-10-09-v0.1.md), architektura v [D-006](decisions/006-runtime-architecture.md) a matice zařízení v [device-tests](device-tests/v0.1.md). Další práce pokračuje M2 podle implementačního plánu. Text níže popisuje původní zahájení M0.

Výchozí bod: commit `c8f027d` obsahoval připnuté prostředí, GitHub Actions, Git hook a 10 testů tooling. Závazný rozsah a brány vlastní [implementační plán](../vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md); tento soubor pouze určuje první konkrétní kroky.

## Zahájení práce

1. Přečti [AGENTS.md](../AGENTS.md), [README](../README.md) a povinné specifikace vyjmenované v AGENTS.md.
2. Začni z aktuálního `master` na samostatné větvi pro M0. Zachovej případné cizí rozpracované změny.
3. Spusť `volta run npm ci` a `volta run npm run check`. Instalaci a diagnostiku popisuje [vývojový návod](development.md).
4. Každou malou změnu veď přes pozorované red → green → refactor. Současně uprav její dokumentaci; při předání uveď příkazy a výsledky.

## První funkční řez

- **Doménové hranice a vstupy:** začni testem priority brzdy nad plynem (INP-04), pak UI bez propadnutí vstupu (INP-06), ukončení/zrušení dotyku (INP-09), ztráty fokusu (INP-10) a nového dotyku po obnovení (INP-11). Před produkčním kódem potvrď správné selhání testu. Přidej doménový TypeScript projekt bez DOM a lint zákazy platformních importů; negativním testem prokaž jejich vynucení i přes alias/reexport.
- **Pohyb:** implementuj testovatelný fixní simulační krok, držení pro rozjezd, dojezd a brzdu. Parametry přebírej z dokumentu 13. Testuj nezápornou rychlost a nezávislost simulace na renderovacím FPS (TRN-04/05).
- **Kolej a souprava:** stabilizuj jednotky, jedno vzorkování koleje a samostatné polohy vozidel přes kopec. Už první řez musí podporovat celou délku soupravy podle limitu a připravit trať za celou počáteční soupravou (TRN-01/03/07).
- **Spustitelný web:** doplň přímé, přesně připnuté závislosti Vite, Phaser 4.2.1 a Playwright. Ověř API a renderer v instalovaných typech. Napoj jediný InputRouter a simulační loop na scénu s lokomotivou, 100 geometrickými vagonky, kopcem, interaktivním objektem, brzdou, píšťalou a pauzou. Placeholdery označ a eviduj jejich původ.
- **Kontroly zároveň s implementací:** přidej skutečné `dev`, `build`, `preview`, browser smoke test a jejich CI kroky. Doplň dosud chybějící secret scanner a pravidla velikostí/assetů s ověřením, že vadný vstup selže. Rozšiř stávající projekt a testy; nevytvářej druhou aplikaci nebo prázdné úspěšné validátory.

Akceptační ID a přesné očekávané chování vlastní [dokument 11](../vlacek-predavaci-balicek/11_TESTY_A_AKCEPTACE.md). Před grafikou přečti dokument 07; před přidáváním katalogového obsahu dokument 06. Další obsah patří do následujících milníků podle plánu, cílový rozsah V1 se nemění.

## Co musí být doloženo při dokončení M0

- Fungující demo a příkazy ke spuštění; build identifikovaný commitem, dostupná testovací URL a zaznamenaná volba rendereru podle brány M0.
- Lokální kontroly i GitHub Actions, browserové ovládání a návrat z pauzy, měření s nejdelší povolenou soupravou.
- Stav fyzického Androidu a Tesly včetně zařízení/firmwaru; nedostupný test označit **NEOVĚŘENO**. Desktopová emulace není fyzický test.
- Aktualizovaná dokumentace, původ assetů, známá omezení a zbývající práce. Příprava tooling sama o sobě neznamená hotové M0.
