---
name: codex-harness-maintenance
description: Maintain Sketch2Mermaid repository guidance and Codex skills with concise root instructions, focused progressive disclosure, valid front matter, no duplicated or machine-specific guidance, and deterministic validation. Use when editing AGENTS.md, adding or changing .agents/skills, codifying recurring agent feedback, or auditing the repository Codex harness.
---

# Codex Harness Maintenance

Keep durable rules small, discoverable, portable, and owned by one source.

## Place guidance at the smallest useful surface

- Put rules that apply to nearly every task in the root `AGENTS.md`.
- Put repeatable domain workflows in a focused repository skill under `.agents/skills/<name>/SKILL.md`.
- Keep detailed procedure in the skill, not duplicated in `AGENTS.md`; keep the root skill list to routing summaries.
- Do not add nested `AGENTS.md`, `.codex` config, rules, hooks, plugin metadata, or skill UI metadata unless a concrete requirement justifies that surface.
- Use relative repository paths. Do not commit absolute local paths, file-scheme links, user-specific configuration, or generated session state.

## Maintain skills

1. Use a lowercase hyphenated folder name under 64 characters.
2. Keep YAML front matter to single-line `name` and `description` fields. Make `name` match the folder exactly and put all trigger conditions in `description`.
3. Write the body as imperative, repo-specific procedure. Remove explanations Codex can infer and avoid auxiliary README or changelog files.
4. Add scripts only for repeated deterministic work and test every added script directly.
5. Reference every repository skill once in the root routing list.

## Validate

Run:

```bash
node --check .agents/skills/codex-harness-maintenance/scripts/validate-harness.mjs
node .agents/skills/codex-harness-maintenance/scripts/validate-harness.mjs
git diff --check
```

Then validate each skill with the built-in `skill-creator` validator when its Python YAML dependency is available. If that validator cannot run, report the exact environment failure and rely on this repository validator plus direct front matter inspection; do not install global packages silently.

Treat recurring incorrect assumptions, excessive source discovery, or repeated review feedback as candidates for a small guidance update. Do not encode one-off task instructions as durable repository policy.
