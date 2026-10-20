# D-026 — Dlouhé skalní tunely a mostní varianty

Datum: 2026-10-14. Navazuje na [D-018](018-bridges-and-tunnels.md),
[D-023](023-world-generator-v2.md) a [text scén](../scenes/tunnels-bridges.md).

## Důvod a rozhodnutí

Krátký tunel 448 u nemůže na chvíli pohltit maximální 2 000u soupravu.
Nový infrastrukturní modul `tunnels-bridges.scenes.ts` plánuje skalní tunely
3 072/3 328 u v horách a podhůří a mostní varianty v jejich hostitelských
scénách. Nezavádí další losovanou lokalitu. Slot vlastníka tunelu zůstává 6;
obsadí interval od slotu 5 do nejvýše slotu 0 následujícího bloku.
Další stanice, přejezd a souběh do něj nevstoupí. Profil koleje se nemění:
kryt sleduje i zaoblení skutečné trati, portály její místní tečnu.

`TunnelSite.fromX/toX` jsou úplné konce stavby relativní k dotazovanému
chunku, tedy mohou ležet mimo 0…1 024. Všechny fragmenty mají stejné ID.
Kresba `RockTunnelView` a textura mají pouze lokální rozsah s 2u přesahem;
portály patří skutečným koncům. Odebrání vstupního chunku neodstraní kryt
uprostřed tunelu. Životní cyklus dál vlastní `ChunkView.destroy`.
Mřížka materiálu má světovou fázi 256 u, nikoli fázi chunku nebo kamery.
Světlost portálu je 186 u, kontakt 128 u, kryt začíná 52 u
za ústím. Pata tělesa navazuje na skutečnou louku. Podle [D-033](033-tunnel-see-through-and-split-portals.md) kryt všech fragmentů
zprůhlední na 50 % u hráčova vlaku, včetně zimy. Ústí a vnější pilíř
jsou za vlakem, přední část v krytu; druhý portál je zrcadlený.
Řízení, kamera a tlumení D-022 zachovávají své kontrakty; emise uvnitř
zůstává potlačená a viditelné bubliny jsou dotykové.
Audio sbírá každý úplný rozsah pouze jednou i při několika renderových
fragmentech, aby částečný vjezd nenásobil útlum počtem chunků.

Viadukt má čtyři 160u oblouky, ocelový most dvě 256u pole. Filtr přijme
pouze existující konstantní sklon nejvýše 3 % v celém poli. Jinak zůstane
malý kamenný most. Údolí má pod viaduktem 180 u, pod ocelovým mostem
110 u; sdílená funkce terénu zajišťuje návaznost i mimo chunk.
Pilíře dosahují na terén a vodní koridor zůstává mezi nimi. Trolejové
konzoly respektují původní globální fázi podpěr a kontakt 128 u.

Letní/zimní skalní assety deklarují pouze `atlasGroup.seasons`. Výběr
barvy krátkého zeleného kopce vlastní souběžná seasons-life; tento řez
jej nepřepisuje. Dev preset **Tunel** preferuje první dlouhou stavbu v
omezeném 1 920chunkovém hledání a při její nepřítomnosti použije krátkou.

## Kompatibilita a ověření

Generátor v2 ještě není vydaný; doplňujeme jeho plánovaný obsah. Verze
geometrie 2, save schéma 1 a katalogová ID se nemění. Vydané cesty v0/v1
se nadále obnovují migrační cestou D-023. Nové klíče náhodnosti jsou
`tunnels-v2:length`; stávající krátký demonstrační tunel zůstává stejný.

`validate:world` vyžaduje nenulové svědky dlouhého tunelu, kamenného mostu,
ocelového mostu a viaduktu. Kontroluje identitu a úplný rozsah každého
vnitřního fragmentu, profil mostovky, údolí a volný koridor mezi podpěrami.
Jednotkové testy doplňují náhodný přístup a omezenou šířku pečení;
`long-structures.spec.ts` a `tunnel-occlusion.spec.ts` ověřují skutečnou
Canvas/WebGL kresbu a pixely skrytých vozidel/částic. Fyzický tablet a Tesla,
firmware a poslech tlumení na zařízení: **NEOVĚŘENO**.

## Integrační kapacita atlasu před D-030

