# Migration Plan — legacy-migrator-fixture-test

**Lane:** class-react-to-hooks
**Analyzed:** 2026-07-08, from `original/` (immutable). Target directory: `migrated/`.

## 1. Architecture map

Three modules, one dependency chain, no application entry point (this is a
library-style fixture: the components are the public surface — there is no
`index.js`, no `ReactDOM.render`, no HTML shell).

```
src/store.js      ── redux state: actions creators (increment, decrement, addTodo),
                     two reducers (counter: number, todos: string[]),
                     combineReducers, and a module-level singleton `store` export.
                     Depends on: redux@^3.7.2. No JSX.

src/Counter.js    ── class component, stateless (render-only), wrapped in
                     connect(mapStateToProps, mapDispatchToProps).
                     Injected props: count, onIncrement, onDecrement.
                     Depends on: react@^16, react-redux@^5, ./store (action creators).

src/TodoList.js   ── class component with local state ({ text }) and two
                     constructor-bound handlers; wrapped in connect().
                     Injected props: todos, onAddTodo.
                     Depends on: react@^16, react-redux@^5, ./store (addTodo).
```

Entry points (public API): the default exports of `Counter.js` and `TodoList.js`
(both are the *connected* components, so they require a react-redux `<Provider>`
ancestor), plus the named exports of `store.js` (`store`, `increment`,
`decrement`, `addTodo`).

State shape (must be preserved exactly): `{ counter: 0, todos: [] }`.

## 2. Legacy patterns → modern equivalents

| Legacy pattern | Where | Modern equivalent |
|---|---|---|
| `React.Component` class, render-only | `Counter.js` | Plain function component |
| Class with `constructor` state + `.bind(this)` handlers | `TodoList.js` | Function component with `useState('')`; handlers as closures (no binding needed) |
| `connect(mapStateToProps, mapDispatchToProps)` HOC (react-redux v5) | both components | `useSelector` + `useDispatch` hooks (react-redux ≥ 7.1); connected default export replaced by a plain function component that reads the store via hooks |
| `redux@3` `createStore` + hand-rolled action constants/creators/switch reducers | `store.js` | Redux Toolkit `configureStore` + `createSlice` — **or** keep plain redux with `createStore` (deprecated-but-working) if the lane wants minimal change. Recommended: RTK, with action types pinned to the exact legacy strings (`'INCREMENT'`, `'DECREMENT'`, `'ADD_TODO'`) and the `text` payload field name preserved so externally dispatched raw actions still work |
| React 16 / react-dom 16 | `package.json` | React 18 (`createRoot` in tests/harness; components themselves need no code change for this) |
| Controlled input via `this.state` | `TodoList.js` | Controlled input via `useState` (identical behavior) |

## 3. Risk areas

1. **Module-level singleton store** (`store.js:33`). Global mutable state: any two
   tests (or two consumers) share one store instance. Characterization tests must
   create a fresh store per test (via `vi.resetModules()`/dynamic re-import or a
   test helper). The migration must keep the singleton export — removing it would
   be a behavior/API change.
2. **Action shape is public API.** `addTodo` carries its payload as `action.text`
   (not `payload`). If migrated to `createSlice` naively, the field becomes
   `action.payload` and any raw-dispatch consumer breaks. Preserve `{ type: 'ADD_TODO', text }`
   exactly (use `prepare` callbacks or hand-written creators).
3. **Injected prop names disappear.** After dropping `connect()`, `count`,
   `onIncrement`, `onDecrement`, `todos`, `onAddTodo` are no longer overridable
   via ownProps. No consumer in this repo passes them, but this is an observable
   API narrowing — log it in migration-log.md and verify no external usage.
4. **Falsy-string guard in submit** (`TodoList.js:19`): `if (!this.state.text)`.
   Because the input is controlled, `text` is always a string, so this only blocks
   the empty string — whitespace-only todos **are** added. Preserve exactly; do not
   "improve" with `.trim()`. Flagged as an ambiguous-intent case to keep as-is.
5. **Array index as React key** (`TodoList.js:35`). Fragile if items were ever
   reordered/removed; harmless today (append-only). Keep index keys — changing the
   key strategy is a behavior change (remount semantics) outside migration scope.
