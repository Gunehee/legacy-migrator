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
    if (proc.error || proc.status !== 0) {
      return {
        taskId: task.taskId,
        executor: this.name,
        status: 'error',
        output: proc.stdout ?? '',
        error: proc.error ? String(proc.error) : `exit ${proc.status}: ${proc.stderr?.slice(0, 2000)}`,
        latencyMs,
      };
    }
    let output = proc.stdout;
    let costUsd: number | undefined;
    try {
      const parsed = JSON.parse(proc.stdout);
      output = parsed.result ?? proc.stdout;
      costUsd = parsed.total_cost_usd;
    } catch {
      // non-JSON output (older CLI): keep raw stdout
    }
    return { taskId: task.taskId, executor: this.name, status: 'ok', output, costUsd, latencyMs };
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