Čtrnáct nových dílů má 348 656 u², tedy 1 394 624 px² při 2 px/u.
Současný společný světový atlas má 1 023 897 u²; při 1 px/u se zabalí
na 2 036 × 702 px, při 2 px/u má 4 095 588 px² ještě před okraji a
současný shelf packer jej do 2 048² nesloží. Dva stávající maximální
atlasové testy proto před integrací D-030 zůstávají červené. Řešením je
plánované rozdělení atlasů podle regionu/sezóny; tento řez nemění limity,
nezmenšuje kresby a neuvolňuje očekávání testů. Sezónní metadata jsou
připravená podle amendmentu 12. Při cílových výřezech se skutečný atlas
rastrováním podle zoomu vejde; to nenahrazuje ověření maximální jemnosti.

## Regrese nalezená dlouhým průchodem

Seed 2, viditelný chunk 288 obsahuje tekoucí mlýnský náhon s břehem
`fromX = 508.2504011598732`. Původní pečení vody předávalo tuto desetinnou
souřadnici funkci `hash32`, která správně vyžaduje bezpečná celá čísla.
`sceneryDecorationHash` zachová dosavadní celočíselné klíče přesně a
konečnou desetinnou souřadnici zakóduje jako řetězec s jednotkou `u:`.
Nekonečna a NaN dál odmítá. Sdílejí jej tři místa pečení detailů země/vody;
geometrie, doménová náhodnost a uložená cesta se nemění. Regresní test
zachovává přesnou hodnotu břehu. Jde o nutnou malou opravu `ChunkView`
pro dokončení streamovacího měření, nikoli změnu kompozice mlýna.

Sezónu dlouhého tunelu drží jeho logický `TunnelSite` podle hostitele.
Delegace do `RockTunnelView` nemění podpis `TunnelView`; sezónní hook
krátkého kopce tak zůstává samostatným místem integrace seasons-life.

## Lokální měření prvního řezu (a1249be)

Ve WebGL při 1 280 × 800 a 2 000u soupravě proběhl streamovací průchod
480 chunky seedu 2: ruční postup kurzoru po chunku, skutečné vytvoření a
odstranění views po každém kroku. Nejde o 480 chunků jízdy v reálném čase.
Maximum bylo 5 fragmentů skalního tunelu a 2,87 MiB jejich pečených textur;
textury půdy a tunelů (`ground:*`) měly v okně nejvýše 6,76 MiB. Na konci byly tunelové
fragmenty i jejich pečené textury uvolněné a kolej držela 11 chunků.
Měření zahrnuje RGBA8 canvasy, nikoli celou paměť prohlížeče či ovladače.

Materiál skály se po jednom cílovém pixelovém sloupci jednorázově nanese
do již vlastněné pečené textury; nevytváří další texturu ani desítky
živých obrázků po celé délce. Portálové roviny pro hit/occlusion výpočet
vzniknou při konstrukci; tento výpočet nevytváří pole ani objekty po snímcích.
Nové tunely/mosty nemají vlastní animátory, timery či listenery.

Jednorázový Node benchmark nad 240 chunky seedu 2 po zahřátí, na sdíleném
vývojovém stroji: původní `35f260f` průměr 1,68 ms/chunk (p95 5,66 ms),
tento řez 1,66 ms/chunk (p95 4,51 ms); maximum 54 dekorativních rekvizit
na chunk, průměr 37,33 oproti původním 37,80. Nejde o měření snímkového
rozpočtu ani fyzického zařízení; `measure:perf` tento worker nespouští.

Logický `FeatureExtent` mostu má celý rozsah mostovky, nejen původních
±96 u kolem vodního koridoru. `validateStructureFeatures` kontroluje
úplné rozsahy mostů i tunelů v každém generovaném fragmentu; mutační test
zachycuje zkrácený mostní rozsah. Tato minimální změna vlastníka v
`Scenery.ts` nemění polohu ani tvar mostu.

## Revize tunnels-bridges-2

Společný profil `rockMountainHeightU` stoupá od portálů k vrcholu přibližně
544 u nad kolejí a klesá po zadním svahu. Kresba i rezervace počítají z
úplného logického rozsahu, nikoli z fragmentu. Louka a zakořeněné skupiny
jehličnanů nad skálou sdílejí světovou fázi; v zimě mají sněhovou pokrývku.
Rezervace a pečené meze zahrnují i koruny. Vnější rameno bez neprůhledné
hmoty neschovává částice; rezerva materiálové hrany platí jen na proužku
skutečně kresleného materiálu. Kolej, save a logická umístění se nemění.

Regrese `ChunkView.test.ts` generuje a peče skutečný seed 2 / chunk 288;
vrácení původního hashování ve volajícím vyvolá původní RangeError.
Mostní E2E měří skutečné transformované paty pilířů/opěr proti terénu,
volný vodní koridor a jeho průjezdný silniční obrys. Elektrický svědek
kontroluje skutečné konzoly, kontakty a závěsy i průchod dlouhou stavbou.
Tato větev pod mosty generuje vodu; silniční obrys je kontrola světlosti,
nikoli tvrzení o přidané silnici nebo aktéru.

