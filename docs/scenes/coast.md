# Pobřeží, pláž a přístav

Pobřeží zachovává oblíbený písečný vzhled a přidává čitelnou souvislou mořskou hladinu.
Není českou vnitrozemskou krajinou; zůstává samostatným stylizovaným prostředím bez exotické výplně.
Moře má napříč chunky jednu návaznou pobřežní geometrii, nikoli řadu uzavřených rybníků.

## CO-01 — Otevřená pláž

Na horizontu je souvislá mořská hladina pod světlou oblohou.
Za tratí se táhne pláž se čitelnou linií příboje.
Kolej vede po suchém pobřežním pásu s nízkou trávou.
Před vlakem je široký písek, několik mušlí a jednotlivé trsy dunové trávy.
Racek občas popojde po břehu nebo klidně vzlétne vysoko mimo vlak.
V dálce pomalu pluje plachetnice, jejíž celá dráha zůstává na moři.

| Zóna           | Objekty                                         | Počet                  | Vztahy a závislosti      | Zakázáno                      |
| -------------- | ----------------------------------------------- | ---------------------- | ------------------------ | ----------------------------- |
| far            | `backdrop.coast-far`, `backdrop.coast-mid`      | Souvislé               | Otevřený mořský horizont | Uzavřené modré ovály          |
| back 0,25–1,00 | Geometrie moře a pobřeží, `back.sailboat`       | 1 moře, 0–1 loď        | Loď uvnitř vodní plochy  | Loď na písku                  |
| bank           | Suchý písečný násep, nízká tráva                | Souvislý               | Trať nad dosahem vody    | Příboj přes kolej             |
| near 0,30–0,90 | `near.dune-grass`, `near.shells`, `animal.gull` | 6–10 skupin, 1–2 racci | Suchý písek a břeh       | `near.pond`, sladkovodní hráz |

## CO-02 — Skalnatý mys

Mořský horizont pokračuje i za skalnatým výběžkem.
Za tratí se písek střídá s nízkými pobřežními skalami.
Kolej výběžek objíždí po suchém tělese a nepotřebuje náhlý tunel bez hory.
Před vlakem leží kameny, naplavené dřevo a malé kapsy písku.
Jeden racek se usadí na kameni a voda se jemně pohybuje kolem paty mysu.
Na obloze pomalu táhnou mraky, které neskrývají vzdálený výhled.

| Zóna           | Objekty                                             | Počet                     | Vztahy a závislosti        | Zakázáno               |
| -------------- | --------------------------------------------------- | ------------------------- | -------------------------- | ---------------------- |
| far            | Pobřežní pozadí                                     | Souvislé                  | Mys navazuje na moře       | Vnitrozemské rybníky   |
| back 0,30–0,85 | `back.rock-a/b`; NEW: pobřežní skála 180 × 110 u    | 3–6 skal, 1 větší skupina | Na pevnině u pobřežní čáry | Skála pod plující lodí |
| bank           | Suché kolejové těleso                               | Souvislé                  | Odstup od srázu            | Nebezpečné drolení     |
| near 0,35–0,90 | `near.beach-rocks`, `near.driftwood`, `animal.gull` | 4–7 skupin, 0–1 racek     | Na písku nebo kameni       | Vysoká skála přes vlak |

## CO-03 — Přístav s majákem

Za tratí se objeví chráněná část moře s moly.
Vzdálený horizont zůstává otevřený, takže přístav nepůsobí jako samostatný rybník.
Na suchém výběžku stojí jeden maják a několik nízkých přístavních staveb.
U koleje vede servisní cesta mimo průjezdný profil.
V popředí leží bedny a nízké keře, zatímco rybářská loď se pohupuje u mola.
Nad přístavem proletí racek a maják pouze pomalu mění jas, nikdy nebliká do celé obrazovky.

