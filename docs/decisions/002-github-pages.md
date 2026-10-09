# D-002: Statické nasazení na GitHub Pages

Datum: 2026-10-09. Stav: přijato.

Brána M0 požaduje dostupnou URL demo buildu a dokument 09 vyžaduje statický HTTPS hosting bez backendu. Repozitář je veřejný a jeho Pages používají zdroj **GitHub Actions**. Nasazujeme proto build z větve `master` přes oficiální akce `configure-pages`, `upload-pages-artifact` a `deploy-pages`, připnuté na commit SHA. Webová adresa je <https://pavelpancocha.github.io/vlacek/>.

Build se nasazuje jen po úspěšných kontrolách ze stejného běhu. Deploy job build zopakuje z téhož commitu a lockfilu s cestou, kterou vrátí `configure-pages`. Vygenerované soubory se necommitují: alternativy „větev / kořen“ nebo „větev / docs“ by do historie přidávaly build a kolidovaly s dokumentací v `docs/`. Zápisová oprávnění pro Pages má jen deploy job.

Cesta nasazení je konfigurovatelná proměnnou `VLACEK_BASE` (výchozí `/`), aby stejný kód fungoval v kořeni domény i v podadresáři (PWA-09). Identifikátor buildu `<verze>+<commit7>[.dirty]` je v `<meta name="vlacek-build">`; podle něj se ověřuje, co je nasazené. Běh na `master` se kvůli nasazení neruší novějším pushem.

Důsledky: pracovní větve se nenasazují, demo odpovídá poslednímu úspěšnému `master`. Pages nenastavují vlastní cache hlavičky; požadavky dokumentu 09 na service worker a cache se ověří až s PWA v M5. Při změně hostingu se zachová `VLACEK_BASE` a statický výstup `dist/`.
