---
name: react-flow-ui
description: Implement and review Sketch2Mermaid React 19 and React Flow user-interface changes with correct Zustand ownership, controlled selection, derived view-model nodes, strict hook linting, and visual verification. Use when changing Canvas, components, hooks, interaction gestures, selection, keyboard behavior, panels, modals, toasts, or UI state ownership.
---

# React Flow UI

Keep React Flow as a derived interactive view over the canonical diagram and existing shared UI state.

## Choose state ownership deliberately

- Use local component state for short-lived state owned by one component.
- Use props and callbacks when a parent already owns the state.
- Reuse `useDiagramStore` for canonical diagram mutations and existing shared selection or tool state.
- Add a new Zustand slice or store only when state must be shared across distant components or participate in established persistence/history behavior.
- Do not maintain a second selection truth beside `selectedNodeIds` and `selectedEdgeIds` in the existing store.

## Respect React 19 and React Flow boundaries

- Do not call `setState` synchronously in an effect to derive render state. Derive values during render or `useMemo`, or update them from event callbacks.
- Do not read `ref.current` during render, including inside `useMemo`. Read refs in effects or event handlers.
- Derive React Flow nodes and edges from canonical data plus UI selection; never insert ghost anchors or draft previews into the canonical store.
- Route user gestures through existing store transactions so drag, resize, delete, paste, and multi-step actions produce coherent undo/redo entries.
- Preserve keyboard focus and text editing behavior when adding canvas shortcuts.

## Verify behavior

1. Add or update the nearest component, hook, store, or integration test.
2. Run lint early because strict hook rules catch patterns that can look valid in the browser.
3. Exercise the affected flow in the browser when geometry, focus, drag/drop, selection, modal stacking, themes, or responsive layout changes.
4. Check empty, selected, editing, undo/redo, and error states relevant to the change.
5. Update `src/components/UserGuide.tsx` when the user workflow changes.

Use the full repository gate before handoff. Do not accept a visual success as a substitute for store and serialization tests when the UI mutates diagram data.
