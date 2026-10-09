# Vývoj a kontroly

## Stav

Repozitář obsahuje specifikace, vývojové nástroje a průběžnou verzi 0.1 hry (M0 + M1): doménu (vstupy, pohyb, trať, souprava, depo), ukládání, GameSession, Phaser renderer a DOM obrazovky, nasazované na GitHub Pages. Úplný katalog, biomy, scénky a PWA zatím nejsou implementované. Jejich kontroly přidávej spolu s funkcemi podle AGENTS.md; úspěch tohoto CI není akceptace hry.

Výsledky prvního lokálního ověření včetně red/green a negativních kontrol jsou v [protokolu z 2026-10-09](validation/2026-10-09-toolchain.md); průběžné ověření verze 0.1 je v [protokolu v0.1](validation/2026-10-09-v0.1.md).

První konkrétní vývojový řez a jeho pořadí jsou připravené v [zahájení M0](development-start.md).

## Prostředí

Používáme projektové verze **Node 24.21.0 a npm 11.19.0** přes již nainstalovanou Voltu. Nový spolupracovník nejprve nainstaluje [Voltu podle oficiálního návodu](https://docs.volta.sh/guide/getting-started). `volta` v `package.json` je zdroj projektových verzí; `engines` a `.npmrc` odmítnou instalaci nesprávným runtime. `packageManager` zaznamenává verzi npm pro další nástroje. Při upgradu udržuj tyto údaje shodné.

```bash
volta fetch node@24.21.0 npm@11.19.0
volta run node --version
volta run npm --version
volta run npm ci
volta run npm run check
```

Příkazy spouštěj v kořeni repozitáře. Volta vybírá verze podle projektu a sdílí jejich cache; neměníme její globální výchozí verze. Explicitní `volta run` je spolehlivý i v shellu zděděném z nástroje spuštěného pod jinou Node verzí. Pro delší práci lze otevřít `volta run bash`; příkazy `npm` a `git commit` pak spouštěj uvnitř tohoto shellu. Alternativně prefixuj jednotlivé příkazy z tabulky pomocí `volta run`, včetně `volta run git commit`. CI má správný runtime přímo přes setup-node a Voltu nepotřebuje.

Bez Volty (například v jednorázovém cloudovém kontejneru) lze použít oficiální archiv `node-v24.21.0-<platforma>.tar.xz`. Nejdřív jej ověř proti `SHASUMS256.txt` ze stejného vydání, rozbal mimo repozitář a jeho `bin/` přidej na začátek `PATH` jen pro danou relaci. Globální runtime se nemění.

Samotné závislosti jsou oddělené v `node_modules/`, nejsou instalované globálně. Toto je izolace verzí a závislostí, nikoli bezpečnostní sandbox. Python virtualenv ani Docker nejsou pro tento Node projekt potřeba.

Obnova prostředí je znovu `npm ci`: nahradí `node_modules/` podle commitnutého `package-lock.json` a obnoví hook přes `prepare`. Lockfile nemaž kvůli běžné reinstalaci. `.idea/`, `.jbeval/`, výstupy a lokální `.env` se necommitují. Nové závislosti instaluj s přesnou verzí a dokumentuj jejich účel.

## Nástroje

Přesné verze závislostí vlastní `package.json`, celý strom `package-lock.json`.

| Nástroj                                 | Účel                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, `@types/node`               | Strict kontrola skriptů a testů, bez DOM typů; kontrola indexů a optional hodnot.                                                 |
| ESLint, `@eslint/js`, typescript-eslint | Chyby JavaScriptu/TypeScriptu a typově informovaný lint skriptů a testů; warnings blokují kontrolu.                               |
| Prettier                                | Jednotný formát zdrojů, konfigurací a dokumentace.                                                                                |
| Vite                                    | Vývojový server, produkční build statického webu a jeho lokální preview.                                                          |
| Phaser (runtime závislost)              | 2D vykreslování (WebGL s Canvas fallbackem). Smí jej importovat jen `src/render/`; vstup, fokus a audio Phaseru jsou vypnuté.     |
| Vitest                                  | Testy v Node; `npm test` skončí po jednom běhu a selže, pokud testy nenajde.                                                      |
| Playwright                              | Browserové testy produkčního buildu v Chromiu, desktop a dotykový tablet 1280 × 800.                                              |
| marked                                  | Markdown parser pro kontrolu skutečných odkazů včetně referencí a vnořených seznamů; text v code blocích se za odkazy nepovažuje. |
| Husky, lint-staged                      | Reprodukovatelný lokální pre-commit hook a kontroly staged souborů.                                                               |
| secretlint + preset recommend           | Offline detekce tajných údajů (klíče, tokeny, privátní klíče) ve všech souborech; nalezené hodnoty maskuje.                       |

## Příkazy

| Příkaz                                         | Výsledek                                                                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                                | Stejná úplná kontrola jako v CI.                                                                                      |
| `npm run dev -- --host 0.0.0.0`                | Vývojový server Vite, dostupný i z jiného zařízení v LAN.                                                             |
| `npm run build`                                | Produkční statický build do `dist/`; `VLACEK_BASE` určuje cestu nasazení (výchozí `/`).                               |
| `npm run preview -- --host 0.0.0.0`            | Lokální servírování posledního buildu z `dist/`; `VLACEK_BASE` musí být stejné jako při buildu.                       |
| `npm test`                                     | Všechny Vitest testy jednou.                                                                                          |
| `npm run test:watch`                           | Průběžný vývoj s Vitest watch režimem.                                                                                |
| `npm test -- tests/tooling/check-docs.test.ts` | Cílený test validátoru pro TDD.                                                                                       |
| `npm run test:e2e`                             | Produkční build a Playwright testy proti `vite preview` (port 4173).                                                  |
| `npm run measure:perf`                         | Měření jízdy se 100 vagonky (`PERF_SECONDS`, výchozí 60) v Chromiu; JSON v `test-results/`. Není součástí CI brány.   |
| `npm run report:budgets`                       | Velikost `dist/` po souborech, raw i gzip; selže nad rozpočtem 10 MiB prvního přenosu.                                |
| `npm run validate:assets`                      | Kontrakt katalogu vozidel (ID, délky, podvozky, trolej ⇔ elektrická); vypíše placeholdery. `-- --release` je odmítne. |
| `npm run typecheck`                            | TypeScript bez generování souborů.                                                                                    |
| `npm run lint`                                 | ESLint bez automatických oprav.                                                                                       |
| `npm run format:check`                         | Kontrola formátu bez změny souborů.                                                                                   |
| `npm run format`                               | Explicitní přeformátování projektu; před stagingem zkontroluj diff.                                                   |
| `npm run check:docs`                           | Existují místní cíle odkazů ve všech Git tracked a neignorovaných untracked Markdown souborech.                       |
| `npm run check:secrets`                        | secretlint nad všemi Git tracked a neignorovanými untracked soubory včetně dotfiles.                                  |
| `npm run check:sizes`                          | Limit velikosti souborů: 1 MiB obecně, 4 MiB pro herní assety v `public/assets/`.                                     |

## TypeScript projekty

Společná strict pravidla jsou v `tsconfig.base.json`. Kořenový `tsconfig.json` kontroluje Node skripty, testy a konfigurace bez DOM typů. `src/tsconfig.json` kontroluje webovou aplikaci s DOM typy a rozlišením modulů pro Vite; má `skipLibCheck`, protože deklarace Phaseru 4.2.1 samy neprojdou strict kontrolou TypeScriptu 6 (TS2526, TS2416, viz [D-004](decisions/004-renderer-and-phaser.md)). `tests/e2e/tsconfig.json` kontroluje Playwright testy a jejich konfiguraci s DOM typy pro kód v `page.evaluate`; kořenový projekt je vynechává. `src/domain/tsconfig.json` kontroluje čistou zónu bez DOM a Node typů. `npm run typecheck` spouští všechny čtyři projekty. Konfigurace se jmenují `tsconfig.json`, protože typově informovaný ESLint (`projectService`) hledá nejbližší soubor právě tohoto jména. Relativní importy v `src/` uvádějí příponu `.ts`, aby je stejně načetly testy v Node.

TDD: napiš test pozorovatelného chování → spusť a ověř správný důvod selhání → minimální implementace → zelený test → refaktoring → `npm run check`. Chyba instalace/importu není red. Výsledek a provedené příkazy uveď v předání. Nové testy patří do `tests/**/*.test.ts`; `.only`, skip ani vyšší retries nesmějí zakrýt regresi.

## Hranice čisté domény

`src/domain/**` a `src/config/**` tvoří čistou zónu bez Phaseru, DOM, úložiště, audia, hodin a náhodnosti. Vynucuje ji ESLint (`eslint.config.mjs`):

- Lokální pravidlo `vlacek/pure-imports` (`tools/eslint/pure-imports.mjs`) povolí jen relativní importy, které zůstanou uvnitř čisté zóny. Odmítne balíčky (`phaser`), aliasy (`@/…`), cesty do `render/`, `ui/`, `platform/`, `app/`, re-exporty, dynamický a vypočtený `import()`, `import('x').Typ`, `require` a importy s `?query`. Protože totéž platí pro každý čistý soubor, nevede ven ani řetězec re-exportů.
- `no-restricted-globals` (včetně `globalThis`), `no-restricted-properties` a `no-restricted-syntax` zakazují `window`, `document`, `localStorage`, `performance`, časovače, `Math.random()`, `Date.now()`, `new Date()`, `import.meta` a `declare global`. `triple-slash-reference` zakazuje `/// <reference lib="dom" />`.

Mimo čistou zónu platí ještě `no-restricted-imports`: `phaser` smí importovat jen `src/render/**`.

Čas, náhodnost (seed) a platformní data předává doméně volající. Negativní testy v `tests/tooling/domain-boundaries.test.ts` lintují skutečnou projektovou konfigurací ukázky každého zakázaného vzoru v obou adresářích zóny. Kontrolní testy ověřují povolený import uvnitř zóny a neomezený platformní kód. Druhou pojistkou je TypeScript projekt `src/domain/tsconfig.json` (lib ES2024, `types: []`), který kontroluje `src/domain` i `src/config` bez DOM a Node typů. Pre-commit typecheck nespouští, proto lint zůstává hlavní okamžitou kontrolou.

## Browserové testy

Playwright je připnutý v `package.json` a stahuje vlastní Chromium odpovídající verzi (pro 1.64.0 revize 1248, Chromium 156). Konfigurace je `tests/e2e/playwright.config.ts`; testy se jmenují `*.spec.ts`, takže je Vitest nespouští. `npm run test:e2e` nejdřív vytvoří produkční build a server spustí Playwright sám. Výstupy jsou v `test-results/` a v CI v `playwright-report/`; obojí je ignorované Gitem.

```bash
volta run npx playwright install chromium
volta run npm run test:e2e
```

Pokud prostředí nastavuje `PLAYWRIGHT_BROWSERS_PATH` na adresář se starší revizí prohlížeče (například předinstalovaný kontejner), nainstaluj správnou revizi jinam a stejnou cestu předej i testům, např. `PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`. Spouštění se starším Chromiem přes `executablePath` není podporovaná konfigurace. Testy mají `forbidOnly` a žádné retries; dotykový projekt používá `hasTouch`. Emulace není test fyzického zařízení.

Celá uživatelská cesta (`tests/e2e/game.spec.ts`) čte stav přes diagnostické API `window.__vlacek.snapshot()`, které existuje jen s `?debug=1`. Vícedotykové testy posílají `Input.dispatchTouchEvent` přes CDP: `touchEnd` uvolní právě uvedené prsty. Časy gest se předávají explicitním `timestamp`, protože automatizační kanál doručuje události se zpožděním až stovek milisekund. Měření `*.perf.ts` má vlastní konfiguraci `tests/e2e/perf.config.ts` a běží jen přes `npm run measure:perf`.

## Kontrola dokumentace

Validátor rozpozná Markdown odkazy a obrázky, relativní cesty vůči zdrojovému dokumentu a `/cesty` vůči kořeni repozitáře. Odstraní query/fragment a dekóduje URL cestu. Existující soubor i adresář je platný cíl. Chybějící cíl nebo neplatné URL kódování způsobí nenulový exit s názvem zdrojového souboru a cílem.

Externí URL, protocol-relative URL, čisté `#fragmenty` a code bloky se ignorují. Kontrola neověřuje vzdálené servery, existenci nadpisových kotev ani odkazy v raw HTML. Přejmenování či smazání cíle zachytí úplné `npm run check:docs`, i když zdroj odkazu zůstal beze změny. Nové návody musí mít odkaz z README nebo příslušného existujícího návodu.

## Git hook a CI

`npm ci` spustí Husky `prepare`. Pre-commit ověřuje `git diff --cached --check`, poté lint a formát staged souborů; při změně Markdownu také místní odkazy. Kontroly neopravují soubory ani nepřidávají cizí změny do indexu. lint-staged dočasně skryje unstaged změny a obnoví je po kontrole. Při selhání oprav konkrétní problém, explicitně stage opravu a opakuj commit.

Pre-commit na každém staged souboru spouští secretlint (`--no-glob`, cesty se berou doslova) a limit velikosti. Nepouští síťové požadavky, plný typecheck ani celou testovací sadu. Samotné odstranění souboru nemusí vyvolat lint-staged úlohu; proto je před commitem povinné `npm run check` a stejná kontrola běží v CI. Testy v `tests/tooling/pre-commit.test.ts` v dočasném repozitáři ověřují, že hook odmítne staged privátní klíč i příliš velký soubor. Kontrola tajných údajů je ochrana proti omylu, nikoli záruka: neodhalí každý formát tajemství.

Workflow `.github/workflows/ci.yml` běží na push, pull request a ruční spuštění. Job **Quality checks** má read-only oprávnění, timeout 10 minut a action reference připnuté na commit SHA. Starší běh pro stejný ref se ruší, kromě běhu na `master`, aby se nepřerušilo nasazení. setup-node čte Node verzi z `package.json`; `.npmrc` při `npm ci` ověří i přesnou npm verzi dodanou s připnutým Node. CI vynechává instalaci lokálních hooků pomocí `HUSKY=0`, spouští `npm run check`, produkční `npm run build` a `npm run report:budgets`. Samostatný job **E2E** nainstaluje Chromium přes `npx playwright install --with-deps chromium`, spustí `npm run test:e2e` a při selhání nahraje report jako artefakt na 7 dní.

GitHub workflow už běží po pushi; první úspěšný běh je zaznamenaný v [protokolu](validation/2026-10-09-toolchain.md). V nastavení ochrany větve nastav **Quality checks** a **E2E** jako povinné kontroly před mergem; samotný YAML toto nastavení nevynutí. Při ověření 2026-10-09 byla větev `master` nechráněná. Lokální průchod není důkaz úspěšného GitHub běhu. Fyzická zařízení se v CI netestují.

## Nasazení na GitHub Pages

Job **Deploy to GitHub Pages** běží jen pro push nebo ruční spuštění na `master` a až po úspěšných jobech **Quality checks** a **E2E**. Jen tento job má oprávnění `pages: write` a `id-token: write`. Po čisté instalaci zjistí `actions/configure-pages` cestu webu (`/vlacek`), build ji dostane přes `VLACEK_BASE` a `actions/upload-pages-artifact` + `actions/deploy-pages` nahrají obsah `dist/`. Do repozitáře se žádný build necommituje.

V nastavení repozitáře musí být **Settings → Pages → Source: GitHub Actions**. Prostředí `github-pages` standardně povoluje nasazení jen z výchozí větve; pracovní větve proto web nemění. Adresa je <https://pavelpancocha.github.io/vlacek/>. Nasazený obsah ověř podle `<meta name="vlacek-build">`, který musí odpovídat commitu běhu. Workflow ověř lokálně pomocí actionlint podle [protokolu nástrojů](validation/2026-10-09-toolchain.md); ověření nasazení je v [protokolu zástupné stránky](validation/2026-10-09-pages-skeleton.md). Volbu popisuje [rozhodnutí D-002](decisions/002-github-pages.md).

## Diagnostika

- `EBADENGINE`: ověř `volta run node --version`, `volta run npm --version`, kořen projektu a Volta shims v PATH. Při zděděném jiném runtime použij explicitní `volta run npm ci`. Nepřepisuj `engine-strict` jen kvůli obejití chyby.
- Nesoulad lockfilu: při záměrné změně závislosti aktualizuj manifest i lockfile, pak ověř čisté `npm ci`.
- Síťový timeout instalace: ověř dostupnost npm registry. Pro IPv4 preferenci lze jednorázově použít `NODE_OPTIONS=--dns-result-order=ipv4first volta run npm ci`; není to požadavek projektu ani vypnutí TLS. Opakovaný pokus využije cache. Ručně stažený Node archiv vždy ověř proti oficiálnímu `SHASUMS256.txt`, než jej předáš Volta cache.
- Chyba formátování: spusť `npm run format`, prohlédni diff a znovu spusť kontrolu.
- Neplatný odkaz: oprav cestu vůči zdrojovému dokumentu; nevypínej validátor.
- Prázdná stránka nebo 404 po nasazení do podadresáře: ověř, že `dist/index.html` odkazuje na assety s prefixem `VLACEK_BASE`, v deploy jobu výstup `base_path` z `actions/configure-pages` a lokálně stejné `VLACEK_BASE` pro build i preview. Vite běží s `appType: 'mpa'`, takže chybná cesta skončí 404 místo tichého vrácení `index.html` (PWA-10).
- Pages zobrazují README místo hry: v nastavení Pages je zdroj „Deploy from a branch“; přepni jej na „GitHub Actions“.

Každá nová funkce a tooling musí podle AGENTS.md upravit relevantní dokumentaci ve stejném commitu.
