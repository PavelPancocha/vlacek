# Licence třetích stran

Knihovny přibalené do produkčního buildu hry (`dependencies` v `package.json`). Vývojové nástroje (`devDependencies`) se do buildu nedostávají a mají vlastní licence v `node_modules/`.

| Balíček                                                                      | Verze | Licence | Copyright                                |
| ---------------------------------------------------------------------------- | ----- | ------- | ---------------------------------------- |
| [phaser](https://github.com/phaserjs/phaser)                                 | 4.2.1 | MIT     | © 2026 Richard Davey, Phaser Studio Inc. |
| [eventemitter3](https://github.com/primus/eventemitter3) (závislost Phaseru) | 5.0.4 | MIT     | © 2014 Arnout Kazemier                   |

Plné texty licencí jsou v `node_modules/phaser/LICENSE.md` a `node_modules/eventemitter3/LICENSE`. Při přidání runtime závislosti doplň tento soubor ve stejném commitu.

## Nahrané zvuky

Úplná atribuce všech nahrávek je také v [assets/audio/credits.txt](assets/audio/credits.txt), generovaném z [scripts/audio/sources.json](scripts/audio/sources.json). Publikovaný build dodává tento textový soubor a vývojářské volby → Zvuky → O zvucích — autoři a licence na něj přímo odkazují. Unit test brání rozchodu provenience a dodaných kreditů.

Zvukové nahrávky uvedené v [assets/SOURCES.md](assets/SOURCES.md) a [scripts/audio/sources.json](scripts/audio/sources.json) jsou CC0 1.0 s výjimkou následujících CC BY 4.0 děl. Dobrovolně děkujeme všem uvedeným autorům; u parního taktu také Keith Peter / keithpeter (originální nahrávka) a birdOfTheNorth (CC0 edit). BigSoundBank autoři jsou Joseph SARDIN a DenisChardonnet; Freesound autoři KayleRustone, mike_stranks, JotrainG a Fercraft64; belgický zvonek Bert76.

- **WWS Bediadiesellocomotiveidling.ogg** — Work With Sounds / Technical Museum of Slovenia; sound recordist **Dušan Oblak**. [Zdroj](https://commons.wikimedia.org/wiki/File:WWS_Bediadiesellocomotiveidling.ogg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Dodaný `diesel-idle.mp3`: výřez 10–30 s, převod mono, EQ 70 Hz–6 kHz, normalizace na cíl −28 LUFS / −6 dBTP, limiter, crossfade 0,2 s, 10 ms hrany, 120 ms padding a MP3 VBR export. Změny provedl projekt Vláček; žádné schválení či endorsement původním autorem nebo muzeem se neimplikuje.
- **WWS DiesellocomotiveBediamoving.ogg** — Work With Sounds / Technical Museum of Slovenia; sound recordist **Boštjan Troha**. [Zdroj](https://commons.wikimedia.org/wiki/File:WWS_DiesellocomotiveBediamoving.ogg), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Dodaný `diesel-running.mp3`: výřez 10–30 s, převod mono, EQ 70 Hz–6 kHz, normalizace na cíl −28 LUFS / −6 dBTP, limiter, crossfade 0,3 s, 10 ms hrany, 120 ms padding a MP3 VBR export. Změny provedl projekt Vláček; žádné schválení či endorsement původním autorem nebo muzeem se neimplikuje.
