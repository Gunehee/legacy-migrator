# Graph Report - legacy-migrator  (2026-07-07)

## Corpus Check
- 136 files · ~31,029 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 596 nodes · 862 edges · 54 communities (40 shown, 14 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.53)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fa70aff0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_pipeline.ts|pipeline.ts]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_index.js|index.js]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_fixtures.js|fixtures.js]]
- [[_COMMUNITY_RunStore|RunStore]]
- [[_COMMUNITY_App.jsx|App.jsx]]
- [[_COMMUNITY_agent.js|agent.js]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_actionTypes.js|actionTypes.js]]
- [[_COMMUNITY_Settings.js|Settings.js]]
- [[_COMMUNITY_actionTypes.js|actionTypes.js]]
- [[_COMMUNITY_App.js|App.js]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_index.js|index.js]]
- [[_COMMUNITY_index.jsx|index.jsx]]
- [[_COMMUNITY_agent.js|agent.js]]
- [[_COMMUNITY_MainView.js|MainView.js]]
- [[_COMMUNITY_Editor|Editor]]
- [[_COMMUNITY_Profile.js|Profile.js]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_Profile.jsx|Profile.jsx]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_store.js|store.js]]
- [[_COMMUNITY_Migration log — react-redux-realworld-example-app|Migration log — react-redux-realworld-example-app]]
- [[_COMMUNITY_CommentContainer.jsx|CommentContainer.jsx]]
- [[_COMMUNITY_index.ts|index.ts]]
- [[_COMMUNITY_SettingsForm|SettingsForm]]
- [[_COMMUNITY_Register|Register]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_index.jsx|index.jsx]]
- [[_COMMUNITY_Migration plan — react-redux-realworld-example-app|Migration plan — react-redux-realworld-example-app]]
- [[_COMMUNITY_Login|Login]]
- [[_COMMUNITY_Review report — react-redux-realworld-example-app migration|Review report — react-redux-realworld-example-app migration]]
- [[_COMMUNITY_tsconfig.json|tsconfig.json]]
- [[_COMMUNITY_!React + Redux Example App(project-logo.png)|![React + Redux Example App](project-logo.png)]]
- [[_COMMUNITY_vitest.config.mjs|vitest.config.mjs]]
- [[_COMMUNITY_Header.js|Header.js]]
- [[_COMMUNITY_legacy-migrator — governance rules|legacy-migrator — governance rules]]
- [[_COMMUNITY_agent.test.js|agent.test.js]]
- [[_COMMUNITY_App|App]]
- [[_COMMUNITY_ProfileFavorites|ProfileFavorites]]
- [[_COMMUNITY_target-rationale|target-rationale.md]]

