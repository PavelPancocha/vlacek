# D-003: Hranice čisté domény a ochrany repozitáře

Datum: 2026-10-09. Stav: přijato.

AGENTS.md vyžaduje od M0 vynucenou hranici domény včetně cest přes aliasy a re-exporty, kontrolu tajných údajů a limit nechtěně velkých souborů v pre-commit hooku.

**Hranice.** Čistou zónu tvoří `src/domain` a `src/config`. ESLint `no-restricted-imports` neumí rozlišit relativní cíl podle umístění souboru ani dynamický `import()`. Proto používáme malé lokální pravidlo `vlacek/pure-imports`: čistý soubor smí importovat jen relativní cestu, která se vyhodnotí uvnitř zóny. Re-exporty tak ven vést nemohou indukcí. Aliasy ani balíčky se nepovolují vůbec. Globální objekty, hodiny a náhodnost blokují vestavěná pravidla ESLint. Testy pravidla používají skutečnou projektovou konfiguraci; type-aware pravidla v nich vypínají, protože hranice je syntaktická. TypeScript projekt domény bez DOM typů přidáme s prvním doménovým modulem (`tsc` bez vstupních souborů selže). Externí plugin pro hranice by přidal závislost pro jedno pravidlo.

**Tajné údaje.** `secretlint` 13.0.6 s `@secretlint/secretlint-rule-preset-recommend` běží offline v Node, maskuje nalezené hodnoty a respektuje `.gitignore`. Zvolená verze byla v době zavedení dva týdny stará; 13.0.7 vyšla o šest dní dříve. gitleaks či detect-secrets by vyžadovaly stahovanou binárku nebo Python. Úplná kontrola (`check:secrets`) předává seznam souborů z Gitu, aby zahrnula i dotfiles a `.github/`. Testovací tajemství se skládá až za běhu, aby se necommitovalo.

**Velikost.** Obecný limit 1 MiB pokrývá zdroje, dokumentaci i lockfile s rezervou. Herní assety v `public/assets/` mají limit 4 MiB na soubor, aby se vešel atlas 2048 × 2048 z dokumentu 07 a jednotlivé soubory nezabraly zásadní část rozpočtu 10 MiB prvního načtení a 45 MiB offline balíku. Větší soubor vyžaduje vědomou změnu limitu a nové rozhodnutí.

Důsledky: hook a `npm run check` volají stejné skripty. Lokální hook lze obejít, skutečnou bránou zůstává CI. Kontrola tajných údajů je pojistka proti omylu, ne audit.
