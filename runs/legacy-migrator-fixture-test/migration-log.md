# Migration log — legacy-migrator-fixture-test

## Analyze stage (2026-07-07)

- **[flag / ambiguity] TodoList empty-input guard** (`original/src/TodoList.js:19`):
  `if (!this.state.text) return;` blocks only `''`. Whitespace-only and `"0"` submissions
  go through. Resolution per governance rule 2: preserve exactly — do NOT add `.trim()`.
  Characterization tests pin the whitespace-submits case.
- **[flag / decision-for-migrator] store.js exports only the built singleton** — the combined
  `reducer` is module-private, which prevents fresh-store-per-test isolation. Options:
  (a) tests reconstruct state via the singleton with ordering discipline, or (b) migrator adds
  an additive `export const reducer` (no observable behavior change, but an API-surface
  addition — must be rationale-logged if taken).
- **[rationale] Redux stays at hand-rolled reducers, upgrade `redux@3→^4` only, no Redux
  Toolkit**: RTK rewrites reducer code and is outside the class-react-to-hooks lane;
  redux@4 is behavior-identical for the APIs used.
- **[rationale] `react-redux@5→^8`, React stays `^16.14`**: hooks API requires
  react-redux ≥7.1; React 16.14 already supports hooks, so no React upgrade needed.
  Dep upgrade lands as its own step (connect API unchanged) before any component rewrite.
- **[rationale] `key={i}` index keys in TodoList kept as-is**: list is append-only; changing
  key derivation alters reconciliation behavior and is outside the migration's scope.

## Testgen stage (2026-07-07)

- **[rationale] R1 resolved via test technique, not a source change**: `store.js` exports
  only the built `store` singleton, not the reducer, so naive tests would leak state across
  cases (option a/b in the analyzer's flag). Chose neither destructive option — tests call
  `vi.resetModules()` + dynamic `import('@app/store')` per test, forcing a fresh singleton
  each time with zero edits to `original/` or `migrated/`. `Counter.js`/`TodoList.js` import
  `./store` by relative path, which resolves to the same module instance post-reset, so
  rendered components and assertions share one fresh store per test. Governance rule 4
  (originals immutable) and rule 2 (no incidental API-surface changes) are both satisfied.
- **[rationale] Toolchain mirrors the prior `react-redux-realworld-example-app` run**:
  `characterization/` is its own package with a dual-target `vitest.config.mjs`
  (`TARGET=original|migrated` selects `../original/src` or `../migrated/src` via an `@app`
  alias, and pins runtime deps to the target's own `node_modules`). Same 30 tests will run
  unchanged against `migrated/` once it exists, per plan §4 step 6's completion gate.
- **[result] characterization/ — 4 files / 30 tests, all green against `original/`**:
  `store.test.js` (15: action creators, counter slice, todos slice, immutability, cross-slice
  independence), `Counter.test.js` (5: initial render, +/- dispatch, accumulation),
  `TodoList.test.js` (8: controlled input, submit/clear/store-update, R2 empty/whitespace/`"0"`
  guard edges, duplicates, li-count parity), `wiring.test.js` (2: R4 — render without
  `<Provider>` throws for both components, message text intentionally not asserted). No
  `original/` source was modified; `npm test` run from `characterization/` with
  `TARGET=original` (default) is the reproduction command.

## Migrate stage (2026-07-07)

### Step 1 — scaffold `migrated/`
- Copied `original/` → `migrated/` verbatim (rsync, `.git` excluded; `diff -r` confirms
  identical `src/`). `npm install` in `migrated/` at the *legacy* versions
  (react-redux 5.1.2, redux 3.7.2) so the dual-target harness exercises an unmodified
  baseline first.
- **Tests:** 30/30 green `TARGET=original`, 30/30 green `TARGET=migrated`.
