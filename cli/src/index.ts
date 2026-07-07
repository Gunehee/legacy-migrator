#!/usr/bin/env node
/**
 * legacy-migrator CLI.
 *
 *   legacy-migrator run --repo <github-url> [--lane <lane>] [--name <run-name>]
 *   legacy-migrator status [run-name]
 *
 * `run` executes the full pipeline (clone → analyze → testgen → migrate →
 * review → document), gating each stage per the governance rules. `status`
 * renders run state from core's RunStore.
 */

import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { Pipeline, RunStore, type RunRecord } from '@legacy-migrator/core';
import { PIPELINE_AGENTS } from '@legacy-migrator/agents';

export const DEFAULT_RUNS_ROOT = join(process.cwd(), 'runs');

export function repoNameFromUrl(url: string): string {
  const m = url.replace(/\.git$/, '').match(/([^/]+)\/?$/);
  if (!m) throw new Error(`cannot derive run name from repo url: ${url}`);
  return m[1];
}

export function renderStatus(record: RunRecord): string {
  const lines = [
    `run: ${record.name}   lane: ${record.lane}`,
    `repo: ${record.repoUrl}`,
    `created: ${record.createdAt}`,
    '',
    'stage      status    executor  notes',
  ];
  for (const s of record.stages) {
    lines.push(
      `${s.stage.padEnd(10)} ${s.status.padEnd(9)} ${(s.executor ?? '-').padEnd(9)} ${s.notes ?? ''}`.trimEnd(),
    );
  }
  if (record.testGates.length) {
    lines.push('', 'test gates:');
    for (const g of record.testGates) {
      lines.push(`  [${g.ok ? 'PASS' : 'FAIL'}] ${g.stage}: ${g.command} → ${g.summary}`);
    }
  }
  if (record.decisions.length) {
    lines.push('', `decisions logged: ${record.decisions.length} (see run-state.json)`);
  }
  return lines.join('\n');
}

export function runCommand(repoUrl: string, lane: string, name: string | undefined, runsRoot: string): void {
  const pipeline = new Pipeline({ runsRoot, log: (l) => console.log(l) });
  const runName = name ?? repoNameFromUrl(repoUrl);
  let record: RunRecord;
  try {
    record = pipeline.store.load(runName);
    console.log(`resuming run '${runName}'`);
  } catch {
    record = pipeline.store.create(runName, repoUrl, lane);
    console.log(`created run '${runName}'`);
  }

  pipeline.select(record);
  for (const agent of PIPELINE_AGENTS) {
    record = pipeline.store.load(runName);
    const existing = record.stages.find((s) => s.stage === agent.stage);
    if (existing?.status === 'passed') {
      console.log(`[${agent.stage}] already passed — skipping`);
      continue;
    }
    const result = pipeline.runStage(record, agent);
    if (result.status !== 'ok') {
      console.error(`[${agent.stage}] FAILED: ${result.error}`);
      console.error(`fix and re-run; the pipeline resumes from the failed stage.`);
      process.exitCode = 1;
      return;
    }
    console.log(`[${agent.stage}] passed`);
  }
  console.log(renderStatus(pipeline.store.load(runName)));
}

export function statusCommand(name: string | undefined, runsRoot: string): void {
  const store = new RunStore(runsRoot);
  const names = name ? [name] : store.list();
  if (!names.length) {
    console.log(`no runs found under ${runsRoot}`);
    return;
  }
  for (const n of names) console.log(renderStatus(store.load(n)) + '\n');
}

export function main(argv = process.argv.slice(2)): void {
  const [command, ...rest] = argv;
  if (command === 'run') {
    const { values } = parseArgs({
      args: rest,
      options: {
        repo: { type: 'string' },
        lane: { type: 'string', default: 'class-react-to-hooks' },
        name: { type: 'string' },
        'runs-root': { type: 'string', default: DEFAULT_RUNS_ROOT },
      },
    });
    if (!values.repo) {
      console.error('usage: legacy-migrator run --repo <github-url> [--lane <lane>] [--name <run-name>]');
      process.exitCode = 2;
      return;
    }
    runCommand(values.repo, values.lane!, values.name, values['runs-root']!);
  } else if (command === 'status') {
    const { values, positionals } = parseArgs({
      args: rest,
      options: { 'runs-root': { type: 'string', default: DEFAULT_RUNS_ROOT } },
      allowPositionals: true,
    });
    statusCommand(positionals[0], values['runs-root']!);
  } else {
    console.error('usage: legacy-migrator <run|status> [options]');
    process.exitCode = 2;
  }
}

// Only run when invoked as a binary, not when imported by tests. Compares
// resolved real paths (not raw import.meta.url vs argv[1]) so this still
// matches when the binary is reached through a symlink, as npm link and
// npm install -g both do for every globally installed CLI.
const isMain = (() => {
  try {
    return fileURLToPath(import.meta.url) === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}
