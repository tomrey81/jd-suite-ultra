/**
 * Configurable model registry. Update prices quarterly by editing this file
 * and bumping `effectiveFrom`. Historical AiUsageLog rows retain the price
 * recorded at call time, so updates here do not rewrite history.
 *
 * Verify against https://docs.claude.com/en/docs/build-with-claude/pricing
 */

export type ModelTier =
  | 'haiku'
  | 'sonnet'
  | 'opus'
  | 'embedding-small'
  | 'embedding-large'
  | 'deterministic';

export interface ModelEntry {
  tier: ModelTier;
  modelId: string;
  pricePerMTokensIn: number;
  pricePerMTokensOut: number;
  pricePerMEmbedding?: number;
  effectiveFrom: string; // ISO date
  notes?: string;
}

export const MODEL_REGISTRY: Record<ModelTier, ModelEntry> = {
  haiku: {
    tier: 'haiku',
    modelId: 'claude-haiku-4-5-20251001',
    pricePerMTokensIn: 1.0,
    pricePerMTokensOut: 5.0,
    effectiveFrom: '2026-05-01',
  },
  sonnet: {
    tier: 'sonnet',
    modelId: 'claude-sonnet-4-6',
    pricePerMTokensIn: 3.0,
    pricePerMTokensOut: 15.0,
    effectiveFrom: '2026-05-01',
  },
  opus: {
    tier: 'opus',
    modelId: 'claude-opus-4-6',
    pricePerMTokensIn: 15.0,
    pricePerMTokensOut: 75.0,
    effectiveFrom: '2026-05-01',
  },
  'embedding-small': {
    tier: 'embedding-small',
    modelId: 'text-embedding-3-small',
    pricePerMTokensIn: 0.02,
    pricePerMTokensOut: 0,
    pricePerMEmbedding: 0.02,
    effectiveFrom: '2026-05-01',
  },
  'embedding-large': {
    tier: 'embedding-large',
    modelId: 'text-embedding-3-large',
    pricePerMTokensIn: 0.13,
    pricePerMTokensOut: 0,
    pricePerMEmbedding: 0.13,
    effectiveFrom: '2026-05-01',
  },
  deterministic: {
    tier: 'deterministic',
    modelId: 'none',
    pricePerMTokensIn: 0,
    pricePerMTokensOut: 0,
    effectiveFrom: '2026-05-01',
    notes: 'Used for non-AI operations tracked for completeness',
  },
};

/** Default tier for each operation. Override with CallAiOptions.tier. */
const OPERATION_TIER_DEFAULTS: Record<string, ModelTier> = {
  // Existing Pro operations
  'jd.analyse': 'sonnet',
  'jd.evaluate.16criterion': 'sonnet',
  'jd.honestReview': 'sonnet',
  'jd.sonicReview': 'sonnet',
  'jd.testHypotheses': 'sonnet',
  'jd.payGroups.suggest': 'sonnet',
  'jd.generateField': 'haiku',
  'jd.endSession.summary': 'haiku',
  'jd.lint': 'haiku',
  'jd.bias.scan': 'sonnet',
  'companion.message': 'sonnet',
  'jd.improve.rewrite': 'sonnet',
  'jd.rewrite': 'sonnet',
  'jd.process.extract': 'sonnet',
  'pmoa.build-org': 'sonnet',
  'pmoa.build-processes': 'sonnet',
  'v5.bias-check': 'sonnet',

  // Phase 1 — Axiomera
  'jd.evaluate.axiomera': 'sonnet',
  'jd.axiomera.extractR': 'sonnet',
  'jd.axiomera.extractE': 'sonnet',
  'jd.axiomera.languageScore': 'deterministic',
  'jd.axiomera.composite': 'deterministic',

  // Phase 5+ — placeholders
  'regulation.extract.chunks': 'sonnet',
  'regulation.extract.tags': 'haiku',
  'regulation.embed': 'embedding-small',
  'regulation.suggestForJd': 'sonnet',
  'report.generateSummary': 'sonnet',
};

export function defaultTierFor(operation: string): ModelTier {
  return OPERATION_TIER_DEFAULTS[operation] ?? 'sonnet';
}

export function estimateCost(
  model: ModelEntry,
  tokensIn: number,
  tokensOut: number,
): number {
  return (
    (tokensIn / 1_000_000) * model.pricePerMTokensIn +
    (tokensOut / 1_000_000) * model.pricePerMTokensOut
  );
}
