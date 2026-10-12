# Ověření volitelné celé obrazovky — 12. října 2026

## Rozsah a umístění

Tlačítko s vlastní ikonou čtyř rohů a českým přístupným názvem je na úvodní obrazovce, v existujícím řádku akcí výběru mašinky a v pauze. Při jízdě chybí, aby nekolidovalo s dětským řízením, brzdou ani píšťalou. Používá stejný InputRouter jako ostatní akce. Jde o provedení dokumentu 02 §2 a dokumentu 09 §4, bez nového herního pravidla nebo závislosti; samostatné technické rozhodnutí není potřeba.

Standardní Fullscreen API se volá na kořen dokumentu přímo z aktivace tlačítka. Stav vychází z `fullscreenElement` a `fullscreenchange`; jediný listener vlastní `FullscreenController`, který shell uvolní při `dispose()`. Rozměry zpracuje existující resize cesta. Opuštění režimu pozastaví jízdu a vymaže vstupy i v prohlížeči, který nezměnil viewport; vstup v pauze ji neobnoví. Save, katalog ani generátor se nemění.

Bez podpory (`fullscreenEnabled` chybí / není `true` nebo chybí metody) je tlačítko skryté. Po zamítnutí je neaktivní do obnovení stránky a ukáže klidnou informaci. Žádný automatický vstup, retry ani žádost při návratu stránky. Při zamítnutí výstupu nadále platí skutečný režim a systémový výstup zůstává možný.

API ověřeno podle [MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API) a [requestFullscreen](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen) (S06 dokumentu 12).

## TDD: unit testy (PWA-07, PWA-08)

Příkaz všech kroků:

```bash
VITEST_MAX_WORKERS=4 volta run npm test -- tests/unit/platform/FullscreenController.test.ts
```

- Red nad minimálním stubem: `4 failed | 2 passed (6)`; podporovaná žádost, zamítnutí, čekající žádost a změna skutečného stavu selhaly na chybějícím chování (`expected false to be true`).
- Green prvního řezu: `6 passed (6)`.
- Red cleanupu pending žádosti: `1 failed | 7 passed (8)`; `expected "vi.fn()" to not be called at all, but actually been called 1 times` po `dispose()`.
- Green cleanupu: `8 passed (8)`.
- Doplňkové testy neúplného API: `10 passed (10)`. Pokryté jsou vstup, výstup, chybějící/zakázané API, obě zamítnutí, souběžný dotyk, externí změna a úklid včetně nedokončené žádosti. Browserová hranice je mockovaná, doména není zapojená.

## Browserové red/green a závěrečné kontroly

Build obou browserových profilů: `0.1.0+2563ef4.dirty`. Playwright 1.64.0, Chromium headless shell revize 1248, desktop a dotykový profil. Red se spustil po čekání na sdílený zámek proti neměnnému produkčnímu buildu vytvořenému **před zapojením UI**, servírovanému na portu 4197 z `/tmp/vlacek-fullscreen-red-dist-20261012/`. Pozdější buildy jej nepřepsaly.

```bash
E2E_BASE_URL=http://localhost:4197/ flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- fullscreen.spec.ts --workers=2
```

Red: `10 failed`, `2 passed (2.2m)`. Nové tlačítko chybělo (`element(s) not found` / `waiting for locator('[data-action="fullscreen"]')`); obě varianty průchodu bez API už fungovaly. Žádné selhání instalace nebo browseru.

```bash
flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- fullscreen.spec.ts --workers=2
```

První běh po zapojení: `4 failed`, `8 passed (27.1s)`. Šlo o testovací hranici: Chromium zakazuje `Browser.setWindowBounds` při fullscreen a časný `documentElement` v init scriptu se při parsování stránky mění. Mock zamítnutí se proto nastavuje na `Element.prototype`; explicitní resize probíhá po skutečném výstupu. Produkční chování se kvůli tomu neměnilo, očekávání se neuvolnila a nepřibyl retry ani čekání.

Následující cílený green: `12 passed (25.9s)`. Skutečné API (bez mocku) nastavilo `document.fullscreenElement` na kořen dokumentu po kliknutí / tapu a druhá aktivace jej zrušila. Pauza i pozice zůstaly zachované, systémový výstup simulovaný voláním browserového `exitFullscreen()` aktualizoval UI a pozastavil jízdu i bez resize. Nejdelší vlak zůstal v pohledu; explicitní resize okna na 960 × 540 je součástí závěrečné plné sady. Ověřeny jsou i Enter/mezerník se zachovaným fokusem, 64px cíle a dostupnost všech akcí na telefonu 568 × 320, skrytí bez API a zamítnutí bez pádu či druhé žádosti.

Závěrečné příkazy:

```bash
flock /tmp/vlacek-check.lock env VITEST_MAX_WORKERS=4 volta run npm run check
flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- --workers=2
```

Finální `check`: **PASS**, 59 testovacích souborů a 475 testů; formátování, lint, všechny typechecky, validace assetů, místní odkazy (46 dokumentů), tajné údaje a velikosti prošly. Jediný běh pod požadovaným zámkem a se 4 Vitest workery, bez timeoutu a opakování.

Plná E2E sada: **142 PASS + 4 stávající skipy** (desktopové testy vyžadující dotyky), žádný nový skip. První úplný průchod trval 7,9 min a nástroj po zeleném shrnutí vrátil shellový exit 143; příčina ukončení není prokázaná. Stejná brána se proto bez změny kódu či očekávání zopakovala v odděleném procesu se zachyceným návratovým kódem: **142 PASS + 4 skipy, 7,8 min, exit 0**. Příkaz stále používá požadovaný `flock` a `volta run`. Záznam návratového kódu je `/tmp/vlacek-fullscreen-full-e2e-confirmed.exit`; logy prvního a potvrzovacího běhu jsou `/tmp/vlacek-fullscreen-full-e2e.log` a `/tmp/vlacek-fullscreen-full-e2e-confirmed.log`. Potvrzen je i resize 960 × 540 v obou profilech a následný vstup/výstup s nejdelším vlakem v pohledu. Po doplnění výsledků byly znovu ověřeny pouze formátování a odkazy dokumentace; produkční kód se po finálním checku neměnil.

Screenshoty z produkčního preview 4197: `/home/pavel/Projects/vlacek-worktrees/_runs/shots/fullscreen/` — `start.png`, `home.png`, `pause.png`, `pause-fullscreen.png`, `phone-start.png`, `phone-pause.png`. Vznikly příkazem `volta run node /tmp/vlacek-fullscreen-shots.mjs` po `volta run npm run build` a spuštění `volta run npx vite preview --port 4197 --strictPort`; skript je dočasný a není součást repozitáře. Preview se po zachycení ukončil.

## Fyzická zařízení

Android tablet, iOS a Tesla Model 3 2019 Intel: **NEOVĚŘENO**. Není znám konkrétní tablet, browser ani firmware Tesly. Headless Chromium a dotykový profil jsou emulace; neprokazují chování skutečného Esc, systémového gesta, instalačního režimu PWA ani podporu vozidla. Výkonové měření se v této lane nespouští. GitHub Actions a nasazení této změny: **NEOVĚŘENO**.
