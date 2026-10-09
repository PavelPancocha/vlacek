# D-005: Dočasný generátor trati v0 pro verzi 0.1

Datum: 2026-10-09. Stav: přijato.

Verze 0.1 (M0 + M1) potřebuje nekonečnou trať s kopci a ukládání rozehrané cesty. Úplný generátor V1 z dokumentu 04 s biomy, rezervacemi a scénami patří do M2. Rezervace změní profily (stanice a přejezd chtějí `flat-middle`). Kdyby 0.1 ukládala cesty pod `generatorVersion: 1`, M2 by pod uloženou soupravou potichu vyměnil geometrii. To dokument 08 §7 zakazuje.

**Rozhodnutí.** 0.1 používá generátor **verze 0**. Je to přesně referenční konstrukce dokumentu 04 §4: výšky hranic `H(k)` z klíče `terrain-boundary`, profily `smooth`, `hill`, `dip` a `flat-middle` se smootherstep přechody a prostřední výška vybraná analyticky v přípustném intervalu sklonu ≤ 0.12. Druh profilu volí klíč `profile-kind` (40 % smooth, 25 % hill, 25 % dip, 10 % flat-middle), prostřední výšku klíč `profile-middle`. Biomy, rezervace ani scény v0 nemá. Geometrické vstupy (šířka chunku, maximální sklon, měřítko výšek, vzorkování LUT) čte z dokumentu 13. Jejich změna je změnou generátoru a vyžaduje novou verzi.

Uložená cesta nese `generatorVersion: 0`. Validace verze 0.1 přijímá jen 0. Generátor V1 podle dokumentu 04 dostane verzi 1, jak uvádí dokument 13.

**Kompatibilita pro M2.** Při načtení cesty s `generatorVersion: 0` buildem s generátorem V1 se zachová souprava i nastavení. Po upozornění rodiče („Trať se změnila, vlak vyjede na novou cestu.“) se založí nová cesta, ledaže by M2 vědomě ponechal generátor v0 pro dojetí staré cesty. Potichu se geometrie nemění nikdy.

**Důsledky.** Testy GEN-01, 02, 04, 05 a odlehčené GEN-09, 10, 11 platí už pro v0, takže M2 přidává jen biomy, rezervace a scény nad ověřenou geometrií. Testy jsou v `tests/unit/world/`, referenční hodnoty `hash32` z dokumentu 11 procházejí beze změny.
