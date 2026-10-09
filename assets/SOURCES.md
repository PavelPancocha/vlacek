# Původ herních assetů

Evidence podle [dokumentu 07 §11](../vlacek-predavaci-balicek/07_VIZUAL_AUDIO_UX.md). Každá sada má původ a podmínky použití. Dočasné placeholdery jsou výslovně označené a nejsou součástí akceptace katalogu.

| Sada                                              | Soubory                                                                           | Původ                | Podmínky              | Stav                                                                                  |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Dočasné vozidlové tvary (3 lokomotivy, 7 vagonků) | žádné; barvy a siluety v `src/content/vehicles.ts` (`placeholder`), kreslí je kód | vlastní kód projektu | stejné jako repozitář | **PLACEHOLDER** (M0/M1), finální sady v M4; `validate:assets -- --release` je odmítne |
| Ukázková scéna vykreslování                       | žádné; tvary kreslí kód v `src/render/PreviewScene.ts`                            | vlastní kód projektu | stejné jako repozitář | **PLACEHOLDER** (M0), nahradí jej renderer jízdy                                      |

Build zatím neobsahuje žádné obrázky, zvuky ani fonty; používá se systémový font. Licence knihoven přibalených do buildu jsou v [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).