6. **Unkeyed submit clears state after dispatch** (`TodoList.js:22-23`): dispatch
   happens before `setState({ text: '' })`. Order is observable if a subscriber
   reads the DOM synchronously; keep dispatch-then-clear order in the hook version.
7. **react-redux v5 context.** The old `connect` uses legacy context; v8+ requires
   React ≥ 16.8 and behaves slightly differently on batched updates (React 18
   automatic batching). Characterization tests should assert user-visible outcomes
   (rendered text after events), not render counts, so they stay valid across the
   upgrade.
8. **No implicit-coercion or callback-pyramid hazards found** beyond item 4 —
   the reducers are pure and synchronous; no async code exists.

## 4. Ordered migration sequence

Each step lands only with its paired passing tests (governance rule 1).

1. **Characterization tests first** (against `original/` behavior, run on the
   migrated tree at each step). Build the harness: vitest + jsdom +
   @testing-library/react + a JSX transform (the fixture ships no build tooling).
2. **`store.js`** — no JSX, no React dependency; the leaf of the dependency
   graph. Port with identical state shape, action types, and payload field names.
   Store tests must pass before and after.
3. **`Counter.js`** — the simpler component (no local state). Class → function,
   `connect` → `useSelector`/`useDispatch`. Same DOM output (`div.counter`,
   button `-`, span, button `+`).
4. **`TodoList.js`** — local state + handlers. `useState` for `text`; preserve
   submit guard, dispatch-then-clear order, index keys, DOM structure.
5. **Dependency bump** — `react@18`, `react-dom@18`, `react-redux@^8` (or ^9),
   `redux`→RTK, in `migrated/package.json` only. Re-run full suite.
6. **Final validation** — full characterization suite green on `migrated/`;
   record validation command in run-state.json; then swap per governance rule 4.

Rationale for the order: convert leaves before dependents (store before
components) so no file ever imports a not-yet-migrated sibling; convert the
stateless component before the stateful one so the `connect`→hooks pattern is
validated on the easy case first; bump dependencies last so every code change is
tested against a known-working runtime before the runtime itself changes.

## 5. Characterization-test plan (coverage is currently zero)

The fixture has **no existing tests** (`package.json` confirms). Everything below
is required before any conversion starts.

**store.test.js** (fresh store per test)
- Initial state is exactly `{ counter: 0, todos: [] }`.
- `increment()` / `decrement()` creators return `{ type: 'INCREMENT' }` / `{ type: 'DECREMENT' }`; `addTodo('x')` returns `{ type: 'ADD_TODO', text: 'x' }`.
- Dispatching increment/decrement moves `counter` ±1; decrement below zero yields negative numbers (no clamping).
- `ADD_TODO` appends to `todos`, preserving order; original array not mutated.
- Unknown action types leave state unchanged (and referentially equal).

**Counter.test.js** (render connected component in `<Provider>` with a fresh store)
- Renders `div.counter` with `-` button, count span showing `0`, `+` button.
- Clicking `+` shows `1`; clicking `-` shows `-1`; interleaved clicks accumulate.
- External `store.dispatch(increment())` updates the rendered count (store→view wiring).

**TodoList.test.js** (same harness)
- Renders form with empty controlled input, `Add` button, empty `<ul>`.
- Typing updates the input value (controlled-input wiring).
- Submitting non-empty text appends an `<li>`, clears the input, and preserves list order across multiple adds.
- Submitting with empty input does nothing (no `<li>`, no dispatch).
- Submitting `'   '` (whitespace-only) **does** add a todo — pins the no-trim guard.
- Duplicate texts render as separate items.

**wiring.test.js** (cross-component)
- Counter and TodoList mounted under one Provider/store: adding todos doesn't
  affect the count and vice versa (combineReducers isolation).

Harness note: tests must assert user-visible behavior only (DOM text after
events), so the identical suite validates both the legacy tree and the migrated
tree — that equivalence is the migration's acceptance gate.

## Decisions log (analyzer)

- Preserve `action.text` payload field and legacy action-type strings through any RTK conversion — action shape is observable API.
- Keep the no-trim empty-string submit guard verbatim — ambiguous intent, behavior preserved per governance rule 2.
- Keep index-as-key rendering — changing key strategy alters remount semantics.
- Keep the singleton `store` export — removing module-level state is out of migration scope.
