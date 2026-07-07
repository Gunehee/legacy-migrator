import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Dual-target golden-master config: the SAME suite runs against original/
// (TARGET=original, default — this is the gate before migration starts) and
// migrated/ (TARGET=migrated — the gate the migrator/reviewer stages run
// later). '@app' resolves to whichever tree is under test.
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

// original/ ships no node_modules (it's an immutable snapshot) so its declared
// versions are installed here instead; migrated/ carries its own dependency
// set once it exists, so pin every runtime lib the app touches to whichever
// tree is under test.
const depRoot =
  TARGET === 'migrated' ? join(HERE, '..', 'migrated', 'node_modules') : join(HERE, 'node_modules');
for (const pkg of ['react', 'react-dom', 'react-redux', 'redux', '@testing-library/react', '@testing-library/dom']) {
  if (existsSync(join(depRoot, pkg))) alias[pkg] = join(depRoot, pkg);
}

// The fixture keeps JSX in .js files with no build tooling of its own;
// transform it explicitly rather than requiring original/migrated to ship a
// babel/webpack config that isn't part of their observable behavior.
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
    // store.js holds a module-scoped singleton; isolate per test file so
    // suites can't leak counter/todos state into one another.
    isolate: true,
    server: {
      deps: {
        inline: [/react-redux/, /@testing-library/],
      },
    },
  },
});
