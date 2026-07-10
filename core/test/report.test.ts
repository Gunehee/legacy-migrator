import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { generateReport } from '../src/report.js';
import type { RunRecord } from '../src/state.js';

function baseRecord(over: Partial<RunRecord> = {}): RunRecord {
  return {
    name: 'demo-app',
    repoUrl: 'https://github.com/x/demo-app',
    lane: 'class-react-to-hooks',
    createdAt: '2026-07-10T00:00:00.000Z',
    stages: [
      { stage: 'select', status: 'passed' },
      {
        stage: 'analyze',
        status: 'passed',
        executor: 'fable',
        startedAt: '2026-07-10T00:00:00.000Z',
        finishedAt: '2026-07-10T00:01:00.000Z',
        costUsd: 0.5,
      },
      {
        stage: 'testgen',
        status: 'passed',
        executor: 'sonnet',
        startedAt: '2026-07-10T00:01:00.000Z',
        finishedAt: '2026-07-10T00:03:00.000Z',
        costUsd: 1.25,
      },
      {
        stage: 'migrate',
        status: 'passed',
        executor: 'fable',
        startedAt: '2026-07-10T00:03:00.000Z',
        finishedAt: '2026-07-10T00:04:30.000Z',
        costUsd: 2.0,
      },
      {
        stage: 'review',
        status: 'passed',
        executor: 'sonnet',
        startedAt: '2026-07-10T00:04:30.000Z',
        finishedAt: '2026-07-10T00:05:00.000Z',
        costUsd: 0.25,
      },
      {
        stage: 'document',
        status: 'passed',
        executor: 'haiku',
        startedAt: '2026-07-10T00:05:00.000Z',
        finishedAt: '2026-07-10T00:05:10.000Z',
        costUsd: 0.05,
      },
      {
        stage: 'validate',
        status: 'passed',
        executor: 'deterministic',
        startedAt: '2026-07-10T00:05:10.000Z',
        finishedAt: '2026-07-10T00:05:12.000Z',
        costUsd: 0,
      },
    ],
    decisions: [{ ts: '2026-07-10T00:01:00.000Z', stage: 'migrate', rationale: 'kept the legacy action shape' }],
    testGates: [
      { ts: '2026-07-10T00:02:00.000Z', stage: 'testgen', command: 'npm test', cwd: 'x', ok: true, summary: 'Tests 12 passed (12)' },
    ],
    costTotalUsd: 4.05,
    validationCommand: { command: 'npm run test:migrated', cwd: '/x/characterization' },
    ...over,
  };
}

