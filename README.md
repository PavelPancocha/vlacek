# Vláček — implementační předání

**Pracovní název:** Vláček  
**Verze specifikace:** 1.0 · **Datum:** 9. října 2026  
**Jazyk hry:** čeština; hlavní ovládání obrázky, bez nutnosti číst.  
**Výstup tohoto balíčku:** zadání a kontrakty pro implementaci, nikoli hotová hra.

## Co se má postavit

Jednoduchá 2D webová hra pro malé dítě. Před cestou si dítě vybere jednu z **10 odlišných lokomotiv** a připojí libovolnou kombinaci až **100 vagonků z 32 druhů**. Číselné limity vagonků jsou výchozí návrh, nikoli dříve potvrzené číslo zadavatele. Potom jede zleva doprava po nekonečné, procedurálně skládané trati. Držení prstu v herním světě vlak rozjíždí, puštění jej postupně zastaví. Vlevo dole je velká brzda; doleva lze také zabrzdit gestem.

Krajina je převážně středoevropská, postupně zahrnuje lesy, pole, vodu, podhůří, hory a pobřeží. Jsou v ní nádraží, mosty, tunely, fungující přejezdy, okolní provoz a zvířata. Dotyk vyvolává jednoduché reakce. Hra nemá skóre, prohru, povinné úkoly ani minihry. Nádraží lze projet. Scénky nezávisí na nákladu nebo složení vagonků. U elektrické lokomotivy se automaticky zobrazí trolejové vedení podél celé použité trasy.

**Technický výchozí návrh:** TypeScript + Phaser + Vite; statický web s volitelnými PWA funkcemi. Žádný backend, účet, obchod s aplikacemi ani síťová AI nejsou součástí V1. Cílem je Android tablet a běžný prohlížeč, včetně ověření na konkrétní Tesle Model 3 2019 s Intelem. Podpora konkrétních funkcí Tesly zatím není změřena ani garantována.

## Rozcestník

| Soubor                                                                              | Obsah a vlastník rozhodnutí                                       |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [01_GAME_DESIGN.md](vlacek-predavaci-balicek/01_GAME_DESIGN.md)                     | Záměr, rozsah V1, herní smyčka, co se záměrně nedělá.             |
| [02_OVLADANI_A_STAVY.md](vlacek-predavaci-balicek/02_OVLADANI_A_STAVY.md)           | Dotyky, brzda, gesta, souběh prstů, menu, pauza, depo.            |
| [03_VLAK_A_JIZDA.md](vlacek-predavaci-balicek/03_VLAK_A_JIZDA.md)                   | Pohyb, dlouhá souprava, geometrie, kamera, elektrifikace.         |
| [04_PROCEDURALNI_SVET.md](vlacek-predavaci-balicek/04_PROCEDURALNI_SVET.md)         | Seed, úseky, kontinuita tratě, biomy, streaming, čas a počasí.    |
| [05_SCENKY_A_INTERAKCE.md](vlacek-predavaci-balicek/05_SCENKY_A_INTERAKCE.md)       | Nádraží, závory, silniční provoz, druhé koleje, zvířata a reakce. |
| [06_KATALOG_OBSAHU.md](vlacek-predavaci-balicek/06_KATALOG_OBSAHU.md)               | Závazný katalog 10 lokomotiv, 32 vagonků a základních scén.       |
| [07_VIZUAL_AUDIO_UX.md](vlacek-predavaci-balicek/07_VIZUAL_AUDIO_UX.md)             | Výtvarný směr, vrstvy, assety, zvuk, přístupnost a rozložení.     |
| [08_ARCHITEKTURA_A_DATA.md](vlacek-predavaci-balicek/08_ARCHITEKTURA_A_DATA.md)     | Moduly, typové kontrakty, ukládání, migrace a struktura projektu. |
| [09_WEB_PWA_ANDROID_TESLA.md](vlacek-predavaci-balicek/09_WEB_PWA_ANDROID_TESLA.md) | Platformy, offline režim, aktualizace, nasazení a kompatibilita.  |
| [10_IMPLEMENTACNI_PLAN.md](vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md)       | Pracovní balíčky, závislosti a definice hotové práce.             |
| [11_TESTY_A_AKCEPTACE.md](vlacek-predavaci-balicek/11_TESTY_A_AKCEPTACE.md)         | Funkční, generativní, integrační a ruční testy; výkonové cíle.    |
| [12_ROZHODNUTI_A_ZDROJE.md](vlacek-predavaci-balicek/12_ROZHODNUTI_A_ZDROJE.md)     | Potvrzené požadavky, doplněné výchozí volby, rizika a zdroje.     |
| [13_VYCHOZI_KONFIGURACE.md](vlacek-predavaci-balicek/13_VYCHOZI_KONFIGURACE.md)     | Centrální číselné parametry a jejich význam.                      |
| [AGENTS.md](AGENTS.md)                                                              | Pracovní instrukce pro implementátora nebo kódovacího agenta.     |

