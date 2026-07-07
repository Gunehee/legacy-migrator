import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Router, type RunContext } from '@legacy-migrator/core';
import { PIPELINE_AGENTS, analyzer, docWriter, migrator, reviewer, testGenerator, validator } from '../src/index.js';

const ctx: RunContext = {
  name: 'demo',
  repoUrl: 'https://github.com/x/demo',
  lane: 'class-react-to-hooks',
  runDir: '/runs/demo',
  originalDir: '/runs/demo/original',
  migratedDir: '/runs/demo/migrated',
};

const modelDrivenAgents = [analyzer, testGenerator, migrator, reviewer, docWriter];

describe('agent definitions', () => {
  it('covers the six pipeline stages in governance order', () => {
    expect(PIPELINE_AGENTS.map((a) => a.stage)).toEqual([
      'analyze',
      'testgen',
      'migrate',
      'review',
      'document',
      'validate',
    ]);
  });

  it('every model-driven agent task type has an explicit routing rule (no silent default)', () => {
    const router = new Router();
    for (const agent of modelDrivenAgents) {
      expect(router.route(agent.taskType).matchedRule).toBe(`task_types.${agent.taskType}`);
    }
  });

  it('routes deep-reasoning stages to fable, structured stages to sonnet, docs to haiku', () => {
    const router = new Router();
    expect(router.route(analyzer.taskType).executor).toBe('fable');
    expect(router.route(migrator.taskType).executor).toBe('fable');
    expect(router.route(testGenerator.taskType).executor).toBe('sonnet');
    expect(router.route(reviewer.taskType).executor).toBe('sonnet');
    expect(router.route(docWriter.taskType).executor).toBe('haiku');
  });

  it('embeds the governance rules and run paths in every model-driven prompt', () => {
    for (const agent of modelDrivenAgents) {
      const prompt = agent.buildPrompt!(ctx);
      expect(prompt).toContain('Governance rules');
      expect(prompt).toContain('/runs/demo');
    }
  });

  it('validate is fully deterministic: no prompt, no router-mapped executor, no generic gate hooks', () => {
    expect(validator.buildPrompt).toBeUndefined();
    expect(validator.gateCommand).toBeUndefined();
    expect(validator.validationCommand).toBeUndefined();
    expect(validator.runDeterministic).toBeTypeOf('function');
  });

  it('gates testgen on the characterization suite against original', () => {
    expect(testGenerator.gateCommand!(ctx)).toEqual({
      command: 'npm test',
      cwd: '/runs/demo/characterization',
    });
    expect(analyzer.gateCommand).toBeUndefined();
    expect(docWriter.gateCommand).toBeUndefined();
  });

  it('records the canonical validationCommand once testgen passes, pointed at the characterization suite', () => {
    expect(testGenerator.validationCommand!(ctx)).toEqual({
      command: 'npm run test:migrated',
      cwd: '/runs/demo/characterization',
    });
    expect(migrator.validationCommand).toBeUndefined();
    expect(reviewer.validationCommand).toBeUndefined();
  });

  it("migrate/review gate on the recorded validationCommand, not on migrated/'s own package.json", () => {
    const withCommand: RunContext = {
      ...ctx,
      validationCommand: { command: 'npm run test:migrated', cwd: '/runs/demo/characterization' },
    };
    expect(migrator.gateCommand!(withCommand)).toEqual({
      command: 'npm run test:migrated',
      cwd: '/runs/demo/characterization',
    });
    expect(reviewer.gateCommand!(withCommand)).toEqual({
      command: 'npm run test:migrated',
      cwd: '/runs/demo/characterization',
    });
  });

  it('migrate/review gates throw a clear error when no validationCommand was ever recorded', () => {
    expect(() => migrator.gateCommand!(ctx)).toThrow(/no validationCommand recorded/);
    expect(() => reviewer.gateCommand!(ctx)).toThrow(/no validationCommand recorded/);
  });

  it('keeps original/ immutable and migrated/ as the work area in the migrator prompt', () => {
    const prompt = migrator.buildPrompt!(ctx);
    expect(prompt).toContain('original');
    expect(prompt).toContain('/runs/demo/migrated');
    expect(prompt).toMatch(/Never delete or edit anything under original/);
  });
});

