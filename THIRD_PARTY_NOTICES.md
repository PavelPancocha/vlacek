# Licence třetích stran

Knihovny přibalené do produkčního buildu hry (`dependencies` v `package.json`). Vývojové nástroje (`devDependencies`) se do buildu nedostávají a mají vlastní licence v `node_modules/`.

| Balíček                                                                      | Verze | Licence | Copyright                                |
| ---------------------------------------------------------------------------- | ----- | ------- | ---------------------------------------- |
| [phaser](https://github.com/phaserjs/phaser)                                 | 4.2.1 | MIT     | © 2026 Richard Davey, Phaser Studio Inc. |
| [eventemitter3](https://github.com/primus/eventemitter3) (závislost Phaseru) | 5.0.4 | MIT     | © 2014 Arnout Kazemier                   |

Plné texty licencí jsou v `node_modules/phaser/LICENSE.md` a `node_modules/eventemitter3/LICENSE`. Při přidání runtime závislosti doplň tento soubor ve stejném commitu.
