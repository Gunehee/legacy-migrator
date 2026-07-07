import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests run against src (no build step); package exports point at dist for consumers.
export default defineConfig({
  resolve: {
    alias: {
      '@legacy-migrator/core': fileURLToPath(new URL('./core/src/index.ts', import.meta.url)),
      '@legacy-migrator/agents': fileURLToPath(new URL('./agents/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['core/test/**/*.test.ts', 'agents/test/**/*.test.ts', 'cli/test/**/*.test.ts'],
  },
});
