import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AgentStage, RunContext } from '../src/pipeline.js';
import { Pipeline } from '../src/pipeline.js';
import type { ExecutorAdapter } from '../src/adapters.js';
import type { Effort, TaskRequest, TaskResult } from '../src/task.js';

class FakeAdapter implements ExecutorAdapter {
  calls: { prompt: string; effort: Effort }[] = [];
  constructor(
    readonly name: string,
    private readonly available = true,
    private readonly fail = false,
    private readonly costUsd?: number,
  ) {}
  isAvailable() {
    return this.available;
  }
  execute(task: TaskRequest, effort: Effort): TaskResult {
    this.calls.push({ prompt: task.prompt, effort });
    return {
      taskId: task.taskId,
      executor: this.name,
      status: this.fail ? 'error' : 'ok',
      output: 'done',
      error: this.fail ? 'boom' : undefined,
      costUsd: this.costUsd,
      latencyMs: 1,
    };
  }
}

const stage = (over: Partial<AgentStage> = {}): AgentStage => ({
  stage: 'analyze',
  taskType: 'analyze',
  buildPrompt: (ctx: RunContext) => `analyze ${ctx.originalDir}`,
  ...over,
});

describe('Pipeline', () => {
  let pipeline: Pipeline;
  let fable: FakeAdapter;
  let sonnet: FakeAdapter;
  let runsRoot: string;

  beforeEach(() => {
    fable = new FakeAdapter('fable');
    sonnet = new FakeAdapter('sonnet');
    runsRoot = mkdtempSync(join(tmpdir(), 'pipe-'));
    pipeline = new Pipeline({
      runsRoot,
      adapters: { fable, sonnet },
    });
  });

  it('routes a stage to the configured executor with the run context in the prompt', () => {
    const record = pipeline.store.create('demo', 'url', 'lane');
    const result = pipeline.runStage(record, stage());
    expect(result.status).toBe('ok');
    expect(fable.calls).toHaveLength(1);
    expect(fable.calls[0].effort).toBe('high');
    expect(fable.calls[0].prompt).toContain(join('demo', 'original'));
    expect(pipeline.store.load('demo').stages.find((s) => s.stage === 'analyze')).toMatchObject({
      status: 'passed',
      executor: 'fable',
    });
  });

  it('falls back to the fallback executor when the primary is unavailable', () => {
    const unavailable = new FakeAdapter('fable', false);
    const p = new Pipeline({
      runsRoot: mkdtempSync(join(tmpdir(), 'pipe-')),
      adapters: { fable: unavailable, sonnet },
      router: undefined,
    });
    // shipped ruleset has no fallback for analyze; simulate via a custom stage on default rule
    const record = p.store.create('demo', 'url', 'lane');
    const result = p.runStage(record, stage({ taskType: 'unknown-type' })); // default → sonnet
    expect(result.executor).toBe('sonnet');
  });

  it('fails the stage and records the gate when the test gate exits non-zero', () => {
    const record = pipeline.store.create('demo', 'url', 'lane');
    const result = pipeline.runStage(
      record,
      stage({ gateCommand: () => ({ command: 'node -e "process.exit(1)"', cwd: process.cwd() }) }),
    );
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/test gate failed/);
    const rec = pipeline.store.load('demo');
    expect(rec.stages.find((s) => s.stage === 'analyze')!.status).toBe('failed');
    expect(rec.testGates).toHaveLength(1);
    expect(rec.testGates[0].ok).toBe(false);
  });

  it('passes the stage when the gate exits 0 and logs the gate result', () => {
    const record = pipeline.store.create('demo', 'url', 'lane');
    const result = pipeline.runStage(
      record,
      stage({ gateCommand: () => ({ command: 'node -e "process.exit(0)"', cwd: process.cwd() }) }),
    );
    expect(result.status).toBe('ok');
    const rec = pipeline.store.load('demo');
    expect(rec.testGates[0].ok).toBe(true);
    expect(rec.stages.find((s) => s.stage === 'analyze')!.status).toBe('passed');
  });

  it('marks the stage failed when the executor errors', () => {
    const failing = new FakeAdapter('fable', true, true);
    const p = new Pipeline({
      runsRoot: mkdtempSync(join(tmpdir(), 'pipe-')),
      adapters: { fable: failing },
    });
    const record = p.store.create('demo', 'url', 'lane');
    const result = p.runStage(record, stage());
    expect(result.status).toBe('error');
    expect(p.store.load('demo').stages.find((s) => s.stage === 'analyze')!.status).toBe('failed');
  });

  it('persists costUsd onto the stage record and into costTotalUsd on success', () => {
    const costly = new FakeAdapter('fable', true, false, 0.42);
    const p = new Pipeline({ runsRoot: mkdtempSync(join(tmpdir(), 'pipe-')), adapters: { fable: costly } });
    const record = p.store.create('demo', 'url', 'lane');
    p.runStage(record, stage());
    const rec = p.store.load('demo');
    expect(rec.stages.find((s) => s.stage === 'analyze')!.costUsd).toBe(0.42);
    expect(rec.costTotalUsd).toBe(0.42);
  });

  it('persists costUsd even when the executor itself errors — a failed stage still spent tokens', () => {
    const costlyFailure = new FakeAdapter('fable', true, true, 0.17);
    const p = new Pipeline({ runsRoot: mkdtempSync(join(tmpdir(), 'pipe-')), adapters: { fable: costlyFailure } });
    const record = p.store.create('demo', 'url', 'lane');
    p.runStage(record, stage());
    const rec = p.store.load('demo');
    expect(rec.stages.find((s) => s.stage === 'analyze')!.costUsd).toBe(0.17);
    expect(rec.costTotalUsd).toBe(0.17);
  });

  it('persists the pre-gate costUsd when the stage fails on the test gate', () => {
    const costly = new FakeAdapter('fable', true, false, 0.05);
    const p = new Pipeline({ runsRoot: mkdtempSync(join(tmpdir(), 'pipe-')), adapters: { fable: costly } });
    const record = p.store.create('demo', 'url', 'lane');
    p.runStage(record, stage({ gateCommand: () => ({ command: 'node -e "process.exit(1)"', cwd: process.cwd() }) }));
    const rec = p.store.load('demo');
    expect(rec.stages.find((s) => s.stage === 'analyze')!.status).toBe('failed');
    expect(rec.stages.find((s) => s.stage === 'analyze')!.costUsd).toBe(0.05);
    expect(rec.costTotalUsd).toBe(0.05);
  });

  describe('validationCommand — later stages must not assume migrated/ has its own test script', () => {
    it('persists validationCommand only for a stage that declares the hook, once its own gate passes', () => {
      const record = pipeline.store.create('demo', 'url', 'lane');
      pipeline.runStage(
        record,
        stage({
          stage: 'testgen',
          taskType: 'testgen',
          gateCommand: () => ({ command: 'node -e "process.exit(0)"', cwd: process.cwd() }),
          validationCommand: (ctx) => ({ command: 'npm run test:migrated', cwd: `${ctx.runDir}/characterization` }),
        }),
      );
      const rec = pipeline.store.load('demo');
      expect(rec.validationCommand).toEqual({
        command: 'npm run test:migrated',
        cwd: join(runsRoot, 'demo', 'characterization'),
      });
    });

    it('does not persist a validationCommand for a stage that never declares the hook', () => {
      const record = pipeline.store.create('demo', 'url', 'lane');
      pipeline.runStage(record, stage());
      expect(pipeline.store.load('demo').validationCommand).toBeUndefined();
    });

    it(
      "regression: migrate's gate passes via the recorded validationCommand even though migrated/'s own " +
        'package.json has no test script at all — the exact bug this fix closes',
      () => {
        const record = pipeline.store.create('demo', 'url', 'lane');

        // testgen: real characterization/ dir with a real npm script that succeeds.
        const characterizationDir = join(runsRoot, 'demo', 'characterization');
        mkdirSync(characterizationDir, { recursive: true });
        writeFileSync(
          join(characterizationDir, 'package.json'),
          JSON.stringify({ name: 'characterization', scripts: { 'test:migrated': 'node -e "process.exit(0)"' } }),
        );
        pipeline.runStage(
          record,
          stage({
            stage: 'testgen',
            taskType: 'testgen',
            gateCommand: () => ({ command: 'node -e "process.exit(0)"', cwd: process.cwd() }),
            validationCommand: (ctx) => ({
              command: 'npm run test:migrated',
              cwd: `${ctx.runDir}/characterization`,
            }),
          }),
        );

        // migrate: migrated/ exists but deliberately has NO "test" script — only deps.
        const migratedDir = join(runsRoot, 'demo', 'migrated');
        mkdirSync(migratedDir, { recursive: true });
        writeFileSync(join(migratedDir, 'package.json'), JSON.stringify({ name: 'migrated', dependencies: {} }));

        const reloaded = pipeline.store.load('demo');
        const result = pipeline.runStage(
          reloaded,
          stage({
            stage: 'migrate',
            taskType: 'migrate',
            gateCommand: (ctx) => {
              if (!ctx.validationCommand) throw new Error('no validationCommand recorded');
              return ctx.validationCommand;
            },
          }),
        );

        expect(result.status).toBe('ok');
        expect(pipeline.store.load('demo').stages.find((s) => s.stage === 'migrate')!.status).toBe('passed');
      },
    );

    it('a gate that requires validationCommand throws a clear error if testgen never recorded one', () => {
      const record = pipeline.store.create('demo', 'url', 'lane');
      expect(() =>
        pipeline.runStage(
          record,
          stage({
            stage: 'migrate',
            taskType: 'migrate',
            gateCommand: (ctx) => {
              if (!ctx.validationCommand) throw new Error('no validationCommand recorded');
              return ctx.validationCommand;
            },
          }),
        ),
      ).toThrow(/no validationCommand recorded/);
    });
  });
});
