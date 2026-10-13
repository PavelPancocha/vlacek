# Vývojářské volby a jízda za neprůhlednými obrazovkami — 12. října 2026

## Rozsah

PR #8 (`feat/dev-menu-idle-render`) přináší tři změny:

1. **`feat(platform)`: kvalita z adresy.** `?quality=auto|standard|low` platí jen pro dané načtení a nemění uložené nastavení. Snapshot uvádí efektivní `renderProfile`.
2. **`feat(ui)`: skryté vývojářské volby** ([D-020](../decisions/020-developer-menu.md)). V pauze je otevře pět aktivací řádky Build během 3 s. Nabízejí Diagnostiku, Vykreslování, Kvalitu, Omezené efekty a Číslo světa. Použití i reset nejprve uloží cestu a nastavení; při neúspěšném uložení se stránka znovu nenačte.
3. **`perf(render)`: jízda se nekreslí za neprůhlednými obrazovkami** ([D-006](../decisions/006-runtime-architecture.md)). Týká se úvodu, výběru mašinky, depa, obnovitelné chyby a výzvy k otočení. Navazující commit `fix(render)` totéž zavádí pro otevřené vývojářské volby nad pauzou.
   - Smyčka Phaseru dál obsluhuje ukládání, UI a události.
   - Clona zakryje canvas až do `Phaser.Renderer.Events.POST_RENDER` vracejícího se světa.
   - Průsvitná pauza kreslí zamrzlý svět dál.

Save, katalog ani generátor se nemění. Commit `docs(decisions)` opravuje větu D-006 o diagnostice. Je samostatný, protože první tři commity už byly pushnuté a větev PR se nepřepisuje.

## TDD

Každý red běžel nad buildem, který chybějící chování skutečně neměl. Přesné příkazy a výstupy jsou v předávacích záznamech jednotlivých linek.

- **Kvalita z adresy:**
  - unit red `2 failed, 10 passed` (`expected undefined to be 'low'`), green 12/12;
  - E2E `quality.spec.ts` red 2 failed (`renderProfile` chyběl), green 2/2.
- **Vývojářské volby:**
  - **úložiště a branka:** red `3 failed, 1 passed`, green; dětská cesta E2E red 2 failed (řádka Build ještě nebyla tlačítkem);
  - **bezpečné použití:**
    - unit/integrace red `5 failed, 27 passed`;
    - E2E red 8 scénářů, kdy panel zmizel reloadem při novějším save nebo selhání primárního zápisu, a 2 scénáře s nepřesnou zprávou;
    - vše green;
  - **branka v E2E:** red 6 failed (pět aktivací přesáhlo 3 s skutečného času), green s `page.clock` zastaveným jen během aktivací.
- **Jízda za neprůhlednými obrazovkami:**
  - **matice `worldHidden`:** red `17 failed, 5 passed`, green 22/22; s vývojářským panelem red `3 failed, 31 passed`, green 34/34;
  - **`ride-visibility.spec.ts`:** red nad buildem s čítačem `rideFramesDrawn` bez potlačení kresby (např. `Expected: 62 / Received: 63`), green;
  - **`ride-reveal.spec.ts`:** sleduje každý browserový snímek:
    - **zakrytý canvas:** red `15 failed, 3 passed`, kdy byl canvas odkrytý bez nové kresby ve standardním i 30 FPS profilu a navíc se ztratilo rozpracované prolínání biomů;
    - **ztráta kontextu WebGL a pozorovatelé:** red `worldDrawn` volaný 2× při ztrátě kontextu, skutečný `WEBGL_lose_context` red `Expected: true; Received: false`;
    - **vývojářský panel:** red `12 failed, 4 passed`;
    - vše green.

## Měření CPU ×4

Chromium 156.0.8078.4, WebGL, standard, 1280 × 800 CSS px, DPR 1, seed 123, `?debug=1`, CDP `Emulation.setCPUThrottlingRate` 4, produkční build. Jde o jednorázové běhy na sdíleném stroji. Sloupec „Po“ změřila verze s clonou; pozdější opravy recenze změnily jen zdroj signálu odkrytí, testy a propojení s vývojářským panelem, ne práci menu za snímek.

| Průchod                                                             |    Před |      Po |
| ------------------------------------------------------------------- | ------: | ------: |
| Výběr 10 mašinek + přidání, výběr a odebrání všech 32 druhů vagonků | 41,97 s | 11,27 s |
| Depo otevřené z živé jízdy: 10× přidání a odebrání                  | 15,37 s |  2,64 s |

