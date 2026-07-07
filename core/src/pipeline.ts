/**
 * Pipeline: classify → route → execute → gate → record, once per stage.
 *
 * The pipeline owns sequencing and the governance gates; what each stage
 * actually asks its executor to do comes from the injected agent definitions
 * (see @legacy-migrator/agents), so agents can evolve without core changes.
 */

import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildAdapter, type ExecutorAdapter } from './adapters.js';
import { runTestGate } from './eval.js';
import { Router } from './router.js';
import { newTask, type TaskResult } from './task.js';
import { RunStore, type RunRecord, type StageName } from './state.js';

/** Outcome of a deterministic (non-model) stage — see AgentStage.runDeterministic. */
export interface DeterministicResult {
  ok: boolean;
  /** Persisted as the stage's `notes`. */
  notes: string;
  /** Usually 0 — deterministic stages don't call a model unless they choose to. */
  costUsd?: number;
}

/** One pipeline stage as the agents package defines it. */
export interface AgentStage {
  stage: StageName;
  taskType: string;
  /** Build the executor prompt from the run context. Omit for deterministic stages. */
  buildPrompt?(ctx: RunContext): string;
  /**
   * Command that must exit 0 in `gateCwd` before the stage may pass
   * (governance rule 1). Stages without an executable gate omit it.
   */
  gateCommand?(ctx: RunContext): { command: string; cwd: string } | undefined;
  /**
   * Called once this stage's own gate passes; the result is persisted to the
   * run record as `validationCommand` — the canonical, pipeline-known way
   * later stages verify the migrated target. This lets e.g. `migrate`'s gate
   * read a recorded command instead of assuming `migrated/`'s own
   * package.json defines a compatible script (it may not — nothing forces a
   * migrator agent to know that convention).
   */
  validationCommand?(ctx: RunContext): { command: string; cwd: string } | undefined;
  /**
   * When present, this stage runs entirely deterministically: no router
   * lookup, no adapter, no model call. Used for mechanical final checks
   * (e.g. validate) that don't need an LLM to decide anything. Takes over
   * the whole stage — gateCommand/validationCommand are ignored if also set.
   */
  runDeterministic?(ctx: RunContext): DeterministicResult;
}

export interface RunContext {
  name: string;
  repoUrl: string;
  lane: string;
  runDir: string; //      runs/<name>
  originalDir: string; // runs/<name>/original
  migratedDir: string; // runs/<name>/migrated
  /** Set once testgen's gate has passed and recorded one; undefined before then. */
  validationCommand?: { command: string; cwd: string };
}

export interface PipelineOptions {
  runsRoot: string;
  router?: Router;
  adapters?: Record<string, ExecutorAdapter>;
  log?: (line: string) => void;
}

export class Pipeline {
  readonly store: RunStore;
  private readonly router: Router;
  private readonly adapters: Record<string, ExecutorAdapter>;
  private readonly log: (line: string) => void;

  constructor(opts: PipelineOptions) {
    this.store = new RunStore(opts.runsRoot);
    this.router = opts.router ?? new Router();
    this.adapters = { ...(opts.adapters ?? {}) };
    this.log = opts.log ?? (() => {});
  }

  context(record: RunRecord): RunContext {
    const runDir = join(this.store.runsRoot, record.name);
    return {
      name: record.name,
      repoUrl: record.repoUrl,
      lane: record.lane,
      runDir,
      originalDir: join(runDir, 'original'),
      migratedDir: join(runDir, 'migrated'),
      validationCommand: record.validationCommand,
    };
  }

  /** Stage "select": clone the target into runs/<name>/original (idempotent). */
  select(record: RunRecord): void {
    const ctx = this.context(record);
    this.store.setStage(record.name, 'select', 'running');
    if (!existsSync(ctx.originalDir)) {
      const clone = spawnSync('git', ['clone', '--quiet', record.repoUrl, ctx.originalDir], {
        encoding: 'utf8',
      });
      if (clone.status !== 0) {
        this.store.setStage(record.name, 'select', 'failed', { notes: clone.stderr?.slice(0, 500) });
        throw new Error(`clone failed: ${clone.stderr}`);
      }
    }
    this.store.setStage(record.name, 'select', 'passed', { notes: ctx.originalDir });
  }

  /** Run one agent stage: route by task type, execute, apply the test gate. */
  runStage(record: RunRecord, stage: AgentStage): TaskResult {
    const ctx = this.context(record);

    if (stage.runDeterministic) {
      return this.runDeterministicStage(record, stage, ctx);
    }

    const decision = this.router.route(stage.taskType);
    const adapter = this.resolveAdapter(decision.executor, decision.fallback);
    this.store.setStage(record.name, stage.stage, 'running', { executor: adapter.name });
    this.log(`[${stage.stage}] → ${adapter.name} (${decision.effort}, rule ${decision.matchedRule})`);

    const task = newTask(stage.buildPrompt!(ctx), stage.taskType, ctx.runDir);
    const result = adapter.execute(task, decision.effort);
    if (result.status !== 'ok') {
      this.store.setStage(record.name, stage.stage, 'failed', { notes: result.error, costUsd: result.costUsd });
      return result;
    }

    const gate = stage.gateCommand?.(ctx);
    if (gate) {
      const gateResult = runTestGate(gate.command, gate.cwd);
      this.store.logTestGate(record.name, {
        stage: stage.stage,
        command: gate.command,
        cwd: gate.cwd,
        ok: gateResult.ok,
        summary: gateResult.summary,
      });
      if (!gateResult.ok) {
        this.store.setStage(record.name, stage.stage, 'failed', {
          notes: `gate failed: ${gateResult.summary}`,
          costUsd: result.costUsd,
        });
        return { ...result, status: 'error', error: `test gate failed: ${gateResult.summary}` };
      }
    }

    const validationCommand = stage.validationCommand?.(ctx);
    if (validationCommand) {
      this.store.setValidationCommand(record.name, validationCommand);
    }

    this.store.setStage(record.name, stage.stage, 'passed', { costUsd: result.costUsd });
    return result;
  }

  /** No router, no adapter, no model call — just run the stage's own check logic. */
  private runDeterministicStage(record: RunRecord, stage: AgentStage, ctx: RunContext): TaskResult {
    this.store.setStage(record.name, stage.stage, 'running', { executor: 'deterministic' });
    this.log(`[${stage.stage}] → deterministic (no model call)`);

    const outcome = stage.runDeterministic!(ctx);
    const taskId = randomUUID();
    this.store.setStage(record.name, stage.stage, outcome.ok ? 'passed' : 'failed', {
      notes: outcome.notes,
      costUsd: outcome.costUsd,
    });
    return {
      taskId,
      executor: 'deterministic',
      status: outcome.ok ? 'ok' : 'error',
      output: outcome.notes,
      error: outcome.ok ? undefined : outcome.notes,
      costUsd: outcome.costUsd,
      latencyMs: 0,
    };
  }

  private resolveAdapter(executor: string, fallback?: string): ExecutorAdapter {
    const primary = this.getAdapter(executor);
    if (!primary.isAvailable() && fallback) return this.getAdapter(fallback);
    return primary;
  }

  private getAdapter(name: string): ExecutorAdapter {
    if (!this.adapters[name]) this.adapters[name] = buildAdapter(name);
    return this.adapters[name];
  }
}
