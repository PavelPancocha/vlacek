# D-010: WebGL dávky s jednou texturou

Datum: 2026-10-10. Stav: přijato. Dočasné opatření s podmínkou odstranění.

Ve WebGL rendereru Phaseru 4.2.1 se otočené obrázky vozů občas vykreslovaly jako zkosené klíny: obrys karoserie seděl, ale vnitřek textury byl střižený podél úhlopříčky čtyřúhelníku. Projevovalo se to jen ve svahu a jen u některých textur (krytý, uhelný, kontejnerový, jeřábový a otevřený vůz), ve stejném snímku Canvas rendereru nikdy. Pokusy postupně vyloučily čtyři hypotézy: zdroj textury (`Graphics.generateTexture` i 2D canvas textura se chovaly stejně), otočený `Container` (samostatné obrázky se chovaly stejně), `setTexture` v každém snímku a zaokrouhlování pixelů, které posouvá vrchol nejvýš o 1 px, kdežto klíny o desítky.

Chyba zmizela s `render.maxTextures: 1`. Příčina je tedy v dávkování více textur najednou (multi-texture batching): když se v jedné dávce střídají textury karoserií a kol, část čtyřúhelníků dostane špatná data vrcholů. Phaser 4.2.1 je nejnovější vydaná verze (npm, 2026-10-10), takže aktualizace řešení nenabízí.

**Rozhodnutí.** `GameHost` nastavuje `render: { maxTextures: 1 }`. Každá dávka má jednu texturu a renderer při změně textury dávku odešle.

**Ověření.** E2E `tests/e2e/render.spec.ts` postaví vlak se „zrádnými“ vozy na dlouhý rovný svah světa 123 (seedovaný save) a porovná stejný stojící snímek z WebGL a Canvas uvnitř rámečku soupravy. S opatřením se liší 0 % pixelů, bez něj 1,2–2,1 %. Práh testu je 0,2 %.

**Důsledky.** Víc volání kreslení: přibližně jedno na každé střídání textury, u nejdelší soupravy desítky za snímek. Na výkon se to musí znovu změřit s novou grafikou.

**Podmínka odstranění.** Až budou vozidla a kola v jednom atlasu (grafická iterace, dokument 07 doporučuje atlasy), nebo až to opraví vydání Phaseru, zkusí se výchozí `maxTextures` znovu. Rozhoduje test `render.spec.ts`.

**Opakovaný pokus (2026-10-10, [D-011](011-vector-vehicle-art-and-atlas.md)).** Se všemi vozidly v jednom atlasu prošel původní test i s výchozím `maxTextures` (3 běhy). Při stejném snímku se zablokovanou grafikou ale vlak kreslí z několika textur (fallback siluety a kola) a bez opatření se lišilo 0,98 % a 0,97 % pixelů rámečku. Chyba v Phaseru 4.2.1 tedy trvá. Opatření zůstává, protože krajina a částice budou textury střídat. Nový test „D-010: interleaved textures“ v `render.spec.ts` tento případ hlídá. Zbývající podmínka odstranění je vydání Phaseru s opravou ověřené oběma testy.