describe('validate stage — runDeterministic checks', () => {
  function setupRun(over: { migratedPkg?: object; migratedFiles?: Record<string, string> } = {}) {
    const runDir = mkdtempSync(join(tmpdir(), 'validate-'));
    const characterizationDir = join(runDir, 'characterization');
    const migratedDir = join(runDir, 'migrated');
    mkdirSync(characterizationDir, { recursive: true });
    mkdirSync(migratedDir, { recursive: true });

    writeFileSync(
      join(characterizationDir, 'package.json'),
      JSON.stringify({ name: 'characterization', scripts: { 'test:migrated': 'node -e "process.exit(0)"' } }),
    );
    writeFileSync(
      join(migratedDir, 'package.json'),
      JSON.stringify(over.migratedPkg ?? { name: 'migrated', dependencies: {} }),
    );
    for (const [name, content] of Object.entries(over.migratedFiles ?? { 'src/App.js': 'const App = () => null;\nexport default App;\n' })) {
      const full = join(migratedDir, name);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content);
    }

    const runCtx: RunContext = {
      name: 'validate-fixture',
      repoUrl: 'https://github.com/x/demo',
      lane: 'class-react-to-hooks',
      runDir,
      originalDir: join(runDir, 'original'),
      migratedDir,
      validationCommand: { command: 'npm run test:migrated', cwd: characterizationDir },
    };
    return { runDir, runCtx };
  }

  it('passes cleanly when the recorded validationCommand succeeds and no legacy patterns remain', () => {
    const { runCtx } = setupRun();
    const result = validator.runDeterministic!(runCtx);
    expect(result.ok).toBe(true);
    expect(result.costUsd).toBe(0);
  });

  it('skips the build check when migrated/package.json defines no build script, without failing the stage', () => {
    const { runDir, runCtx } = setupRun();
    const result = validator.runDeterministic!(runCtx);
    expect(result.ok).toBe(true);
    const report = readFileSync(join(runDir, 'validate-report.md'), 'utf8');
    expect(report).toContain('SKIP');
    expect(report).toContain('no `build` script');
  });

  it('regression: reports FAIL (not a false pass) when migrated/src still has a legacy connect() call', () => {
    const { runDir, runCtx } = setupRun({
      migratedFiles: {
        'src/App.js': 'const App = () => null;\nexport default App;\n',
        'src/Old.js':
          "import { connect } from 'react-redux';\nclass Old extends React.Component {}\nexport default connect(() => ({}))(Old);\n",
      },
    });
    const result = validator.runDeterministic!(runCtx);
    expect(result.ok).toBe(false);
    const report = readFileSync(join(runDir, 'validate-report.md'), 'utf8');
    expect(report).toContain('FAIL');
    expect(report).toContain('connect(');
    expect(report).toContain('src/Old.js');
    expect(report).toContain('## Result: FAIL');
  });

  it('fails when no validationCommand was ever recorded, rather than silently skipping the final check', () => {
    const { runCtx } = setupRun();
    const withoutCommand: RunContext = { ...runCtx, validationCommand: undefined };
    const result = validator.runDeterministic!(withoutCommand);
    expect(result.ok).toBe(false);
    expect(result.notes).toMatch(/checks failed/);
  });

  it('fails when the recorded validationCommand itself fails', () => {
    const { runCtx } = setupRun();
    const broken: RunContext = {
      ...runCtx,
      validationCommand: { command: 'node -e "process.exit(1)"', cwd: runCtx.runDir },
    };
    const result = validator.runDeterministic!(broken);
    expect(result.ok).toBe(false);
  });

  it('runs and requires a passing build when migrated/package.json defines one', () => {
    const { runDir, runCtx } = setupRun({ migratedPkg: { name: 'migrated', scripts: { build: 'node -e "process.exit(1)"' } } });
    const result = validator.runDeterministic!(runCtx);
    expect(result.ok).toBe(false);
    const report = readFileSync(join(runDir, 'validate-report.md'), 'utf8');
    expect(report).toContain('## 2. Production build');
    expect(report).toMatch(/FAIL.*exit 1/);
  });
});
