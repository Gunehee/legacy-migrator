import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Dual-target golden-master config.
 *
 * TARGET=original (default): '@app' → ../original/src, libraries resolve from
 * this package's node_modules (installed at the ORIGINAL's declared versions).
 *
 * TARGET=migrated: '@app' → ../migrated/src, and every runtime library the app
 * touches is pinned to ../migrated/node_modules so the suite exercises the
 * migrated code with the migrated dependency set — same tests, new stack.
 */
const HERE = dirname(fileURLToPath(new URL(import.meta.url)));
const TARGET = process.env.TARGET ?? 'original';
if (!['original', 'migrated'].includes(TARGET)) {
  throw new Error(`TARGET must be 'original' or 'migrated', got '${TARGET}'`);
}
const appSrc = join(HERE, '..', TARGET, 'src');
if (!existsSync(appSrc)) {
  throw new Error(`target src not found: ${appSrc}`);
}

const alias = { '@app': appSrc };

// Pin every runtime library to the *target's* dependency set. original/ has no
// node_modules (it is an immutable snapshot), so its declared versions live in
// this package's node_modules; migrated/ brings its own modern versions.
const depRoot =
  TARGET === 'migrated' ? join(HERE, '..', 'migrated', 'node_modules') : join(HERE, 'node_modules');
for (const pkg of [
  'react',
  'react-dom',
  'react-redux',
  'react-router-dom',
  'react-router-redux',
  'history',
  'marked',
  'superagent',
  'superagent-promise',
  'redux',
  'redux-logger',
  'redux-devtools-extension',
  '@redux-devtools/extension',
  '@testing-library/react',
  '@testing-library/dom',
  'prop-types',
]) {
  if (existsSync(join(depRoot, pkg))) alias[pkg] = join(depRoot, pkg);
}

/** The app keeps JSX in .js files (faithful to upstream); transform them explicitly. */
const jsxInJs = {
  name: 'jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    if (!/\.jsx?$/.test(id) || id.includes('node_modules')) return null;
    const { transform } = await import('esbuild');
    return transform(code, { loader: 'jsx', jsx: 'transform', sourcefile: id, sourcemap: true });
  },
};

export default defineConfig({
  plugins: [jsxInJs],
  resolve: { alias },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    // the app relies on singletons (store, agent token); isolate per file
    isolate: true,
    server: {
      deps: {
        // old CJS packages need to be processed so aliases apply inside them
        inline: [/react-redux/, /react-router/, /superagent/, /@testing-library/],
      },
    },
  },
});
