import { describe, expect, it } from 'vitest';

import { Router, type RunContext } from '@legacy-migrator/core';
import { PIPELINE_AGENTS, analyzer, docWriter, migrator, reviewer, testGenerator } from '../src/index.js';

const ctx: RunContext = {
  name: 'demo',
  repoUrl: 'https://github.com/x/demo',
  lane: 'class-react-to-hooks',
  runDir: '/runs/demo',
  originalDir: '/runs/demo/original',
  migratedDir: '/runs/demo/migrated',
};

describe('agent definitions', () => {
  it('covers the five pipeline stages in governance order', () => {
    expect(PIPELINE_AGENTS.map((a) => a.stage)).toEqual([
      'analyze',
      'testgen',
      'migrate',
      'review',
      'document',
    ]);
  });

  it('every agent task type has an explicit routing rule (no silent default)', () => {
    const router = new Router();
    for (const agent of PIPELINE_AGENTS) {
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

  it('embeds the governance rules and run paths in every prompt', () => {
    for (const agent of PIPELINE_AGENTS) {
      const prompt = agent.buildPrompt(ctx);
      expect(prompt).toContain('Governance rules');
      expect(prompt).toContain('/runs/demo');
    }
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
    const prompt = migrator.buildPrompt(ctx);
    expect(prompt).toContain('original');
    expect(prompt).toContain('/runs/demo/migrated');
    expect(prompt).toMatch(/Never delete or edit anything under original/);
  });
});
