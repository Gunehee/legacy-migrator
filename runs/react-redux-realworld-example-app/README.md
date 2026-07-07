# React Redux RealWorld Example App — Class-to-Hooks Migration

This directory contains the original, migrated, and characterization-test artifacts for a complete class-components-to-functional-hooks migration of the canonical RealWorld "Conduit" frontend example.

## Contents

- **original/** — unmodified copy of gothinkster/react-redux-realworld-example-app (commit ee72eba, MIT), used as golden reference; never edited.
- **migrated/** — result of the class-to-hooks transformation; ready to run and build.
- **characterization/** — 157-test suite that runs against both targets (via `TARGET` env var), proving behavior preservation.
- **target-rationale.md** — why this repo was chosen (canonical, archived, MIT, testable, represents real legacy patterns).
- **migration-plan.md** — detailed architecture map, legacy-to-modern equivalents, risk areas (R1–R7), and the ordered M0–M7 sequence.
- **migration-log.md** — step-by-step execution log for each migration phase, preserved upstream bugs, and flagged deviations.
- **review-report.md** — review findings, cleanups applied (none; code was already clean), and follow-up modernization paths.

## Architecture Transformation

| aspect | original | migrated |
|--------|----------|----------|
| **Build tool** | Create React App 1 (Webpack 3, Babel 6) | Vite 5 + `@vitejs/plugin-react` |
| **React** | 16.3 class components (13 classes, `connect()` everywhere) | 17.0.2 functional components + hooks (0 classes, `useSelector`/`useDispatch`) |
| **State** | redux 3 + react-redux 5 `connect()` | redux 4.2 + react-redux 8 hooks |
| **Routing** | react-router-dom 4 + react-router-redux 5.0.0-alpha.6 (middleware + global dispatch) | react-router-dom 5.3.4 plain (history object, redirect via effect) |
| **HTTP** | superagent-promise wrapper | native superagent 3.8.3 (removed wrapper; same `.then()` shape) |
| **Markdown** | marked 0.3.6 | marked 0.3.19 (pinned for identical `sanitize` output; see security note) |
| **Tests** | 0 test files | 157-test characterization suite (reducers, middleware, agent, user flows) |
| **Bundle** | n/a (CRA1 build not measurable on modern Node) | 244 KB (down from 254 KB at the M0 toolchain step after dead router-redux code was dropped) |

## Migration Sequence

The app was migrated module-by-module in seven ordered steps (**M0–M7**), with the full 157-test suite passing green after every step:

1. **M0 — Toolchain strangler** (no component-logic changes): scaffold Vite, pin new stack (React 17, react-redux 8, react-router-dom 5.3.4, redux 4.2), drop react-router-redux entirely, excise superagent-promise wrapper. Gate: suite 157/157 on *both* targets before any hooks work.

2. **M1–M2 — Stateless and dispatch-only classes**: convert Header, ListErrors, and dispatch-only connected wrappers (ArticlePreview, ListPagination, MainView, ArticleActions, DeleteButton) to functions; replace `connect()` with `useDispatch`/`useSelector`.

3. **M3 — Form components**: Login, Register, CommentInput; convert to hooks state (`useState`), move lifecycle cleanups to effect cleanup functions.

4. **M4 — Editor + Settings**: replace deprecated lifecycles (`componentWillMount`, `componentWillReceiveProps`, `componentWillUnmount`) with appropriately-scoped `useEffect` blocks; use `useParams` for route params. Catch: Settings form keystroke issue fixed (capture `ev.target.value` eagerly; functional updaters read stale DOM value).

5. **M5 — Page components**: Home, Article, Profile + ProfileFavorites. Dissolve class inheritance (`ProfileFavorites extends Profile`) into a shared `ProfileView` function parameterized by `buildLoader` and `activeTab`.

6. **M6 — App shell**: convert auth bootstrap and redirect watcher to effects; drop global store dispatch, use history object instead.

7. **M7 — Sweep**: verify zero `React.Component`, `connect()`, deprecated lifecycle methods, react-router-redux, superagent-promise, or `global.Promise` remain; confirm full suite green on both targets and production build clean.

## Test Coverage & Behavior Preservation

**Before migration:** 0 tests in the upstream repo. **After:** 157-test golden-master characterization suite, structured as:

- **8 reducer test suites**: every action branch (including error variants, `viewChangeCounter` logic, tuple payload order from `Promise.all`).
- **Middleware tests**: promise detection, `ASYNC_START`/`END` ordering, payload mutation, stale-view filtering, `localStorage` JWT persistence.
- **Agent tests**: URL construction, token headers, response unwrapping, edge cases.
- **28 full-app integration tests**: user flows (login, register, logout, article load, comments, favorites, profile tabs, editor create/edit, settings save, auth bootstrap).

**Proof of behavior preservation:** The same 157-test suite is run against both the original and migrated code using a dual-target vitest harness (env `TARGET=original` or `TARGET=migrated`). Both complete at 157/157 green. The characterization suite uses jsdom and mocks the HTTP layer at the agent boundary, so it exercises every reducer path, middleware ordering, and user-flow state transition in both stacks side-by-side.

**Deliberately preserved upstream bugs** (9 total, documented in migration-log.md): profile pages fetch 5 articles/page but pagination assumes 10, DELETE_COMMENT throws if comments is undefined, LOGOUT writes empty string not removeItem, Login/Register inputs start uncontrolled, and others. These are left untouched per governance rule (behavior preservation, not bug-fix pass); see review-report.md for severity assessment of each.

**One flagged non-replicated bug (documented in migration-log.md):** the original's `componentWillReceiveProps` on Editor fetches the old slug when navigating editor→editor; the hooks version fetches the new slug. This path is unreachable via the UI (no editor→editor links), so this is a conservative scope boundary, not a bug introduced by the migration.

## How to Run

### Characterization Suite

```bash
cd characterization
npm install

# Test the original code
npm test

# Test the migrated code
npm run test:migrated
```

Both should print `157 passed` with no errors. The test harness picks `ConnectedRouter` vs plain `Router` by probing the store state and routes each target with its own React, react-redux, and react-router-dom versions.

### Migrated App (dev server)

```bash
cd migrated
npm install
npm start
```

Opens at http://localhost:4100. The app shell is fully functional; live data requires a working RealWorld API instance. (The upstream api.realworld.io domain is defunct; see the RealWorld spec for setup instructions if you need to point at a live backend.)

### Production Build

```bash
cd migrated
npm run build      # Creates dist/ with 244 KB bundle
npm run preview    # Serves build on http://localhost:4100
```

The build is clean with zero warnings. The preview HTTP server confirms static serving works.

## Key Technical Decisions

- **React 17 kept (not 18):** React 18's `createRoot` auto-batching would change observable update timing, requiring re-characterization of every async dispatch test. React 18 is a natural follow-up, deferred to preserve this migration's scope.

- **react-router-dom 5.3.4 kept (not v6):** v6 changed route-matching semantics (no more implicit partial match without `exact`). A full route-table rewrite would be needed. v5 is API-compatible with v4 semantics.

- **marked 0.3.19 pinned:** the `sanitize: true` option (which escapes raw HTML) was removed in modern marked. Keeping the pin ensures identical output; see CVE note below.

- **superagent wrapper removed:** superagent ≥3 is natively thenable with identical `.then(res) / .catch(error.response)` shapes; the wrapper was purely shimming a non-standard API and is safe to drop.

- **react-router-redux entirely removed:** the router slice (`state.router`) was write-only (verified: no component reads it); redirect now uses the history object and a simple effect, one less middleware.

- **`process.env.NODE_ENV` → `import.meta.env.PROD`:** Vite idiom, same meaning at runtime.

## Security & Follow-ups

### Preserved Issues

**marked pinned at 0.3.19:** This version has known CVEs (ReDoS-related, GHSA advisories). The app displays server-supplied markdown with HTML escaping enabled (the `sanitize: true` option), which was a deliberate security measure in the original code. Modern marked removed this option; upgrading would require implementing external sanitization (e.g., DOMPurify). This is the one preserved item I would flag as a genuine follow-up, not just a style one — it is worth a separate upgrade pass with external sanitization.

### Future Modernization (out of this migration's scope)

- **React 18**: enables Suspense and automatic batching; re-run characterization suite to re-assert behavior preservation.
- **react-router-dom v6**: changes route matching; requires full route-table rewrite.
- **Redux Toolkit**: collapse hand-written reducers into slices; moderate mechanical effort.
- **TypeScript**: incremental `allowJs` → `checkJs` pass would catch class of bugs like `state.comments || []` without behavior changes.
- **MSW-based tests**: swap from agent-boundary mocking to MSW for closer-to-real network testing.

## Attribution

Original repository: [gothinkster/react-redux-realworld-example-app](https://github.com/gothinkster/react-redux-realworld-example-app) (archived, MIT license). License file retained in **original/LICENSE.md**. Migration and characterization suite produced as a capability demonstration and portfolio artifact.

For detailed pre-migration architecture, see **original/README.md**. For full migration decision logs and risk assessments, see **migration-plan.md** and **migration-log.md**.
