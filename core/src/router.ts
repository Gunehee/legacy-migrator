/**
 * Model router: maps a task type to an executor + effort decision.
 *
 * All routing knowledge lives in a YAML ruleset (core/config/routing.yaml by
 * default). The router applies rules; it never imports adapter implementations,
 * so new executors are added by editing the ruleset and registering an adapter
 * factory — no changes here or in the pipeline.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import type { Effort } from './task.js';

const HERE = dirname(fileURLToPath(import.meta.url));
/** dist/router.js and src/router.ts are both one level below the package root. */
export const DEFAULT_RULES_PATH = join(HERE, '..', 'config', 'routing.yaml');

const VALID_EFFORTS: Effort[] = ['low', 'medium', 'high'];

export interface RoutingDecision {
  executor: string;
  effort: Effort;
  fallback?: string;
  matchedRule: string;
}

interface Rule {
  executor: string;
  effort?: Effort;
  fallback?: string;
}

interface RuleSet {
  default: Rule;
  task_types?: Record<string, Rule>;
}

export class RoutingConfigError extends Error {}

export class Router {
  readonly rulesPath: string;
  private rules: RuleSet;

  constructor(rulesPath?: string) {
    this.rulesPath = rulesPath ?? DEFAULT_RULES_PATH;
    this.rules = Router.load(this.rulesPath);
  }

  private static load(path: string): RuleSet {
    if (!existsSync(path)) {
      throw new RoutingConfigError(`routing rules file not found: ${path}`);
    }
    const rules = parse(readFileSync(path, 'utf8'));
    if (typeof rules !== 'object' || rules === null || !('default' in rules)) {
      throw new RoutingConfigError(`routing rules must be a mapping with a 'default' rule: ${path}`);
    }
    const entries: [string, unknown][] = [
      ['default', rules.default],
      ...Object.entries(rules.task_types ?? {}),
    ];
    for (const [name, rule] of entries) {
      if (typeof rule !== 'object' || rule === null || !('executor' in rule)) {
        throw new RoutingConfigError(`rule '${name}' must define an executor`);
      }
      const effort = (rule as Rule).effort ?? 'medium';
      if (!VALID_EFFORTS.includes(effort)) {
        throw new RoutingConfigError(
          `rule '${name}' has invalid effort '${effort}' (valid: ${VALID_EFFORTS.join(', ')})`,
        );
      }
    }
    return rules as RuleSet;
  }

  route(taskType?: string): RoutingDecision {
    const taskTypes = this.rules.task_types ?? {};
    const rule = taskType && taskTypes[taskType] ? taskTypes[taskType] : this.rules.default;
    const matchedRule = taskType && taskTypes[taskType] ? `task_types.${taskType}` : 'default';
    return {
      executor: rule.executor,
      effort: rule.effort ?? 'medium',
      fallback: rule.fallback,
      matchedRule,
    };
  }

  get knownTaskTypes(): string[] {
    return Object.keys(this.rules.task_types ?? {}).sort();
  }
}