Před změnou v nečinném depu nad živou jízdou dominovalo kreslení jízdy a renderer (CPU `RideScene.update` 279 ms, render Phaseru 507 ms za 5 s), nikoli `#refreshUi()` (17 ms). První verze změny (bez clony) je v témže okně snížila na 11 ms a 52 ms.

## Brána

Build `0.1.0+df17712`. Finální strom se od něj liší jen opravou jedné věty D-006 a tímto protokolem; kód je shodný.

- `flock /tmp/vlacek-check.lock env VITEST_MAX_WORKERS=4 volta run npm run check`: **PASS**, 74 souborů, 618 testů.
- `volta run npm run validate:assets -- --release`: 42 vozidel s kresbou, 103 dílů vozidel, 156 dílů světa, **0 placeholderů**.
- `flock /tmp/vlacek-playwright.lock volta run npm run test:e2e -- --workers=2`: **356 passed, 4 skipped**, 31,1 min. Čtyři přeskočené jsou vícedotykové testy v desktopovém projektu.
- `volta run npm run report:budgets`: počáteční přenos **3440,3 KiB** (gzip 855,5 KiB) z 10 240 KiB.

## Jízda: `measure:perf`

`PERF_SECONDS=30 PERF_LOCOMOTIVE=steam_express PERF_WAGON=cargo_cars volta run npm run measure:perf` pod Playwright zámkem, souprava `steam_express` + `cargo_cars`, 7 vozidel, vždy všech 7 vykreslených, bez chyb.

Stroj nebyl nečinný: průměrná zátěž 11–16 po celé E2E sadě a s běžícími desktopovými aplikacemi. Nečinné měření 59,9 FPS z [brány sloučeného PR #6](2026-10-10-iterace-upravy.md) proto nejde přímo porovnat. Rozhoduje střídavé měření `master` (`0.1.0+8f1a8a7`) a této změny (`0.1.0+df17712`) za stejných podmínek:

| Běh            | Build     |         Medián FPS |            p95, ms |  Nejhorší, ms |
| -------------- | --------- | -----------------: | -----------------: | ------------: |
| samostatně 1–3 | `df17712` | 29,9 / 29,9 / 30,0 | 50,1 / 50,1 / 50,0 | 83 / 83 / 117 |
| střídavě 1     | `master`  |               20,0 |               66,7 |           100 |
| střídavě 1     | `df17712` |               30,0 |               50,0 |           150 |
| střídavě 2     | `master`  |               30,0 |               50,1 |           200 |
| střídavě 2     | `df17712` |               30,0 |               50,0 |           117 |

Viditelná jízda se nezhoršila: ve stejných podmínkách je změna stejná nebo lepší než `master`. Rozpočet dokumentu 11 (medián ≥ 30, p95 ≤ 50) tato zátěžová měření splňují jen na hraně; nečinné ověření rozpočtu se neopakovalo. Logy jsou mimo repozitář (`_runs/perf-pr8/`).

## Recenze

Nezávislé recenze Codex GPT-6-Astra, read-only:

- **Vývojářské volby:** FIX.
  - Nález: reload i při neuloženém stavu, kdy se ztratila rozehraná cesta.
  - Další nálezy: časový závod branky v E2E, propojení s potlačením renderu a 100vagonový postup v matici zařízení.
  - Po opravách **LAND**. Propojení s panelem bylo vyřešeno při integraci.
- **Jízda za neprůhlednými obrazovkami**, dvě kola FIX:
  1. záblesk smazaného canvasu ve 30 FPS profilu a ztracené prolínání biomů;
  2. odkrytí při ztrátě kontextu WebGL, test čekající na nasycený `frameSamples` a pozorovatel otočení.

  Vše opraveno a potvrzeno v recenzi celého PR.

- **Celý PR:** FIX s jediným nálezem, zastaralou větou D-006 o diagnostice. Po opravě **LAND**. Oprava je samostatný dokumentační commit, protože pushnutá historie se nepřepisuje.

## Omezení

- Fyzický Android tablet a Tesla: **NEOVĚŘENO**. Měření CPU ×4 je emulace na desktopu.
- Kvalita `auto` je dál totéž co `standard`; adaptivní řízení zůstává v R4.
- Měření před a po jsou jednorázová.
