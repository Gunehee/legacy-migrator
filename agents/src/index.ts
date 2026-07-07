/**
 * The five pipeline agents. Each is an AgentStage: a task type the router
 * maps to a model, a prompt builder over the run context, and (where the
 * governance rules demand it) an executable test gate.
 */

import type { AgentStage, RunContext } from '@legacy-migrator/core';

const GOVERNANCE = `Governance rules (non-negotiable):
1. Every code change must be paired with a passing test before being marked complete.
2. No behavior changes beyond what the migration requires — flag any ambiguous case in
   migration-log.md and preserve existing behavior exactly instead of guessing intent.
3. Log a one-line rationale for every non-trivial transformation decision to migration-log.md.
4. Never delete or edit anything under original/ — work in the parallel migrated/ directory.`;

/** The characterization/existing suite for a run; agents write it, gates run it. */
export function testCommand(ctx: RunContext): { command: string; cwd: string } {
  return { command: 'npm test', cwd: ctx.migratedDir };
}

export const analyzer: AgentStage = {
  stage: 'analyze',
  taskType: 'analyze',
  buildPrompt: (ctx) => `You are the ANALYZER agent for a legacy-code migration.
${GOVERNANCE}

Read the full legacy codebase at ${ctx.originalDir} (lane: ${ctx.lane}).
Produce ${ctx.runDir}/migration-plan.md containing:
- Architecture map: modules, dependencies, entry points.
- Legacy patterns found and their modern equivalents.
- Risk areas: global state, implicit type coercion, callback pyramids, anything fragile.
- Ordered migration sequence (what to convert first so nothing breaks mid-way).
- A characterization-test plan for any area lacking existing test coverage.
Do not modify any source file.`,
};

export const testGenerator: AgentStage = {
  stage: 'testgen',
  taskType: 'testgen',
  buildPrompt: (ctx) => `You are the TEST-GENERATOR agent for a legacy-code migration.
${GOVERNANCE}

Following the characterization-test plan in ${ctx.runDir}/migration-plan.md, write
golden-master characterization tests under ${ctx.runDir}/characterization/ that capture
the CURRENT observable behavior of the code in ${ctx.originalDir} (inputs → outputs, key
user flows, edge cases visible in code). The tests must run against the ORIGINAL code and
pass there before any migration starts — they are the safety net, not new feature tests.`,
  gateCommand: (ctx) => ({ command: 'npm test', cwd: `${ctx.runDir}/characterization` }),
};

export const migrator: AgentStage = {
  stage: 'migrate',
  taskType: 'migrate',
  buildPrompt: (ctx) => `You are the MIGRATOR agent for a legacy-code migration.
${GOVERNANCE}

Execute the sequence in ${ctx.runDir}/migration-plan.md module by module, migrating
${ctx.originalDir} into the parallel directory ${ctx.migratedDir} (lane: ${ctx.lane}).
After each module run the full test suite (existing + characterization); if anything
fails, fix it before the next module — never proceed in a known-broken state.
Keep a running log in ${ctx.runDir}/migration-log.md: what changed, why, test status.`,
  gateCommand: testCommand,
};

export const reviewer: AgentStage = {
  stage: 'review',
  taskType: 'review',
  buildPrompt: (ctx) => `You are the REVIEWER agent for a completed legacy-code migration.
${GOVERNANCE}

The migration in ${ctx.migratedDir} passes all tests. Do a full read-through pass for code
quality: idiomatic modern patterns, no leftover dead code, no lingering legacy shims unless
necessary. Write a short review report to ${ctx.runDir}/review-report.md with any remaining
follow-ups. Only fix issues that keep the suite green; log rationale for each fix.`,
  gateCommand: testCommand,
};

export const docWriter: AgentStage = {
  stage: 'document',
  taskType: 'document',
  buildPrompt: (ctx) => `You are the DOC-WRITER agent for a completed legacy-code migration.
${GOVERNANCE}

Using ${ctx.runDir}/migration-plan.md, migration-log.md and review-report.md, produce:
- ${ctx.runDir}/README.md — technical summary: before/after architecture, test coverage
  delta, what was migrated and how.
- ${ctx.runDir}/one-pager.md — a client-facing one-pager IN KOREAN: plain-language summary
  of the migration, time taken, before/after comparison, suitable to send to a dev agency
  or startup as a capability demonstration.
Do not modify any code.`,
};

/** Stage order the CLI executes for a full run (select is handled by the pipeline). */
export const PIPELINE_AGENTS: AgentStage[] = [analyzer, testGenerator, migrator, reviewer, docWriter];
