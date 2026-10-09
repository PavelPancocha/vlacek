# Ověření zástupné stránky a nasazení — 2026-10-09

Rozsah: Vite build zástupné stránky, cesta nasazení a workflow GitHub Pages. Prostředí: Linux x86_64 v cloudovém kontejneru, Node 24.21.0 z oficiálního archivu ověřeného proti `SHASUMS256.txt`, npm 11.19.0. Tento protokol není test hry ani fyzického zařízení.

## Red → green

- `npm test -- tests/tooling/build-info.test.ts` nad prázdnou implementací `formatBuildId`/`normalizeBasePath`: **6 FAIL** (`AssertionError`, např. `expected '' to be '0.1.0+f8ae2b6'`). Po implementaci stejný příkaz **6 PASS**.

## Lokální kontroly

| Kontrola                                                           | Výsledek                                                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                                           | PASS; přidání `vite@8.3.4` jako přímé závislosti nezměnilo verzi v lockfilu, pouze odstranilo příznaky `peer`.          |
| `npm run check`                                                    | PASS; formát, ESLint bez warningů, oba TypeScript projekty, všechny Vitest testy, odkazy v dokumentaci.                 |
| `VLACEK_BASE=/vlacek npm run build`                                | PASS; `dist/index.html` odkazuje na `/vlacek/assets/…` a obsahuje `<meta name="vlacek-build">`.                         |
| `VLACEK_BASE=/vlacek vite preview --port 4173` + HTTP GET          | PASS; `200` s typem `text/html`, `text/javascript` a `text/css`; neexistující `/vlacek/assets/missing.png` vrací `404`. |
| Headless Chromium 141 (`/opt/pw-browsers/chromium`), 1280 × 720    | PASS; snímek ukazuje nadpis, text a `Build 0.0.0+f8ae2b6.dirty`.                                                        |
| actionlint 1.7.12 (archiv ověřený checksumem z oficiálního vydání) | PASS pro `.github/workflows/ci.yml`.                                                                                    |

## Nalezená a opravená chyba

První kontrola preview bez `VLACEK_BASE` hlásila `200` i pro JS asset, ale tělo odpovědi bylo `index.html`: preview servíroval web z kořene a SPA fallback maskoval chybnou cestu. Stránka v prohlížeči zůstala prázdná. Oprava: `appType: 'mpa'` ve `vite.config.ts` (chybějící soubor vrací 404) a dokumentované stejné `VLACEK_BASE` pro build i preview. Po opravě vrací preview bez `VLACEK_BASE` pro `/vlacek/…` 404 a s ní správné typy obsahu.

## Neověřeno

Běh deploy jobu a dostupnost nasazené stránky lze ověřit až po sloučení do `master`; výsledek se doplní do protokolu verze 0.1. Vzhled stránky v prohlížeči, Android a Tesla: **NEOVĚŘENO**.
