---
name: diagram-contracts
description: Preserve Sketch2Mermaid canonical diagram, normalization, history, Mermaid import and export, .s2m, localStorage, group, and detached-edge contracts. Use when changing core types, diagramStore mutations, persistence, import or export behavior, undo or redo, groups, text boxes, ghost arrows, endpoint semantics, validation, or migrations of saved diagrams.
---

# Diagram Contracts

Preserve one canonical diagram model across editing, history, persistence, import, and export.

## Inspect the complete boundary

Read the relevant portions of:

- `src/core/types.ts` for canonical and runtime-only fields.
- `src/store/diagramStore.ts` for normalization, mutations, transactions, and localStorage.
- `src/core/mermaid.ts` and `src/core/mermaidImport.ts` for Mermaid round trips.
- `src/core/s2mFile.ts` for file validation and compatibility.

Trace a changed field through all five boundaries before editing. Do not fix only the caller that exposed the inconsistency.

## Preserve canonical purity

- Reject reserved view-model IDs beginning with `ghostAnchor__`, `draft-`, or `temp-` during creation, normalization, and file parsing.
- Keep `DiagramEdge.data` and imported route snapshots out of `.s2m`, localStorage, equality checks, and durable history states.
- Treat an edge as Mermaid-exportable only when both endpoints are connected and `exportMode !== 'canvasOnly'`.
- Preserve detached endpoints as canvas coordinates; never synthesize temporary nodes into the canonical model.
- Normalize legacy or malformed inputs defensively without mutating the input object.
- Preserve duplicate edges, self-loops, groups, text boxes, canvas-only content, and transaction semantics unless the requested behavior explicitly changes them.

## Implement safely

1. Define the invariant and affected persisted/runtime fields.
2. Update types, normalization, store mutations, serialization, and import/export together where applicable.
3. Keep undo/redo snapshots pure and group multi-step gestures in existing transactions.
4. Add a focused regression for the failure and an end-to-end boundary test when persistence or round-trip behavior changes.
5. Re-run the existing adversarial and purity suites for endpoint or view-model changes.

## Validate

Select the smallest relevant set while iterating, then use the repository full gate. Common focused commands include:

```bash
npm run test -- src/core/mermaid.test.ts src/core/mermaidImport.test.ts
npm run test -- src/core/s2mFile.test.ts src/store/diagramStore.test.ts
npm run test -- src/store/ghostArrows.viewmodel.test.ts src/core/ghostArrows.negative.test.ts
```

For import changes, include realistic round trips. For normalization or mutation changes, include integration, undo/redo, and non-mutation assertions.
