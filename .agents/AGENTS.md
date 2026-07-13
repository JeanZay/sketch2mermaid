# Project Customization Rules

- **Mermaid Compatibility Constraint**: Only offer canvas options that are compatible with Mermaid.js rendering.
- **No Canvas-Only Geometry Transforms**: Do not implement shape rotation, resizing, or free-form drawing features on the canvas. The geometry must map cleanly to nodes and connections in standard Mermaid flowcharts.
- **Imported Edge Route Contract**: Mermaid-imported edges render from transient `DiagramEdge.data.points` produced by Dagre and clipped to shape boundaries. Keep that data out of `.s2m` and local-storage serialization, and fall back to interactive React Flow routing whenever its captured node bounds are stale.
- **Auto-Layout Merge Contract**: Auto-layout may replace positions, measured node dimensions, connected handles, group frames, and transient imported routes only. It must preserve canonical IDs, labels, styles, group kinds, duplicate edges, text annotations, detached arrows, and every `canvasOnly` entity; canvas-only elements must be repositioned rather than recreated through a Mermaid round-trip.

## Deployment Workflow

- **Auto-deploy on push to `main`**: A push to `main` triggers CI (`ci.yml`) and Deploy (`deploy.yml`) GitHub Actions workflows. The deploy pipeline runs `typecheck`, `lint`, and `test` before building and deploying to GitHub Pages.
- **Always run the full local validation gate**: Run the following validation commands locally before committing, pushing, or handing off the workspace:
  ```bash
  npm run typecheck
  npm run lint
  npm run test
  npm run build
  ```
  The CI environment may have stricter behavior than the local dev server (e.g., lint rules that only surface in `--max-warnings 0` mode).
- **Check deployment status after push**: Use `gh run list --limit 3` to verify that the CI and Deploy pipelines completed successfully. Do not assume a push is deployed until confirmed.
- **No Automatic Push to Production**: Do NOT push changes to the `main` branch or trigger production deployment without the user's explicit request. Changes can be committed locally, but push and deploy actions require approval.
- **Status verification (when requested)**: When a push is explicitly requested by the user, verify deployment status using `gh run list --limit 3` to ensure CI/CD success, and notify the user once confirmed.

## React 19 Lint Rules (Strict)

This project uses React 19 with strict ESLint rules from `eslint-plugin-react-hooks`. These rules **will fail the CI pipeline** if violated:

- **`react-hooks/set-state-in-effect`**: Do NOT call `setState` synchronously inside a `useEffect` body. If you need to derive state from external data (e.g., Zustand store), use `useMemo` or update state only from event handler callbacks.
- **`react-hooks/refs`**: Do NOT read `useRef.current` during render (including inside `useMemo`). Refs should only be accessed in event handlers or effects.
- **Practical pattern for React Flow controlled components**: Track selection IDs in `useState`, update them from `onNodesChange`/`onEdgesChange` callbacks (event handlers), and derive the React Flow node/edge arrays via `useMemo` from the diagram store + selection state.

## AI Agent Quality & Documentation Checklist

