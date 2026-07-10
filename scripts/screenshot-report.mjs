#!/usr/bin/env node
/**
 * Visual sanity check for a generated report.html: opens it in headless
 * Chromium, screenshots it, and checks for the layout breakage a pure
 * string-templating bug tends to produce (horizontal overflow, an empty
 * body, a <details> section that never rendered). Same practice as
 * vlog-pipeline's e2e checks — a measured signal, not a vibe.
 *
 * Usage: node scripts/screenshot-report.mjs <path-to-report.html> [out.png]
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';

const reportPath = process.argv[2];
if (!reportPath) {
  console.error('usage: node scripts/screenshot-report.mjs <path-to-report.html> [out.png]');
  process.exit(2);
}
const outPath = process.argv[3] ?? reportPath.replace(/\.html$/, '.png');
const url = `file://${resolve(reportPath)}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(url, { waitUntil: 'load' });

const checks = await page.evaluate(() => {
  const doc = document;
  const overflow = doc.documentElement.scrollWidth - doc.documentElement.clientWidth;
  return {
    bodyText: doc.body.innerText.length,
    hasStagebar: !!doc.querySelector('.stagebar'),
    stepCount: doc.querySelectorAll('.step').length,
    hasBanner: !!doc.querySelector('.banner'),
    detailsCount: doc.querySelectorAll('details').length,
    detailsWithContent: [...doc.querySelectorAll('details .md-body')].filter((el) => el.textContent.trim().length > 0).length,
    horizontalOverflowPx: overflow,
    computedBg: getComputedStyle(doc.body).backgroundColor,
  };
});

await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

const problems = [];
if (checks.bodyText < 200) problems.push(`body text suspiciously short (${checks.bodyText} chars) — likely unrendered content`);
if (!checks.hasStagebar) problems.push('no .stagebar element found');
if (checks.stepCount !== 6) problems.push(`expected 6 stage steps, found ${checks.stepCount}`);
if (!checks.hasBanner) problems.push('no test-proof banner found');
if (checks.detailsCount < 2) problems.push(`expected >=2 <details> sections, found ${checks.detailsCount}`);
if (checks.detailsWithContent < checks.detailsCount) problems.push('a <details> section has no rendered content');
if (checks.horizontalOverflowPx > 4) problems.push(`horizontal overflow: ${checks.horizontalOverflowPx}px wider than viewport`);
if (checks.computedBg === 'rgba(0, 0, 0, 0)') problems.push('body has no background color — CSS likely did not apply');
if (consoleErrors.length) problems.push(`console errors: ${consoleErrors.join(' | ')}`);

console.log(`screenshot: ${outPath}`);
console.log(JSON.stringify(checks, null, 2));
if (problems.length) {
  console.error('\nFAIL:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('\nPASS — no layout breakage detected.');