## Jak balíček používat

Nejprve přečíst tento soubor, game design a rozhodnutí. Před implementací vstupů přečíst celý dokument 02; před implementací tratě společně 03 a 04. Plán práce je v dokumentu 10. Dokument 11 je součást zadání od začátku, nikoli až závěrečný seznam přání.

V tomto repozitáři jsou specifikace ve složce `vlacek-predavaci-balicek/`; tento README je jejich rozcestník. Kořenový [AGENTS.md](AGENTS.md) určuje pracovní postup včetně TDD, povinné dokumentace a pravidel udržitelnosti. Při případném přesunu do `docs/spec/` oprav i odkazy a nevytvářej druhou kopii specifikací. Herní aplikace zatím není implementovaná; vývojové nástroje, lokální hook a workflow GitHub Actions už jsou součástí repozitáře.

### Vývojové prostředí a kontroly od prvního dne

Použij [Volta](https://docs.volta.sh/guide/getting-started) a verze Node/npm připnuté v [package.json](package.json). V kořeni repozitáře Volta automaticky vybere projektové verze; závislosti zůstávají v lokálním `node_modules/`.

```bash
volta run npm ci
volta run npm run check
```

`npm ci` také nainstaluje lokální Git hook. `npm run check` ověří formátování, lint, TypeScript, Vitest testy a místní odkazy v dokumentaci. GitHub Actions spouští stejný příkaz na push a pull request. Testy zatím ověřují vývojové nástroje a dokumentaci, nikoli hru. Herní build a browserové testy přibudou s prvním hratelným řezem.

Podrobná instalace, příkazy, TDD, chování hooku a omezení kontrol jsou ve [vývojovém návodu](docs/development.md); volbu prostředí vysvětluje [rozhodnutí D-001](docs/decisions/001-toolchain.md).

### Pravidla autority

- **POTVRZENO:** explicitní požadavek zadavatele, souhrn v dokumentu 12. Má přednost před dřívějšími návrhy v konverzaci.
- **VÝCHOZÍ VOLBA:** rozhodnutí doplněné tímto zadáním, aby implementace nečekala na další otázky. Platí pro V1, dokud se vědomě nezmění.
- **POZDĚJI:** není součástí akceptace V1.
- Číselné parametry vlastní dokument 13; katalog obsahu dokument 06; logiku jednotlivých oblastí dokument uvedený v rozcestníku.
- Výkonnostní rozpočty jsou cíle k ověření. Nesmí být prezentovány jako naměřené výsledky.

Pokud se při implementaci objeví rozpor, zachovat potvrzený požadavek, zapsat krátké rozhodnutí a opravit související dokument i test. Nevracet automaticky starší zamítnuté nápady.

## Nejdůležitější invarianty

1. Vlak nikdy nevyjede ze své koleje, nejede pozpátku a nemůže havarovat.
2. Bez prstu se plynule zastavuje; automatické rozjezdy a povinné zastávky nejsou povolené.
3. Brzda má přednost před plynem. Menu a tlačítka nepropouštějí dotyk do řízení.
4. Dotyk zvířete či jiného objektu může zároveň pohánět vlak; žádná interakce nepřepíná scénu ani nezastavuje jízdu.
5. Po pauze, ztrátě fokusu nebo obnově stránky nejsou aktivní staré dotyky; k jízdě je potřeba nový dotyk.
6. Všechny vagonky sledují tentýž geometrický průběh tratě, každý ve své poloze.
7. Trať se nesmí odstranit před posledním vagónkem. Přejezd se neotevře mezi lokomotivou a koncem soupravy.
8. Žádný typ vagónku není podmínkou scénky. Jediná globální vazba typu lokomotivy na svět je elektrifikace; další odlišnosti jsou audiovizuální.
9. Nekonečnost znamená průběžně generovaný svět s omezenou pamětí, ne předem vygenerovanou nekonečnou mapu.
10. Základní online hra nesmí vyžadovat PWA instalaci, fullscreen, service worker ani trvalé místní úložiště.

## Co má implementátor skutečně dodat

Zdrojový kód, automatické testy, vlastní nebo řádně použitelné assety a jejich evidenci, reprodukovatelný build, návod ke spuštění, nasazení statické verze, popis ukládání a aktualizací a vyplněnou matici testovaných zařízení. V1 obsahuje celý katalog, nikoli jen technickou ukázku s jednou lokomotivou.

Technický prototyp a menší průběžné milníky jsou povolené a žádoucí. Nejsou náhradou finálního rozsahu.
