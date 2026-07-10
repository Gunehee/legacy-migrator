/**
 * Self-contained run report: runs/<name>/report.html.
 *
 * Single offline file — inline CSS, no JS framework, no CDN, opens directly
 * via file://. Purely templated from run-state.json + the markdown artifacts
 * already on disk; never calls a model. Mirrors the report-generator pattern
 * used in vlog-pipeline (deterministic templating, same status palette).
 */

import { spawnSync } from 'node:child_process';
import { existsSync as exists, readFileSync as readFile, writeFileSync as writeFile } from 'node:fs';
import { join } from 'node:path';

import type { RunRecord, StageRecord } from './state.js';

// Status palette validated for light + dark (same instance used elsewhere in
// this codebase's design-system reference): good/warning/critical, distinct
// from any categorical hue, always paired with an icon + label — never color
// alone.
const CSS = `
:root {
  --surface: #fcfcfb; --page: #f9f9f7; --panel: #f3f2ef; --border: #e1e0d9;
  --ink: #0b0b0b; --ink-2: #52514e; --ink-3: #898781;
  --s-good: #0ca30c; --s-warn: #fab219; --s-crit: #d03b3b;
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: #1a1a19; --page: #0d0d0d; --panel: #232322; --border: #2c2c2a;
    --ink: #ffffff; --ink-2: #c3c2b7; --ink-3: #898781;
    --s-good: #0ca30c; --s-warn: #fab219; --s-crit: #d03b3b;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink);
       font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { max-width: 1000px; margin: 0 auto; padding: 32px 24px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 17px; margin: 40px 0 12px; }
.sub { color: var(--ink-2); margin: 0 0 10px; }
a { color: var(--s-good); }
.meta { display: flex; gap: 28px; flex-wrap: wrap; margin: 18px 0 6px;
        padding: 14px 18px; background: var(--panel);
        border: 1px solid var(--border); border-radius: 10px; }
.meta div { min-width: 130px; }
.meta .k { font-size: 12px; color: var(--ink-3); text-transform: uppercase;
           letter-spacing: .04em; }
.meta .v { font-size: 20px; font-weight: 600; }
.stagebar { display: flex; flex-wrap: wrap; border-radius: 10px; overflow: hidden;
            border: 1px solid var(--border); }
.step { flex: 1 1 150px; padding: 16px 14px 12px; background: var(--surface);
        border-right: 1px solid var(--border); border-top: 4px solid var(--ink-3); }
.step:last-child { border-right: none; }
.step.pass { border-top-color: var(--s-good); }
.step.fail { border-top-color: var(--s-crit); }
.step.pending { border-top-color: var(--s-warn); }
.step .name { font-weight: 700; font-size: 13px; text-transform: capitalize; }
.step .icon { margin-right: 5px; }
.step.pass .icon { color: var(--s-good); }
.step.fail .icon { color: var(--s-crit); }
.step.pending .icon { color: var(--s-warn); }
.step .sub2 { font-size: 12px; color: var(--ink-3); margin-top: 6px; line-height: 1.5; }
.legend { display: flex; gap: 18px; flex-wrap: wrap; margin: 10px 0 4px;
          font-size: 13px; color: var(--ink-2); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.chip { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.banner { border-radius: 10px; padding: 16px 18px; margin: 12px 0;
          border: 1px solid var(--border); border-left: 6px solid var(--ink-3);
          background: var(--panel); }
.banner.good { border-left-color: var(--s-good); }
.banner.crit { border-left-color: var(--s-crit); }
.banner .verdict { font-size: 18px; font-weight: 700; }
.banner .verdict .icon { margin-right: 8px; }
.stats-grid { display: flex; gap: 16px; flex-wrap: wrap; }
.stat { flex: 1 1 150px; background: var(--panel); border: 1px solid var(--border);
        border-radius: 10px; padding: 14px 16px; }
.stat .k { font-size: 12px; color: var(--ink-3); text-transform: uppercase;
           letter-spacing: .04em; }
.stat .v { font-size: 22px; font-weight: 600; margin-top: 2px; }
.pattern-list { margin: 10px 0 0; padding: 0; list-style: none; }
.pattern-list li { padding: 6px 10px; border-radius: 6px; font-size: 14px;
                    display: flex; align-items: center; gap: 8px; }
.pattern-list li:nth-child(odd) { background: var(--panel); }
.pattern-list .icon.good { color: var(--s-good); }
.pattern-list .icon.crit { color: var(--s-crit); }
table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 14px; }
th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); }
th { font-size: 12px; color: var(--ink-3); text-transform: uppercase; letter-spacing: .04em; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.decision { padding: 8px 10px; border-radius: 6px; font-size: 14px; margin-bottom: 4px; }
.decision:nth-child(odd) { background: var(--panel); }
.decision .stage-tag { display: inline-block; font-size: 11px; font-weight: 700;
                        text-transform: uppercase; letter-spacing: .04em; color: var(--ink-3);
                        margin-right: 8px; }
details { margin-top: 14px; border: 1px solid var(--border); border-radius: 10px;
          padding: 10px 16px; background: var(--panel); }
summary { cursor: pointer; color: var(--ink-2); font-size: 14px; font-weight: 600; }
details .md-body { margin-top: 10px; font-size: 14px; color: var(--ink-2); }
details .md-body h1, details .md-body h2, details .md-body h3 { color: var(--ink); }
details .md-body pre { background: var(--surface); padding: 10px; border-radius: 6px;
                        overflow-x: auto; border: 1px solid var(--border); }
code { background: var(--surface); padding: 1px 5px; border-radius: 4px;
       border: 1px solid var(--border); font-size: 13px; }
.footer { margin-top: 48px; font-size: 13px; color: var(--ink-3); }
.footer a { margin-right: 14px; }
`;

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inline(text: string): string {
  let out = esc(text);
  // [\s\S] instead of `.` — bold/code spans in these markdown files routinely
  // wrap across a line break, and `.` never matches `\n`.
  out = out.replace(/\*\*([\s\S]+?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/`([\s\S]+?)`/g, '<code>$1</code>');
  return out;
}

/** Minimal markdown → HTML: headings, lists, paragraphs. No tables/links needed here. */
function mdToHtml(md: string): string {
  const blocks = md.trim().split(/\n\s*\n/);
  const out: string[] = [];
  for (const block of blocks) {
    let lines = block.split('\n');
    if (/^#{1,6}\s/.test(lines[0])) {
      const level = Math.min(lines[0].match(/^#+/)![0].length, 4);
      out.push(`<h${level}>${inline(lines[0].replace(/^#+\s*/, ''))}</h${level}>`);
      lines = lines.slice(1);
      if (!lines.length) continue;
    }
    const nonEmpty = lines.filter((l) => l.trim());
    if (nonEmpty.length && nonEmpty.every((l) => /^\s*(?:[-*]|\d+\.)\s+/.test(l))) {
      const items = nonEmpty.map((l) => `<li>${inline(l.replace(/^\s*(?:[-*]|\d+\.)\s+/, ''))}</li>`).join('');
      out.push(`<ul>${items}</ul>`);
    } else if (nonEmpty.length) {
      out.push(`<p>${inline(lines.join('\n'))}</p>`);
    }
  }
  return out.join('\n');
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m${String(s).padStart(2, '0')}s` : `${s}s`;
}

function fmtCost(usd: number | undefined): string {
  return `$${(usd ?? 0).toFixed(4)}`;
}

const STATUS_ICON: Record<string, string> = {
  passed: '&#10003;',
  failed: '&#10007;',
  pending: '&#8212;',
  running: '&#8942;',
};

const STATUS_CLASS: Record<string, string> = {
  passed: 'pass',
  failed: 'fail',
  pending: 'pending',
  running: 'pending',
};

function stepDurationMs(s: StageRecord): number | undefined {
  if (!s.startedAt || !s.finishedAt) return undefined;
  return new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
}

const REPORTED_STAGES = ['analyze', 'testgen', 'migrate', 'review', 'document', 'validate'] as const;

function renderTimeline(record: RunRecord): { html: string; totalMs: number } {
  let totalMs = 0;
  const steps = REPORTED_STAGES.map((name) => {
    const s = record.stages.find((x) => x.stage === name);
    const status = s?.status ?? 'pending';
    const cls = STATUS_CLASS[status] ?? 'pending';
    const icon = STATUS_ICON[status] ?? '&#8212;';
    const dur = s ? stepDurationMs(s) : undefined;
    if (dur) totalMs += dur;
    const durLabel = dur !== undefined ? fmtDuration(dur) : '—';
    const executor = s?.executor ?? '—';
    const cost = s?.costUsd !== undefined ? fmtCost(s.costUsd) : '—';
    return `<div class="step ${cls}">
      <div class="name"><span class="icon">${icon}</span>${esc(name)}</div>
      <div class="sub2">${esc(executor)}<br>${esc(durLabel)} · ${esc(cost)}</div>
    </div>`;
  });
  return {
    html: `<div class="stagebar">${steps.join('')}</div>
<div class="legend">
  <span><span class="chip" style="background:var(--s-good)"></span>passed</span>
  <span><span class="chip" style="background:var(--s-crit)"></span>failed</span>
  <span><span class="chip" style="background:var(--s-warn)"></span>pending / not yet run</span>
</div>`,
    totalMs,
  };
}

/** Strips ANSI color codes vitest leaves in captured test-gate summaries. */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function parseTestCount(summary: string | undefined): { passed: number; total: number } | undefined {
  if (!summary) return undefined;
  const clean = stripAnsi(summary);
  const passedMatch = clean.match(/(\d+)\s+passed/);
  if (!passedMatch) return undefined;
  // vitest/jest/mocha all append the run total in trailing parens even when
  // some failed ("8 passed, 2 failed (10)") — read that instead of assuming
  // "passed" is the whole story, or a partial failure silently reads as 100%.
  const totalMatch = clean.match(/\((\d+)\)\s*$/) ?? clean.match(/\((\d+)\)/);
  const passed = Number(passedMatch[1]);
  const total = totalMatch ? Number(totalMatch[1]) : passed;
  return { passed, total };
}

function renderTestBadge(record: RunRecord, validateReport: string | undefined): string {
  const testgenGate = [...record.testGates].reverse().find((g) => g.stage === 'testgen');
  const original = parseTestCount(testgenGate?.summary);

  let migrated: { passed: number; total: number } | undefined;
  if (validateReport) {
    // Match PASS or FAIL here — a failing final re-run must still surface its
    // count so the badge reflects reality instead of silently omitting it.
    const m = validateReport.match(/## 1\. Final test-suite re-run[\s\S]*?(?:PASS|FAIL)\*\*\s*—\s*(.+)/);
    migrated = parseTestCount(m?.[1]);
  }
  if (!migrated) {
    const lastMigrateGate = [...record.testGates].reverse().find((g) => g.stage === 'migrate' || g.stage === 'review');
    migrated = parseTestCount(lastMigrateGate?.summary);
  }

  if (!original && !migrated) {
    return `<div class="banner"><div class="verdict"><span class="icon">&#8212;</span>No characterization test data recorded yet</div></div>`;
  }
  const bothMatch = original && migrated && original.total === migrated.total && original.passed === original.total && migrated.passed === migrated.total;
  if (bothMatch) {
    return `<div class="banner good"><div class="verdict"><span class="icon">&#10003;</span>${original!.total}/${original!.total} passing on both original and migrated</div></div>`;
  }
  const bits: string[] = [];
  if (original) bits.push(`original: ${original.passed}/${original.total}`);
  if (migrated) bits.push(`migrated: ${migrated.passed}/${migrated.total}`);
  const anyFail = (original && original.passed < original.total) || (migrated && migrated.passed < migrated.total);
  return `<div class="banner ${anyFail ? 'crit' : ''}"><div class="verdict"><span class="icon">${anyFail ? '&#10007;' : '&#10003;'}</span>${bits.join(' · ')}</div></div>`;
}

function codeStats(runDir: string): { html: string } {
  const originalSrc = join(runDir, 'original', 'src');
  const migratedSrc = join(runDir, 'migrated', 'src');
  if (!exists(originalSrc) || !exists(migratedSrc)) {
    return { html: '<p class="sub">original/src or migrated/src not found on this machine.</p>' };
  }
  const proc = spawnSync('git', ['diff', '--no-index', '--stat', '--', originalSrc, migratedSrc], {
    encoding: 'utf8',
  });
  const out = proc.stdout ?? '';
  const summaryLine = out.trim().split('\n').pop() ?? '';
  const m = summaryLine.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
  const files = m?.[1] ?? '0';
  const ins = m?.[2] ?? '0';
  const del = m?.[3] ?? '0';
  return {
    html: `<div class="stats-grid">
      <div class="stat"><div class="k">files changed</div><div class="v">${esc(files)}</div></div>
      <div class="stat"><div class="k">lines added</div><div class="v">+${esc(ins)}</div></div>
      <div class="stat"><div class="k">lines removed</div><div class="v">&minus;${esc(del)}</div></div>
    </div>`,
  };
}

/** Parses the validator's own "## 3. Legacy pattern sweep" section into a short list. */
function patternRemovals(validateReport: string | undefined): string {
  if (!validateReport) return '<p class="sub">No validate-report.md found — run `legacy-migrator run` through the validate stage first.</p>';
  const section = validateReport.match(/## 3\. Legacy pattern sweep([\s\S]*?)(?:\n## |$)/);
  if (!section) return '<p class="sub">No legacy-pattern sweep recorded.</p>';
  const lines = section[1].split('\n').filter((l) => l.trim().startsWith('- **'));
  if (!lines.length) return '<p class="sub">No legacy-pattern rules applied for this lane.</p>';
  const items = lines.map((line) => {
    const passMatch = line.match(/\*\*PASS\*\*\s*—\s*no `(.+?)` remaining/);
    const failMatch = line.match(/\*\*FAIL\*\*\s*—\s*`(.+?)` still found in: (.+)/);
    if (passMatch) {
      return `<li><span class="icon good">&#10003;</span>0 remaining <code>${esc(passMatch[1])}</code> calls</li>`;
    }
    if (failMatch) {
      const files = failMatch[2].split(',').length;
      return `<li><span class="icon crit">&#10007;</span>${files} file(s) still contain <code>${esc(failMatch[1])}</code></li>`;
    }
    return `<li>${inline(line.replace(/^- /, ''))}</li>`;
  });
  return `<ul class="pattern-list">${items.join('')}</ul>`;
}

function renderDecisions(record: RunRecord): string {
  if (!record.decisions.length) return '<p class="sub">No decisions logged.</p>';
  return record.decisions
    .map((d) => `<div class="decision"><span class="stage-tag">${esc(d.stage)}</span>${inline(d.rationale)}</div>`)
    .join('\n');
}

function readIfExists(path: string): string | undefined {
  return exists(path) ? readFile(path, 'utf8') : undefined;
}

/**
 * Reads runDir/run-state.json plus the markdown artifacts already produced
 * there, and writes a self-contained runDir/report.html. Pure templating —
 * never calls a model. Returns the path written.
 */
export function generateReport(runDir: string): string {
  const record: RunRecord = JSON.parse(readFile(join(runDir, 'run-state.json'), 'utf8'));
  const validateReportText = readIfExists(join(runDir, 'validate-report.md'));
  const migrationLog = readIfExists(join(runDir, 'migration-log.md'));
  const reviewReport = readIfExists(join(runDir, 'review-report.md'));
  const hasOnePager = exists(join(runDir, 'one-pager.md'));
  const hasReadme = exists(join(runDir, 'README.md'));
  const hasPlan = exists(join(runDir, 'migration-plan.md'));

  const { html: timelineHtml, totalMs } = renderTimeline(record);
  const totalCost = record.costTotalUsd ?? record.stages.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
  const testBadge = renderTestBadge(record, validateReportText);
  const { html: statsHtml } = codeStats(runDir);
  const removalsHtml = patternRemovals(validateReportText);
  const decisionsHtml = renderDecisions(record);
  const createdDate = record.createdAt ? new Date(record.createdAt).toISOString().slice(0, 10) : '—';

  const footerLinks: string[] = [];
  if (hasReadme) footerLinks.push('<a href="README.md">README.md</a> (technical)');
  if (hasOnePager) footerLinks.push('<a href="one-pager.md">one-pager.md</a> (non-technical summary)');
  if (hasPlan) footerLinks.push('<a href="migration-plan.md">migration-plan.md</a>');

  const doc = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>legacy-migrator report — ${esc(record.name)}</title>
<style>${CSS}</style></head><body><div class="wrap">

<h1>${esc(record.name)}</h1>
<p class="sub">lane: <code>${esc(record.lane)}</code> · source: <a href="${esc(record.repoUrl)}">${esc(record.repoUrl)}</a></p>
<div class="meta">
  <div><div class="k">run created</div><div class="v">${esc(createdDate)}</div></div>
  <div><div class="k">wall-clock (sum of stages)</div><div class="v">${esc(fmtDuration(totalMs))}</div></div>
  <div><div class="k">total cost</div><div class="v">${esc(fmtCost(totalCost))}</div></div>
</div>

<h2>Pipeline stages</h2>
${timelineHtml}

<h2>Test proof</h2>
${testBadge}

<h2>Before / after code</h2>
${statsHtml}
<div class="sub" style="margin-top:14px">Legacy pattern sweep (from validate-report.md):</div>
${removalsHtml}

<h2>Decision log</h2>
${decisionsHtml}

<h2>Full migration log</h2>
<details><summary>migration-log.md — what changed, why, and test status, module by module</summary>
<div class="md-body">${migrationLog ? mdToHtml(migrationLog) : '<p class="sub">Not found.</p>'}</div>
</details>

<h2>Review</h2>
<details><summary>review-report.md — post-migration code-quality pass</summary>
<div class="md-body">${reviewReport ? mdToHtml(reviewReport) : '<p class="sub">Not found.</p>'}</div>
</details>

<div class="footer">Generated by legacy-migrator · self-contained file, opens via file://.
${footerLinks.length ? `Also in this folder: ${footerLinks.join(' · ')}` : ''}</div>
</div></body></html>
`;

  const outPath = join(runDir, 'report.html');
  writeFile(outPath, doc, 'utf8');
  return outPath;
}
