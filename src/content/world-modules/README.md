# Lokální art mapy scén

Obsahová linka přidá `<lane>.art.ts` s exporty `parts` (`as const satisfies Record<string, ArtPart>`) a `usedKeys` pro kresby používané mimo pravidla umístění. Soubor sám vlastní a ostatní moduly neupravuje. Nové SVG patří do `assets/world/`; názvy souborů i klíče jsou jedinečné a mají prefix linky. Statické registry obnoví `volta run npm run generate:world-registries`; ruční úprava generovaných souborů není povolena. Postup a kompatibilita jsou v [D-023](../../../docs/decisions/023-world-generator-v2.md).
