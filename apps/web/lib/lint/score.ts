/**
 * Weighted scoring for JDGC lint rules.
 * Categories: structure (30%), bias (35%), euptd (35%)
 * Severity penalty: info 5, warn 15, error 35 (capped per-rule at rule.weight * 100)
 */
import { RULES, RuleDef, Category } from './rules';
import type { Finding } from './rules';
export type { Finding } from './rules';

export interface CategoryScore {
  category: Category;
  score: number;        // 0..100
  findings: Finding[];
  rulesRun: number;
  rulesFailed: number;
}

export interface LintResult {
  total: number;        // 0..100 weighted
  structure: CategoryScore;
  bias: CategoryScore;
  euptd: CategoryScore;
  findings: Finding[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
}

const SEVERITY_PENALTY: Record<string, number> = { info: 5, warn: 15, error: 35 };
const CATEGORY_WEIGHT: Record<Category, number> = { structure: 0.30, bias: 0.35, euptd: 0.35 };

export function runLint(text: string, fields?: Record<string, unknown>): LintResult {
  const findings: Finding[] = [];
  const byCategory: Record<Category, { score: number; findings: Finding[]; rulesRun: number; rulesFailed: number }> = {
    structure: { score: 100, findings: [], rulesRun: 0, rulesFailed: 0 },
    bias:      { score: 100, findings: [], rulesRun: 0, rulesFailed: 0 },
    euptd:     { score: 100, findings: [], rulesRun: 0, rulesFailed: 0 },
  };

  for (const rule of RULES) {
    const cat = byCategory[rule.category];
    cat.rulesRun += 1;
    let ruleFindings: Finding[] = [];
    try {
      ruleFindings = rule.check(text, fields);
    } catch (err) {
      ruleFindings = [{ ruleId: rule.id, category: rule.category, severity: 'warn', message: `Rule error: ${err instanceof Error ? err.message : 'unknown'}` }];
    }

    if (ruleFindings.length === 0) continue;
    cat.rulesFailed += 1;
    cat.findings.push(...ruleFindings);
    findings.push(...ruleFindings);

    const worst = ruleFindings.reduce((acc, f) => Math.max(acc, SEVERITY_PENALTY[f.severity] || 0), 0);
    const penalty = Math.min(rule.weight * 100, worst);
    cat.score = Math.max(0, cat.score - penalty);
  }

  const total = Math.round(
    byCategory.structure.score * CATEGORY_WEIGHT.structure +
    byCategory.bias.score * CATEGORY_WEIGHT.bias +
    byCategory.euptd.score * CATEGORY_WEIGHT.euptd
  );

  const grade: LintResult['grade'] =
    total >= 90 ? 'A' :
    total >= 80 ? 'B' :
    total >= 70 ? 'C' :
    total >= 60 ? 'D' : 'F';

  const errorCount = findings.filter(f => f.severity === 'error').length;
  const warnCount  = findings.filter(f => f.severity === 'warn').length;

  const summary =
    errorCount === 0 && warnCount === 0
      ? 'No issues detected — JD meets governance standards.'
      : `${errorCount} error${errorCount === 1 ? '' : 's'}, ${warnCount} warning${warnCount === 1 ? '' : 's'} across ${findings.length} finding${findings.length === 1 ? '' : 's'}.`;

  const buildCatScore = (c: Category): CategoryScore => ({
    category: c,
    score: Math.round(byCategory[c].score),
    findings: byCategory[c].findings,
    rulesRun: byCategory[c].rulesRun,
    rulesFailed: byCategory[c].rulesFailed,
  });

  return {
    total,
    structure: buildCatScore('structure'),
    bias: buildCatScore('bias'),
    euptd: buildCatScore('euptd'),
    findings,
    grade,
    summary,
  };
}

export function ruleById(id: string): RuleDef | undefined {
  return RULES.find(r => r.id === id);
}
