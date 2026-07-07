/**
 * File-backed run state. One JSON record per migration run at
 * runs/<name>/run-state.json — the durable log the governance rules require:
 * stage statuses, transformation-decision rationales, and test-gate results.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type StageName = 'select' | 'analyze' | 'testgen' | 'migrate' | 'review' | 'document' | 'validate';

export const STAGE_ORDER: StageName[] = [
  'select',
  'analyze',
  'testgen',
  'migrate',
  'review',
  'document',
  'validate',
];

export type StageStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface StageRecord {
  stage: StageName;
  status: StageStatus;
  startedAt?: string;
  finishedAt?: string;
  executor?: string;
  notes?: string;
  /** Set whenever the executor's JSON result envelope reports a cost — pass or fail. */
  costUsd?: number;
}

export interface Decision {
  ts: string;
  stage: StageName;
  rationale: string;
}

export interface TestGateRecord {
  ts: string;
  stage: StageName;
  command: string;
  cwd: string;
  ok: boolean;
  summary: string;
}

export interface RunRecord {
  name: string;
  repoUrl: string;
  lane: string;
  createdAt: string;
  stages: StageRecord[];
  decisions: Decision[];
  testGates: TestGateRecord[];
  /** Running total of every stage's costUsd recorded so far, pass or fail. */
  costTotalUsd?: number;
}

const now = () => new Date().toISOString();

export class RunStore {
  constructor(readonly runsRoot: string) {}

  private file(name: string): string {
    return join(this.runsRoot, name, 'run-state.json');
  }

  create(name: string, repoUrl: string, lane: string): RunRecord {
    const record: RunRecord = {
      name,
      repoUrl,
      lane,
      createdAt: now(),
      stages: STAGE_ORDER.map((stage) => ({ stage, status: 'pending' })),
      decisions: [],
      testGates: [],
    };
    this.save(record);
    return record;
  }

  save(record: RunRecord): void {
    mkdirSync(join(this.runsRoot, record.name), { recursive: true });
    writeFileSync(this.file(record.name), JSON.stringify(record, null, 2) + '\n');
  }

  load(name: string): RunRecord {
    if (!existsSync(this.file(name))) {
      throw new Error(`no run record for '${name}' under ${this.runsRoot}`);
    }
    return JSON.parse(readFileSync(this.file(name), 'utf8'));
  }

  list(): string[] {
    if (!existsSync(this.runsRoot)) return [];
    return readdirSync(this.runsRoot, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(this.file(e.name)))
      .map((e) => e.name)
      .sort();
  }

  setStage(name: string, stage: StageName, status: StageStatus, patch: Partial<StageRecord> = {}): RunRecord {
    const record = this.load(name);
    const entry = record.stages.find((s) => s.stage === stage);
    if (!entry) throw new Error(`unknown stage '${stage}'`);
    if (status === 'running') entry.startedAt = now();
    if (status === 'passed' || status === 'failed') entry.finishedAt = now();
    entry.status = status;
    Object.assign(entry, patch);
    // Cost accrues whether the stage passed or failed — a failed run still
    // spent tokens getting there, and the run record should reflect that.
    if (typeof patch.costUsd === 'number') {
      record.costTotalUsd = (record.costTotalUsd ?? 0) + patch.costUsd;
    }
    this.save(record);
    return record;
  }

  /** Governance rule 3: one-line rationale per non-trivial transformation decision. */
  logDecision(name: string, stage: StageName, rationale: string): RunRecord {
    const record = this.load(name);
    record.decisions.push({ ts: now(), stage, rationale });
    this.save(record);
    return record;
  }

  logTestGate(name: string, gate: Omit<TestGateRecord, 'ts'>): RunRecord {
    const record = this.load(name);
    record.testGates.push({ ts: now(), ...gate });
    this.save(record);
    return record;
  }
}