Bod 1 review zůstává záměrně otevřený do integrace D-030. Jediná funkce
`composeRockMaterial` uzavírá dnešní přístup k pixelům atlasu a nanášení
na vlastněný canvas. Následná integrace musí přesunout složení před
neměnný upload, použít přístup k pixelům i jediný resolver D-030 a uvolnit
případný dočasný readback. Samotné přesměrování názvu textury nestačí.
Výše uvedené číselné měření paměti patří prvnímu řezu s nižším krytem;
není měřením nového horského profilu.

Nový profil byl znovu změřen stejným 480chunkovým streamingem seedu 2,
WebGL 1 280 × 800 a 2 000u soupravou: nejvýše 5 skalních fragmentů,
4,38 MiB jejich RGBA8 canvasů; všechny `ground:*` textury nejvýše
8,24 MiB / 22 textur. Ve všech 480 vzorcích bylo 0 osiřelých textur,
na konci 0 skalních fragmentů a 11 chunků tratě; maximum 114 kořenových
objektů se nezměnilo. Jde o paměť těchto canvasů, ne celé GPU/prohlížeče.

Cílená unit sada má 25 PASS. Tři požadované E2E soubory mají dohromady
56 PASS (desktop i dotyková emulace, Canvas i WebGL). Nová mostní kontrola
ověřuje také skutečně volný pixelový průhled pro vodu a obrys auta
z katalogu. Odstranění podpěr dává v obou rendererech behaviorální RED
„expected 5, received 0“. Plný lokální `check` vykázal 958 PASS / 2 FAIL;
obě chyby jsou výše popsaná maximální kapacita atlasu. Snímky revize jsou
v externím archivu `_runs/shots/tunnels-bridges/tb-2/`, 16 PNG 1 140 × 512.

## Revize tunnels-bridges-3 — krátký kopec v hostitelské krajině

Krátký tunel vybírá povrch a vegetaci z regionu a sezóny u vstupního
portálu. Duny mají písek, borovice a nízké fialové keříky; pobřeží skálu
s řídkou trávou; hory/podhůří skálu s jehličnany; venkov/vesnice původní
louku a květy. Lesní a jezerní hostitelé ponechávají luční variantu.
Zimní sezóna má vždy přednost: sníh a existující zasněžené díly bez
letních květů. Nové klíče ani assety nepřibývají; nízký vřes skládáme
ze stávajícího keře a fialových květů, protože samostatný díl na této
bázi není. Rostliny jsou uvnitř původního obrysu, nezasahují do příjezdů.

Jediná funkce `shortTunnelHostAt` zatím čte `regionAt(seed, portalX)`;
po rebase se nahradí zdrojem `effectiveClimateAt` ze seasons-life.
Minimální zásah do `ChunkView.#addTunnel` předává seed. Geometrie,
rezervace, occlusion, pata portálu, kolej a formát save zůstávají stejné.
Nové obrázky vlastní existující kontejner krytu a zanikají s chunkem;
nepřibývají textury, animátory ani alokace v aktualizační smyčce.

Behaviorální RED seedu 0 / chunku 382 zachytil luční barvu v dunách;
po změně má cílená sada 40 PASS. Varianty zahrnují pobřeží, hory, podhůří,
venkov, vesnici a zimu; test s artem kontroluje i obrys každé nové rostliny
proti původnímu krytu. Šest snímků Canvas/WebGL 1 140 × 512 v archivu
`_runs/shots/tunnels-bridges/tb-3/` bylo prohlédnuto. Výřez skutečně
vykresleného tělesa obsahuje v dunách písek, na venkově louku a v zimě
sníh; duny ani zima v tomto výřezu nemají žádný pixel luční barvy.
Celá unit sada má 970 PASS / 2 známé kapacitní chyby atlasu; lint a
projektový typecheck prošly. Validátory světa, assetů a lokálních odkazů
prošly samostatně. D-030 zůstává před integrační zelenou branou.

Při závěrečném E2E vyšel najevo timeout starší mostní kontroly: zkrácený
callback `page.evaluate` vracel výsledek `setActive(false)`, tedy celý
Phaser `Systems`. Trace zachytil 2,26 MB serializovaného grafu a téměř
10 s režie na jedno pozastavení. Callback nyní nic nevrací; stejné
pozastavení, aserce i 30s limit zůstávají. Tato oprava testovací hranice
nemění vykreslování mostů ani tunelů.

