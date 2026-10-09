# D-001: Vývojové prostředí a CI od prvního dne

Datum: 2026-10-09. Stav: přijato.

Potřebujeme reprodukovatelné lokální nástroje, TDD a GitHub Actions ještě před vznikem hry. Použijeme existující Voltu s projektovým pinem Node/npm, lokální npm devDependencies a jediný lockfile. Globální výchozí runtime jiných projektů se nemění. Python virtualenv ani kontejner by pro současné nástroje nepřidal potřebnou izolaci.

CI i lokální vývoj používají `npm ci` a `npm run check`. První skutečné testy chrání validátor odkazů a navigaci specifikací. Nevytváříme prázdné build/E2E příkazy: budou součástí prvního herního řezu. Dokud není implementovaný kód domény, netvrdíme, že jsou její hranice automaticky vynucené.

TypeScript je připnutý na 6.0.3, protože vybraná verze typescript-eslint podporuje TypeScript `<6.1.0`; nejnovější TypeScript 7 by byl mimo deklarovanou kompatibilitu. Ostatní přesné verze vlastní manifest a lockfile. Při upgradu ověříme kompatibilitu celé sady a její kontroly, nikoli pouze číslo nejnovějšího vydání.

Husky a lint-staged zajišťují rychlé kontroly staged souborů. Prettier sjednocuje i dodané specifikace; jejich obsah se tím nemění. marked správně rozpoznává Markdown syntaxi místo vlastního regulárního parseru. Lokální odkazy kontrolujeme bez sítě; externí URL a fragmenty jsou mimo současný rozsah.

Podrobné příkazy, omezení a povinnosti dokumentace jsou ve [vývojovém návodu](../development.md). Pravidla snižují riziko regresí; nenahrazují skutečné herní a hardwarové testy.
