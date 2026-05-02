/**
 * Prompt version registry. Bump version when a prompt changes so that
 * golden tests pinned to a version still pass and historical AiUsageLog
 * rows can be analyzed by prompt generation.
 */

export const PROMPT_VERSIONS: Record<string, string> = {
  // Existing Pro
  'jd.analyse': 'v1.0.0',
  'jd.evaluate.16criterion': 'v1.0.0',
  'jd.honestReview': 'v1.0.0',
  'jd.sonicReview': 'v1.0.0',
  'jd.testHypotheses': 'v1.0.0',
  'jd.payGroups.suggest': 'v1.0.0',
  'jd.generateField': 'v1.0.0',
  'jd.endSession.summary': 'v1.0.0',
  'jd.lint': 'v1.0.0',
  'jd.bias.scan': 'v1.0.0',
  'companion.message': 'v1.0.0',
  'jd.improve.rewrite': 'v1.0.0',
  'jd.rewrite': 'v1.0.0',
  'jd.process.extract': 'v1.0.0',
  'pmoa.build-org': 'v1.0.0',
  'pmoa.build-processes': 'v1.0.0',
  'v5.bias-check': 'v1.0.0',

  // Phase 1 — Axiomera (ported from Pro Max)
  'jd.evaluate.axiomera': 'v1.0.0',
  'jd.axiomera.extractR': 'v1.0.0',
  'jd.axiomera.extractE': 'v1.0.0',
  'jd.axiomera.languageScore': 'v1.0.0',
  'jd.axiomera.composite': 'v1.0.0',
};

export function promptVersionFor(operation: string): string {
  return PROMPT_VERSIONS[operation] ?? 'v0.0.0';
}
