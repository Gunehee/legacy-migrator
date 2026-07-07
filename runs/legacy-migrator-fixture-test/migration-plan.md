# Migration Plan — legacy-migrator-fixture-test

**Lane:** `class-react-to-hooks`
**Analyzed:** 2026-07-07 (analyzer stage)
**Scope:** 3 source files, ~105 LOC. Synthetic fixture: React 16 class components wired to
Redux via `react-redux@5` `connect()`. **Zero existing tests.**

---

## 1. Architecture map

### Modules

| File | Kind | Exports | Depends on |
|---|---|---|---|
| `src/store.js` | Redux state layer | `increment`, `decrement`, `addTodo` (action creators); `store` (singleton) | `redux` (`createStore`, `combineReducers`) |
| `src/Counter.js` | Connected class component | default: `connect(...)(Counter)` | `react`, `react-redux`, `./store` (`increment`, `decrement`) |
| `src/TodoList.js` | Connected class component (with local UI state) | default: `connect(...)(TodoList)` | `react`, `react-redux`, `./store` (`addTodo`) |

### Dependency graph

```
Counter.js  ──┐
              ├──▶ store.js ──▶ redux
TodoList.js ──┘
   │
   └──▶ react, react-redux (connect)
```

### Entry points

**There is no entry point.** No `index.js`, no `<Provider>` mount, no HTML shell — the
components are only exported. This is a library-style fixture; the "public API" is the three
module surfaces above. Consequence: characterization tests must construct their own
`<Provider store={...}>` wrapper, and the migration has no bootstrap file to update.

### State shape (global store)

```js
{ counter: number /* init 0 */, todos: string[] /* init [] */ }
```

Actions: `INCREMENT`, `DECREMENT` (counter ±1), `ADD_TODO` (`{ type, text }`, appends
`action.text` to `todos`).

---

## 2. Legacy patterns → modern equivalents

| # | Legacy pattern | Where | Modern equivalent |
|---|---|---|---|
| P1 | `class extends React.Component` with `render()` only | `Counter.js` | Function component |
| P2 | Class with `constructor` + `this.state` + manual `.bind(this)` | `TodoList.js` | Function component with `useState('')`; handlers as inline closures (no binding needed) |
| P3 | `connect(mapStateToProps, mapDispatchToProps)` HOC | `Counter.js`, `TodoList.js` | `useSelector` + `useDispatch` hooks (react-redux ≥ 7.1) |
| P4 | `react-redux@5` (pre-hooks era, legacy context API) | `package.json` | `react-redux@^8` (compatible with React 16.14; v8 dropped connect-only legacy context) |
| P5 | `redux@3` `createStore` | `store.js` | `redux@^4` — minimal, behavior-identical upgrade. **Not** Redux Toolkit: RTK would rewrite the reducers and violates the no-behavior-change rule. `createStore` is only *deprecation-marked* in redux@5, still fine in 4.x |
| P6 | String action-type constants + hand-rolled switch reducers | `store.js` | Kept as-is (see P5 rationale). Pure functions; no migration value in changing them |
| P7 | `key={i}` array-index keys in list render | `TodoList.js:35` | Kept as-is — todos are append-only strings with no ids; changing key derivation is a behavior/reconciliation change outside the lane |

Dependency note: React 16.14 already supports hooks (≥16.8), so **React itself does not need
upgrading** for this lane. Only `react-redux` must move (v5 has no hooks API). Pin plan:
`react-redux@^8.1` + `redux@^4.2`, `react`/`react-dom` unchanged at `^16.14.0`.

---

## 3. Risk areas

- **R1 — Global singleton store** (`store.js:33`): `store` is created at module load and
  exported. Any test that dispatches against the real store leaks state into the next test.
  Characterization tests must build a **fresh store per test** via the exported reducer path —
  but the reducer is *not* exported (only `store` is). Tests must either (a) reconstruct an
  equivalent store from the action creators + observed transitions through the singleton with
  careful ordering, or (b) treat this as the one place migration may add an export
  (`export const reducer`) — **flagged as a decision for the migrator**; adding an export is
  additive and observable-behavior-preserving, but it is an API-surface change and must be
  rationale-logged.
- **R2 — Implicit falsy guard** (`TodoList.js:19`): `if (!this.state.text) return;` blocks
  only the empty string — `"0"` and whitespace-only strings **are** submitted. Do not
  "improve" to `.trim()`. Characterization tests must pin the whitespace-submits behavior
  explicitly.
- **R3 — Array-index keys** (`TodoList.js:35`): `key={i}` on todo `<li>`s. Safe today because
  the list is append-only, but any tempting "fix" to keyed items changes reconciliation.
  Preserve.
- **R4 — No Provider/entry point**: nothing in the repo mounts these components, so nothing
  in the repo proves `connect()` wiring works end-to-end. Tests must supply `<Provider>`;
  the migrated `useSelector` versions will throw without one — same requirement, but the
  failure mode changes (v5 connect throws "Could not find store"; v8 hook throws its own
  message). Test at the wiring level, not error-message level.
