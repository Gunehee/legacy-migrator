# Review report — react-redux-realworld-example-app migration

## Verdict

High-quality, disciplined migration. Every class component is now a correctly-written
function component: hooks are called unconditionally before any early return, dependency
arrays are accurate (mount-only effects carry `eslint-disable-next-line
react-hooks/exhaustive-deps` with a comment explaining the intentional omission, exactly
where the plan calls for it), and event values are captured eagerly before being handed to
functional `setState`/dispatch updaters (the one real hooks regression class — stale-value
closures — is absent everywhere, including the tricky `Settings` form case the log calls
out). `connect()`, `React.Component`, deprecated lifecycles, `react-router-redux`,
`superagent-promise`, and `global.Promise` are fully gone; the only remaining traces are
comments explaining the old lifecycle names for context. `Profile`/`ProfileFavorites`
correctly dissolve class inheritance into a shared `ProfileView` parameterized by
`buildLoader`, matching the plan. Reducers, `agent.js`, `middleware.js`, and `store.js` are
copied with only the toolchain-forced changes (`import.meta.env`, `history` package,
dropped `router` slice) — no behavior drift. Both characterization targets are green
(157/157 original, 157/157 migrated) and `vite build` is clean (244.54 kB).

I read every file in `migrated/src` against the corresponding `original/src` file and
against `migration-plan.md`/`migration-log.md`. I found no undocumented defects, no dead
files, no unused action types beyond the already-documented preserved
`PROFILE_FAVORITES_PAGE_*` case, and no dependency in `package.json` that isn't imported
somewhere in `src/`.

## Cleanups applied

**None.** The codebase was already clean enough that no edit met the bar of "clear
improvement, zero behavior risk." The one candidate I considered and rejected:

- Every component still does `import React from 'react'` even though
  `@vitejs/plugin-react` (confirmed via `node_modules/@vitejs/plugin-react/dist/index.mjs`,
  default `jsxRuntime` is `"automatic"`) no longer requires it for JSX. This import is
  inert, not incorrect — React 17 supports both runtimes, so keeping the explicit import
  is a defensible, common transitional convention and is harmless either way. Removing it
  would touch all 24 component files for zero functional or lint benefit (no ESLint config
  in this repo flags it), so I left it as a follow-up rather than editing working code
  under a "zero unnecessary diff" review posture.

Gates were re-confirmed green in their pre-review state (no edits made, so no re-run was
needed after the fact): `TARGET=migrated npx vitest run` → 157/157; plain `npx vitest run`
(original) → 157/157; `npx vite build` → clean, 244.54 kB.

## Follow-ups

### Preserved upstream bugs (do NOT fix — governance rule; my assessment of each)

| # | Bug | Assessment |
|---|---|---|
| 1 | `DELETE_COMMENT` reducer throws if `state.comments` is undefined | Low real-world risk (unreachable via UI since comments load before the delete button renders); worth a defensive `state.comments \|\| []` if ever revisited, but only alongside a behavior-change sign-off. |
| 2 | `LOGOUT` writes `''` to `localStorage.jwt` instead of `removeItem` | Harmless in practice (`agent.setToken(null)` still clears the in-memory token; empty string is falsy on next `APP_LOAD` read) but leaves a stray key — cosmetic. |
| 3 | `settings` reducer sets `inProgress: true` on **any** `ASYNC_START`, not just settings-scoped ones | Could cause a spurious disabled-button flash on the settings form triggered by unrelated in-flight requests; low severity, UI-only. |
| 4 | `PROFILE_FAVORITES_PAGE_LOADED/UNLOADED` defined + reduced but never dispatched | Dead action types, functionally inert since `ProfileFavorites` reuses `PROFILE_PAGE_*`. Safe to delete in a future non-behavior-preserving pass; flagged, not removed here per governance. |
| 5 | `omitSlug` leaves `slug: undefined` in the update payload | Harmless — `JSON.stringify`/superagent drop `undefined` values; server never sees a conflicting slug key. |
| 6 | `marked` `sanitize: true` escapes raw HTML into visible text | Intentional legacy rendering behavior; see CVE note below — this is the one item with real security relevance. |
| 7 | Favorite/unfavorite dispatched with no login guard | Will hit the API unauthenticated if a logged-out user reaches the button (currently gated by UI flow, not code); low risk but worth a guard in a future behavior-change pass. |
| 8 | Profile pages fetch 5 articles/page, `ListPagination` paginates assuming 10 | Cosmetic pagination-count mismatch on profile pages only (favorites tab is unaffected — it does pass a page-aware pager). |
| 9 | Login/Register inputs start `value={undefined}` | Produces a one-time React "uncontrolled → controlled" console warning on first mount; no functional impact. |

Also carried over correctly: `CommentContainer`'s lowercase `<list-errors>` pseudo-element
(comment errors are structurally never rendered — confirmed, not fixed); `Editor`'s
slug-vs-old-slug reachability note in the log; `Settings` never dispatching
`SETTINGS_PAGE_UNLOADED`.

### Modernization steps for a maintainer (out of this migration's scope)

- **React 18 + `createRoot`**: batching change requires re-characterizing every async
  dispatch ordering test; do only with the same characterization-first discipline used here.
- **react-router-dom v6**: route-matching semantics changed (no more implicit partial
  match without `exact`); would need a full route-table rewrite and re-test, not a drop-in.
- **Redux Toolkit**: would collapse the 8 hand-written reducers + `constants/actionTypes.js`
  into slices; biggest ergonomic win available, moderate mechanical effort.
- **`marked` upgrade**: current pin (`0.3.19`) has known CVEs (ReDoS related, e.g.
  GHSA advisories for marked <0.7). Upgrading requires re-implementing `sanitize: true`
  equivalent behavior externally (e.g. DOMPurify post-render) since the option was removed
  upstream — a deliberate, documented scope boundary in this migration (R3).
  **This is the one preserved item I'd flag as a genuine security follow-up**, not just
  a style one.
- **superagent upgrade**: 3.8.3 → latest is low-risk (native promises already assumed);
  mainly a routine dependency bump plus a re-run of the `agent.js` characterization layer.
- **TypeScript**: no types anywhere; a incremental `allowJs`+`checkJs` pass would catch
  the `state.comments`/`omitSlug` classes of bug in the future without behavior changes.
- **MSW-based tests**: characterization currently mocks at the `@app/agent` module
  boundary; swapping to MSW would test closer to the real network boundary and make the
  suite reusable if `agent.js`'s internals ever change.
