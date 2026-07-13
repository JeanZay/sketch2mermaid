---
name: lot-closure
description: Close and hand off Sketch2Mermaid work with scoped Git inspection, targeted and full validation, documentation and version decisions, clean artifacts, exact reporting, commit custody, authorized pushes, and GitHub Pages deployment checks. Use when finishing a change, preparing a commit or review, reporting completion, pushing, or verifying CI and deployment.
---

# Lot Closure

Close the requested lot without absorbing unrelated worktree changes or performing unauthorized delivery actions.

## Establish scope and evidence

1. Record `git status --short`, the branch, and `git rev-parse HEAD` before closure.
2. Inspect the final diff and distinguish task files from pre-existing or out-of-scope changes.
3. Run focused tests for the changed behavior, then the complete repository gate from `AGENTS.md`.
4. Run `git diff --check` and confirm no temporary, debug, rendered, or test-result artifacts were introduced.

## Decide documentation and versioning

- Determine whether behavior is visible to users.
- For visible behavior, decide and report whether `README.md`, `src/components/UserGuide.tsx`, and the in-app changelog need updates.
- Change `src/core/appVersion.ts` and `package.json` together when a release-worthy change requires a version bump.
- Do not bump or add a changelog entry for harness, documentation, tests, lint, CI, dependency housekeeping, or behavior-preserving internal work.
- Update `CONTRIBUTING.md`, `SECURITY.md`, and `.gitignore` only for the responsibilities stated in `AGENTS.md`.

## Preserve delivery custody

- Stage only the requested files when a commit is authorized. Recheck the staged diff before committing.
- Do not amend, squash, push, open a pull request, or deploy unless explicitly requested.
- Treat `main` as production-triggering: a push starts CI and GitHub Pages deployment.
- After an authorized push, run `gh run list --limit 3` and report CI and deploy status; do not infer deployment from a successful local build.

## Report exactly

Include changed files, behavior delivered, focused and full validation results, documentation status, `AGENTS.md` and `.gitignore` status, version/changelog decision, branch, HEAD or commit hash, and push/deployment status. Call out preserved unrelated changes explicitly.
