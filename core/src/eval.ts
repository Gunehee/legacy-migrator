/**
 * Evaluation gates. A stage may only advance when its gate passes — for
 * migration stages the gate is the target repo's full test suite
 * (existing tests + characterization tests).
 */

import { spawnSync } from 'node:child_process';

export interface GateResult {
  ok: boolean;
  command: string;
  cwd: string;
  exitCode: number | null;
  /** Best-effort "N passed / M failed" extracted from runner output. */
  summary: string;
  output: string;
}

/** Pull a human-readable pass/fail summary out of vitest/jest/mocha output. */
export function summarizeTestOutput(output: string, exitCode: number | null): string {
  const patterns = [
    /Tests\s+.*$/m, //           vitest: "Tests  12 passed (12)"
    /Tests:\s+.*$/m, //          jest:   "Tests:       3 failed, 9 passed, 12 total"
    /\d+\s+passing.*$/m, //      mocha:  "12 passing (34ms)"
  ];
  for (const p of patterns) {
    const m = output.match(p);
    if (m) return m[0].trim();
  }
  return exitCode === 0 ? 'exit 0 (no summary found)' : `exit ${exitCode} (no summary found)`;
}

export function runTestGate(command: string, cwd: string, timeoutMs = 600_000): GateResult {
  const proc = spawnSync(command, {
    shell: true,
    cwd,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: 'true' },
  });
  const output = `${proc.stdout ?? ''}\n${proc.stderr ?? ''}`;
  return {
    ok: proc.status === 0,
    command,
    cwd,
    exitCode: proc.status,
    summary: summarizeTestOutput(output, proc.status),
    output,
  };
}
