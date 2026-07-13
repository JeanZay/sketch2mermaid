---
name: shape-catalog
description: Keep Sketch2Mermaid shape definitions, NodeShape typing, Mermaid syntax and aliases, palette ordering, node rendering, sizing, import and export, and generated SVG icons synchronized. Use when adding, removing, renaming, reclassifying, styling, parsing, rendering, or regenerating any supported flowchart shape.
---

# Shape Catalog

Treat `src/core/shapeRegistry.ts` as the catalog and Mermaid mapping source of truth. Keep the explicit `NodeShape` type and every consumer synchronized with it.

## Update the complete shape surface

1. Update `NodeShape` and the matching `SHAPE_DEFINITIONS` entry, including category, label, Mermaid shape or legacy syntax, aliases, and fixed-label behavior.
2. Update node sizing and `NodeShapeRenderer` only when the new geometry requires it.
3. Cover Mermaid export, import aliases, escaping, and round-trip behavior.
4. Verify palette grouping and both legacy and Mermaid-generated icon paths.
5. Regenerate committed icons only after the registry is correct.

Never edit `src/assets/shape-icons/*.svg` or `generated-icons-map.ts` by hand. Use:

```bash
npm run generate:shape-icons
npm run check:shape-icons
```

These scripts currently invoke `tsx` through `npx`; report a missing-network/tooling failure instead of fabricating generated output or changing dependencies outside the task scope.

## Validate

Run focused shape coverage before the full gate:

```bash
npm run test -- src/core/shapeRegistry.test.ts src/core/shapeIcons.test.tsx
npm run test -- src/core/mermaid.test.ts src/core/mermaidImport.test.ts
npm run check:shape-icons
```

For a catalog change, confirm the registry, union type, generated map, individual SVG files, import aliases, export syntax, and renderer all contain the same final shape set.
