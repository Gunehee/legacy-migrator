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

## Migrate stage (2026-07-08, resumed — prior adapter attempt died on a credit error)

### Step 2 — dependency upgrade only (no source changes)
- Found on resume: `migrated/package.json` already bumped to `react-redux@^8.1.3` +
  `redux@^4.2.1` (installed 8.1.3 / 4.2.1; react stays 16.14.0) but **unverified** — the
  log recorded only step 1 and the prior migrate attempt exited before running tests.
  `migrated/src` confirmed still byte-identical to `original/src` (`diff -r`).
- **Verification found a real gap:** `TARGET=migrated` failed 13/30 with "Invalid hook call"
  — react-redux 8's Provider resolved React from `migrated/node_modules` while
  `@testing-library/react` (CJS, un-aliasable require chain) pulled `react-dom` from
  `characterization/node_modules`: two React instances.
- **[rationale] Added `@testing-library/{react,dom,jest-dom}` as devDependencies in
  `migrated/`** (same versions as characterization/): per the dual-target harness design
  already documented in `vitest.config.mjs`, the migrated target must carry its own test
  libraries so Node sibling resolution keeps a single React instance. Test tooling only —
  zero runtime-dependency or source change.
- **Tests:** 30/30 green `TARGET=original`, 30/30 green `TARGET=migrated`. The 5→8
  `connect()` hop alone is proven safe (plan §4 step 2 / R5 contained).

### Step 3 — store.js surface decision (R1)
- **[rationale] `store.js` left completely unchanged — the optional `export const reducer`
  is NOT added.** The analyzer flagged it only as a possible aid for test isolation, and
  testgen already solved isolation via `vi.resetModules()` + dynamic import with zero source
  edits. Adding an export now would be an API-surface change with no consumer — pure risk,
  no benefit (governance rule 2). P5/P6 confirmed: reducers/action creators are untouched;
  `redux@4` `createStore` is behavior-identical for this usage.
- **Tests:** unchanged from step 2 — 30/30 both targets.

### Step 4 — Counter.js → function component + hooks
- Class with render-only body (P1) → arrow function component; `connect(mapStateToProps,
  mapDispatchToProps)` → `useSelector(state => state.counter)` + `useDispatch`, dispatch
  calls inlined in the onClick closures. Default export is now the bare component (no HOC
  wrapper) — R4 covered: rendering without `<Provider>` still throws (wiring tests assert
  throw-only, not message text, exactly because the failure mode changed from connect's
  "Could not find store" to the hook's own error).
- **[rationale]** Selector returns the same primitive slice (`state.counter`) the old
  `mapStateToProps` produced, so re-render behavior under reference equality is unchanged.
- **Tests:** 30/30 `TARGET=migrated`, 30/30 `TARGET=original`.

### Step 5 — TodoList.js → function component + useState + hooks
- `constructor`/`this.state.text`/manual `.bind(this)` (P2) → `useState('')` with inline
  arrow handlers; `connect` → `useSelector(state => state.todos)` + `useDispatch`.
- **[rationale] R2 preserved verbatim:** guard stays `if (!text) return;` — no `.trim()`.
  Whitespace-only and `"0"` still submit; a source comment now marks this as deliberate.
- **[rationale] R6 ordering preserved:** dispatch-before-clear (`dispatch(addTodo(text))`
  then `setText('')`), same as the class's read-then-clear sequence; no batched multi-field
  updates exist so semantics are identical.
- **[rationale] R3/P7 preserved:** `key={i}` index keys kept — the list is append-only and
  changing key derivation would alter reconciliation, which is outside the lane.
- **Tests:** 30/30 `TARGET=migrated`, 30/30 `TARGET=original`.

### Step 6 — completion sweep
- Grep over `migrated/src/`: zero occurrences of `connect`, `React.Component`,
  `this.state`, `this.props`, or `.bind(this)`. `store.js` byte-identical to original
  (only diff in the tree is the two component files + package.json dev/dep versions).
- Build-equivalent check: the fixture has no build script, so each migrated module was
  parsed standalone with esbuild (`loader: jsx`) — all three parse clean; vitest's
  transform pipeline exercises the same path on every run.
- **Final gate: 30/30 green `TARGET=original`, 30/30 green `TARGET=migrated`.** Same
  characterization suite, unchanged, against both trees. Migration sequence complete;
  `original/` untouched throughout (governance rule 4).