To maintain repo hygiene and ensure smooth handoffs:
- **Final Validation & Doc Pass**: Before any commit, push, or workspace handoff, run the complete local quality validation pipeline and perform a full pass of documentation cleanup. Keep documentation strictly aligned with the actual features available.
- **Documentation Updates Checklist**: Verify and update the following files when relevant:
  - [README.md](file:///c:/Users/amaur/dev/sketch2mermaid/README.md) for developer/user-facing project documentation;
  - [UserGuide.tsx](file:///c:/Users/amaur/dev/sketch2mermaid/src/components/UserGuide.tsx) for UI-visible help and user-facing behavior;
  - [AGENTS.md](file:///c:/Users/amaur/dev/sketch2mermaid/.agents/AGENTS.md) for durable recurrent rules, conventions, traps, and maintainer expectations;
  - [CONTRIBUTING.md](file:///c:/Users/amaur/dev/sketch2mermaid/CONTRIBUTING.md) when commands, contribution workflow, branching, PR rules, or validation gates change;
  - [SECURITY.md](file:///c:/Users/amaur/dev/sketch2mermaid/SECURITY.md) only when the client-side security model changes;
  - [.gitignore](file:///c:/Users/amaur/dev/sketch2mermaid/.gitignore) when new local/generated/test artifacts are discovered.
- **Durable Rules Documentation**: Document in `AGENTS.md` any recurrently expected behaviors, design constraints, or traps encountered during development.
- **Zero Stray Test Artifacts**: Never let tests or scripts write temporary files (e.g., `rendered_svg.xml`, debug logs) to the project root. If an artifact is generated during testing, the root cause must be fixed (e.g., remove the write or use a temporary system directory); adding files to `.gitignore` is only a safety net and is not a substitute for fixing the root cause.
- **No Automatic Push to main**: Never push to the `main` branch (which triggers GitHub Pages deployment) without explicit confirmation from the maintainer.
- **UI State Store Inspection Guideline**: Before adding a new Zustand store, inspect existing UI state patterns. If a simpler local state, prop callback, or existing store is sufficient, prefer that. Add a dedicated store only if it materially reduces coupling or matches existing app architecture.

## User-visible Change Log Discipline

- Whenever a task introduces, changes, removes, or fixes behavior that is visible to end users, update the in-app changelog in `src/core/changelog.ts`.
- Also update the app version source in `src/core/appVersion.ts` when the change should trigger a “What’s New” notification on the deployed GitHub Pages app.
- Do not add changelog entries for purely internal refactors, test-only changes, lint-only changes, CI-only changes, dependency housekeeping, or dead-code cleanup unless they materially affect user-visible behavior.
- Keep changelog entries short, concrete, and written for users, not developers.
- Prefer categories such as `feature`, `improvement`, `fix`, `breaking`, and `security`.
- Set changelog importance deliberately:
  - `minor`: small visible polish or narrow bug fix.
  - `normal`: meaningful user-visible improvement or feature.
  - `major`: significant workflow change, compatibility change, or breaking behavior.
- Before completing a coding task, explicitly check whether the change is user-visible. If yes, either update the changelog/version or explain why no changelog entry is needed.
- Before pushing or opening a final report, include the changelog/version status in the completion summary.

## Product Versioning Policy

After any significant development, enhancement, or fix, the agent must check if the product version should be incremented.
- **Verify UI Version**: The primary user-facing version is defined as `APP_VERSION` in `src/core/appVersion.ts` (re-exported in `src/core/config.ts`) and displayed dynamically in components like [Toolbar.tsx](file:///c:/Users/amaur/dev/sketch2mermaid/src/components/Toolbar.tsx) and [SettingsModal.tsx](file:///c:/Users/amaur/dev/sketch2mermaid/src/components/SettingsModal.tsx).
- **Check Other Sources**: Check for any other version sources (such as `"version"` in [package.json](file:///c:/Users/amaur/dev/sketch2mermaid/package.json), application constants, or documentation).
- **Maintain Consistency**: Keep these different version sources strictly synchronized unless the repository explicitly documents a deliberate distinction between the package version and the displayed product version. Specifically, `package.json.version` and `APP_VERSION` must remain consistent.
- **Determine Increment Level**: Select the appropriate version increment (e.g. Major, Minor, or Patch) based on the actual impact of the changes made.
- **No Unnecessary Increments**: Do not increment the version for purely internal code refactoring, test additions, documentation updates, or non-significant product changes.
- **Report Status**: The final report must explicitly mention:
  - Full validation results for `typecheck`, `lint`, `test`, and `build`.
  - Whether documentation was updated.
  - Whether [AGENTS.md](file:///c:/Users/amaur/dev/sketch2mermaid/.agents/AGENTS.md) was updated.
  - Whether [.gitignore](file:///c:/Users/amaur/dev/sketch2mermaid/.gitignore) was updated.
  - Whether the product version was changed or intentionally kept unchanged (providing the new version number or a clear explanation).
  - If the task changed user-visible behavior, verify that `src/core/changelog.ts` and `src/core/appVersion.ts` were updated consistently.
  - If the task did not require a changelog update, state that explicitly in the final report.
  - Current branch, commit hash, and push/deployment status if applicable.



