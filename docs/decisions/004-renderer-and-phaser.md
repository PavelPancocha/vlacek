# D-004: Renderer, konfigurace Phaseru a browserové testy

Datum: 2026-10-09. Stav: přijato.

Brána M0 vyžaduje zaznamenané rozhodnutí o rendereru a ověřenou Canvas cestu. Dokument 02 vyžaduje jediného vlastníka vstupů, dokument 09 konzervativní renderer bez speciálních GPU efektů.

**Renderer.** Phaser 4.2.1 startuje s `Phaser.AUTO` (WebGL, při nedostupnosti Canvas). Parametr `?renderer=canvas` vynutí `Phaser.CANVAS`, aby šla Canvas cesta ověřit na každém zařízení. Zvolený renderer je v atributu `data-renderer` kořene hry a v diagnostice. V headless Chromiu 156 (Playwright 1.64) zvolí AUTO WebGL; obě cesty pokrývá E2E smoke test. Podpora konkrétních zařízení zůstává **NEOVĚŘENO**, dokud neproběhne test na tabletu a Tesle. Filtry a shadery Phaseru se nepoužívají, aby obě cesty vypadaly stejně.

**Vlastnictví vstupů a životního cyklu.** Volba `input: false` vstup Phaseru nevypne (výchozí hodnoty podsekcí zůstanou zapnuté). Proto jsou v objektové konfiguraci výslovně vypnuté klávesnice, myš, dotyk, gamepad i `windowEvents`. Phaser dále nedostane `autoFocus`, vlastní audio (`audio.noAudio`), banner ani vyhlazování delta (`fps.smoothStep: false`). Simulační krok bude počítat z vlastního času. Phaser při skrytí stránky sám pozastaví smyčku přes `visibilitychange` a přiřadí `window.onblur`/`onfocus`. Aplikace proto používá výhradně `addEventListener` a jako zdroj pauzy nebere stav Phaseru.

**Hustota pixelů.** Phaser 4 nemá volbu `resolution`. Plátno má rozměr CSS × DPR (DPR omezené profilem kvality, zatím 1.5) a `Scale.NONE` se zoomem 1/DPR. CSS velikost tak odpovídá kontejneru a dotykové rozměry se nemění. Změnu velikosti zachytí `ResizeObserver` nad kontejnerem. Volá nejdřív `scale.resize` a teprve potom `scale.setZoom`: Phaser 4.2.1 v `resize` při zoomu 1 (hustota 1, tedy obrazovka s DPR 1 nebo profil `low`) CSS rozměr plátna nepřepíše a `setZoom` ho zapíše z aktuální velikosti hry. V opačném pořadí zůstalo plátno po otočení telefonu nebo změně okna ve staré CSS velikosti a obraz se roztáhl. E2E test to hlídá při DPR 1 i 2. Kamera počítá měřítko z výšky výřezu vůči 720 u (dokument 03).

**Hranice a typy.** Phaser smí importovat jen `src/render/**` (`no-restricted-imports`). Při importu sahá na `window` a `navigator`, takže nesmí být v kódu testovaném ve Vitestu. Deklarace `phaser.d.ts` 4.2.1 neprojdou TypeScriptem 6 bez `skipLibCheck` (TS2526 u `setFlipV`, TS2416 u `SubmitterMeshToQuad.run`). Aplikace proto používá `skipLibCheck: true`; vlastní kód zůstává ve strict režimu. Volbu přehodnotíme při upgradu Phaseru nebo TypeScriptu.

**Velikost.** Phaser je jeden asi 1,4 MB velký chunk (zhruba 350 KiB gzip), který Vite nerozdělí. Varování Vite je nastavené na 1600 kB; závaznou kontrolou je `npm run report:budgets` proti rozpočtu 10 MiB prvního přenosu z dokumentu 13.

**Browserové testy.** Playwright 1.64.0 používá vlastní Chromium (revize 1248). CI jej instaluje přes `npx playwright install --with-deps chromium`. Starší předinstalovaný prohlížeč přes `executablePath` nepoužíváme, protože by šlo o nepodporovanou kombinaci verzí. Testy běží proti produkčnímu `vite preview`, ne proti dev serveru.
