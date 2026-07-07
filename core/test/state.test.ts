import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { RunStore, STAGE_ORDER } from '../src/state.js';

describe('RunStore', () => {
  let store: RunStore;

  beforeEach(() => {
    store = new RunStore(mkdtempSync(join(tmpdir(), 'runs-')));
  });

  it('creates a run with all stages pending and round-trips it', () => {
    store.create('demo', 'https://example.com/demo.git', 'class-react-to-hooks');
    const loaded = store.load('demo');
    expect(loaded.stages.map((s) => s.stage)).toEqual(STAGE_ORDER);
    expect(loaded.stages.every((s) => s.status === 'pending')).toBe(true);
    expect(loaded.lane).toBe('class-react-to-hooks');
  });

  it('tracks stage transitions with timestamps', () => {
    store.create('demo', 'url', 'lane');
    store.setStage('demo', 'analyze', 'running');
    let rec = store.load('demo');
    expect(rec.stages.find((s) => s.stage === 'analyze')).toMatchObject({ status: 'running' });
    expect(rec.stages.find((s) => s.stage === 'analyze')!.startedAt).toBeTruthy();

    store.setStage('demo', 'analyze', 'passed', { executor: 'fable' });
    rec = store.load('demo');
    const analyze = rec.stages.find((s) => s.stage === 'analyze')!;
    expect(analyze).toMatchObject({ status: 'passed', executor: 'fable' });
    expect(analyze.finishedAt).toBeTruthy();
  });

  it('appends decisions and test gates to the run record', () => {
    store.create('demo', 'url', 'lane');
    store.logDecision('demo', 'migrate', 'kept superagent: HTTP layer is out of lane scope');
    store.logTestGate('demo', {
      stage: 'migrate',
      command: 'npm test',
      cwd: '/x',
      ok: true,
      summary: '12 passed',
    });
    const rec = store.load('demo');
    expect(rec.decisions).toHaveLength(1);
    expect(rec.decisions[0].rationale).toMatch(/superagent/);
    expect(rec.testGates[0]).toMatchObject({ ok: true, stage: 'migrate' });
  });

  it('lists only directories containing run records, and errors on missing runs', () => {
    store.create('a', 'url', 'lane');
    store.create('b', 'url', 'lane');
    expect(store.list()).toEqual(['a', 'b']);
    expect(() => store.load('missing')).toThrow(/no run record/);
    expect(() => store.setStage('a', 'bogus' as never, 'passed')).toThrow(/unknown stage/);
  });

  it('accumulates costUsd into a running costTotalUsd across stages, pass or fail', () => {
    store.create('demo', 'url', 'lane');
    store.setStage('demo', 'analyze', 'passed', { costUsd: 0.5 });
    expect(store.load('demo').costTotalUsd).toBe(0.5);

    // a failed stage still spent tokens — it must still count
    store.setStage('demo', 'migrate', 'failed', { costUsd: 0.25 });
    expect(store.load('demo').costTotalUsd).toBe(0.75);

    // stages with no cost info (e.g. costUsd absent) leave the total unchanged
    store.setStage('demo', 'testgen', 'passed', {});
    expect(store.load('demo').costTotalUsd).toBe(0.75);

    const analyze = store.load('demo').stages.find((s) => s.stage === 'analyze')!;
    const migrate = store.load('demo').stages.find((s) => s.stage === 'migrate')!;
    expect(analyze.costUsd).toBe(0.5);
    expect(migrate.costUsd).toBe(0.25);
  });

  it('starts a fresh run with no costTotalUsd until a stage reports one', () => {
    store.create('demo', 'url', 'lane');
    expect(store.load('demo').costTotalUsd).toBeUndefined();
  });
});