- **R5 — react-redux 5→8 jump**: two-major-version hop (context API rewrite in v6, hooks in
  v7, React 18-ready internals in v8). For this codebase the surface used is only
  `connect`→hooks, so risk is contained, but peer-dependency resolution (`react-redux@8`
  requires React ≥16.8.3 ✓) should be verified at install time.
- **R6 — Duplicate `setState` semantics** (`TodoList.js:22-23`): `handleSubmit` reads
  `this.state.text` then clears it. With `useState`, the hook translation
  (`onAddTodo(text); setText('')`) is semantically identical here since there are no batched
  multi-field updates — but the migrator should keep dispatch-before-clear ordering.
- No callback pyramids, no async, no side effects, no lifecycle methods, no refs, no context
  usage, no implicit numeric coercion beyond R2 — the fixture is deliberately clean.

---

## 4. Ordered migration sequence

Each step lands only with its paired tests green (governance rule 1). Suite must be green
after every step.

| Step | What | Why this order |
|---|---|---|
| 0 | **Characterization tests first** (see §5) against `original/` behavior, running in `migrated/` scaffold with the *legacy* deps | Zero coverage exists; nothing may move until behavior is pinned |
| 1 | Scaffold `migrated/` — copy sources verbatim, add test tooling (vitest + @testing-library/react + jsdom), tests green against unmodified copies | Establishes the harness before any transformation |
| 2 | Upgrade deps: `redux@^4`, `react-redux@^8` — **no source changes**; `connect()` API is unchanged across 5→8 | Isolates dependency risk (R5) from code-shape risk; tests re-run green proves the dep hop alone is safe |
| 3 | `store.js`: no logic changes; only the R1 decision (optionally export `reducer` for test isolation), rationale-logged | Leaf of nothing / root of everything — settle its surface before components |
| 4 | `Counter.js` → function component + `useSelector`/`useDispatch` | Simplest component (P1, stateless): validates the connect→hooks recipe on the easy case first |
| 5 | `TodoList.js` → function component + `useState` + `useSelector`/`useDispatch` | Applies the proven recipe plus local-state conversion (P2, R2, R6) |
| 6 | Sweep: remove now-unused `connect` imports, confirm no `React.Component` remains, full suite + `npm run build`-equivalent check | Completion gate |

Components are independent of each other (see graph), so steps 4–5 could swap, but easy-first
is lower risk. At no intermediate step is anything broken: `connect` and hooks coexist under
react-redux 8, which is exactly why the dep upgrade (step 2) precedes any component rewrite.

---

## 5. Characterization-test plan (coverage is currently 0%)

Framework: vitest + @testing-library/react + jsdom, matching the repo-standard toolchain.
All tests are written against **observed behavior of `original/`**, then must pass unchanged
against `migrated/` at every step.

### store.js (pure — test without React)
- `counter` reducer: initial state `0`; `INCREMENT` → `+1`; `DECREMENT` → `-1` (goes
  negative — pin `0 → -1`, no clamping); unknown action returns state unchanged.
- `todos` reducer: initial `[]`; `ADD_TODO` appends `action.text` verbatim (including `''`,
  whitespace, non-strings if dispatched directly — pin at least whitespace); immutability
  (new array identity, old state untouched).
- Action creators: exact shapes `{type:'INCREMENT'}`, `{type:'DECREMENT'}`,
  `{type:'ADD_TODO', text}`.
- Combined store: `store.getState()` initial shape `{counter: 0, todos: []}`; independent
  slices (counter action doesn't touch todos and vice versa).

### Counter.js (render + interaction, fresh store per test via `<Provider>`)
- Renders current count from store state.
- `+` click dispatches increment → displayed count updates; `-` likewise decrements.
- Multiple clicks accumulate; negative display renders (e.g. `-1`).

### TodoList.js
- Input is controlled: typing updates the field.
- Submit with non-empty text: todo appears in list, input clears, store contains the text.
- **Submit with empty input: nothing dispatched, no empty `<li>` (R2 guard).**
- **Submit with whitespace-only text `"   "`: IS added (R2 — pins the no-trim behavior).**
- Submitting `"0"` is added (falsy-string edge of R2).
- Duplicate todos allowed; order is append order.
- Rendered `<li>` count matches store `todos` length.

### Wiring (R4)
- Rendering either connected component **without** a `<Provider>` throws (assert it throws,
  not the message text — the message differs between react-redux 5 and 8).

Estimated: ~18–20 tests. This is the full behavior surface; anything not on this list
(exact error strings, React element key values, class vs function identity) is explicitly
**not** part of the contract being preserved.

---

*Analyzer notes: no source files were modified. Ambiguous-behavior flags (R1 export decision,
R2 whitespace semantics) recorded in `migration-log.md`.*
