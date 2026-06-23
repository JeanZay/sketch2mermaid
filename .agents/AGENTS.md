# Project Customization Rules

- **Mermaid Compatibility Constraint**: Only offer canvas options that are compatible with Mermaid.js rendering.
- **No Canvas-Only Geometry Transforms**: Do not implement shape rotation, resizing, or free-form drawing features on the canvas. The geometry must map cleanly to nodes and connections in standard Mermaid flowcharts.

## Deployment Workflow

- **Auto-deploy on push to `main`**: A push to `main` triggers CI (`ci.yml`) and Deploy (`deploy.yml`) GitHub Actions workflows. The deploy pipeline runs `typecheck`, `lint`, and `test` before building and deploying to GitHub Pages.
- **Always run the full CI gate locally before pushing**: Run `npm run typecheck`, `npm run lint`, and `npm run test` locally before committing. The CI environment may have stricter behavior than the local dev server (e.g., lint rules that only surface in `--max-warnings 0` mode).
- **Check deployment status after push**: Use `gh run list --limit 3` to verify that the CI and Deploy pipelines completed successfully. Do not assume a push is deployed until confirmed.

## React 19 Lint Rules (Strict)

This project uses React 19 with strict ESLint rules from `eslint-plugin-react-hooks`. These rules **will fail the CI pipeline** if violated:

- **`react-hooks/set-state-in-effect`**: Do NOT call `setState` synchronously inside a `useEffect` body. If you need to derive state from external data (e.g., Zustand store), use `useMemo` or update state only from event handler callbacks.
- **`react-hooks/refs`**: Do NOT read `useRef.current` during render (including inside `useMemo`). Refs should only be accessed in event handlers or effects.
- **Practical pattern for React Flow controlled components**: Track selection IDs in `useState`, update them from `onNodesChange`/`onEdgesChange` callbacks (event handlers), and derive the React Flow node/edge arrays via `useMemo` from the diagram store + selection state.
