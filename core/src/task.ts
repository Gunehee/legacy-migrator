/** Task contracts shared by every layer: pipeline, router, adapters, state. */

import { randomUUID } from 'node:crypto';

export type Effort = 'low' | 'medium' | 'high';

export interface TaskRequest {
  prompt: string;
  /** Routing key, e.g. "analyze" | "testgen" | "migrate" | "review" | "document". */
  taskType?: string;
  /** Working directory the executor runs in (the run directory for migrations). */
  cwd?: string;
  taskId: string;
  metadata?: Record<string, unknown>;
}

export function newTask(
  prompt: string,
  taskType?: string,
  cwd?: string,
  metadata?: Record<string, unknown>,
): TaskRequest {
  return { prompt, taskType, cwd, taskId: randomUUID(), metadata };
}

/** The uniform result shape every executor adapter must return. */
export interface TaskResult {
  taskId: string;
  executor: string;
  status: 'ok' | 'error';
  output: string;
  error?: string;
  latencyMs: number;
  costUsd?: number;
}