## God Nodes (most connected - your core abstractions)
1. `RunStore` - 13 edges
2. `ExecutorAdapter` - 11 edges
3. `Pipeline` - 11 edges
4. `compilerOptions` - 11 edges
5. `Effort` - 10 edges
6. `renderApp()` - 10 edges
7. `Router` - 9 edges
8. `Editor` - 9 edges
9. `Migration log — react-redux-realworld-example-app` - 9 edges
10. `TaskResult` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Pipeline` --references--> `RunStore`  [EXTRACTED]
  core/src/pipeline.ts → core/src/state.ts
- `RoutingDecision` --references--> `Effort`  [EXTRACTED]
  core/src/router.ts → core/src/task.ts
- `Rule` --references--> `Effort`  [EXTRACTED]
  core/src/router.ts → core/src/task.ts
- `getMiddleware()` --indirect_call--> `promiseMiddleware()`  [INFERRED]
  runs/react-redux-realworld-example-app/migrated/src/store.js → runs/react-redux-realworld-example-app/migrated/src/middleware.js
- `getMiddleware()` --indirect_call--> `localStorageMiddleware()`  [INFERRED]
  runs/react-redux-realworld-example-app/migrated/src/store.js → runs/react-redux-realworld-example-app/migrated/src/middleware.js

## Import Cycles
- None detected.

## Communities (54 total, 14 thin omitted)

### Community 0 - "pipeline.ts"
Cohesion: 0.07
Nodes (28): ADAPTER_FACTORIES, AdapterFactory, buildAdapter(), ClaudeCodeAdapter, ExecutorAdapter, MAX_TURNS, GateResult, runTestGate() (+20 more)

### Community 1 - "dependencies"
Cohesion: 0.06
Nodes (30): dependencies, history, marked, prop-types, react, react-dom, react-redux, react-router-dom (+22 more)

### Community 2 - "index.js"
Cohesion: 0.08
Nodes (6): ArticleMeta(), Comment(), CommentContainer(), CommentInput, CommentList(), Article

### Community 3 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, history, marked, react, react-dom, react-redux, react-router-dom, redux (+18 more)

### Community 4 - "dependencies"
Cohesion: 0.07
Nodes (26): dependencies, history, marked, prop-types, react, react-dom, react-redux, react-router (+18 more)

### Community 5 - "fixtures.js"
Cohesion: 0.35
Nodes (8): articlesList(), author, makeArticle(), makeComment(), tags, user, agentMockFactory(), renderApp()

### Community 6 - "RunStore"
Cohesion: 0.21
Nodes (7): Decision, now(), RunStore, STAGE_ORDER, StageRecord, StageStatus, TestGateRecord

### Community 7 - "App.jsx"
Cohesion: 0.19
Nodes (7): Editor(), Header(), ListErrors(), Login(), Register(), emptyForm, Settings()

### Community 8 - "agent.js"
Cohesion: 0.15
Nodes (8): Articles, Auth, Comments, Profile, requests, Tags, ArticlePreview(), ListPagination()

### Community 9 - "package.json"
Cohesion: 0.13
Nodes (14): description, devDependencies, @types/node, typescript, vitest, name, private, scripts (+6 more)

### Community 13 - "App.js"
Cohesion: 0.26
Nodes (6): localStorageMiddleware(), promiseMiddleware(), getMiddleware(), history, myRouterMiddleware, store

### Community 14 - "package.json"
Cohesion: 0.17
Nodes (11): bin, legacy-migrator, dependencies, @legacy-migrator/agents, @legacy-migrator/core, main, name, scripts (+3 more)

### Community 15 - "index.js"
Cohesion: 0.20
Nodes (3): Banner(), Home, Tags()

### Community 16 - "index.jsx"
Cohesion: 0.21
Nodes (5): ArticleList(), Banner(), Home(), MainView(), Tags()

### Community 17 - "agent.js"
Cohesion: 0.17
Nodes (7): Articles, Auth, Comments, Profile, requests, superagent, Tags

### Community 21 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, composite, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, skipLibCheck (+3 more)

### Community 22 - "package.json"
Cohesion: 0.18
Nodes (10): dependencies, @legacy-migrator/core, exports, main, name, scripts, build, type (+2 more)

### Community 23 - "package.json"
Cohesion: 0.18
Nodes (10): dependencies, yaml, exports, main, name, scripts, build, type (+2 more)

### Community 24 - "Profile.jsx"
Cohesion: 0.20
Nodes (3): Profile(), ProfileView(), ProfileFavorites()

### Community 25 - "index.ts"
Cohesion: 0.33
Nodes (7): analyzer, docWriter, migrator, PIPELINE_AGENTS, reviewer, testGenerator, ctx

### Community 26 - "store.js"
Cohesion: 0.33
Nodes (6): App(), localStorageMiddleware(), promiseMiddleware(), getMiddleware(), history, store

### Community 27 - "Migration log — react-redux-realworld-example-app"
Cohesion: 0.20
Nodes (9): Baseline, M0 — toolchain strangler step (no component-logic changes) ✅ 157/157 migrated + original, vite build clean, M1+M2 — stateless classes + dispatch-only connects → hooks ✅ 157/157, M3 — form components → hooks ✅ 157/157, M4 — Editor + Settings (deprecated lifecycles) ✅ 157/157, M5 — page components → hooks ✅ 157/157, M6 — App shell → hooks ✅ 157/157, M7 — sweep + final validation ✅ (+1 more)

### Community 28 - "CommentContainer.jsx"
Cohesion: 0.33
Nodes (4): Comment(), CommentInput(), CommentList(), DeleteButton()

### Community 29 - "index.ts"
Cohesion: 0.54
Nodes (6): DEFAULT_RUNS_ROOT, main(), renderStatus(), repoNameFromUrl(), runCommand(), statusCommand()

### Community 32 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, references

### Community 33 - "tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, references

### Community 34 - "index.jsx"
Cohesion: 0.38
Nodes (4): ArticleActions(), ArticleMeta(), CommentContainer(), Article()

### Community 35 - "Migration plan — react-redux-realworld-example-app"
Cohesion: 0.29
Nodes (6): 1. Architecture map, 2. Legacy patterns → modern equivalents, 3. Risk areas, 4. Ordered migration sequence (each step ends with the full suite green), 5. Characterization-test plan (no existing coverage — 0 test files upstream), Migration plan — react-redux-realworld-example-app

### Community 37 - "Review report — react-redux-realworld-example-app migration"
Cohesion: 0.29
Nodes (6): Cleanups applied, Follow-ups, Modernization steps for a maintainer (out of this migration's scope), Preserved upstream bugs (do NOT fix — governance rule; my assessment of each), Review report — react-redux-realworld-example-app migration, Verdict

### Community 38 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 39 - "![React + Redux Example App](project-logo.png)"
Cohesion: 0.33
Nodes (5): [Demo](https://react-redux.realworld.io)&nbsp;&nbsp;&nbsp;&nbsp;[RealWorld](https://github.com/gothinkster/realworld), Functionality overview, Getting started, Making requests to the backend API, ![React + Redux Example App](project-logo.png)

### Community 40 - "vitest.config.mjs"
Cohesion: 0.40
Nodes (4): alias, appSrc, HERE, jsxInJs

### Community 42 - "legacy-migrator — governance rules"
Cohesion: 0.50
Nodes (3): Commands, Layout, legacy-migrator — governance rules

## Knowledge Gaps
- **192 isolated node(s):** `name`, `version`, `type`, `main`, `types` (+187 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SettingsForm` connect `SettingsForm` to `Settings.js`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `SettingsForm()` connect `SettingsForm` to `App.jsx`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `renderApp()` connect `fixtures.js` to `App.js`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `version`, `type` to the rest of the system?**
  _192 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pipeline.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07130333138515488 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `index.js` be split into smaller, more focused modules?**
  _Cohesion score 0.082010582010582 - nodes in this community are weakly interconnected._