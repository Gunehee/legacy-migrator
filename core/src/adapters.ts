/**
 * Executor adapters. Every executor wraps a headless `claude -p` invocation
 * pinned to one model; the router decides which adapter a task type gets.
 */

import { spawnSync } from 'node:child_process';

import type { Effort, TaskRequest, TaskResult } from './task.js';

export interface ExecutorAdapter {
  readonly name: string;
  isAvailable(): boolean;
  execute(task: TaskRequest, effort: Effort): TaskResult;
}

/** Effort → agent turn budget. Adapters map abstract effort to model-native knobs. */
const MAX_TURNS: Record<Effort, number> = { low: 15, medium: 40, high: 100 };

export class ClaudeCodeAdapter implements ExecutorAdapter {
  constructor(
    readonly name: string,
    readonly model: string,
    private readonly binary = 'claude',
  ) {}

  isAvailable(): boolean {
    const probe = spawnSync(this.binary, ['--version'], { encoding: 'utf8' });
    return probe.status === 0;
  }

  execute(task: TaskRequest, effort: Effort): TaskResult {
    const started = Date.now();
    const args = [
      '-p',
      task.prompt,
      '--model',
      this.model,
      '--output-format',
      'json',
      '--max-turns',
      String(MAX_TURNS[effort]),
      '--permission-mode',
      'acceptEdits',
    ];
    const proc = spawnSync(this.binary, args, {
      cwd: task.cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    const latencyMs = Date.now() - started;

    // Spawn itself failed (e.g. binary not found) — no subprocess ever ran,
    // so there's no stdout/stderr worth parsing.
    if (proc.error) {
      return {
        taskId: task.taskId,
        executor: this.name,
        status: 'error',
        output: proc.stdout ?? '',
        error: String(proc.error),
        latencyMs,
      };
    }

    // The subprocess ran to completion (or was cut off) and may still have
    // written a JSON result envelope to stdout even on a non-zero exit
    // (e.g. max-turns exhaustion) — always attempt the parse so cost/turn
    // data survives failure, not just success.
    const parsed = ClaudeCodeAdapter.tryParseJson(proc.stdout);
    const costUsd = typeof parsed?.total_cost_usd === 'number' ? parsed.total_cost_usd : undefined;

    if (proc.status !== 0) {
      return {
        taskId: task.taskId,
        executor: this.name,
        status: 'error',
        output: proc.stdout ?? '',
        error: ClaudeCodeAdapter.describeFailure(proc, parsed),
        costUsd,
        latencyMs,
      };
    }

    const output = typeof parsed?.result === 'string' ? parsed.result : proc.stdout;
    return { taskId: task.taskId, executor: this.name, status: 'ok', output, costUsd, latencyMs };
  }

  private static tryParseJson(stdout: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(stdout);
    } catch {
      return undefined; // non-JSON output (older CLI, or a truncated/partial run): nothing to parse
    }
  }

  /** Surfaces BOTH stdout and stderr on failure — previously only stderr was kept, so a
   * real explanation sitting in the JSON result envelope (or the SDK's own error text) on
   * stdout was silently discarded whenever the process exited non-zero. */
  private static describeFailure(
    proc: { status: number | null; stdout: string; stderr: string },
    parsed: Record<string, unknown> | undefined,
  ): string {
    const stdout = proc.stdout ? proc.stdout.slice(0, 4000) : '(empty)';
    const stderr = proc.stderr ? proc.stderr.slice(0, 2000) : '(empty)';
    const bits: string[] = [];
    if (parsed) {
      if (typeof parsed.num_turns === 'number') bits.push(`num_turns=${parsed.num_turns}`);
      if (typeof parsed.total_cost_usd === 'number') bits.push(`total_cost_usd=${parsed.total_cost_usd}`);
      if (typeof parsed.subtype === 'string') bits.push(`subtype=${parsed.subtype}`);
      if (typeof parsed.is_error === 'boolean') bits.push(`is_error=${parsed.is_error}`);
    }
    const parsedNote = bits.length ? ` [parsed: ${bits.join(', ')}]` : '';
    return `exit ${proc.status}${parsedNote}\nstdout: ${stdout}\nstderr: ${stderr}`;
  }
}

export type AdapterFactory = () => ExecutorAdapter;

export const ADAPTER_FACTORIES: Record<string, AdapterFactory> = {
  fable: () => new ClaudeCodeAdapter('fable', 'claude-fable-5'),
  sonnet: () => new ClaudeCodeAdapter('sonnet', 'claude-sonnet-5'),
  haiku: () => new ClaudeCodeAdapter('haiku', 'claude-haiku-4-5-20251001'),
};

export function buildAdapter(name: string): ExecutorAdapter {
  const factory = ADAPTER_FACTORIES[name];
  if (!factory) {
    throw new Error(`unknown executor '${name}' (known: ${Object.keys(ADAPTER_FACTORIES).sort().join(', ')})`);
  }
  return factory();
}
