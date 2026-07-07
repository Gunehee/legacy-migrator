import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL 12 auto-cleanup needs a global afterEach (vitest globals are off); do it explicitly
afterEach(cleanup);
