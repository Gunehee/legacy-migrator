# Migration plan — react-redux-realworld-example-app

Lane: **class-based React components → functional + hooks** (plus the toolchain work that
lane forces: the CRA-1/Babel-6 build cannot host a hooks-era React).
Produced by the analyzer stage (executor: fable). Governance: identical observable
behavior; every deviation logged; original/ immutable; migrate into migrated/.

## 1. Architecture map

**Entry point:** `src/index.js` — `ReactDOM.render` of `<Provider store>` →
`<ConnectedRouter history>` (react-router-redux) → `<App>`.

**Data flow (one pattern, everywhere):** components dispatch actions whose `payload` is a
*superagent promise* from `src/agent.js`. `src/middleware.js#promiseMiddleware` intercepts
promise payloads: dispatches `ASYNC_START`, awaits, mutates `action.payload` to the
response body, dispatches `ASYNC_END` + the original action. A `viewChangeCounter` in
`state.common` (incremented by every `*_PAGE_UNLOADED`) drops responses that resolve after
the user navigated away (unless `action.skipTracking`). `localStorageMiddleware` persists
the JWT on LOGIN/REGISTER and writes `''` on LOGOUT (never `removeItem`).

**Modules:**

| module | files | role |
|---|---|---|
| API layer | `agent.js` | superagent + superagent-promise; URL building, token plugin, `res.body` unwrapping |
| store | `store.js`, `middleware.js`, `reducer.js` | redux 3 `createStore`, router middleware, custom promise middleware, devtools |
| reducers | `reducers/{article,articleList,auth,common,editor,home,profile,settings}.js` | pure; keyed on `constants/actionTypes.js` (36 action types) |
| routing/shell | `index.js`, `components/App.js`, `Header.js` | route table (8 routes incl. `/@:username`), redirect-via-redux (`state.common.redirectTo` → `push()`), auth bootstrap from localStorage in `componentWillMount` |
| pages | `Home/*`, `Article/*`, `Editor.js`, `Login.js`, `Register.js`, `Settings.js`, `Profile.js`, `ProfileFavorites.js` | class components w/ deprecated lifecycles |
| shared UI | `ArticleList.js`, `ArticlePreview.js`, `ListErrors.js`, `ListPagination.js` | mixed class/function, several `connect(() => ({}))` dispatch-only wrappers |

**Dependencies between modules:** components → agent + actionTypes; middleware → agent
(token) ; reducers ← actionTypes only; `App.js` imports the **store singleton directly**
(`import { store } from '../store'`) to dispatch navigation — a hidden global.

## 2. Legacy patterns → modern equivalents

| legacy | where | modern equivalent |
|---|---|---|
| CRA 1 (Webpack 3, Babel 6), `react-scripts@1.1.1` | build | Vite 5 + `@vitejs/plugin-react` (JSX-in-`.js` handled via esbuild loader config) |
| React 16.3 class components | 13 class components | function components + `useState`/`useEffect` |
| `componentWillMount` (side effects before mount) | App, Home, Article, Profile, ProfileFavorites, Editor, SettingsForm | `useEffect(..., [])` (see risk R4) |
| `componentWillReceiveProps` | App, Editor, SettingsForm | `useEffect` with dep on the watched prop |
| `connect(mapState, mapDispatch)` | 12 call sites | `useSelector` / `useDispatch` |
| `connect(() => ({}), mapDispatch)` dispatch-only wrappers | ArticleActions, CommentInput, DeleteButton, ArticlePreview, ListPagination, MainView | `useDispatch` |
| class inheritance of a component (`ProfileFavorites extends Profile`) | ProfileFavorites | shared `ProfileView` function component parameterized by loader + tab |
| `react-router-redux@5.0.0-alpha.6` (`ConnectedRouter`, `routerMiddleware`, `routerReducer`, `push()`) | index, store, reducer, App | plain `react-router-dom@5.3.4` `<Router history>`; redirect effect calls `history.push`; `state.router` dropped (verified: no component reads it) |
| `react-router-dom@4` route API | index, App | v5.3.4 — `Switch`/`Route`/`exact` semantics identical to v4 (v6 would change match semantics; out of conservative scope) |
| `redux@3` + `react-redux@5` | store, all connects | `redux@4.2` + `react-redux@8.1` (hooks API; class-compatible during stepwise conversion) |
| `superagent-promise` wrapper | agent.js | dropped — superagent ≥3 is natively thenable; same resolved/rejected shapes |
| `redux-devtools-extension` (renamed pkg) | store.js | `@redux-devtools/extension` (same API) |
| string refs / legacy context | — | none present ✓ |

## 3. Risk areas

- **R1 `promiseMiddleware` semantics** — mutates `action.payload` after resolution;
  error path reads `error.response.body` (throws on pure network errors — a preserved
  bug); `viewChangeCounter` guard drops stale responses; `ASYNC_END` skipped on error only
  when `skipTracking`. Copy verbatim; characterize every branch before touching anything.
