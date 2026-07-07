import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Router, RoutingConfigError } from '../src/router.js';

function rulesFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'router-'));
  const path = join(dir, 'routing.yaml');
  writeFileSync(path, content);
  return path;
}

describe('Router', () => {
  it('loads the shipped default ruleset and routes the five pipeline task types', () => {
    const router = new Router();
    expect(router.route('analyze')).toMatchObject({ executor: 'fable', effort: 'high' });
    expect(router.route('migrate')).toMatchObject({ executor: 'fable', effort: 'high' });
    expect(router.route('testgen')).toMatchObject({ executor: 'sonnet', effort: 'high' });
    expect(router.route('review')).toMatchObject({ executor: 'sonnet', effort: 'medium' });
    expect(router.route('document')).toMatchObject({ executor: 'haiku', effort: 'low' });
  });

  it('falls back to the default rule for unknown or missing task types', () => {
    const router = new Router();
    expect(router.route('nonsense').matchedRule).toBe('default');
    expect(router.route(undefined).matchedRule).toBe('default');
    expect(router.route(undefined).executor).toBe('sonnet');
  });

  it('exposes known task types from the ruleset', () => {
    expect(new Router().knownTaskTypes).toEqual(['analyze', 'document', 'migrate', 'review', 'testgen']);
  });

  it('honors fallback executors declared in rules', () => {
    const path = rulesFile('default: {executor: sonnet}\ntask_types:\n  x: {executor: codex, fallback: sonnet}\n');
    expect(new Router(path).route('x')).toMatchObject({ executor: 'codex', fallback: 'sonnet' });
  });

  it('rejects a missing rules file', () => {
    expect(() => new Router('/nonexistent/routing.yaml')).toThrow(RoutingConfigError);
  });

  it('rejects rules without a default', () => {
    const path = rulesFile('task_types:\n  a: {executor: sonnet}\n');
    expect(() => new Router(path)).toThrow(/default/);
  });

  it('rejects rules without an executor or with invalid effort', () => {
    expect(() => new Router(rulesFile('default: {effort: high}\n'))).toThrow(/executor/);
    expect(() => new Router(rulesFile('default: {executor: sonnet, effort: extreme}\n'))).toThrow(/invalid effort/);
  });
});
