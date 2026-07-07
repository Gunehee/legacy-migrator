// store.js exports only the built `store` singleton (no reducer to
// reconstruct independently), so two tests sharing an import would leak
// counter/todos state across cases. Reset the module registry and re-import
// to force a brand-new singleton per test, with zero edits to original/ or
// migrated/. Counter.js/TodoList.js import './store' by relative path, which
// resolves to the same freshly-registered module after the reset, so the
// rendered components and the test's assertions always share one store.
import { vi } from 'vitest';

export async function freshApp() {
  vi.resetModules();
  const store = await import('@app/store');
  const { Provider } = await import('react-redux');
  const { default: Counter } = await import('@app/Counter');
  const { default: TodoList } = await import('@app/TodoList');
  return { ...store, Provider, Counter, TodoList };
}
