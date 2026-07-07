import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { RunStore } from '@legacy-migrator/core';
import { renderStatus, repoNameFromUrl, statusCommand } from '../src/index.js';

describe('repoNameFromUrl', () => {
  it('derives run names from github urls', () => {
    expect(repoNameFromUrl('https://github.com/gothinkster/react-redux-realworld-example-app')).toBe(
      'react-redux-realworld-example-app',
    );
    expect(repoNameFromUrl('git@github.com:a/b.git')).toBe('b');
    expect(repoNameFromUrl('https://github.com/a/b/')).toBe('b');
  });
});

describe('renderStatus', () => {
  it('renders stages, gates and decision count', () => {
    const store = new RunStore(mkdtempSync(join(tmpdir(), 'cli-')));
    store.create('demo', 'https://github.com/x/demo', 'class-react-to-hooks');
    store.setStage('demo', 'select', 'passed');
    store.setStage('demo', 'analyze', 'running', { executor: 'fable' });
    store.logDecision('demo', 'analyze', 'why');
    store.logTestGate('demo', { stage: 'testgen', command: 'npm test', cwd: '/x', ok: true, summary: '5 passed' });

    const out = renderStatus(store.load('demo'));
    expect(out).toContain('run: demo');
    expect(out).toMatch(/select\s+passed/);
    expect(out).toMatch(/analyze\s+running\s+fable/);
    expect(out).toContain('[PASS] testgen: npm test → 5 passed');
    expect(out).toContain('decisions logged: 1');
  });
});

describe('statusCommand', () => {
  it('prints all runs, or a notice when none exist', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-'));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    statusCommand(undefined, root);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('no runs found'));

    new RunStore(root).create('demo', 'url', 'lane');
    statusCommand(undefined, root);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('run: demo'));
    log.mockRestore();
  });
});
