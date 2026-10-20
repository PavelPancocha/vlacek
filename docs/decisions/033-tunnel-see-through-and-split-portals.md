# D-033: Průhledný tunelový kryt a dělené portály

Datum rozhodnutí vlastníka: 2026-10-19. Stav: přijato. Mění D-018 a D-026.

## Důvod

Vlastník při hraní buildu `0.1.0+b211e87` na Android tabletu uvedl:

> „The tunnel portal is in front of the train — it probably needs to be separated into the part in front of and behind the train.“
>
> „The partially visible tunnel insides in the previous version was great, bring it back, just make it like 50% opacity.“

Souvislý portál před vlakem řezal i vozidlo stojící venku. Neprůhledná hora
zároveň odstranila oblíbenou možnost sledovat vlak uvnitř.

## Rozhodnutí

Každý krátký i dlouhý skalní tunel včetně zasněžených portálů má dvě části:
ústí s tmavým otvorem a vnějším pilířem za vlakem (hloubka vnitřku + 0,01),
přední díl s vnitřním pilířem, horním obloukem včetně celého klenáku a tělesem před vlakem.
Řez vede středem portálu a na vnější straně ve výšce 186 u nad kolejí:
vnější rameno pod korunou patří k ústí, vršek zůstává v krytu.
Vozidlo venku se kreslí nad vnějším pilířem a ramenem, nejvyšší část
portálu je nad průjezdným profilem. Výjezd zrcadlí oba díly kolem vlastního
kolejového pivotu. Asymetrický pivot ústí drží stávající `setWorldPivot`
v metadatech `world-pivot`, aby jej pozdější publikace atlasu nepřepsala
původním nezrcadleným pivotem (regrese seed 1 / chunk 152 / generátor 2).
SVG kopie zachovávají původní kresbu a měřítko; ústí je oříznuté.

Kryt (těleso, přední díly portálů, vegetace, sněhové přílohy) má cíl
`TUNNEL_SEE_THROUGH_ALPHA = 0.5`, je-li kterákoli část hráčovy soupravy
uvnitř nebo do `APPROACH_U = 80` u od portálu včetně hranice. Jinde je cíl 1.
Exponenciální přiblížení používá `FADE_PER_SEC = 6` s⁻¹ a rozdíl simulačního
času. Při odchylce nejvýše 0,002 se přichytí přesně k cíli, aby po odjezdu
kryt i interakční filtr používaly přesnou alfu 1. První obnovený snímek
nastaví cíl bez přechodu; pauza stav drží i těsně před přichycením.
Cíl nastaví dosavadní aktualizace intervalu vlaku; hodiny dodává jednou
za snímek existující life fáze `ChunkView.update`, také s nulovým rozpočtem
dekorativních animací. `RideScene.#drawTrack` ani `#updateWorldWindow` se nemění.
Ústí za vlakem zůstává neprůhledné. Jen hráčova souprava řídí tento přechod;
NPC na druhé koleji zachovávají vlastní zakrytí.

Výchozí interakce:

- Viditelná bublina je dotyková: při alfě krytu pod 1 projde hit-testem,
  seznamem viditelných bublin i prasknutím. Při alfě 1 ji kryt dál filtruje.
- Emise uvnitř horniny zůstává potlačená. Již živé částice zachovávají hloubky
  7,55 pro hráče a 4,32 pro NPC; pořadí kresby se nemění.
- Stávající ztmavující pás nad hráčovým vlakem zůstává nezávislý na krytu.
- Diagnostický snapshot hlásí skutečnou alfu každého tunelového fragmentu.
- Tlumení zvuku se nemění.

## Důsledky

