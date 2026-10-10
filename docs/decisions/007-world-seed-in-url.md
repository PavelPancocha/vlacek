# D-007: Číslo světa a parametr `?seed`

Datum: 2026-10-10. Stav: přijato.

Dokument 04 §11 požaduje, aby šly chyby layoutu reprodukovat seedem a indexem chunku, a dokument 04 §3 definuje seed cesty jako nezáporné 32bitové číslo. Verze 0.1 seed losovala bez možnosti ho zvolit nebo zjistit mimo diagnostiku, takže hezký ani chybný svět nešlo zopakovat.

**Rozhodnutí.**

- Parametr adresy `?seed=N` (desítkové číslo 0–4294967295) určí seed každé **nové** cesty v této stránce: první jízdy z domova i „Vyjet s tímto vlakem“ z depa. Jiná hodnota (záporná, desetinná, hex, mimo rozsah, s mezerou) se ignoruje a seed se losuje jako dřív. Parsování je v `seedOverride` (`src/platform/CapabilityProbe.ts`), napojení v `src/main.ts`.
- „Pokračovat“ vždy obnoví uloženou cestu s jejím vlastním seedem; parametr ji nepřepisuje.
- Pauza ukazuje drobně a vybledle „Svět N“ nad identifikací buildu, aby dospělý mohl číslo opsat. Není to tlačítko ani dětská volba; ladicí zkratky dál patří jen do `?debug=1`.

**Důsledky.** Stejný svět se zopakuje jen se stejnou verzí generátoru: seed a build je proto potřeba hlásit spolu (oba jsou na pauze i v `window.__vlacek.snapshot()`). Generátor V1 (M2) dá stejnému číslu jiný svět, viz [D-005](005-provisional-track-generator-v0.md). Start na zvoleném indexu chunku zatím neexistuje; reprodukce konkrétního chunku jde přes jednotkové testy `generateTrackProfile` a `chunkObjects`, ve hře dojetím.

**Kompatibilita.** Formát uložené hry se nemění, seed se ukládá jako dosud. Bez parametru se hra chová stejně jako 0.1.0.
