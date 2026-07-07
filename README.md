# legacy-migrator

An autonomous agent that migrates legacy codebases to modern stacks — end to end, unattended.
Point it at a real GitHub repo and a migration lane; it clones the code, writes a
characterization-test safety net against the *original* behavior, migrates module by module
into a parallel directory (gating every step on that same test suite), reviews its own work,
and writes both a technical README and a client-facing summary — all through a five-agent
pipeline with per-stage model routing, not a single monolithic prompt.

## Supported migration lanes

- **Class components → hooks** (React, `connect()` → `useSelector`/`useDispatch`) — proven
  twice: once on a real, archived open-source app, once on a from-zero unattended CLI run.

Other lanes (Python 2→3, AngularJS→Vue/React, CommonJS/Webpack→ESM/Vite) are designed for in
the router and agent prompts but not yet exercised end to end.

## Installation

```bash
npm install
npm run build
cd cli && npm link   # installs the `legacy-migrator` binary globally
```

(`npm link` mirrors exactly how a real global install — `npm install -g` — lays out the
binary: a symlink into `cli/dist/index.js`. The CLI's entrypoint detection is written to
survive that, not just direct invocation.)

## Usage

```bash
legacy-migrator run --repo <github-url> [--lane <lane>] [--name <run-name>]
legacy-migrator status [run-name]
```

`run` executes the full pipeline unattended: `select` (clone) → `analyze` → `testgen` →
`migrate` → `review` → `document`. Each stage is gated — if a stage's tests fail, the
pipeline stops there rather than proceeding on a known-broken state, and re-running the same
command resumes from the failed stage instead of redoing completed work. `status` reads the
run's state file and prints per-stage progress, test-gate results, and cost.

## What gets produced

Every run lives under `runs/<repo-name>/`:

- `original/` — the unmodified clone. Never edited.
- `migrated/` — the migration target. Built in parallel; `original/` is only swapped out
  once `migrated/` passes the full test suite.
- `characterization/` — the golden-master test suite, written *before* migration starts,
  proven green against `original/` first. The same tests then run against `migrated/`.
- `migration-plan.md` — architecture map, legacy→modern pattern mapping, risk areas, ordered
  migration sequence.
- `migration-log.md` — what changed, why, and test status, module by module, with a
  one-line rationale for every non-trivial transformation decision.
- `review-report.md` — a second-pass code-quality review after migration completes.
- `README.md` — technical summary: before/after architecture, test coverage delta.
- `one-pager.md` — a client-facing, plain-language summary (Korean, for the showcase runs).
- `run-state.json` — the full audit trail: stage timestamps, executor used, cost per stage,
  decision log, test-gate history.

## Real proof, not a demo

- **[react-redux-realworld-example-app](runs/react-redux-realworld-example-app/)** — a real,
  archived, MIT-licensed open-source app (React 16 class components, Redux 3,
  `react-router-redux`, zero existing tests) migrated to Vite + React 17 + hooks. 157
  characterization tests, written before migration, pass against both the original and the
  migrated code. Published fork:
  [Gunehee/realworld-class-to-hooks-migration](https://github.com/Gunehee/realworld-class-to-hooks-migration).
- **[legacy-migrator-fixture-test](runs/legacy-migrator-fixture-test/)** — a from-zero,
  fully unattended run of `legacy-migrator run --repo ...` via the linked global binary, no
  manual intervention or state backfill at any stage. **Measured cost: $5.74
  (`$5.73717435`). Measured wall-clock: 15m34s**, `select` through `document`. Source repo:
  [Gunehee/legacy-migrator-fixture-test](https://github.com/Gunehee/legacy-migrator-fixture-test).

## Architecture

- **`core/`** — router (a YAML ruleset mapping task type → executor + effort, no hardcoded
  model logic), adapters (headless `claude -p` subprocesses, one per model), state
  (file-backed run records), eval (test-gate execution), pipeline (classify → route →
  execute → gate → record).
- **`agents/`** — the five pipeline stage definitions: prompts and gate/validation-command
  hooks, decoupled from the routing and execution mechanics in `core/`.
- **`cli/`** — `legacy-migrator run|status`.

**Model routing**: analyze and migrate — the two stages doing deep, whole-codebase
reasoning — route to **Fable**. testgen and review — structured, verifiable work — route to
**Sonnet**. document — pattern-following writing — routes to **Haiku**. Routing lives
entirely in `core/config/routing.yaml`; no model names are hardcoded in the pipeline itself.

There is no dashboard, no UI, no server. It's a CLI, a state file, and five prompts — that's
the whole system.
