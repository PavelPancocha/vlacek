# D-009: Generátor trati v1 — roviny a rovné sklony

Datum: 2026-10-10. Stav: přijato. Navazuje na [D-005](005-provisional-track-generator-v0.md).

Zadání [14 §6](../../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md) požaduje pestřejší výškový profil, který nepřipomíná sinusovku ani horskou dráhu: roviny a delší rovná stoupání a klesání spojená krátkými plynulými zaobleními v nepravidelných délkách. Generátor v0 verze 0.1 skládal smootherstep přechody s nulovým sklonem na každé hranici chunku. Měření na světech 1, 77 a 123 ukázalo, že se sklon mění na **91–95 %** délky a výška zůstává v ±42 u.

**Rozhodnutí.** Generátor **v1** plánuje trať po blocích 8 chunků jako lomenou čáru rovin (384–1536 u) a sklonů (768–2304 u, 3–8 %). Zlomy nahrazují parabolické přechody délky 192 u. Bloky začínají a končí rovinou v seedované výšce (±160 u), takže chunk se počítá jen ze svého bloku. Výška zůstává v ±400 u. Přesná konstrukce je v dokumentu 04 §4, parametry v `world.profile` (dokument 13). Na stejných světech se sklon mění na méně než 25 % délky; test to hlídá.

**Kompatibilita uložené hry.**

- `generatorVersion` nových cest je 1. Validace save (`SaveValidation`) už verzi generátoru neomezuje na známé hodnoty, jen na celé číslo 0–1000. Cesta z jiné verze dřív neprošla validací a celý save se zahodil jako poškozený i se soupravou a nastavením, což dokument 08 nedovoluje.
- `GameSession` u cesty ze starší verze generátoru (0.1) zachová soupravu i číslo světa. Novou cestu začne na startu a ukáže „Trať se změnila, vlak vyjede na novou cestu.“ (`track-changed`). Pod uloženou soupravou se tedy nikdy potichu nemění geometrie.
- Cestu z **novější** verze generátoru (save novějšího buildu) validace hlásí jako novější save, stejně jako vyšší `schemaVersion`. Hra pak běží jen v paměti a uložená data nepřepíše (`newer-save-kept`, dokument 08 §7, DATA-04). Dřív by ji první checkpoint přepsal cestou v1 (Codex review PR #2).
- ID entit nesou verzi (`g1:chunk:…`), takže se staré a nové objekty nepletou.

**Důsledky.** Testy GEN-01/02/04/05 platí pro v1. Nové testy hlídají charakter tratě (převaha konstantního sklonu, roviny i dlouhé sklony oběma směry, různé délky), plynulost přechodů a to, že se oblouky nepřekrývají. Zátěžový profil pro geometrii soupravy (TRN-03, TRN-10) odpovídá nejprudšímu případu v1 a bere hodnoty z konfigurace. Nádraží a přejezdy z M2 se mají umístit na existující roviny plánu, aby geometrie v1 zůstala. Změna kteréhokoli parametru `world.profile` znamená novou verzi generátoru.
