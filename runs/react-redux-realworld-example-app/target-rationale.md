# Target rationale — gothinkster/react-redux-realworld-example-app

**Lane:** class-based React components → functional + hooks
**Source:** https://github.com/gothinkster/react-redux-realworld-example-app
**Snapshot:** commit `ee72eba4056392c95a27bc48d385d3f54ba38a18` (2021-09-07), MIT license, 5,628 stars, **archived by its owners** — genuinely abandoned legacy code, not a strawman.

I picked this repo because it is the canonical "RealWorld" Medium-clone frontend — a real,
complete application (auth, articles, comments, profiles, favorites, pagination, editor)
frozen on a 2018-era stack: Create React App 1 (Webpack 3 / Babel 6), React 16.3 **class
components** throughout, `redux@3` + `react-redux@5` `connect()` everywhere,
`react-router@4` with the long-deprecated `react-router-redux@5.0.0-alpha.6`, and
`superagent-promise`. Every file exercises the exact legacy patterns the migration lane
targets, it is famous enough that the before/after is instantly recognizable, and its MIT
license permits publishing a migrated fork as a portfolio artifact. It has **no test suite
at all** (0 test files), which makes it an honest end-to-end exercise for this pipeline:
the test-generator agent must build a golden-master characterization suite against the
original before the migrator may touch anything.

**Size trade-off (flagged, not hidden):** source is 2,340 lines of JS across 38 modules —
slightly under the rough 3,000-line floor in the brief. The two larger same-lane
alternatives evaluated (`andrewngu/sound-redux`, `insin/react-hn`) fail the permissive-
license criterion (GPL-3.0 / no license), so I chose the famous, archived, MIT candidate
over an obscure one that hits the number exactly.

Evaluated candidates:

| candidate | lane fit | license | verdict |
|---|---|---|---|
| gothinkster/react-redux-realworld-example-app | class React → hooks | MIT | **selected** (archived, canonical, testable) |
| andrewngu/sound-redux | class React → hooks | GPL-3.0 | rejected: license |
| insin/react-hn | class React → hooks | none | rejected: license |
| websockets/ws, forwardemail/superagent, jprichardson/node-fs-extra | CJS → ESM | MIT | rejected: actively maintained — not credibly "legacy" |
