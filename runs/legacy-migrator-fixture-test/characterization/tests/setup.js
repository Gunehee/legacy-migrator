import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// vitest globals are off; RTL's auto-cleanup needs an explicit afterEach hook.
afterEach(cleanup);