| Zóna           | Objekty                                                | Počet                         | Vztahy a závislosti                      | Zakázáno               |
| -------------- | ------------------------------------------------------ | ----------------------------- | ---------------------------------------- | ---------------------- |
| far            | Pobřežní pozadí                                        | Souvislé                      | Přístav spojený s mořem                  | Uzavřená zelená nádrž  |
| back 0,35–0,90 | `back.lighthouse`, `back.pier`, `back.fishing-boat`    | 0–1 maják, 1–2 mola, 1–2 lodě | Maják na suchu, mola ve vodě, lodě u mol | Maják na každém chunku |
| back 0,25–0,65 | `back.beach-hut`, `back.crates`                        | 1–3 stavby, 2–4 skupiny beden | Servisní cesta a suché zázemí            | Bedny v plavební dráze |
| bank           | Suchý servisní odstup                                  | Souvislý                      | Kolej mimo manipulaci                    | Náklad přes vlak       |
| near 0,35–0,85 | `near.dune-grass`, `near.beach-rocks`, `back.person-a` | 3–6 skupin, 0–1 člověk        | Člověk na cestě                          | Chodec ve vodě         |

## CO-04 — Promenáda a suchý písečný okraj

Moře pokračuje za tratí, ale část výhledu rámují nízké pobřežní stavby.
Podél břehu vede promenáda s lavičkami a několika přístřešky.
U koleje zůstává suchý otevřený pás.
Před vlakem je převážně písek s dunovou trávou; voda zde nemusí být vidět.
Člověk pomalu projde po promenádě a děti mohou mít hračky na vyhrazené pláži.
Nad ní zůstává velká klidná obloha a písečný obraz může připravit přechod do dun.

| Zóna           | Objekty                                                             | Počet                                 | Vztahy a závislosti          | Zakázáno                |
| -------------- | ------------------------------------------------------------------- | ------------------------------------- | ---------------------------- | ----------------------- |
| far            | Pobřežní pozadí                                                     | Souvislé                              | Moře dál trvá za scénou      | Změna na rybníkářsko    |
| back 0,30–0,85 | `back.bench`, `back.beach-hut`, `back.parasol`, `back.person-a/b/c` | 2–4 lavičky, 1–3 přístřešky, 1–3 lidé | Podél souvislé promenády     | Stavba uprostřed moře   |
| bank           | Suchý odstup                                                        | Souvislý                              | Trať oddělená od rekreace    | Pěší zkratka přes kolej |
| near 0,30–0,90 | `near.dune-grass`, `near.sand-toys`, `near.driftwood`               | 5–9 skupin, 0–1 hračky                | Hračky jen v plážové podzóně | Rybník vložený do písku |

## Činnosti a odezvy

| Scéna | Samostatná činnost                                | Reakce na vlak; cooldown         |
| ----- | ------------------------------------------------- | -------------------------------- |
| CO-01 | Příboj, loď a jednotliví racci s vlastními fázemi | Jeden racek klidně vzlétne; 20 s |
| CO-02 | Voda kolem skal, racek se otočí                   | Otočení hlavy; 18 s              |
| CO-03 | Pohupování lodí, člověk u mola po 20–40 s         | Námořník zamává; 20 s            |
| CO-04 | Procházka a mírný pohyb slunečníku                | Jeden člověk zamává; 20 s        |

Maják může na dotyk pomalu zesílit světlo; další reakce nejdříve za 12 s.
Plavidla mají určenou příď a orientaci podle vlastní světové dráhy, ne podle posunu vůči vlaku.

## Profil a preset

Cíl koleje: −60 až +60 u, absolutní sklon 0–0,025; u mysu krátce nejvýše 0,04.
Mořská hladina zůstává spojitá a vodorovná; výška koleje se může měnit nezávisle.
Pobřeží používá mírný jasný nebo větrný preset.
Jaro, léto, podzim a zima se zde nepřidávají jako čtyři automatické varianty.
Neobjevují se sněhové pláže, podzimní listové emitery nad mořem ani sladkovodní vážky.
Při přechodu do dun nejprve ubývá pobřežní vybavení a moře ustupuje za suchý terén.

## Zvuky a nové kresby

Použít moře, vítr a racky; žádné rybniční kvákání jako univerzální vodní zvuk.
Nové audio jen podle potřeby: jemné vrzání vyvázané lodi a tlumené přístavní okolí.
NEW: pobřežní skála 180 × 110 u; oblé světlé vrstvy s nízkou přední variantou.
Stávající lodě potřebují ověřený údaj o přídi a kotvení, nikoli nutně kompletní novou kresbu.
Mola, maják, mušle, písečné hračky a trávy se znovu používají.
Palmy, kokosové plody a další exotická výplň nejsou součástí tohoto katalogu.
