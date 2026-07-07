/**
 * `store.js` creates and exports a single module-scoped `store` singleton
 * (no reducer is exported to reconstruct one independently). To get test
 * isolation without touching original/migrated source, reset the module
 * registry and re-import: this forces a brand-new singleton per test.
 * Counter.js/TodoList.js import './store' by relative path, which resolves
 * to the same module instance as '@app/store' after the reset, so the
 * rendered components and the test's assertions share one fresh store.
 */
import { vi } from 'vitest';

export async function freshApp() {
  vi.resetModules();
  const store = await import('@app/store');
  const { Provider } = await import('react-redux');
  const { default: Counter } = await import('@app/Counter');
  const { default: TodoList } = await import('@app/TodoList');
  return { ...store, Provider, Counter, TodoList };
}
