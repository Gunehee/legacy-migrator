# Review report — legacy-migrator-fixture-test

**Reviewer stage, 2026-07-08.** Full read-through of `migrated/src/*.js`,
`migrated/package.json`/`package-lock.json`, and the characterization harness
that gates it, against `migration-plan.md` and `migration-log.md`.

## Verification

- Re-ran both gates from a clean shell: `npm run test:migrated` → 27/27 green;
  `npm test` (TARGET=original) → 27/27 green. Matches `run-state.json`'s
  recorded `validationCommand`.
- `npm ls --depth=0` in `migrated/` resolves cleanly — no phantom/missing deps,
  lockfile matches `package.json` (react/react-dom 18.3.1, react-redux 9.3.0,
  @reduxjs/toolkit 2.12.0, RTL 14.3.1 + @testing-library/dom 9.3.4 as devDeps).
- Confirmed `original/` untouched (only files under `migrated/` and
  `characterization/` differ from the initial checkout).

## Code quality

No changes made — the migrated tree is already clean:

- **No dead code / no legacy shims.** `Counter.js` and `TodoList.js` are
  plain function components; no leftover `connect()`, `mapStateToProps`,
  class boilerplate, or `.bind(this)`. `store.js` has no unused `combineReducers`/
  `createStore` residue from the redux→RTK swap.
- **Imports are all used** (checked every `import` in `migrated/src` and the
  test suite by hand) — nothing to prune.
- **Idiomatic for the target stack**: hooks (`useState`, `useSelector`,
  `useDispatch`) used correctly and minimally; `configureStore` with an
  explicit `middleware` override rather than a boolean flag hack; comments
  are used only where they carry non-obvious rationale (the no-`.trim()`
  guard, the disabled thunk middleware, the hand-written action creators
  instead of `createSlice`/`createAction`) — no restating-the-obvious
  comments to strip.
- **`React` import is still required** in both components despite React 18:
  the harness's esbuild plugin uses the classic `jsx: 'transform'` mode (see
  `characterization/vitest.config.mjs`), not the automatic runtime, so this
  is a correct dependency of the current build setup, not a legacy leftover.
- Governance rule 2 (no incidental behavior change) holds up under direct
  inspection: no-trim submit guard, dispatch-then-clear order, `key={i}`,
  and the `{type, text}` action shape are all preserved verbatim in
  `migrated/src/TodoList.js` and `migrated/src/store.js`.

## Follow-ups (non-blocking, informational only — no action taken)

These are pre-existing/plan-flagged characteristics, not migration defects.
Listed per the reviewer's read-through, not because they need fixing now —
changing any of them would be an unrequested behavior change per governance
rule 2.

1. **API narrowing from dropping `connect()`** (`Counter.js`, `TodoList.js`):
   `count`/`onIncrement`/`onDecrement`/`todos`/`onAddTodo` are no longer
   injectable via ownProps. Already flagged in `migration-plan.md` risk 3 and
   `migration-log.md`; no consumer in this repo passes them. Worth a note in
   the eventual doc-writer output if this fixture is ever imported as a
   library rather than run standalone.
2. **Thunk middleware disabled** (`store.js:38`): correct today (matches the
   legacy plain-object-only dispatch contract), but is an easy thing for a
   future contributor to "fix" by re-enabling default middleware without
   realizing it changes the public dispatch contract. The inline comment
   already covers this; no code change needed.
3. **`key={i}` index keys** (`TodoList.js:33`): safe only because the list is
   append-only with no delete/reorder/insert-at-index operation anywhere in
   the app. If a delete/reorder feature is ever added, this will need a
   stable key at the same time — not before.

## Verdict

Suite is green on both targets; no fixes were required to keep it that way,
so none were made. Migration is ready to proceed to the document/validate
stages as-is.