- **R2 Global store singleton** — `App.js` dispatches `push()` via imported store. The
  replacement (history in a redirect effect) must not change *when* redirect happens
  relative to the `REDIRECT` reset dispatch.
- **R3 `marked@0.3.6` with `sanitize: true`** — the `sanitize` option was removed in
  modern marked; replicating its exact escaping is not feasible without behavior drift.
  **Conservative choice: keep marked@0.3.6 pinned** (identical output); flag its CVEs as a
  follow-up in the review report. Characterize: markdown body renders, raw HTML is escaped.
- **R4 `componentWillMount` → `useEffect` timing** — willMount side effects fire before
  first render; effects fire after. All such side effects here dispatch promise-payload
  actions whose state lands only after async resolution, so final rendered state is
  unaffected. Accepted equivalence; tests assert on settled DOM (`findBy*`).
- **R5 Preserved bugs (do NOT fix):** profile article fetches use page size 5 but
  `ListPagination` paginates assuming 10; LOGOUT writes `''` jwt instead of removing;
  Register/Login inputs start `value={undefined}` (uncontrolled→controlled warning);
  `DELETE_COMMENT` reducer assumes `state.comments` exists. Log each in migration-log.md.
- **R6 React version** — hooks require ≥16.8. **React 17.0.2**, keeping
  `ReactDOM.render`: React 18's `createRoot` auto-batching would change observable update
  timing. React 18 is a follow-up, not this migration.
- **R7 Implicit action-shape coupling** — reducers switch on `action.error`,
  `action.payload[0/1]` tuple order from `Promise.all`. Characterization must pin tuple
  order for Home/Article/Profile loaders.

## 4. Ordered migration sequence (each step ends with the full suite green)

- **M0. Toolchain strangler step (no component changes):** scaffold `migrated/` with
  Vite 5; copy `src/` verbatim; new deps (React 17, react-redux 8, react-router-dom 5.3.4,
  redux 4.2, marked 0.3.6 pinned, superagent w/o superagent-promise); excise
  react-router-redux (store.js, reducer.js, index.js, App.js redirect via history);
  `process.env.NODE_ENV` → `import.meta.env`. Gate: characterization suite green on
  migrated *before any hooks work*, `vite build` clean.
- **M1. Stateless/simple classes → functions:** Header, ListErrors.
- **M2. Dispatch-only connected function components → `useDispatch`:** ArticlePreview,
  ListPagination, MainView, ArticleActions, DeleteButton, Tags/Banner cleanups.
- **M3. Form components:** Login, Register, CommentInput (local state → `useState`).
- **M4. Editor + Settings:** deprecated lifecycles → effects; SettingsForm state init.
- **M5. Page components:** Home, Article; then Profile + ProfileFavorites (dissolve
  inheritance into shared `ProfileView`).
- **M6. App shell:** hooks App, redirect effect, auth bootstrap effect.
- **M7. Sweep:** remove dead code (`const Promise = global.Promise`, commented
  contextTypes, unused imports), confirm zero `connect(`/`React.Component` remain, full
  suite + production build + preview smoke.

## 5. Characterization-test plan (no existing coverage — 0 test files upstream)

One suite, two targets: `characterization/` holds the tests; vitest aliases `@app` →
`original/src` or `migrated/src` (env `TARGET`), and pins react/react-dom/react-redux/
router/RTL to the *target's* node_modules so each run uses that target's real libraries.
RTL 12 (supports React 16.14 and 17), jsdom. Network is mocked at the `@app/agent`
module boundary with RealWorld API fixtures; `localStorage` via jsdom.

Layers:
1. **Reducers (8 files, every action branch):** golden transitions incl. `action.error`
   variants, `viewChangeCounter` increments, tuple payloads (R7).
2. **Middleware:** promise detection, ASYNC_START/END ordering, payload mutation, stale-
   view drop, `skipTracking`, error→`error.response.body`, localStorage jwt set/clear +
   `agent.setToken` calls.
3. **agent.js:** URL construction (limit/offset, encode), token header plugin, `res.body`
   unwrapping, `omitSlug` on update — via a chainable superagent mock compatible with both
   superagent-promise (original) and native thenable (migrated).
4. **User flows (full `<App>` render, mocked agent):** home load (banner/tags/global
   feed), tab switch, tag filter, pagination, login success + error list, register,
   logout, article page (markdown + sanitize escaping, comments), add/delete comment,
   favorite/unfavorite, profile + favorites tab, editor create/edit + tag add/remove,
   settings save, auth bootstrap from stored jwt.

Exit criteria: 100% of reducers/middleware/agent branches listed above exercised; suite
passes on original; then and only then migration M0 may start.
