# Migration log — legacy-migrator-fixture-test

## Testgen stage (2026-07-08)

- **[rationale] Store isolation solved via test technique, not a source change**:
  `store.js` exports only the built `store` singleton, never the underlying reducer, so
  naive tests sharing one import would leak counter/todos state across cases (risk area
  1 in migration-plan.md). Chose `vi.resetModules()` + dynamic `import('@app/store')`
  per test (see `tests/helpers/freshApp.js`) over adding an exported reducer — zero edits
  to `original/`, and no new API surface for the migration to carry forward. Satisfies
  governance rule 4 (originals immutable) and rule 2 (no incidental API-surface changes).
- **[rationale] Dual-target harness (`characterization/` as its own package)**: a
  `vitest.config.mjs` resolves an `@app` alias to `../original/src` or `../migrated/src`
  based on a `TARGET` env var, and pins every runtime dependency (`react`, `react-dom`,
  `react-redux`, `redux`, testing-library packages) to the target's own `node_modules` so
  no two React copies end up in one test run. This lets the identical 27-test suite gate
  both `original/` now and `migrated/` once step 6 of the migration sequence needs it —
  `npm test` (default `TARGET=original`) is the testgen gate; `npm run test:migrated` is
  recorded as the pipeline's validationCommand for later stages.
- **[rationale] JSX handled via an esbuild transform plugin, not a babel config file**:
  the fixture ships no build tooling and `.js` files containing JSX (faithful to
  upstream) need a transform to run under Node/jsdom. Adding a plugin inside
  `vitest.config.mjs` avoids introducing a `.babelrc` or similar file that would look
  like part of the app's own build setup.
- **[flag / pinned via test] TodoList empty-input guard** (`original/src/TodoList.js:19`):
  `if (!this.state.text) return;` blocks only the empty string. Whitespace-only (`'   '`)
  and the literal string `'0'` both pass the guard and ARE added as todos. Per governance
  rule 2 this is preserved exactly — `tests/TodoList.test.js` pins both edge cases so a
  migration that "fixes" this with `.trim()` or a truthiness rewrite fails the gate.
- **[flag / pinned via test] `key={i}` index keys** (`original/src/TodoList.js:35`): kept
  as observable-behavior-neutral for an append-only list; not something a characterization
  test can assert on directly (keys aren't part of rendered output), so this is noted here
  rather than pinned by an assertion.
- **[result] `characterization/` created — 4 files, 27 tests, all green against
  `original/`**: `store.test.js` (13 — action creators, counter slice, todos slice,
  immutability, cross-slice independence), `Counter.test.js` (5 — initial render, +/-
  dispatch, accumulation, external `store.dispatch` wiring), `TodoList.test.js` (8 —
  controlled input, submit/clear/store-update, empty/whitespace/`"0"` guard edges,
  duplicates, li-count parity), `wiring.test.js` (1 — Counter and TodoList mounted under
  one store stay isolated via `combineReducers`). No file under `original/` was modified;
  reproduction command is `npm test` from `characterization/` (`TARGET=original` is the
  default).

## Migrate stage (2026-07-08, lane: class-react-to-hooks)

Executed plan §4 into `migrated/` — `original/` untouched (verified via `git status`,
clean). Final state: **27/27 green against `migrated/` AND 27/27 green against
`original/` with the identical suite** (`npm run test:migrated` / `npm test` from
`characterization/`).

### Sequencing deviation (logged up front)

- **[rationale] Dependency bump landed with module 1, not last (plan step 5)**: a
  `connect()`→`useSelector`/`useDispatch` conversion cannot execute against
  react-redux 5 — the hooks don't exist there — so `migrated/package.json`
  (`react@18.3`, `react-dom@18.3`, `react-redux@9`, `@reduxjs/toolkit@2`; devDeps
  `@testing-library/react@14` + `@testing-library/dom@9` so the harness's
  TARGET=migrated alias resolves React-18-compatible test libs) had to exist before
  any component conversion could be gated. Every converted module was therefore
  tested against the modern runtime immediately, which is the plan's underlying
  intent (no untested-runtime window).
- **[note] Per-module full-suite gates**: `tests/helpers/freshApp.js` statically
  imports both `@app/Counter` and `@app/TodoList`, so component test files can only
  run against `migrated/` once both components exist. Gates actually run: module 1 →
  `store.test.js` vs migrated (13/13) + full suite vs original (27/27); modules 2+3 →
  full suite vs migrated + full suite vs original (27/27 each). No module advanced
  with anything red.

### Module 1 — `store.js` (13/13 store tests green vs migrated)

- **[rationale] RTK `configureStore` replaces deprecated `createStore`+`combineReducers`;
  creators and reducers stay hand-written verbatim**: the pinned public action shape
  `{ type: 'ADD_TODO', text }` carries its payload in a top-level `text` field, and
  RTK's `createSlice`/`createAction` can only emit data under `payload` (prepare
  callbacks return `{payload, meta, error}` only) — so the plan's "RTK with action
  types pinned to legacy strings" resolves to: RTK for store construction, legacy
  switch reducers and creators copied unchanged (also preserving the pinned
  referential-equality semantics on unknown actions).
- **[rationale] Default thunk middleware disabled** (`middleware: gDM => gDM({ thunk: false })`):
  the legacy store had no middleware, so `dispatch(fn)` threw; leaving thunk enabled
  would silently extend the observable dispatch contract (governance rule 2). RTK's
  dev-only immutability/serializability checks are kept — they emit no output for
  this state shape and don't alter behavior.
- Singleton `store` export preserved (plan decision).

### Module 2 — `Counter.js`

- Class → function component; `connect(mapStateToProps, mapDispatchToProps)` →
  `useSelector(state => state.counter)` + `useDispatch`, handlers as inline closures.
  DOM output identical (`div.counter`, `-` button, count span, `+` button).
- **[flag] API narrowing per plan risk 3**: without `connect()`, `count`/`onIncrement`/
  `onDecrement` are no longer overridable via ownProps. No consumer in this repo
  passes them; narrowing accepted and logged (also applies to `todos`/`onAddTodo`
  in module 3).

### Module 3 — `TodoList.js`

- Constructor state + two `.bind(this)` handlers → `useState('')` + closure handlers.
- **Preserved verbatim per plan flags**: the no-trim empty-string guard (`if (!text)`)
  so whitespace-only and `'0'` todos ARE added (both pinned by tests); the
  dispatch-then-clear submit order; `key={i}` index keys (remount semantics
  unchanged).

### Full-suite gate + one harness accommodation (flagged)

- First full run vs `migrated/`: **26/27** — the only failure was
  `Counter.test.js` "external store.dispatch updates the rendered count", which
  dispatched from outside React and synchronously asserted the DOM. React 16 +
  react-redux 5 flushed subscriber re-renders synchronously; React 18's concurrent
  root batches externally-originated updates into a microtask, so the DOM read one
  tick too early. This is framework-internal flush *timing*, not app behavior — the
  store→view wiring still updates the count (plan risk 7 anticipated exactly this).
- **[rationale / only test change] Wrapped that one dispatch in `act()`** (valid on
  both stacks: RTL has exported `act` since v9), asserting "the view reflects the
  dispatch once processed" instead of the legacy synchronous flush. The modified
  suite was then re-run against `original/` — still 27/27 — so the golden-master
  equivalence gate remains: identical suite, both trees green. No app source was
  changed to pass any test.
- Final: `npm run test:migrated` → 27 passed (27); `npm test` (TARGET=original) →
  27 passed (27). No act()/deprecation warnings in the migrated run. Gates and six
  decision rationales recorded in `run-state.json`.
