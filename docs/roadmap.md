# Stav a další kroky

Stav k 2026-10-10. Rozsah a brány milníků vlastní [implementační plán](../vlacek-predavaci-balicek/10_IMPLEMENTACNI_PLAN.md) a úpravy po první verzi [dokument 14](../vlacek-predavaci-balicek/14_UPRAVY_PRVNI_VERZE.md). Tento soubor jen shrnuje, co je hotové, co zbývá a v jakém pořadí. Ověření jednotlivých kroků je v [protokolu v0.1](validation/2026-10-09-v0.1.md) a v [protokolu iterace podle dokumentu 14](validation/2026-10-10-iterace-upravy.md).

## Hotovo

| Milník (dokument 10)            | Stav     | Co funguje                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 a M1                         | hotovo   | Verze 0.1: dotykové řízení, dojezd, brzda, depo, pauza, ukládání a obnova ([D-006](decisions/006-runtime-architecture.md)).                                                                                                                                                                                                                                         |
| M2 — nekonečná trať a prostředí | většinou | Generátor v1 ([D-009](decisions/009-track-generator-v1.md)), šest biomů s přechody ([D-013](decisions/013-landscape-localities-and-backdrops.md)), most a tunel s průjezdem po vozidlech ([D-018](decisions/018-bridges-and-tunnels.md)), elektrifikace celé trasy ([D-016](decisions/016-electric-locomotive-and-catenary.md)). Chybí den, noc a počasí.           |
| M3 — živý svět a interakce      | částečně | Přejezdy s automatem a provozem ([D-015](decisions/015-level-crossings.md)), nádraží bez povinného zastavení, druhá kolej s protijedoucím vlakem ([D-017](decisions/017-second-track-and-oncoming-train.md)), zvířata s reakcí na dotyk. Chybí scénky dokumentu 05 a reakce aut a kol na dotyk.                                                                     |
| M4 — obsah a výtvarný základ    | částečně | Detailní vektorová grafika všech současných vozidel ([D-011](decisions/011-vector-vehicle-art-and-atlas.md)), kolej a terén ([D-012](decisions/012-track-tiles-and-terrain.md)), krajina z 18 lokalit, částice a drobné animace ([D-014](decisions/014-particles-and-small-animations.md)). Katalog má 4 z 10 lokomotiv a 7 z 32 druhů vagonků, zvuky jsou dočasné. |
| M5 — PWA a vydání V1            | nezačato | Hra běží jako online web na GitHub Pages ([D-002](decisions/002-github-pages.md)).                                                                                                                                                                                                                                                                                  |

Dokument 14 je splněný v §1–7: pořadí soupravy, celý vlak v obraze s délkovým limitem ([D-008](decisions/008-whole-train-in-view.md)), detailní grafika, částice, bohatší krajina s přejezdy, druhou kolejí, mosty a tunely, svižnější jízda a snímky ze skutečné aplikace.

## Rozhodnutí, která čekají na vlastníka

- **Číslo světa u příliš dlouhé jízdy z 0.1.** Taková jízda nemůže pokračovat; hráč vlak zkrátí v depu a vyjede v novém světě, stejně jako po každé úpravě vlaku. Codex navrhl staré číslo zachovat. Zatím beze změny, rozhodnutí je ve vlákně PR #2.

## Další kroky v pořadí

1. **H0 — atlas pro jednu jízdu** (podmínka [D-011](decisions/011-vector-vehicle-art-and-atlas.md)). Celý katalog se do jednoho atlasu při 2,5 px/u nevejde.
   - Atlas bude obsahovat jen vozidla jízdy a seedem vybranou sadu protijedoucích vlaků: 2 parní nebo naftové lokomotivy a 6 druhů vagonků místo celého katalogu.
   - Po každém výjezdu se atlas přestaví. Depo zůstává u SVG.
   - Nové rozhodnutí D-019. Test rozpočtu atlasu počítá nejhorší jízdu.
2. **H1 — šest chybějících lokomotiv** podle dokumentu 06 §2: `steam_express`, `diesel_shunter`, `electric_modern`, `electric_mountain`, `magic_bubbles`, `magic_rainbow`.
   - Detailní vektorová grafika ve stylu současných vozidel, bez obličejů a log.
   - Velká parní dostane větší hnací kola a táhla, elektrické pantograf, fantazijní vlastní částice.
   - Výběr deseti lokomotiv se musí vejít i na telefon naležato.
3. **H2 — 25 chybějících druhů vagonků** po skupinách dokumentu 06 §3, s jedním commitem na skupinu:
   - osobní (4);
   - služební (2);
   - nákladní (13);
   - hravé (6).

   Každý druh má vlastní kresbu, ne přebarvenou kopii. Výsledkem je kontaktní list všech 42 vozidel ze skutečné aplikace a `validate:assets --release` bez placeholderů.

4. **H3 — bubliny a duha.** Bublinková mašinka pouští bubliny, které jde dotykem prasknout souběžně s plynem. Duhová mašinka pouští barevné obláčky.
5. **Potom (M3–M5):**
   - scénky dokumentu 05;
   - varianty infrastruktury dokumentu 06 §5 (ocelový most, viadukt, skalní tunel, další nádraží);
   - chybějící zvířata dokumentu 06 §6 (datel, ryba, sova);
   - porovnání lokalit se sestavami dokumentu 06 §7;
   - den, noc a počasí;
   - finální zvuky;
   - PWA a offline (M5);
   - test na skutečných zařízeních.

Volitelné místní reakce vagonků (dokument 06 §3) zůstávají mimo tento plán, dokud je vlastník nevyžádá.

## Známá omezení

Každé omezení má podmínku odstranění v uvedeném rozhodnutí.

- **Zvuky** jsou syntetizované tóny. Zvonění přejezdu i zvuk lokomotivy v tunelu přijdou s finálními zvuky ([D-015](decisions/015-level-crossings.md), [D-018](decisions/018-bridges-and-tunnels.md)).
- **Světla lokomotiv** chybí. Přijdou se dnem a nocí ([D-017](decisions/017-second-track-and-oncoming-train.md), [D-018](decisions/018-bridges-and-tunnels.md)).
- **Souběžná kolej** zatím nemá vedení a protijedoucí vlak je parní nebo naftový. Doplní se s další elektrickou lokomotivou ([D-016](decisions/016-electric-locomotive-and-catenary.md), [D-017](decisions/017-second-track-and-oncoming-train.md)).
- **Portálové podpěry vedení ve stanici** chybí. Přijdou s vícekolejnými nádražími ([D-016](decisions/016-electric-locomotive-and-catenary.md)).
- **Zem se kreslí nejvýše 1 px/u.** Zvýší se, pokud test zařízení ukáže rušivou neostrost ([D-013](decisions/013-landscape-localities-and-backdrops.md)).
- **WebGL dávky s jednou texturou** obcházejí chybu Phaseru 4.2.1 ([D-010](decisions/010-webgl-single-texture-batches.md)).
- **Fyzický tablet, telefon a Tesla:** NEOVĚŘENO ([matice zařízení](device-tests/v0.1.md)).
