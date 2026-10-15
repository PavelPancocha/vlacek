# 09 — Browser, PWA, Android, Tesla a distribuce

[Zpět na rozcestník](../README.md)

## 1. Základní distribuční model

Hra se nasazuje jako statický web na jednu HTTPS adresu. Nová verze se vydá nasazením nových statických souborů. Žádná publikace v Google Play ani App Store není pro V1 potřeba. Hra nesmí vyžadovat přihlášení, API klíč nebo vlastní instalační balíček.

PWA je volitelné rozšíření webu pro pohodlné spuštění a offline cache, nikoli druhý produkt. Online hratelnost funguje i v prohlížeči, který instalaci, service worker nebo fullscreen neumí. Toto je důležité zejména pro Teslu.

## 2. Cílové platformy a poctivá úroveň podpory

| Prostředí                       | Základní cíl                                                                 | Co vyžaduje ověření                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Android tablet v Chrome         | Plná online hra na šířku, dotyky, zvuk, místní save.                         | Konkrétní výkon, rozlišení a chování vybraného tabletu.                                       |
| Nainstalovaná Android PWA       | Spuštění z plochy, omezené browser UI, offline po dokončeném uložení balíku. | Instalační nabídka, retenční politika úložiště, fullscreen konkrétního browseru.              |
| Tesla Model 3 2019 Intel        | Online jízda ve skutečném dostupném výřezu browseru, při stání.              | Renderer, dotyky, audio, výkon, save, service worker a fullscreen podle konkrétního firmwaru. |
| Desktop Chrome / Firefox        | Vývoj a referenční funkční testy, myš i klávesnice.                          | Reálná dotyková ergonomie se desktopem nenahradí.                                             |
| Jiná auta, iOS, nativní Android | Mimo závaznou V1 podporu.                                                    | Případné pozdější rozšíření.                                                                  |

Informace výrobce o zábavních funkcích Tesly nenahrazuje měření browserových API konkrétního auta. Zdroje S10 v dokumentu 12 uvádějí související omezení zábavních funkcí; neprokazují výkon naší hry ani přístup k API vozidla.

Hra nečte rychlost auta, neovládá jej a nepřipojuje se k Tesla účtu či API. Neumí ověřit, že auto stojí, a nesmí takovou detekci předstírat. Produkt je navržen pro použití na centrálním displeji při parkování/nabíjení; neobchází omezení vozidla.

## 3. První technická brána: reálný prohlížeč

Před výrobou kompletní grafiky nasadit malou scénu: kolej s kopcem, lokomotiva a 100 jednoduchých vagonků, několik pohybujících se objektů, dotykové řízení a zvuk po gestu. Na autě i cílovém tabletu zaznamenat:

- datum, build, firmware/OS, browser a skutečný viewport;
- zvolený renderer a případný Canvas fallback;
- průměrné FPS a percentily frame time během jízdy;
- držení prstu, více prstů, brzdění, ztrátu fokusu a návrat;
- úspěch odemčení audia, ukládání, fullscreen a service worker;
- chování při dostupné a nedostupné síti.

Není-li fyzické zařízení dostupné, implementace může pokračovat v desktopovém a Android referenčním prostředí, ale stav podpory Tesly zůstává **NEOVĚŘENO**. User-agent emulace ani pomalý desktop nejsou test skutečné Tesly.

Pokud Phaser/WebGL v autě selže, nejdřív ověřit kompatibilní build a Canvas variantu na malém prototypu. Teprve podle důkazů se rozhodne o změně rendereru či verze frameworku. Není důvod předem vyvíjet dva kompletní enginy.

## 4. Manifest a celá obrazovka

Příklad manifestu pro nasazení do `/vlacek/`:

