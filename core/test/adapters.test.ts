import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ClaudeCodeAdapter } from '../src/adapters.js';
import { newTask } from '../src/task.js';

// A tiny stand-in for `claude -p ...`: it ignores the real CLI args and just
// prints FAKE_STDOUT/FAKE_STDERR and exits FAKE_EXIT, so every branch of the
// adapter's parsing logic can be driven deterministically without spawning
// the real binary or making a network call.
const fakeBinaryDir = mkdtempSync(join(tmpdir(), 'fake-claude-'));
const fakeBinaryPath = join(fakeBinaryDir, 'fake-claude.mjs');
writeFileSync(
  fakeBinaryPath,
  `#!/usr/bin/env node
const stdout = process.env.FAKE_STDOUT ?? '';
const stderr = process.env.FAKE_STDERR ?? '';
const exitCode = Number(process.env.FAKE_EXIT ?? '0');
if (stdout) process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);
process.exit(exitCode);
`,
);
chmodSync(fakeBinaryPath, 0o755);

const FAKE_ENV_KEYS = ['FAKE_STDOUT', 'FAKE_STDERR', 'FAKE_EXIT'] as const;

function runFake(env: Partial<Record<(typeof FAKE_ENV_KEYS)[number], string>>) {
  const prev: Record<string, string | undefined> = {};
  for (const k of FAKE_ENV_KEYS) prev[k] = process.env[k];
  for (const k of FAKE_ENV_KEYS) {
    if (env[k] !== undefined) process.env[k] = env[k];
    else delete process.env[k];
  }
  try {
    const adapter = new ClaudeCodeAdapter('fake', 'fake-model', fakeBinaryPath);
    return adapter.execute(newTask('do the thing', 'testtype'), 'low');
  } finally {
    for (const k of FAKE_ENV_KEYS) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

describe('ClaudeCodeAdapter — success path (unchanged behavior)', () => {
  it('extracts result and total_cost_usd from a JSON envelope', () => {
    const result = runFake({
      FAKE_STDOUT: JSON.stringify({ result: 'hello world', total_cost_usd: 0.1234 }),
      FAKE_EXIT: '0',
    });
    expect(result.status).toBe('ok');
    expect(result.output).toBe('hello world');
    expect(result.costUsd).toBe(0.1234);
  });

  it('falls back to raw stdout when it is not JSON, with costUsd undefined', () => {
    const result = runFake({ FAKE_STDOUT: 'plain text output', FAKE_EXIT: '0' });
    expect(result.status).toBe('ok');
    expect(result.output).toBe('plain text output');
    expect(result.costUsd).toBeUndefined();
  });
});

describe('ClaudeCodeAdapter — failure path (the fix)', () => {
  it('labels both stdout and stderr in the error message, not just stderr', () => {
    const result = runFake({
      FAKE_STDOUT: 'partial output before crash',
      FAKE_STDERR: 'boom: something broke',
      FAKE_EXIT: '1',
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('exit 1');
    expect(result.error).toContain('stdout: partial output before crash');
    expect(result.error).toContain('stderr: boom: something broke');
  });

  it('parses a JSON result envelope even on non-zero exit and surfaces num_turns/cost/subtype', () => {
    const result = runFake({
      FAKE_STDOUT: JSON.stringify({
        subtype: 'error_max_turns',
        is_error: true,
        num_turns: 100,
        total_cost_usd: 0.4567,
      }),
      FAKE_EXIT: '1',
    });
    expect(result.status).toBe('error');
    expect(result.error).toContain('num_turns=100');
    expect(result.error).toContain('total_cost_usd=0.4567');
    expect(result.error).toContain('subtype=error_max_turns');
    expect(result.error).toContain('is_error=true');
    // the whole point: cost incurred by a failed run must still be visible
    expect(result.costUsd).toBe(0.4567);
  });

  it('truncates stdout to 4000 chars and stderr to 2000 chars', () => {
    const result = runFake({
      FAKE_STDOUT: 'A'.repeat(5000),
      FAKE_STDERR: 'B'.repeat(3000),
      FAKE_EXIT: '1',
    });
    const stdoutMatch = result.error?.match(/stdout: (A+)/);
    const stderrMatch = result.error?.match(/stderr: (B+)/);
    expect(stdoutMatch?.[1]).toHaveLength(4000);
    expect(stderrMatch?.[1]).toHaveLength(2000);
  });

  it('keeps the original spawn-error path untouched (no stdout/stderr labels to add)', () => {
    const adapter = new ClaudeCodeAdapter('fake', 'fake-model', '/definitely/not/a/real/binary-xyz');
    const result = adapter.execute(newTask('do the thing', 'testtype'), 'low');
    expect(result.status).toBe('error');
    expect(result.error).not.toContain('stdout:');
    expect(result.error).toMatch(/ENOENT/);
  });
});
