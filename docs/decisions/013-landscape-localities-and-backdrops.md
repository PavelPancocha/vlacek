# D-013: Krajina z lokalit, parallax pozadí a kreslení bez MSAA

Datum: 2026-10-10. Stav: přijato.

Dokument 14 §5 chce bohatší krajinu z logických lokalit, ne náhodnou změť: farma k polím, rákosí k vodě, nástupiště k nádraží. Klidné úseky se mají střídat s bohatšími a dekorace nesmí dlouhodobě zakrývat vlak. Dokument 14 §3 chce detailní poloreálnou grafiku. Dokument 07 §3 určuje vrstvy a dvě až tři rychlosti parallaxy, dokument 04 §5 šest biomů a gramatiku trasy.

Vlastník zvolil „vektory a vyřezaná scenérie“. Referenční listy ale nikdy nebyly v repozitáři jako soubory, jen jako obrázky v konverzaci, takže z nich nelze nic vyřezat ani evidovat původ. Proto je i scenérie vlastní vektorová kresba ve stylu listů. Jakmile vlastník listy uloží do `docs/reference/art/`, výřez se znovu posoudí.

## Rozhodnutí

1. **Biomy a lokality v doméně.** Doména určuje biomy a lokality, renderer je jen kreslí.
   - `biomeAt(seed, k)` (`src/domain/world/Biomes.ts`) počítá biom z gramatiky dokumentu 04 §5: osm chunků v bloku, osm bloků v cyklu, itinerář A, B nebo C podle hashe cyklu.
   - `chunkScenery(seed, k)` (`src/domain/world/Scenery.ts`) vybere lokalitu podle slotu a rozmístí její rekvizity. Šablony lokalit jsou data v `sceneryTemplates.ts`.
   - Sloty:
     - Slot 0 je klidný.
     - Nádraží stojí ve slotu 1 nebo 2 na rovině dlouhé aspoň 448 u.
     - Slot 7 je přechod: od x = 512 platí klidná lokalita dalšího biomu.
   - Rozmístění rekvizit:
     - Každé pravidlo má omezený počet pokusů (`world.maxPlacementAttempts`).
     - Rekvizita má stabilní ID `g1:chunk:k:prop:n`.
     - Vrstva `back` leží za tratí v hloubce 0 u koleje až 1 na obzoru, vrstva `near` na louce před tratí.
   - Interaktivní zvíře zůstává na své dosavadní poloze. Druh a hloubku mu přidělí lokalita, ve které stojí.
2. **Voda.** Rybníky, jezera a zálivy jsou rovné nádrže (`WaterBasin`) v rámci jednoho chunku.
   - Hladina má na vzdálené straně stálou výšku podle nejvyššího bodu koleje u nádrže, takže se na svahu nenaklání. Blízký břeh sleduje násep.
   - Oba konce se zaoblí na `WATER_END_U` (72 u), takže voda nikdy nepřechází přes hranici chunku a každá nádrž má vlastní hladinu.
   - Doménové invarianty:
     - Lodě i se svou trasou zůstávají na vodě.
     - Domy, stromy a maják stojí na suchu.
     - Nádraží nemá vodu.
     - Traktor, auto a lodě nejsou v polovinách přechodového chunku.