Instalované Phaser 4.2.1 `LayerCanvasRenderer` násobí alfu jednotlivých dětí,
nevytváří izolovanou kompozici. Překrývající kresby se proto skládají jednou do již vlastněné
pečené textury před neměnným uploadem, stejně v Canvas jako ve WebGL. Krátký tunel skládá i přední díly, rostliny a sněhové čepice;
skalní fragment skládá materiál, jeho podklad a přední díly v pásu
292 u nad kolejí až 6 u pod kolejí. Hřbet nad pásem, vegetace a pata pod ním jsou neprůhledné vektory za vlakem.
Za tmavým vnitřkem navíc leží druhý obraz téhož pečeného pásu: sdílí existující
texturu, nepřidává pixelovou alokaci. Nad stropem tím přední tvář zakrývá své
vlastní neprůhledné pixely; v oblasti vnitřku je její zadní kopie překrytá
stávající tmavou výplní. Jen tvář nad tmavým vnitřkem tak ukazuje vlak při 50 %.
Tato volba používá vektorový hřbet a jedinou pečenou texturu i v Canvas,
WebGL a bez atlasu. Sněhové přílohy krátkých portálů transformují místní
posun (−78, −228) u i natočení stejným sklonem jako portál. Dočasné atlasové
readbacky se uvolní v `finally`. Nepřibývá trvalý render target, timer nebo
listener; pečení a textury uvolňuje dosavadní vlastník chunku. Pokus s pečením celé horské siluety měl odvozený low peak 104 066 340 B,
tedy přes nezměněných 96 MiB; proto zůstává omezený materiálový pás.

## Kompatibilita a ověření

Geometrie trati, seed, generátor 2, save schéma 1, katalog vozidel a zvukové
kontrakty se nemění. Jde o lokální renderer a interakční filtr bublin.
Staré jednorámcové portály nahrazují dvojice mouth/front; atlasové registry
se explicitně generují a release validace odmítá nepoužité díly.
Unit testy kontrolují cíle, simulační přechod, obnovu, pauzu, vrstvy a zrcadlení;
Canvas/WebGL E2E kontrolují pixely vozidel a dotyk viditelné bubliny.
Revizní regrese navíc porovnávají plný hřbet a horní tvář nad stropem
při alfě 0,5 a 1 s nulovým rozdílem a pozitivní kontrolou odstraněné hory.
Plná zelená plocha přes vektorovou hranici navíc zachovává RGB (110, 174, 67)
s tolerancí 1, aby se nepropadlo pozadí do antialiasovaného svislého švu.
Vzorky plných ploch leží po obou stranách antialiasovaného spoje vektorů
s materiálovým pásem; tento spoj navíc vyžaduje prohlídku screenshotů.
Kompozit přes hranici chunků používá původní toleranci nejvýše 2 v RGB
v Canvas i WebGL, při 1 140 × 512 a 1 280 × 800, s krátkou i 2 000u soupravou.
Odchod k přesné alfě 1 používá 60 běžných simulačních kroků, pak kontroluje
seznam bublin, hit-test i zákaz prasknutí a zachovává pozitivní dotykovou kontrolu.
Unit regrese ověřuje oba sněhové portály při sklonu ±12 % a pauzu těsně před cílem.
Fyzický Android tablet a Tesla, konkrétní zařízení/firmware: **NEOVĚŘENO**.

Atlasová plocha portálů vzrostla ze 124 800 na 174 200 u² (+49 400 u²).
Před balením včetně 1px okrajů jde o +51 072 px² při 1 px/u a
+200 932 px² při 2 px/u. Pečený pás má nahoře 290 u materiálu a 2 u rezervy,
dole 4 u paty portálu a 2 u rezervy. Každý průhledný fragment kreslí jen
svůj úsek 0–1 024 u. Původní sousední přesahy −2…1 026 u se při alfě 0,5
sčítaly na 0,75; tvrzení prvního předání o nepřekryvu platilo pouze uvnitř
fragmentu a tímto se opravuje. Neprůhledný hřbet a pata zůstávají za vlakem
a mají 2u přesah přes hranici chunku: vyplní antialiasované okraje vektorů,
aniž by se sčítala alfa přední tváře nebo přibyla textura.
Vodorovný přesah pásu je 120 u: roh portálu při krajním 12% sklonu
dosahuje méně než 118 u, další 2 u zůstávají rezervou. Původní 170u
ramena hory zůstávají ve vektorech; prázdné části se nepečou.
Hranice 96/192 MiB, 2048² a nejvýše dvě stránky se nemění.

Přepočtená obálka po trimování prázdných ramen: low 100 504 352 B
(95,85 MiB, rezerva 158 944 B), standard 148 527 464 B (141,65 MiB).
Jde o odvozený vrchol evidovaných pixelových alokací pro všechny sousední
regionální/sezónní sady a rastry, nikoli o celou RAM prohlížeče.
Nízký profil má těsnou rezervu; integrace ostatních linek musí znovu projít
nezměněnou vyčerpávající maticí `atlasBound.*` a hranicí 96 MiB.
