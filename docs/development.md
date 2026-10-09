# Vývoj a kontroly

## Stav

Repozitář obsahuje specifikace, vývojové nástroje a testy jejich chování a Vite build zástupné stránky nasazované na GitHub Pages. Hra, Phaser, katalog assetů, Playwright a PWA zatím nejsou implementované. Jejich kontroly přidávej spolu s funkcemi podle AGENTS.md; úspěch tohoto CI není akceptace hry.

Výsledky prvního lokálního ověření včetně red/green a negativních kontrol jsou v [protokolu z 2026-10-09](validation/2026-10-09-toolchain.md).

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
| Vitest                                  | Testy v Node; `npm test` skončí po jednom běhu a selže, pokud testy nenajde.                                                      |
| marked                                  | Markdown parser pro kontrolu skutečných odkazů včetně referencí a vnořených seznamů; text v code blocích se za odkazy nepovažuje. |
| Husky, lint-staged                      | Reprodukovatelný lokální pre-commit hook a kontroly staged souborů.                                                               |

## Příkazy

| Příkaz                                         | Výsledek                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run check`                                | Stejná úplná kontrola jako v CI.                                                                |
| `npm run dev -- --host 0.0.0.0`                | Vývojový server Vite, dostupný i z jiného zařízení v LAN.                                       |
| `npm run build`                                | Produkční statický build do `dist/`; `VLACEK_BASE` určuje cestu nasazení (výchozí `/`).         |
| `npm run preview -- --host 0.0.0.0`            | Lokální servírování posledního buildu z `dist/`; `VLACEK_BASE` musí být stejné jako při buildu. |
| `npm test`                                     | Všechny Vitest testy jednou.                                                                    |
| `npm run test:watch`                           | Průběžný vývoj s Vitest watch režimem.                                                          |
| `npm test -- tests/tooling/check-docs.test.ts` | Cílený test validátoru pro TDD.                                                                 |
| `npm run typecheck`                            | TypeScript bez generování souborů.                                                              |
| `npm run lint`                                 | ESLint bez automatických oprav.                                                                 |
| `npm run format:check`                         | Kontrola formátu bez změny souborů.                                                             |
| `npm run format`                               | Explicitní přeformátování projektu; před stagingem zkontroluj diff.                             |
| `npm run check:docs`                           | Existují místní cíle odkazů ve všech Git tracked a neignorovaných untracked Markdown souborech. |

## TypeScript projekty

Společná strict pravidla jsou v `tsconfig.base.json`. Kořenový `tsconfig.json` kontroluje Node skripty, testy a konfigurace bez DOM typů. `src/tsconfig.json` kontroluje webovou aplikaci s DOM typy a rozlišením modulů pro Vite. `npm run typecheck` spouští oba projekty. Konfigurace se jmenují `tsconfig.json`, protože typově informovaný ESLint (`projectService`) hledá nejbližší soubor právě tohoto jména. Relativní importy v `src/` uvádějí příponu `.ts`, aby je stejně načetly testy v Node.

TDD: napiš test pozorovatelného chování → spusť a ověř správný důvod selhání → minimální implementace → zelený test → refaktoring → `npm run check`. Chyba instalace/importu není red. Výsledek a provedené příkazy uveď v předání. Nové testy patří do `tests/**/*.test.ts`; `.only`, skip ani vyšší retries nesmějí zakrýt regresi.

## Kontrola dokumentace

Validátor rozpozná Markdown odkazy a obrázky, relativní cesty vůči zdrojovému dokumentu a `/cesty` vůči kořeni repozitáře. Odstraní query/fragment a dekóduje URL cestu. Existující soubor i adresář je platný cíl. Chybějící cíl nebo neplatné URL kódování způsobí nenulový exit s názvem zdrojového souboru a cílem.

Externí URL, protocol-relative URL, čisté `#fragmenty` a code bloky se ignorují. Kontrola neověřuje vzdálené servery, existenci nadpisových kotev ani odkazy v raw HTML. Přejmenování či smazání cíle zachytí úplné `npm run check:docs`, i když zdroj odkazu zůstal beze změny. Nové návody musí mít odkaz z README nebo příslušného existujícího návodu.

## Git hook a CI

`npm ci` spustí Husky `prepare`. Pre-commit ověřuje `git diff --cached --check`, poté lint a formát staged souborů; při změně Markdownu také místní odkazy. Kontroly neopravují soubory ani nepřidávají cizí změny do indexu. lint-staged dočasně skryje unstaged změny a obnoví je po kontrole. Při selhání oprav konkrétní problém, explicitně stage opravu a opakuj commit.

Pre-commit nepouští síťové požadavky, plný typecheck ani celou testovací sadu. Samotné odstranění souboru nemusí vyvolat lint-staged úlohu; proto je před commitem povinné `npm run check` a stejná kontrola běží v CI. Kompletní secret scanner, velikostní rozpočty herních assetů a doménová importní pravidla zatím nejsou zavedené; doplní se v M0 spolu s jejich konfigurací a negativními testy. `git diff --check` není secret scanner.

Workflow `.github/workflows/ci.yml` běží na push, pull request a ruční spuštění. Job **Quality checks** má read-only oprávnění, timeout 10 minut a action reference připnuté na commit SHA. Starší běh pro stejný ref se ruší, kromě běhu na `master`, aby se nepřerušilo nasazení. setup-node čte Node verzi z `package.json`; `.npmrc` při `npm ci` ověří i přesnou npm verzi dodanou s připnutým Node. CI vynechává instalaci lokálních hooků pomocí `HUSKY=0`, spouští `npm run check` a produkční `npm run build`.

GitHub workflow už běží po pushi; první úspěšný běh je zaznamenaný v [protokolu](validation/2026-10-09-toolchain.md). V nastavení ochrany větve nastav **Quality checks** jako povinnou kontrolu před mergem; samotný YAML toto nastavení nevynutí. Při ověření 2026-10-09 byla větev `master` nechráněná. Lokální průchod není důkaz úspěšného GitHub běhu. Build, E2E ani fyzická zařízení se v tomto workflow zatím netestují.

## Nasazení na GitHub Pages

Job **Deploy to GitHub Pages** běží jen pro push nebo ruční spuštění na `master` a až po úspěšném **Quality checks**. Jen tento job má oprávnění `pages: write` a `id-token: write`. Po čisté instalaci zjistí `actions/configure-pages` cestu webu (`/vlacek`), build ji dostane přes `VLACEK_BASE` a `actions/upload-pages-artifact` + `actions/deploy-pages` nahrají obsah `dist/`. Do repozitáře se žádný build necommituje.

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