describe('generateReport', () => {
  let runDir: string;

  beforeEach(() => {
    runDir = mkdtempSync(join(tmpdir(), 'report-'));
    mkdirSync(join(runDir, 'original', 'src'), { recursive: true });
    mkdirSync(join(runDir, 'migrated', 'src'), { recursive: true });
  });

  function write(record: RunRecord, files: Record<string, string> = {}) {
    writeFileSync(join(runDir, 'run-state.json'), JSON.stringify(record, null, 2));
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(runDir, name), content);
    }
  }

  it('embeds header, cost, and wall-clock figures', () => {
    write(baseRecord());
    const path = generateReport(runDir);
    const html = readFileSync(path, 'utf8');
    expect(html).toContain('demo-app');
    expect(html).toContain('class-react-to-hooks');
    expect(html).toContain('https://github.com/x/demo-app');
    expect(html).toContain('$4.0500'); // costTotalUsd
    expect(html).toContain('5m12s'); // sum of stage durations: 60+120+90+30+10+2 = 312s
  });

  it('renders all 6 stages with executor, status class, and per-stage cost', () => {
    write(baseRecord());
    const html = readFileSync(generateReport(runDir), 'utf8');
    // stage names render lowercase in the DOM; CSS text-transform:capitalize
    // handles the visual casing, so assert on the actual text content.
    for (const stage of ['analyze', 'testgen', 'migrate', 'review', 'document', 'validate']) {
      expect(html).toContain(`>${stage}</div>`);
    }
    expect(html).toContain('$0.5000');
    expect(html).toContain('$2.0000');
    expect(html).toContain('class="step pass"');
  });

  it('marks a failed stage with the fail class, not pass', () => {
    const record = baseRecord();
    record.stages.find((s) => s.stage === 'migrate')!.status = 'failed';
    write(record);
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('class="step fail"');
  });

  it('shows the X/X passing badge when original and migrated both fully pass and match', () => {
    write(baseRecord(), {
      'validate-report.md': [
        '# Validate report — demo-app',
        '',
        '## 1. Final test-suite re-run (recorded validationCommand)',
        '- **PASS** — Tests 12 passed (12)',
        '',
        '## 3. Legacy pattern sweep',
        '- **PASS** — no `connect(` remaining',
      ].join('\n'),
    });
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('12/12 passing on both original and migrated');
    expect(html).toContain('banner good');
  });

  it('flags a failing migrated re-run with the critical banner, not a silent omission', () => {
    write(baseRecord(), {
      'validate-report.md': [
        '# Validate report — demo-app',
        '',
        '## 1. Final test-suite re-run (recorded validationCommand)',
        '- **FAIL** — Tests 9 passed, 3 failed (12)',
      ].join('\n'),
    });
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('migrated: 9/12');
    expect(html).toContain('banner crit');
  });

  it('renders concrete pattern-removal counts from the legacy-pattern sweep', () => {
    write(baseRecord(), {
      'validate-report.md': [
        '## 3. Legacy pattern sweep',
        '- **PASS** — no `connect(` remaining',
        '- **FAIL** — `extends React.Component / Component` still found in: src/Old.js',
      ].join('\n'),
    });
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('0 remaining <code>connect(</code> calls');
    expect(html).toContain('1 file(s) still contain <code>extends React.Component / Component</code>');
  });

  it('computes before/after file and line counts from a real git diff between original/ and migrated/', () => {
    writeFileSync(join(runDir, 'original', 'src', 'App.js'), 'class App extends React.Component {\n  render() { return null; }\n}\n');
    writeFileSync(join(runDir, 'migrated', 'src', 'App.js'), 'const App = () => null;\n');
    write(baseRecord());
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toMatch(/files changed[\s\S]*?<div class="v">1<\/div>/);
  });

  it('renders the decision log with stage tags', () => {
    write(baseRecord());
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('kept the legacy action shape');
    expect(html).toContain('>migrate<');
  });

  it('embeds full migration-log.md and review-report.md text in collapsible details, with bold spans that cross a line break rendering correctly', () => {
    write(baseRecord(), {
      'migration-log.md': '# Log\n\n- **[rationale] a long decision title that\n  wraps across two lines**: the rest of the sentence.',
      'review-report.md': '# Review\n\nEverything looks good.',
    });
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('<details>');
    expect(html).toContain('<strong>[rationale] a long decision title that\n  wraps across two lines</strong>');
    expect(html).toContain('Everything looks good.');
    expect(html).not.toContain('**['); // no literal unconverted markdown bold markers
  });

  it('links the one-pager in the footer only when it exists', () => {
    write(baseRecord(), { 'one-pager.md': '# 요약' });
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).toContain('href="one-pager.md"');
  });

  it('is a single self-contained file: no external stylesheet, script, or CDN reference', () => {
    write(baseRecord());
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toContain('http://cdn');
    expect(html).toContain('<style>');
  });

  it('HTML-escapes repo URLs and rationale text to prevent injection', () => {
    write(
      baseRecord({
        decisions: [{ ts: 'x', stage: 'migrate', rationale: '<script>alert(1)</script> & "quoted"' }],
      }),
    );
    const html = readFileSync(generateReport(runDir), 'utf8');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
