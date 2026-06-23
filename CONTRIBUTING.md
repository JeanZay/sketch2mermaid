# Contributing to Sketch2Mermaid

We welcome contributions to Sketch2Mermaid! Please read the guidelines below to get started.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Branching & Pull Requests

1. Fork the repository and create your branch from `main`.
2. Ensure your code conforms to the project's TypeScript, linting, and formatting rules.
3. Write clean, targeted commits.
4. Ensure all CI checks (type check, lint, tests) pass locally before opening a pull request:
   ```bash
   npm run typecheck
   npm run lint
   npm run test
   ```

## Development Workflow

1. Install dependencies:
   ```bash
   npm ci
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Run tests using Vitest:
   ```bash
   npm run test
   ```
