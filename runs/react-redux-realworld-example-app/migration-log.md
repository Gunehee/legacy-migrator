# Migration log — react-redux-realworld-example-app

Executor: migrator (fable). Gate for every step: full characterization suite (157 tests)
green on the affected target(s) + `vite build` where noted. Original is never edited.

## Baseline

- Characterization suite: **157/157 green on original** (see run-state.json testGates).
- As-is behaviors characterized, preserved deliberately (NOT fixed — governance rule 2):
  1. `DELETE_COMMENT` reducer throws if `state.comments` is undefined.
  2. LOGOUT writes `''` to `localStorage.jwt` (never `removeItem`).
  3. `settings` reducer sets `inProgress: true` on ANY `ASYNC_START` (no subtype gate).
  4. `PROFILE_FAVORITES_PAGE_LOADED/UNLOADED` action types are defined and reduced but
     never dispatched by any component (ProfileFavorites reuses `PROFILE_PAGE_*`).
  5. `omitSlug` leaves a present-but-undefined `slug` key in the update payload.
  6. `marked` `sanitize: true` escapes raw HTML into visible text.
  7. Favorite/unfavorite dispatches without a login guard.
  8. Profile pages fetch 5 articles/page but `ListPagination` paginates by 10.
  9. Login/Register inputs start as `value={undefined}` (uncontrolled→controlled warning).

## M0 — toolchain strangler step (no component-logic changes) ✅ 157/157 migrated + original, vite build clean

- Copied `original/src` verbatim into `migrated/src`; JSX-bearing files renamed `.js → .jsx`
  (24 components + entry). *Rationale: stock Vite/esbuild handles JSX by extension; import
  specifiers are extensionless so no call sites change.*
- New stack: Vite 5.4 + `@vitejs/plugin-react`; React/ReactDOM **17.0.2**; react-redux
  **8.1.3**; react-router-dom **5.3.4**; redux **4.2.1**; `@redux-devtools/extension`
  (renamed upstream package, same API). *Rationale: React 17 keeps `ReactDOM.render`
  semantics (18's createRoot batching would change observable timing); router v5 keeps v4
  `Switch`/`Route` matching; both give the hooks APIs the lane needs.*
- `index.html` moved to Vite root; `%PUBLIC_URL%` dropped; script tag → `/src/index.jsx`.
- `store.js`: `process.env.NODE_ENV === 'production'` → `import.meta.env.PROD` (same
  runtime meaning under Vite); `routerMiddleware`/`history/createBrowserHistory` deep
  import → `createBrowserHistory` named import (history 4 API, version unchanged).
- `reducer.js`: dropped `router: routerReducer`. *Rationale: verified no component reads
  `state.router`; the store slice was write-only.*
- `App.jsx`: `store.dispatch(push(to))` → `history.push(to)` — removes react-router-redux
  and the component's direct store-singleton import. *Rationale: identical navigation
  observable; redirect still fires on `redirectTo` + resets via `REDIRECT`.*
- `agent.js`: dropped `superagent-promise` wrapper — superagent ≥3 requests are natively
  thenable with the same resolve (`res`) / reject (`error.response`) shapes; version kept
  at 3.8.3. *Rationale: shim removal is in scope; an HTTP-client swap is not.*
- Test harness fix (characterization/, not app code): `renderApp` now picks
  ConnectedRouter vs plain Router by probing `'router' in store.getState()`; migrated/
  carries RTL 12 as devDependency so the suite renders each target with its own React
  copy. Re-verified 157/157 on original after the change.
