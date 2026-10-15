# D-002: Statické nasazení na GitHub Pages

Datum: 2026-10-09. Stav: přijato.

Brána M0 požaduje dostupnou URL demo buildu a dokument 09 vyžaduje statický HTTPS hosting bez backendu. Repozitář je veřejný a jeho Pages používají zdroj **GitHub Actions**. Nasazujeme proto build z větve `master` přes oficiální akce `configure-pages`, `upload-pages-artifact` a `deploy-pages`, připnuté na commit SHA. Webová adresa je <https://pavelpancocha.github.io/vlacek/>.

Build se nasazuje jen po úspěšných kontrolách ze stejného běhu. Deploy job build zopakuje z téhož commitu a lockfilu s cestou, kterou vrátí `configure-pages`. Vygenerované soubory se necommitují: alternativy „větev / kořen“ nebo „větev / docs“ by do historie přidávaly build a kolidovaly s dokumentací v `docs/`. Zápisová oprávnění pro Pages má jen deploy job.

Cesta nasazení je konfigurovatelná proměnnou `VLACEK_BASE` (výchozí `/`), aby stejný kód fungoval v kořeni domény i v podadresáři (PWA-09). Identifikátor buildu `<verze>+<commit7>[.dirty]` je v `<meta name="vlacek-build">`; podle něj se ověřuje, co je nasazené. Běh na `master` se kvůli nasazení neruší novějším pushem.

Důsledky: pracovní větve se nenasazují, demo odpovídá poslednímu úspěšnému `master`. Pages nenastavují vlastní cache hlavičky. [D-031](031-installable-offline-pwa.md) zavádí manifest a worker pod `VLACEK_BASE`, buildem generovaný inventář skutečného `dist/`, verzované požadavky s `no-store` a ověření SHA-256 celého balíku. Registrace používá `updateViaCache: none`; nový worker zůstává čekající do uzavření všech starých oken. Starý worker nepřijme HTML jiného buildu. Live smoke po nasazení čeká na úplný aktivní balík a ověří offline reload; lokální preview není důkaz skutečného nasazení ani instalace na zařízení. Při změně hostingu se zachová `VLACEK_BASE` a statický výstup `dist/`.
