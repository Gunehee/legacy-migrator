# legacy-migrator — governance rules

This repo builds and runs a legacy-codebase migration agent. Every agent (human or model)
working in this repo — including inside `runs/<repo>/` — must follow these rules:

1. **Test-paired changes.** Every code change must be paired with a passing test before it
   is marked complete. No stage of a migration advances while the suite is red.
2. **No behavior changes beyond the migration.** The goal is identical observable behavior
   on a modern stack. Any ambiguous business-logic case must be flagged in
   `runs/<repo>/migration-log.md` and resolved by preserving existing behavior exactly —
   never by guessing intent or "improving" it.
3. **Rationale-logged transformations.** Every non-trivial transformation decision gets a
   one-line rationale logged to the run record (`runs/<repo>/run-state.json` decisions log
   and/or `migration-log.md`).
4. **Originals are immutable.** Never delete or edit code under `runs/<repo>/original/`.
   Migrate into a parallel directory (`runs/<repo>/migrated/`) until validated, then swap.

## Layout

- `core/` — router (YAML ruleset → executor/effort), adapters (headless `claude -p` per
  model), state (file-backed run records), eval (test gates). Ported from the
  `agent-orchestrator` design: routing knowledge lives in config, never in code.
- `agents/` — the five pipeline agent definitions (analyzer, test-generator, migrator,
  reviewer, doc-writer): prompt builders + task types that the router maps to models.
- `cli/` — `legacy-migrator run|status`.
- `runs/<repo>/` — one directory per migration run: `original/`, `migrated/`,
  `characterization/`, plan/log/report artifacts, `run-state.json`.

## Commands

- `npm test` — vitest across all packages (aliases resolve workspace imports to `src/`).
- `npm run build` — `tsc -b` project references; CLI bin is `cli/dist/index.js`.