Původní požadovaný běh měl 51 PASS / 1 timeout; izolovaný diagnostický
běh potvrdil stejnou chybu. Po opravě prošly všechny čtyři dotčené mostní
varianty (Canvas/WebGL, desktop/dotyková emulace) za 43,3 s. Zbývajících
48 případů původního běhu se touto testovací změnou nemění a prošlo;
nejde o tvrzení o novém souvislém zeleném běhu všech 52 případů.

## Revize tunnels-bridges-4 — čitelný objem krátkého kopce

Dunový kopec používá teplejší písek `#e4c58b`, odlišný od roviny
`#f0dcaa`. Holý písek, pobřežní/horská skála a sníh mají jemně nasvětlený
hřbet a odstupňovaný stín směrem k patě. Stínovací tahy se vejdou mezi
stávající horní a dolní obrys. Původní luční kontury zůstávají; obvodová
čára všech povrchů se kreslí jen na úsecích s nenulovou plochou výplně.
Geometrie, portály, jejich paty, zakrytí, rezervace a formát save se nemění.
Malba probíhá jednou při existujícím bake; nepřidává textury ani objekty
do aktualizační smyčky, nové assety nebo atlasové klíče nevznikají.

Render unit RED skutečného seedu 0 / chunku 382 zachytil nulový RGB
kontrast výplně svahu proti okolnímu písku (požadováno více než 18).
Čtyři další REDy potvrdily čáru na prázdných ramenech v dunách, na pobřeží,
v horách a ve sněhu. Opravená cílená sada má 44 PASS. Pixelová E2E regrese
porovnává medián dvou malých ploch v původním svědkovi 1 140 × 512 v
Canvas a WebGL; medián vyloučí okraj sousední borovice. Zdroj klimatu a
čekající integrace D-030 zůstávají mimo tento řez.

Oba požadované E2E soubory prošly v jednom zamčeném běhu se dvěma workery:
56 PASS za 9 minut (desktop/dotyková emulace, Canvas/WebGL), bez opakování.
Deset prohlédnutých snímků 1 140 × 512 v `_runs/shots/tunnels-bridges/tb-4/`
zahrnuje duny, venkov, zimu i obě skalní krajiny. Dunový svah má v obou
rendererech medián RGB 219/188/131, okolní písek 240/220/170, tedy kontrast
54,6 proti požadovaným 18. Plný `check` proběhl jednou: registry, formát,
lint a typecheck PASS; unit sada 974 PASS / 2 známé kapacitní chyby atlasu
D-030 (976 testů, 103 souborů). Zbývající validátory světa, assetů, odkazů,
tajných údajů a velikostí prošly samostatně pod kontrolním zámkem.

## Integrace D-030 — tunnels-bridges-5

Schválená linka je sloučena do jednoho commitu nad `95cf68c`. Po opravě
tunnels-bridges-6 zachovává D-027 sezónní míchání a přílohy včetně sněhových
čepic obou krátkých portálů i všechny geometrické opravy D-026.
Krátký kopec vybírá dominantní sezónu přes `effectiveClimateAt` u portálu.
Každý světový obrázek používá `frameTexture` a značku `world-part`.

Čepice `snow.roof-64` zůstávají na původních souřadnicích a měřítku D-027;
jejich alfa odpovídá efektivní zimní váze u každého portálu. Art-enabled
regrese SEA-05 pokrývá seed 0, chunk 230 (zima) i 190 (přechod s částečnou
alfou), obě přílohy a jejich značky. Geometrie, zakrytí a uložená data se nemění.

Materiál dlouhého tunelu se skládá do již evidovaného canvasu země před
voláním `immutableTexture`; žádná další pracovní plocha ani CPU kopie na
WebGL nezůstává. `atlasFramePixels` poskytuje jeden rámec po druhém,
uvolnění probíhá v `finally` i při chybě kreslení. Účetní model zahrnuje
současnou živou readback kopii i skutečné fragmenty dlouhé stavby.

Neprůhledný vnitřek s přesnými hranami závěsů zůstává statický vektorový
objekt vlastněný kontejnerem fragmentu. Nevytváří další pixelovou plochu.
Materiál a portály se nezmenšují. Obálka pixelů zahrnuje všech osm poloh
sedmichunkového okna vůči blokovým slotům, obě dlouhé délky, části sousedních
staveb, krátký tunel a 180u viaduktové údolí. Horská silueta s vegetací je také statická vektorová kresba; peče se jen
290u pás skutečného atlasového materiálu mezi ústími. Výpočet používá
skutečné meze profilů krajiny. Geometrie, zakrytí a pata portálu se nemění.

