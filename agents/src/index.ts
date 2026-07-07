/**
 * The five pipeline agents. Each is an AgentStage: a task type the router
 * maps to a model, a prompt builder over the run context, and (where the
 * governance rules demand it) an executable test gate.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { runTestGate, type AgentStage, type DeterministicResult, type RunContext } from '@legacy-migrator/core';

const GOVERNANCE = `Governance rules (non-negotiable):
1. Every code change must be paired with a passing test before being marked complete.
2. No behavior changes beyond what the migration requires — flag any ambiguous case in
   migration-log.md and preserve existing behavior exactly instead of guessing intent.
3. Log a one-line rationale for every non-trivial transformation decision to migration-log.md.
4. Never delete or edit anything under original/ — work in the parallel migrated/ directory.`;

/**
 * Reads the validationCommand recorded once testgen's gate passed. Migrate
 * and review both gate on this rather than assuming migrated/'s own
 * package.json defines a compatible test script — it may not, and nothing
 * forces a migrator agent to know that convention.
 */
function requireValidationCommand(ctx: RunContext, stage: string): { command: string; cwd: string } {
  if (!ctx.validationCommand) {
    throw new Error(
      `no validationCommand recorded for this run — the testgen stage must pass before ${stage} can be gated`,
    );
  }
  return ctx.validationCommand;
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
  // Recorded once the gate above passes: the ONE canonical command every
  // later stage uses to validate the migrated target. Deterministic pipeline
  // logic, not a convention an agent has to remember to wire into
  // migrated/'s own package.json.
  validationCommand: (ctx) => ({
    command: 'npm run test:migrated',
    cwd: `${ctx.runDir}/characterization`,
  }),
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
  gateCommand: (ctx) => requireValidationCommand(ctx, 'migrate'),
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
  gateCommand: (ctx) => requireValidationCommand(ctx, 'review'),
};

/** Per-lane regexes for patterns a completed migration must have zero remaining instances of. */
const LEGACY_PATTERNS: Record<string, { label: string; pattern: RegExp }[]> = {
  'class-react-to-hooks': [
    { label: 'extends React.Component / Component', pattern: /extends\s+(React\.)?Component\b/ },
    { label: 'connect(', pattern: /\bconnect\(/ },
    { label: 'this.setState', pattern: /this\.setState\b/ },
  ],
};

function walkSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkSourceFiles(full));
    else if (/\.jsx?$|\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function hasBuildScript(migratedDir: string): boolean {
  const pkgPath = join(migratedDir, 'package.json');
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return Boolean(pkg.scripts?.build);
  } catch {
    return false;
  }
}

function runValidation(ctx: RunContext): DeterministicResult {
  const lines: string[] = [`# Validate report — ${ctx.name}`, ''];
  let ok = true;

  lines.push('## 1. Final test-suite re-run (recorded validationCommand)');
  if (!ctx.validationCommand) {
    ok = false;
    lines.push('- **FAIL** — no validationCommand recorded for this run (testgen never passed)');
  } else {
    const result = runTestGate(ctx.validationCommand.command, ctx.validationCommand.cwd);
    lines.push(`- command: \`${ctx.validationCommand.command}\` (cwd: ${ctx.validationCommand.cwd})`);
    lines.push(`- **${result.ok ? 'PASS' : 'FAIL'}** — ${result.summary}`);
    if (!result.ok) ok = false;
  }
  lines.push('');

  lines.push('## 2. Production build');
  if (!hasBuildScript(ctx.migratedDir)) {
    lines.push('- **SKIP** — migrated/package.json defines no `build` script (not applicable)');
  } else {
    const build = runTestGate('npm run build', ctx.migratedDir);
    lines.push(`- command: \`npm run build\` (cwd: ${ctx.migratedDir})`);
    lines.push(`- **${build.ok ? 'PASS' : 'FAIL'}** — exit ${build.exitCode}`);
    if (!build.ok) ok = false;
  }
  lines.push('');

  lines.push('## 3. Legacy pattern sweep');
  const patterns = LEGACY_PATTERNS[ctx.lane];
  if (!patterns) {
    lines.push(`- **SKIP** — no legacy-pattern rules defined for lane \`${ctx.lane}\``);
  } else {
    const files = walkSourceFiles(ctx.migratedDir);
    for (const { label, pattern } of patterns) {
      const hits = files.filter((f) => pattern.test(readFileSync(f, 'utf8')));
      if (hits.length) {
        ok = false;
        const relative = hits.map((f) => f.replace(`${ctx.migratedDir}/`, ''));
        lines.push(`- **FAIL** — \`${label}\` still found in: ${relative.join(', ')}`);
      } else {
        lines.push(`- **PASS** — no \`${label}\` remaining`);
      }
    }
  }
  lines.push('', `## Result: ${ok ? 'PASS' : 'FAIL'}`);

  writeFileSync(join(ctx.runDir, 'validate-report.md'), `${lines.join('\n')}\n`);
  return {
    ok,
    notes: ok ? 'all checks passed — see validate-report.md' : 'one or more checks failed — see validate-report.md',
    costUsd: 0,
  };
}

/**
 * Mechanical final check — no model call. Re-runs the recorded
 * validationCommand, builds migrated/ if it has a build script, and sweeps
 * for lane-specific legacy patterns that must be fully gone.
 */
export const validator: AgentStage = {
  stage: 'validate',
  taskType: 'validate',
  runDeterministic: runValidation,
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
export const PIPELINE_AGENTS: AgentStage[] = [analyzer, testGenerator, migrator, reviewer, docWriter, validator];
