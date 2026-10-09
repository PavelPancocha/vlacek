# Vývoj a kontroly

## Stav

Repozitář obsahuje specifikace, vývojové nástroje a testy jejich chování. Hra, Phaser/Vite build, katalog assetů, Playwright a PWA zatím nejsou implementované. Jejich kontroly přidávej spolu s funkcemi podle AGENTS.md; úspěch tohoto CI není akceptace hry.

Výsledky prvního lokálního ověření včetně red/green a negativních kontrol jsou v [protokolu z 2026-10-09](validation/2026-10-09-toolchain.md).

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

Samotné závislosti jsou oddělené v `node_modules/`, nejsou instalované globálně. Toto je izolace verzí a závislostí, nikoli bezpečnostní sandbox. Python virtualenv ani Docker nejsou pro tento Node projekt potřeba.

Obnova prostředí je znovu `npm ci`: nahradí `node_modules/` podle commitnutého `package-lock.json` a obnoví hook přes `prepare`. Lockfile nemaž kvůli běžné reinstalaci. `.idea/`, `.jbeval/`, výstupy a lokální `.env` se necommitují. Nové závislosti instaluj s přesnou verzí a dokumentuj jejich účel.

## Nástroje

Přesné verze závislostí vlastní `package.json`, celý strom `package-lock.json`.

| Nástroj                                 | Účel                                                                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript, `@types/node`               | Strict kontrola skriptů a testů, bez DOM typů; kontrola indexů a optional hodnot.                                                 |
| ESLint, `@eslint/js`, typescript-eslint | Chyby JavaScriptu/TypeScriptu a typově informovaný lint skriptů a testů; warnings blokují kontrolu.                               |
| Prettier                                | Jednotný formát zdrojů, konfigurací a dokumentace.                                                                                |
| Vitest                                  | Testy v Node; `npm test` skončí po jednom běhu a selže, pokud testy nenajde.                                                      |
| marked                                  | Markdown parser pro kontrolu skutečných odkazů včetně referencí a vnořených seznamů; text v code blocích se za odkazy nepovažuje. |
| Husky, lint-staged                      | Reprodukovatelný lokální pre-commit hook a kontroly staged souborů.                                                               |

## Příkazy

| Příkaz                                         | Výsledek                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run check`                                | Stejná úplná kontrola jako v CI.                                                                |
| `npm test`                                     | Všechny Vitest testy jednou.                                                                    |
| `npm run test:watch`                           | Průběžný vývoj s Vitest watch režimem.                                                          |
| `npm test -- tests/tooling/check-docs.test.ts` | Cílený test validátoru pro TDD.                                                                 |
| `npm run typecheck`                            | TypeScript bez generování souborů.                                                              |
| `npm run lint`                                 | ESLint bez automatických oprav.                                                                 |
| `npm run format:check`                         | Kontrola formátu bez změny souborů.                                                             |
| `npm run format`                               | Explicitní přeformátování projektu; před stagingem zkontroluj diff.                             |
| `npm run check:docs`                           | Existují místní cíle odkazů ve všech Git tracked a neignorovaných untracked Markdown souborech. |

TDD: napiš test pozorovatelného chování → spusť a ověř správný důvod selhání → minimální implementace → zelený test → refaktoring → `npm run check`. Chyba instalace/importu není red. Výsledek a provedené příkazy uveď v předání. Nové testy patří do `tests/**/*.test.ts`; `.only`, skip ani vyšší retries nesmějí zakrýt regresi.

## Kontrola dokumentace

Validátor rozpozná Markdown odkazy a obrázky, relativní cesty vůči zdrojovému dokumentu a `/cesty` vůči kořeni repozitáře. Odstraní query/fragment a dekóduje URL cestu. Existující soubor i adresář je platný cíl. Chybějící cíl nebo neplatné URL kódování způsobí nenulový exit s názvem zdrojového souboru a cílem.

Externí URL, protocol-relative URL, čisté `#fragmenty` a code bloky se ignorují. Kontrola neověřuje vzdálené servery, existenci nadpisových kotev ani odkazy v raw HTML. Přejmenování či smazání cíle zachytí úplné `npm run check:docs`, i když zdroj odkazu zůstal beze změny. Nové návody musí mít odkaz z README nebo příslušného existujícího návodu.

## Git hook a CI

`npm ci` spustí Husky `prepare`. Pre-commit ověřuje `git diff --cached --check`, poté lint a formát staged souborů; při změně Markdownu také místní odkazy. Kontroly neopravují soubory ani nepřidávají cizí změny do indexu. lint-staged dočasně skryje unstaged změny a obnoví je po kontrole. Při selhání oprav konkrétní problém, explicitně stage opravu a opakuj commit.

Pre-commit nepouští síťové požadavky, plný typecheck ani celou testovací sadu. Samotné odstranění souboru nemusí vyvolat lint-staged úlohu; proto je před commitem povinné `npm run check` a stejná kontrola běží v CI. Kompletní secret scanner, velikostní rozpočty herních assetů a doménová importní pravidla zatím nejsou zavedené; doplní se v M0 spolu s jejich konfigurací a negativními testy. `git diff --check` není secret scanner.

Workflow `.github/workflows/ci.yml` běží na push, pull request a ruční spuštění. Job **Quality checks** má read-only oprávnění, timeout 10 minut a action reference připnuté na commit SHA. Starší běh pro stejný ref se ruší. setup-node čte Node verzi z `package.json`; `.npmrc` při `npm ci` ověří i přesnou npm verzi dodanou s připnutým Node. CI vynechává instalaci lokálních hooků pomocí `HUSKY=0` a spouští `npm run check`.

GitHub workflow začne běžet až po pushi. V nastavení ochrany větve nastav **Quality checks** jako povinnou kontrolu před mergem; samotný YAML toto nastavení nevynutí. Lokální průchod není důkaz úspěšného GitHub běhu. Build, E2E ani fyzická zařízení se v tomto workflow zatím netestují.

## Diagnostika

- `EBADENGINE`: ověř `volta run node --version`, `volta run npm --version`, kořen projektu a Volta shims v PATH. Při zděděném jiném runtime použij explicitní `volta run npm ci`. Nepřepisuj `engine-strict` jen kvůli obejití chyby.
- Nesoulad lockfilu: při záměrné změně závislosti aktualizuj manifest i lockfile, pak ověř čisté `npm ci`.
- Síťový timeout instalace: ověř dostupnost npm registry. Pro IPv4 preferenci lze jednorázově použít `NODE_OPTIONS=--dns-result-order=ipv4first volta run npm ci`; není to požadavek projektu ani vypnutí TLS. Opakovaný pokus využije cache. Ručně stažený Node archiv vždy ověř proti oficiálnímu `SHASUMS256.txt`, než jej předáš Volta cache.
- Chyba formátování: spusť `npm run format`, prohlédni diff a znovu spusť kontrolu.
- Neplatný odkaz: oprav cestu vůči zdrojovému dokumentu; nevypínej validátor.

Každá nová funkce a tooling musí podle AGENTS.md upravit relevantní dokumentaci ve stejném commitu.