Odvozené maximum integrovaného katalogu po změně: low 97 951 432 B
(93,41 MiB; rezerva 2 711 864 B do nezměněných 96 MiB), standard
147 406 304 B (140,58 MiB do 192 MiB; po integraci všech linek, viz
[D-030](030-world-atlas-region-window.md)). Nejde o celkovou RAM procesu,
ale o obálku evidovaných pixelů včetně souběhu publikace atlasů.
Největší čtený rámec potřebuje současně 940 240 B na low a 2 393 184 B
na standard; další vlastní scratch canvas má 0 B. S již evidovaným
canvasem materiálu 1 632 464 B je pracovní souběh nejvýše 2 572 704 B,
respektive 4 025 648 B. Maximum staré světové sady je 10 485 760 B na low
a 26 017 792 B na standard; metadata nově zahrnují i podhorské tunely.
Čtyřsouborová matice nadále vynucuje stejné rozpočty 96/192 MiB,
nejvýše dvě stránky v sadě a maximální rozměr stránky 2048².

Lokální TDD důkaz integrace: art-enabled dlouhý tunel na rebased bázi
v Canvas i WebGL vyhodil `rock cover needs its owned baked canvas`
(2 FAIL); po opravě stejný výběr `D-030.*art-enabled long tunnel` dává
2 PASS, bez chyb stránky, s `missingFrames: []` a `pending: false`.
Regrese efektivní sezóny (seed 0, chunk 190), hostitelských skupin a
uvolnění readbacku nejprve selhaly chováním; konečná cílená sada má
92 PASS v 7 souborech. Čtyři `atlasBound.*` soubory mají 814 PASS.
Jediný plný běh `flock /tmp/vlacek-check.lock env VITEST_MAX_WORKERS=4
volta run npm run check` prošel: 2 116 testů ve 141 souborech, registry,
formát, lint, typecheck, assety, svět, odkazy, secrets i velikosti.
Samostatná release validace: 42 vozidel s artem, 344 světových dílů,
0 placeholderů. Světový sweep: 81 dlouhých tunelů, 708 kamenných mostů,
154 ocelových mostů, 105 viaduktů a 324 spojů tunelových fragmentů.
Úplné logy a reprodukční příkazy jsou v `_runs/tunnels-bridges-5-proof/`.

Dlouhá browserová jízda přes tři regiony a dvě sezóny prošla v Canvas i
WebGL v desktopové i dotykové emulaci. Ve všech čtyřech případech proběhly
3 výměny sad a `missing: []`; evidované pixelové maximum bylo 9 595 736 B
v Canvas a 9 268 572 B ve WebGL při rastru zvoleném pro tuto jízdu.
Tyto naměřené hodnoty nenahrazují výše uvedenou obálku nejvyššího rastru.
Po prvním širším E2E běhu byly opraveny pouze pomocníky připravenosti:
elektrický svědek čeká na publikované atlasy; záměrný fallback čeká na
potvrzené selhání atlasu. Pixelové a geometrické podmínky i timeouty se nemění.

První širší E2E běh pod oběma zámky dokončil 164 případů: 152 PASS,
12 FAIL. Dvě chyby byly známý atlasový resize `world-atlas-regions:658`;
deset chyb způsobila připravenost fixtures. Po opravě výběr
`TRN-06 and TRN-08: over the bridge|fallback: (sloped NPC rock|stopped player)`
prošel 10/10 v desktopové i dotykové emulaci. Stejný grep na čistém
archivu `95cf68c` dal 8 PASS / 2 FAIL: původní kontrola sběrače čte
`Infinity` před publikací. Samostatný `art.spec:187` zopakoval dvě známá
atlasová resize selhání. Tyto čtyři atlasové případy zůstávají bránou vlastníka
D-030; atlasové internals ani časové limity tato linka nemění.

Osm prohlédnutých snímků 1140 × 512 v `_runs/tunnels-bridges-5-proof/`
ukazuje dunový krátký tunel, celý letní a zimní horský hřbet s oběma ústími
a ocelový most s elektrickou lokomotivou, vždy v Canvas i WebGL.
Každý má JSON s `missingFrames: []`, `pending: false` a nulou chyb stránky.
Na horských snímcích je všech 2000 u i každé vozidlo uvnitř a kryt má
`alpha: 1`. Snímkovací build je `0.1.0+37f251d.dirty`, generátor 2.
Čtrnáct vlastních dílů má součet ploch 348656 u²; rámy před zabalením
(včetně 1px okraje) zaberou 357708 px při 1 px/u a 1412672 px při 2 px/u.
CI a fyzická zařízení včetně Tesly zůstávají NEOVĚŘENO.