3. **Nic nezakryje vlak.** Rekvizita v blízké louce v hloubce d smí být i s perspektivním zvětšením `nearDepthScale(d) = 1 + 0,5 d` nejvýše `26 + 440 d` u vysoká.
   - Renderer ji staví nejméně 30 u pod kolejnici: 22 u kolejového lože a 8 u odsazení.
   - Interaktivní zvíře se kreslí dvakrát větší (`ANIMAL_SCALE`), aby ho dítě vidělo. I se skokem reakce splní stejnou mez; výchozí hloubka je 0,26–0,6.
   - `placeAnimal` zvíře zvedne nad dotykovou plochu brzdy a houkačky (dokument 02: brzda nikdy nezasáhne objekt pod sebou).
   - Na telefonu naležato je pruh mezi vlakem a brzdou užší než zvíře, a tak se zvíře zmenší i se skokem. Kde ovládání sahá i nad patu náspu (568 × 320), zvíře se nekreslí a nejde se ho dotknout; kdyby stálo u paty, ťuknutí na brzdu by ho zasáhlo (Codex review PR #2).
   - Kontrolují to jednotkové testy a E2E: žádná rekvizita ani zvíře nepřekrývá vykreslený vlak a na telefonu žádné zvíře nestojí pod tlačítky.
4. **Vrstvy a parallax** (dokument 07 §3), od zadu dopředu:
   1. Obloha: přechod barev, kreslí se jen nad pozadím.
   2. Mraky: posun 0,06, unášejí se podle simulačního času.
   3. Vzdálené pozadí biomu: posun 0,25.
   4. Střední pozadí: posun 0,55.
   5. Zem za tratí: pole se šikmými hranicemi, skvrny, voda, silnice pod autem.
   6. Zadní rekvizity.
   7. Násep a louka. Kde se v přechodovém chunku mění styl louky (třeba louka a lesní půda), barvy pásů i náspu přecházejí plynule přes 192 u (`blendNearPalette`), bez svislého švu.
   8. Kolej.
   9. Vlak.
   10. Blízké rekvizity.
   11. Zvířata.

   Pozadí ukazuje biom v 65 % šířky obrazu a změnu biomu prolne za 1,2 s. Pod středním pozadím je výplň jen tam, kde zem za tratí klesne pod jeho spodní hranu.

5. **Grafika a atlasy.** Všech 114 dílů světa jsou ručně psané SVG v `assets/world/` v jednotkách u se stabilním pivotem. Generátory použité při kreslení jsou vývojová pomůcka; zdrojem jsou SVG soubory.
   - Obsah dílů:
     - kolej;
     - stromy;
     - stavby;
     - zvířata;
     - blízké rostliny a kameny;
     - dvanáct dlaždic pozadí, které na sebe navazují;
     - tři mraky.
   - Hra rasterizuje dva atlasy:
     - hlavní pro vozidla a svět, do 2 px/u;
     - atlas pozadí a mraků, do 1 px/u.
   - Pozadí mají oříznutou prázdnou oblohu, protože průhledné pixely stojí výkon.
   - Vite je nesmí vkládat jako data URI (`assetsInlineLimit`); Phaser data URI dekóduje jako base64 a jízda zamrzla.
6. **Výkon.** Měřeno `PERF_SECONDS=30 npm run measure:perf` s nejdelší soupravou v softwarovém WebGL tohoto kontejneru.

   | Stav                                                         | Medián FPS | p95       |
   | ------------------------------------------------------------ | ---------- | --------- |
   | E1 (před krajinou)                                           | 20         | 50 ms     |
   | První zapojení krajiny                                       | 12         | 100 ms    |
   | Obloha a výplň jen tam, kde jsou vidět; ořez pozadí          | 15         | 83 ms     |
   | Zem chunku jednou do textury (Phaser trianguluje `Graphics`) | 15         | 67 ms     |
   | Bez MSAA (`antialiasGL: false`)                              | **30**     | **50 ms** |
   - Zem chunku se kreslí jen při jeho vzniku, a to do plátna v nejvýše 1 px/u. Pod posledním pásem louky je jednobarevný obdélník.
   - MSAA se vypnulo, protože hrany už nevznikají z geometrie:
     - každý snímek atlasu má 1 px průhledného okraje (`FRAME_MARGIN_PX`), takže hranu otočeného vagonu či dlaždice vyhladí filtrování textury;
     - náhradní siluety mají okraj 2 px.
   - Pixelový test WebGL proti Canvasu (D-010) zůstává pod 0,2 %.
   - Odhad dekódovaných textur je asi 60 MiB, pod 96 MiB úsporného profilu dokumentu 07 §10:
     - hlavní atlas při 2 px/u asi 12 MiB;
     - pozadí asi 10 MiB;
     - zdrojové obrázky asi 22 MiB;
     - zem asi 3 MiB na chunk při nejvýše šesti živých chunkách.

## Důsledky

- Diagnostika `?debug=1` hlásí `backdropAtlas`, `scenery` (biom, lokality v obraze, blízké rekvizity, překryvy s vlakem) a `chunkEdges`.
- E2E kontroluje:
  - krajinu ze dvou atlasů;
  - žádný překryv vlaku pro tři seedy;
  - zvířata na telefonu nad tlačítky.
- Test švů na Canvasu hledá šev jen na hranicích chunků, protože tenké stonky rostlin vypadají jako šev.
- Test čáry přes oblohu hledá jednopixelový řádek přes půl šířky a sám si ověří, že vloženou čáru najde.
- `validate:assets` kontroluje 114 dílů světa: soubory, rozměry, nepoužité díly.
- Krajina z tvarů v kódu a dlaždice kopců zmizely.

## Kompatibilita

- Save, trať, generátor tratě a ID interaktivních objektů se nemění.
- Krajina je dekorace odvozená ze seedu a verze generátoru a neukládá se. Změna šablon změní dekorace, ne rozehranou trasu.
- Druh zvířete se dřív neukládal a neukládá se ani teď.

## Dočasná omezení a podmínky odstranění

- **Výřezy z referenčních listů:** nejsou, dokud listy nejsou v repozitáři jako soubory.
- **Zem nejvýše 1 px/u:** na monitoru s 2 px/u jsou hrany země měkčí. Zvýší se, pokud test zařízení ukáže rušivou neostrost; spolu s tím je nutné změřit paměť.
- **Částice, přejezdy, tunel, druhá kolej a elektrická trolej** přibyly v krocích F a G ([D-014](014-particles-and-small-animations.md) až [D-018](018-bridges-and-tunnels.md)); toto omezení je odstraněné.
- **Fyzická zařízení:** NEOVĚŘENO.
