# Původ herních assetů

Evidence podle [dokumentu 07 §11](../vlacek-predavaci-balicek/07_VIZUAL_AUDIO_UX.md). Každá sada má původ a podmínky použití. Dočasné placeholdery jsou výslovně označené a nejsou součástí akceptace katalogu.

| Sada                                               | Soubory                                                                                 | Původ                   | Podmínky              | Stav                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Siluety vozidel (3 lokomotivy, 7 vagonků) a ovečka | žádné; polygony v `src/content/placeholderShapes.ts`, barvy v `src/content/vehicles.ts` | vlastní kód projektu    | stejné jako repozitář | **PLACEHOLDER** (M0/M1), finální sady v M4; `validate:assets -- --release` je odmítne |
| Krajina (obloha, kopce, zem, kolej)                | žádné; kreslí `src/render/RideScene.ts`                                                 | vlastní kód projektu    | stejné jako repozitář | **PLACEHOLDER**, nahradí biomové vrstvy v M2/M4                                       |
| Ikony ovládání                                     | žádné; SVG cesty v `src/ui/icons.ts`                                                    | vlastní kresba projektu | stejné jako repozitář | dočasné, přepracovat při výtvarném sjednocení                                         |
| Zvuky (píšťaly, reakce, plný vlak)                 | žádné; syntéza Web Audio v `src/platform/AudioManager.ts`                               | vlastní kód projektu    | stejné jako repozitář | **PLACEHOLDER**, nahradí nahrané zvuky                                                |

Build zatím neobsahuje žádné obrázky, zvuky ani fonty; používá se systémový font. Licence knihoven přibalených do buildu jsou v [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
