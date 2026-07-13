---
name: layout-routing
description: Maintain Sketch2Mermaid imported layout, canvas auto-layout, Dagre fallback, Mermaid SVG oracle, handle selection, collision avoidance, edge clipping, virtual anchors, and transient route validity. Use when changing src/core/layout, Mermaid import refinement, edge routing or snapping utilities, group geometry, node measurement, or direction-specific TD LR BT RL behavior.
---

# Layout and Routing

Treat layout as a geometry projection over the canonical diagram, not as a Mermaid round-trip that rebuilds user data.

## Preserve the merge contract

- Allow layout to replace positions, measured node dimensions, connected handles, group frames, edge label positions, and transient imported routes.
- Preserve canonical IDs, labels, styles, group kinds, duplicate edges, text boxes, detached arrows, export modes, and every canvas-only entity.
- Reposition canvas-only elements relative to their nearest diagram element and resolve collisions; never recreate them through Mermaid serialization.
- Keep all four directions (`TD`, `LR`, `BT`, `RL`) behaviorally equivalent.

## Preserve route validity

- Prefer the Mermaid SVG measurement oracle when it returns usable geometry; keep the deterministic local Dagre path as the fallback.
- Store imported polyline data only in `DiagramEdge.data` and capture the associated node geometry.
- Reject a captured route after a node moves, resizes, or changes shape, then fall back to current React Flow handle routing.
- Clip endpoints to actual shape boundaries and preserve distinct converging routes, labels, curves, and parallel edges.
- Keep pure geometry helpers independent of DOM state. Limit DOM-dependent measurement to the explicit browser/oracle layer.

## Work in layers

1. Reproduce the issue with a minimal diagram and direction.
2. Identify whether the fault is parsing, measurement, Dagre placement, group layout, merge, clipping, or rendering.
3. Change the narrowest layer and preserve deterministic output.
4. Add contract assertions for identities and non-layout fields, not only snapshot coordinates.
5. Cover fallback behavior when rendering or measurements are unavailable or invalid.

## Validate

Run the relevant layout contracts while iterating:

```bash
npm run test -- src/core/layout/mermaidLayout.test.ts src/core/layout/mermaidLayout.contract.test.ts
npm run test -- src/core/layout/autoLayout.test.ts src/core/layout/autoLayout.integration.test.ts src/core/layout/autoLayout.browser.test.ts
npm run test -- src/core/layout/mermaidEdgeRouting.test.ts src/utils/importedEdgeRouting.test.ts
```

Include nested groups, duplicate or converging edges, stale routes, detached elements, collisions, and all four directions when the changed layer can affect them.
