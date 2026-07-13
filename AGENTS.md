# Sketch2Mermaid Agent Guidance

## Product boundaries

- Maintain Sketch2Mermaid as a browser-only React application that edits standard Mermaid flowcharts through a visual canvas. Do not introduce a backend, telemetry, secrets, or server-side persistence without an explicit product decision.
- Keep user-authored diagrams interoperable with Mermaid. Do not add arbitrary rotation, free drawing, or canvas-only shape transforms that cannot map cleanly to Mermaid nodes, connections, or explicitly canvas-only annotations.
- Treat the code and tests as the current behavior contract. `task.md`, README feature summaries, and other presentation text can lag behind the implementation.

## Sources of truth

- `src/core/types.ts`: canonical diagram, endpoint, persistence, and runtime-only data contracts.
- `src/core/shapeRegistry.ts`: supported shape catalog, Mermaid mappings, ordering, and aliases.
- `src/store/diagramStore.ts`: normalization, mutations, history, selection, and localStorage persistence.
- `src/core/mermaid.ts`, `src/core/mermaidImport.ts`, and `src/core/s2mFile.ts`: Mermaid and `.s2m` boundaries.
- `src/core/layout/` and `src/utils/importedEdgeRouting.ts`: imported and automatic layout plus transient edge routes.
- `src/components/Canvas.tsx` and the surrounding components: React Flow view model and user interaction.

## Non-negotiable invariants

- Keep `ghostAnchor__`, `draft-`, and `temp-` identifiers out of the canonical diagram, history, Mermaid output, `.s2m` files, and localStorage.
- Keep `DiagramEdge.data` runtime-only. Strip it before persistence and reject stale captured geometry when node bounds no longer match.
- Export only structurally connected edges whose `exportMode` is not `canvasOnly`.
- Preserve canonical IDs, labels, styles, group kinds, duplicate edges, text boxes, detached arrows, and all canvas-only entities across normalization, undo/redo, import, and auto-layout.
- Initialize Mermaid with `securityLevel: 'strict'` and keep user-controlled labels and style values sanitized.
- Keep generated shape SVGs and `generated-icons-map.ts` synchronized with the shape registry; never hand-edit generated output.

## Working method

1. Inspect the relevant source, adjacent tests, and current Git state before editing.
2. Follow the matching repository skill below. Use targeted tests while iterating, then run the full gate before a commit, push, or handoff.
3. Preserve unrelated worktree changes. Do not create debug files or test artifacts in the repository root; fix the producer rather than relying on `.gitignore`.
4. Add dependencies only when necessary and explicitly justified. Use `npm ci` for a clean lockfile-respecting install.

## Validation

Run the complete local gate from the repository root:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run check:shape-icons
```

Run `node .agents/skills/codex-harness-maintenance/scripts/validate-harness.mjs` after changing this guidance or any repository skill. Run `git diff --check` before handoff.

## Documentation, versioning, and delivery

- For user-visible behavior, decide explicitly whether to update `README.md`, `src/components/UserGuide.tsx`, `src/core/changelog.ts`, `src/core/appVersion.ts`, and `package.json`. Keep `APP_VERSION` and the package version synchronized whenever a version changes.
- Do not bump the version or add a changelog entry for harness-only, documentation-only, test-only, lint-only, CI-only, dependency-housekeeping, or behavior-preserving internal work.
- Update `CONTRIBUTING.md` when contribution commands or gates change, `SECURITY.md` only when the security model changes, and `.gitignore` only for legitimate generated artifacts.
- A push to `main` triggers CI and GitHub Pages deployment. Never push, deploy, or open a pull request unless the user explicitly requests it. After an authorized push, verify the result with `gh run list --limit 3`.

## Repository skills

- `diagram-contracts`: canonical model, normalization, history, Mermaid import/export, `.s2m`, localStorage, groups, and detached arrows.
- `layout-routing`: Mermaid/Dagre layout, auto-layout merge behavior, handles, collisions, clipping, and transient routes.
- `react-flow-ui`: React Flow components, selection, Zustand boundaries, React 19 lint rules, and UI verification.
- `shape-catalog`: shape registry, `NodeShape`, Mermaid syntax, renderers, and generated icons.
- `lot-closure`: targeted and full validation, documentation/version decisions, final reports, commits, pushes, and deployment checks.
- `codex-harness-maintenance`: maintain and validate this `AGENTS.md` plus the repository skills without duplication.
