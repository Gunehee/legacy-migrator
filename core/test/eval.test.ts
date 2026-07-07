import { describe, expect, it } from 'vitest';

import { runTestGate, summarizeTestOutput } from '../src/eval.js';

describe('runTestGate', () => {
  it('passes when the command exits 0', () => {
    const gate = runTestGate('node -e "console.log(\'Tests  3 passed (3)\')"', process.cwd());
    expect(gate.ok).toBe(true);
    expect(gate.exitCode).toBe(0);
    expect(gate.summary).toBe('Tests  3 passed (3)');
  });

  it('fails when the command exits non-zero', () => {
    const gate = runTestGate('node -e "process.exit(1)"', process.cwd());
    expect(gate.ok).toBe(false);
    expect(gate.exitCode).toBe(1);
  });
});

describe('summarizeTestOutput', () => {
  it('extracts vitest, jest and mocha summaries', () => {
    expect(summarizeTestOutput('...\nTests  12 passed (12)\nDuration 1s', 0)).toBe('Tests  12 passed (12)');
    expect(summarizeTestOutput('Tests:       3 failed, 9 passed, 12 total', 1)).toBe(
      'Tests:       3 failed, 9 passed, 12 total',
    );
    expect(summarizeTestOutput('  12 passing (34ms)', 0)).toBe('12 passing (34ms)');
  });

  it('falls back to the exit code when no summary is found', () => {
    expect(summarizeTestOutput('no runner here', 0)).toBe('exit 0 (no summary found)');
    expect(summarizeTestOutput('boom', 2)).toBe('exit 2 (no summary found)');
  });
});
