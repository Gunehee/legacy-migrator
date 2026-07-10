# legacy-migrator

An autonomous agent that migrates legacy codebases to modern stacks — end to end, unattended.
Point it at a real GitHub repo and a migration lane; it clones the code, writes a
characterization-test safety net against the *original* behavior, migrates module by module
into a parallel directory (gating every step on that same test suite), reviews its own work,
writes both a technical README and a client-facing summary, then runs a final deterministic
check (no model call) that re-verifies the test suite, the production build, and a sweep for
leftover legacy patterns — all through a six-stage pipeline with per-stage model routing, not
a single monolithic prompt, ending in a single self-contained `report.html` per run.

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
legacy-migrator report --repo <run-name-or-url>
```

`run` executes the full pipeline unattended: `select` (clone) → `analyze` → `testgen` →
`migrate` → `review` → `document` → `validate`. Each stage is gated — if a stage's tests
fail, the pipeline stops there rather than proceeding on a known-broken state, and re-running
the same command resumes from the failed stage instead of redoing completed work. `status`
reads the run's state file and prints per-stage progress, test-gate results, and cost.
`report` regenerates `report.html` from whatever is already on disk — no pipeline stage
re-runs, no model call — useful after tweaking the report template.

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
- `validate-report.md` — the final deterministic check: the recorded test command re-run,
  a production build (skipped, not failed, if `migrated/` defines no build script), and a
  sweep confirming zero remaining legacy patterns for the lane.
- `README.md` — technical summary: before/after architecture, test coverage delta.
- `one-pager.md` — a client-facing, plain-language summary (Korean, for the showcase runs).
- `report.html` — a single self-contained report: stage timeline with per-stage cost/time,
  an X/X test-pass badge, before/after code stats from a real `git diff`, the decision log,
  and the full migration-log.md / review-report.md text in collapsible sections. Inline CSS,
  no server, no JS framework — open it directly in a browser via `file://`.
- `run-state.json` — the full audit trail: stage timestamps, executor used, cost per stage,
  decision log, test-gate history, the recorded `validationCommand`, and `costTotalUsd`.

## Real proof, not a demo

- **[legacy-migrator-fixture-test](runs/legacy-migrator-fixture-test/report.html)** — the
  reliable baseline: a from-zero, fully unattended run of `legacy-migrator run --repo ...`
  via the linked global binary, no manual intervention or state backfill at any stage, all
  six stages including `validate` passing on their own. **Measured cost: $5.74
  (`$5.73717435`). Measured wall-clock: 15m34s**, `select` through `document` (`validate`
  adds a few more seconds and $0 — it's a deterministic check, no model call). Source repo:
  [Gunehee/legacy-migrator-fixture-test](https://github.com/Gunehee/legacy-migrator-fixture-test).
- **[react-redux-realworld-example-app](runs/react-redux-realworld-example-app/report.html)**
  — the larger real-world showcase: a real, archived, MIT-licensed open-source app (React 16
  class components, Redux 3, `react-router-redux`, zero existing tests) migrated to Vite +
  React 17 + hooks. 157 characterization tests, written before migration, pass against both
  the original and the migrated code, and `validate` independently re-confirms it (real
  production build included, not skipped). **Its cost/wall-clock figures are not a reliable
  baseline** — its five earliest stages were recorded during manual construction, before
  this repo had automated timestamp/cost tracking; only `validate` has precise numbers for
  that run (see the caveat in its own `report.html`). Published fork:
  [Gunehee/realworld-class-to-hooks-migration](https://github.com/Gunehee/realworld-class-to-hooks-migration).

Open either `report.html` directly in a browser (`file://`) for the full picture: stage
timeline, cost, before/after diff stats, and the complete decision log.

## Architecture

- **`core/`** — router (a YAML ruleset mapping task type → executor + effort, no hardcoded
  model logic), adapters (headless `claude -p` subprocesses, one per model), state
  (file-backed run records), eval (test-gate execution), pipeline (classify → route →
  execute → gate → record — or, for `validate`, skip routing/adapter entirely and run its
  own deterministic checks), report (pure string templating into `report.html`, no model
  call, ever).
- **`agents/`** — the six pipeline stage definitions: prompts and gate/validation-command
  hooks for the five model-driven stages, plus `validate`'s deterministic check logic —
  all decoupled from the routing and execution mechanics in `core/`.
- **`cli/`** — `legacy-migrator run|status|report`.

**Model routing**: analyze and migrate — the two stages doing deep, whole-codebase
reasoning — route to **Fable**. testgen and review — structured, verifiable work — route to
**Sonnet**. document — pattern-following writing — routes to **Haiku**. validate calls no
model at all — it re-runs the recorded test command, checks the build, and greps for
leftover legacy patterns, deterministically. Routing lives entirely in
`core/config/routing.yaml`; no model names are hardcoded in the pipeline itself.

There is no dashboard, no UI, no server. It's a CLI, a state file, six stages, and one
self-contained HTML report — that's the whole system.
