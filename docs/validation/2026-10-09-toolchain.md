# Ověření vývojových nástrojů — 2026-10-09

Rozsah: tooling před M0, dokumentace a Git hook. Prostředí: Linux x86_64, Node 24.21.0, npm 11.19.0 přes `volta run`. Tento protokol není test hry ani fyzického zařízení.

## Provedené kontroly

| Kontrola                                                                    | Výsledek                                                                                                                               |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `volta run npm ci --prefer-offline --fetch-retries=2 --fetch-timeout=60000` | PASS; čistá instalace z lockfilu, 135 balíčků, audit 136 balíčků bez nalezené zranitelnosti v okamžiku testu.                          |
| `volta run npm run check`                                                   | PASS; Prettier, ESLint bez warningů, strict TypeScript, všech 10 Vitest testů, lokální Markdown odkazy.                                |
| Husky instalace                                                             | PASS; `core.hooksPath` je `.husky/_`.                                                                                                  |
| Hook v dočasném Git repozitáři                                              | PASS; commit zachoval unstaged část souboru, odmítl chybný staged odkaz bez změny indexu/HEAD a zvládl přejmenování s mezerou v názvu. |
| `git diff --check`                                                          | PASS.                                                                                                                                  |
| actionlint 1.7.12                                                           | PASS pro `.github/workflows/ci.yml`; záměrně neznámý výrazový kontext byl odmítnut.                                                    |

Audit závislostí je časový snímek, nikoli záruka budoucí bezpečnosti. GitHub Actions zatím neběželo: workflow je připravené pro push/PR; vynucení kontroly **Quality checks** v ochraně větve zatím není nastavené.

## Red → green a negativní ověření

- Před implementací validátoru samostatný Node assert očekával `['missing.md']` a nad prázdnou implementací obdržel `[]`; selhal tedy kvůli chybějícímu chování. Tento první assert běžel na původně dostupném Node 22.22.0 během instalace projektového runtime. Finální sada už běžela na připnutém Node 24.21.0.
- Regrese s odstraněním tracked dokumentu: `volta run npm test -- tests/tooling/check-docs.test.ts` nejprve hlásil **6 PASS / 1 FAIL** (`ENOENT` při čtení odstraněného zdroje). Po opravě výběru existujících zdrojů stejný příkaz hlásil **7 PASS**. Odkazy přeživších dokumentů na chybějící cíle zůstávají chybou.
- Dočasný typový nesoulad byl odmítnut přes `TS2322`, nepoužitá proměnná přes `@typescript-eslint/no-unused-vars`, neformátovaný soubor přes Prettier.
- Záměrný Vitest assert `expect(1).toBe(2)` selhal; výběr neexistující testovací sady také skončil chybou. Dočasné soubory byly po kontrolách odstraněné.
- Instalace pod původním Node/npm skončila `EBADENGINE`, takže požadavky runtime nelze omylem ignorovat.

## Poznámky k prostředí a opakování

Po síťových timeoutech byl oficiální Node archiv stažen s pokračováním po částech, složen a porovnán SHA-256 s oficiálním `SHASUMS256.txt`. Teprve poté jej Volta načetla ze své cache a potvrdila přibalené npm 11.19.0. Výchozí globální runtime ostatních projektů zůstal beze změny. Následná čistá instalace npm z cache trvala přibližně tři sekundy. Pro běžné opakování použij [vývojový návod](../development.md).

actionlint byl jednorázový diagnostický nástroj stažený do `/tmp` z [oficiálního vydání 1.7.12](https://github.com/rhysd/actionlint/releases/tag/v1.7.12). Archiv `actionlint_1.7.12_linux_amd64.tar.gz` byl ověřen proti `actionlint_1.7.12_checksums.txt` z téhož vydání. Pro zopakování stáhni tyto dva soubory, ověř checksum, rozbal binárku a v kořeni repozitáře spusť `actionlint .github/workflows/ci.yml`. Není závislostí hry ani součástí `npm run check`.

Neprovedeno: vzdálený GitHub běh, herní build, E2E/PWA, assetové rozpočty a fyzický Android/Tesla. Kontroly importních hranic domény, secret scanner a velikostní pravidla assetů jsou dosud požadavky M0, nikoli dodané kontroly tohoto řezu.
