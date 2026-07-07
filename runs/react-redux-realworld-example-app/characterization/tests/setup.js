import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

// RTL 12 auto-cleanup needs a global afterEach (vitest globals are off); do it explicitly
afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  // each test starts at the root route; tests navigate from there
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  vi.restoreAllMocks();
});