```json
{
  "id": "/vlacek/",
  "name": "Vláček",
  "short_name": "Vláček",
  "lang": "cs",
  "start_url": "/vlacek/",
  "scope": "/vlacek/",
  "display": "fullscreen",
  "display_override": ["fullscreen", "standalone"],
  "orientation": "landscape",
  "background_color": "#F5F1E8",
  "theme_color": "#F5F1E8",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

Barvy jsou výchozí designový návrh. Při jiném base path musí build současně upravit manifest, assetové cesty, registraci a scope service workeru. Nenatáhnout všechny požadavky natvrdo z kořene domény, pokud je hra nasazena do podadresáře.

Manifestový `fullscreen` a Fullscreen API jsou odlišné mechanismy a nejsou univerzálně podporované. Prohlížeč může zvolit náhradní zobrazovací režim; aplikace musí fungovat v `standalone` i běžné kartě. Viz S05/S06 v dokumentu 12.

Průběžná hra má volitelné tlačítko pro celou obrazovku na úvodu, při výběru mašinky a v pauze (dokument 02 §2). Zobrazí se jen při `document.fullscreenEnabled === true` a dostupných standardních metodách `requestFullscreen()` / `exitFullscreen()`. Žádost na `document.documentElement` vzniká přímo z uživatelského gesta; druhá aktivace režim opustí. Stav se čte z `document.fullscreenElement` a aktualizuje událostí `fullscreenchange`.

Zamítnutí vstupu nebo výstupu se zachytí bez pádu; tlačítko zůstane do obnovení stránky neaktivní, bez opakované žádosti, s krátkou zprávou. Opuštění pomocí systému zůstává možné. Nepodporované API tlačítko skryje, základní online hra pokračuje v běžné kartě. Změna režimu uklidí vstupy; resize přepočítá zobrazení a pauza zůstává pauzou. Opuštění režimu během jízdy vyvolá pauzu i bez změny rozměrů. Nikdy se automaticky nežádá ani neobnovuje fullscreen.

Standardní API je ověřeno automaticky v headless Chromium (viz [protokol](../docs/validation/2026-10-12-cela-obrazovka.md)); nejde o důkaz podpory Android tabletu, iOS ani Tesly. Jejich skutečné chování včetně systémového gesta a firmwaru zůstává **NEOVĚŘENO** v [matici zařízení](../docs/device-tests/v0.1.md). Manifest, vlastní PNG ikony, iOS meta tagy a volitelná instalace jsou zavedené v [D-031](../docs/decisions/031-installable-offline-pwa.md). Nabídka instalace patří výhradně do skrytého rodičovského panelu (D-020), pouze po události `beforeinstallprompt`. Fyzická instalace a offline na Androidu, iOS i Tesle zůstávají **NEOVĚŘENO**.

Instalační nabídku ukazovat pouze rodiči a jen tam, kde ji prohlížeč skutečně nabízí. Nelze slibovat stejné instalační chování každého Android browseru nebo Tesly. PWA v praxi stále podléhá pravidlům hostitelského prohlížeče.

## 5. Renderer a adaptivní výkon

Výchozí Phaser konfigurace preferuje WebGL, ale má umožnit ověřenou Canvas cestu tam, kde je dostupná. Obecný princip automatického výběru rendereru je v dokumentaci Phaseru; API z konkrétní nainstalované verze má přednost před příkladem z jiné řady (S02).

Nevyžadovat WebGPU, nestandardní rozšíření, složité shadery, plošné blur filtry ani 3D engine. Noční atmosféra, tunely, voda a pantograf musí fungovat bez speciálního GPU efektu. Shader může být volitelná dekorace, ne jediný způsob zobrazení koleje.

Výchozí renderovací hustotu omezit na DPR 1 v úsporném profilu a nejvýše 1.5 ve standardním. Skutečné CSS rozměry ovládání tím nesmějí klesnout. Podrobné výkonnostní cíle jsou v dokumentu 11 a parametry v dokumentu 13.

Browser může mít omezené API bez ohledu na výkonnost GPU. Feature detection má přednost před větvením podle značky. Zvláštní workarounds pro konkrétní firmware zapisovat jako krátké rozhodnutí a pokrýt regresním testem.

## 6. Audio a životní cyklus

Zvuk odemknout prvním uživatelským gestem v menu nebo potvrzením hry. Nespoléhat na autoplay ani na experimentální API pro zjišťování autoplay policy. Zachytit odmítnutí přehrávání a nechat hru fungovat tiše; rodičovská ikona umožní nový pokus. Pro podmínky přehrávání viz S07.

Při skrytí stránky či ztrátě fokusu pozastavit simulaci a audio, vymazat všechny vstupy a pokusit se uložit snapshot. Timery a `requestAnimationFrame` mohou být v pozadí omezené; nesmějí sloužit jako spolehlivé hodiny pokračující hry (S09).

Po návratu zobrazit pauzu a nechat dítě/dospělého potvrdit pokračování. Chybějící audio oprávnění nesmí způsobit samovolné obnovení rychlosti nebo vstupu.

## 7. Offline balík a service worker

Service worker vyžaduje podporované bezpečné prostředí; lokální vývoj může použít localhost. Skutečné LAN HTTP na adrese zařízení není ekvivalent localhostu pro ostatní zařízení. PWA/offline testovat na HTTPS testovacím nasazení nebo vhodně zabezpečeném lokálním prostředí. Viz S14.

Výchozí implementace: malý service worker s **buildem vygenerovaným seznamem verzovaných statických souborů**. Není potřeba server. Je možné použít zavedený PWA nástroj, pokud výsledný lifecycle zachová zde uvedený kontrakt a přidání závislosti je zdůvodněné.

### Cache politika

- HTML aplikačního shellu a jeho odpovídající hashed JS/CSS patří k jedné verzi.
- Grafika, audio a ikony mají content-hashed cesty nebo explicitně verzovanou cestu vydání.
- Service worker a manifest nesmějí být zablokované dlouhou `immutable` cache hlavičkou.
- Navigace uvnitř scope dostane odpovídající app shell; chybějící obrázek či zvuk nedostane HTML s HTTP 200.
- Cache pro novou verzi se označí jako kompletní až po úspěšném stažení a ověření všech potřebných souborů.
- Neúspěšné stahování nové verze ponechá starý kompletní balík funkční. Částečná cache není offline připravenost.

Registrace a doplňování balíku nesmí blokovat online první jízdu. Stav pro rodiče rozlišuje **online / připravuje se offline balík / offline připraveno / offline není dostupné**. Zařízení bez service workeru prostě hraje online; žádná chybová smyčka.

„Offline připraveno“ znamená, že je kompletní balík aktuálního vydání opravdu v cache a odpovídající worker je aktivní, nikoli že existuje ikona na ploše. Offline akceptace zahrnuje všechny biomy a celý katalog, ne pouze první obrazovku. Samotná první návštěva bez internetu fungovat nemůže.

Prohlížeč může uložené soubory odstranit při nedostatku místa nebo podle vlastních pravidel. Offline připravenost proto není doživotní garance a po návratu se znovu ověřuje (S08).

Aktuální implementace ([D-031](../docs/decisions/031-installable-offline-pwa.md)): inventář vzniká z reálného produkčního `dist/`, obsahuje všechny emitované SVG/PNG, MP3, JS/CSS, HTML, manifest, ikony a kredity. Worker kontroluje SHA-256 každého souboru, odmítá redirect/chybný stav a při selhání odstraní jen vlastní neúplný nový balík, který nepoužívá aktivní ani čekající worker. Při reinstalaci téhož vydání znovu použije existující balík až po kontrole značky, všech položek a jejich hashů; rollback A při čekajícím B tak nesmaže aktivní A ani při chybě sítě nebo zápisu. Registrace začíná po připraveném rendereru a prvním snímku, v dev režimu je vypnutá. Rodičovský panel ukazuje stav, build uloženého balíku a čekající aktualizaci. Připravenost ověřuje skutečnou cache a opakuje ji po návratu stránky. Lokální produkční Chromium test pokrývá offline reload, picker, depo, jízdu, uložené assety/audio, neúplný update a chybějící API; fyzická zařízení jsou **NEOVĚŘENO**.

## 8. Aktualizace bez přerušení jízdy

**V1 používá jednoduchý standardní model čekajícího service workeru.** Nová verze se může připravit při online návštěvě, ale nenutí rozehranou kartu k reloadu. Nevolat automaticky `skipWaiting()` ani `clients.claim()` tak, aby se živá hra přepnula pod jinou verzí.

Aktualizace se standardně aktivuje, když už žádná karta/okno nepoužívá starý worker. Rodič může vidět informaci: „Nová verze je připravená. Zavři všechna okna hry a znovu ji otevři.“ Pouhé skrytí aplikace ani reload jedné z více otevřených karet nemusí stačit. To je přijatelná cena za jednoduchost a nepřerušování dítěte.

Při běžném webu bez workeru se nové soubory načtou při příštím načtení stránky. HTML má revalidaci; hashed assety dlouhou cache. Všechny assety používané aktuálním builtem zůstanou na serveru dostupné během nasazení a po rozumnou dobu pro již otevřené karty. Nasazení nesmí nejdříve smazat staré JS chunk soubory a teprve potom nahrát nové.

Po automatické aktivaci nového workeru ponechat aktuální a nejméně předchozí úplnou cache. Cleanup nesmí proběhnout během nedokončené instalace. Při další aktualizaci uvolnit starší nepotřebné cache; dlouhodobě se nesmí vrstvit všechny verze. Save není součást statické cache a aktualizace jej nemaže.

Rychlé nucené přepnutí všech otevřených instancí s koordinací mezi kartami je **mimo V1**. Nezavádět ho kvůli domnělému pohodlí. Přesná pravidla životního cyklu vycházejí ze service worker dokumentace S14.

## 9. Nasazení a provoz

Stačí statický HTTPS hosting. Výběr konkrétního poskytovatele není součást herní logiky. Povinná konfigurace: správný base path, typy MIME pro JS/JSON/audio, pravidla cache pro HTML a worker, verzované assety a konzistentní publikace buildu.

Build před nasazením: typová kontrola, testy, kontrola katalogu a assetů, produkční sestavení a kontrola velikosti. Nasazenou verzi ověřit smoke testem přes její skutečnou adresu. Test lokálního dev serveru neprokazuje fungující offline režim produkčního buildu.

Uchovávat identifikátor vydání a předchozí publikovanou verzi pro rollback. Rollback je kompatibilní s existujícími save nebo se chová bezpečně podle jejich verze; není to smazání všech dat v prohlížeči.

Nepotřebuje externí CDN pro kód za běhu, externí fonty, reklamní skripty ani online konfigurační API. Veškeré herní assety jsou stejného původu. Browser/hosting mohou technicky vést vlastní provozní logy; „bez herní analytiky“ se nesmí vydávat za slib, že na internetu nevzniká žádný síťový záznam.

## 10. Budoucí Android obálka

Pokud web/PWA později nestačí, doménu i webové assety lze využít v Android obálce, například přes Capacitor, který podporuje začlenění existující webové aplikace (S15). Není potřeba nyní psát Android projekt, připravovat účty v obchodech ani měnit hru na nativní UI.

Zabalený balík a vzdáleně načítaný web mají odlišný model aktualizací. Nativní obálka s vloženými assety se automaticky neaktualizuje jen nasazením webu. Tento kompromis by se řešil až v samostatném zadání. Pro aktuální požadavek na co nejjednodušší aktualizace zůstává prioritou web/PWA.
