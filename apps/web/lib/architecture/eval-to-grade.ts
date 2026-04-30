/**
 * Map a JD evaluation score (overallScore 0-100) to an Axiomera grade (6-30).
 *
 * The EvalResult model in JD Suite stores `overallScore` as a normalised 0-100
 * percentage of evaluation completeness/strength. The Axiomera 1000-point model
 * uses `Grade = round((R + S + E) / 50)` over a maximum of ~1000 points → grades
 * 6 to 30.
 *
 * Mapping convention (linear, anchored at the band centres):
 *   overallScore  →  grade
 *           0     →   6  (A1, lowest)
 *          50     →  18  (C3, mid)
 *         100     →  30  (E5, highest)
 *
 * This is a SIMPLE proxy for placement until a real Axiomera-side score is
 * synced via the eval-bridge. When `evalResult.criteria` contains the actual
 * R/S/E sub-scores, prefer the explicit formula `Grade = round((R+S+E)/50)`.
 */

import { AXIOMERA_BANDS, getBand, gradeToBandCode } from './axiomera-bands';

export interface EvalSubScores {
  /** Responsibility points (0–635 in Axiomera v3) */
  R?: number;
  /** Skills points (0–333) */
  S?: number;
  /** Effort points (0–195) */
  E?: number;
  /** Working conditions points (50–350, separate compensator) */
  WC?: number;
}

/**
 * Convert overallScore (0-100) to a suggested Axiomera grade.
 * This is the FALLBACK when explicit R/S/E sub-scores are not available.
 */
export function overallScoreToGrade(overallScore: number): number {
  const clamped = Math.max(0, Math.min(100, overallScore));
  // Linear interpolation: 0 → 6, 100 → 30
  const grade = Math.round(6 + (clamped / 100) * 24);
  return Math.max(6, Math.min(30, grade));
}

/**
 * Compute the Axiomera grade from explicit R/S/E sub-scores.
 * Formula: Grade = round((R + S + E) / 50)
 */
export function computeAxiomeraGrade(scores: EvalSubScores): number {
  const r = scores.R ?? 0;
  const s = scores.S ?? 0;
  const e = scores.E ?? 0;
  const grade = Math.round((r + s + e) / 50);
  return Math.max(6, Math.min(30, grade));
}

export interface GradeSuggestion {
  grade: number;
  bandCode: string;
  bandLabel: string;
  bandColor: string;
  source: 'rse_sum' | 'overall_proxy' | 'manual';
  /** Human-readable explanation of how this grade was derived */
  rationale: string;
}

/**
 * Best-effort grade suggestion from any combination of inputs.
 * Prefers explicit R/S/E sub-scores; falls back to overallScore proxy.
 */
export function suggestGrade(input: {
  overallScore?: number;
  scores?: EvalSubScores;
  manualGrade?: number;
}): GradeSuggestion | null {
  let grade: number;
  let source: GradeSuggestion['source'];
  let rationale: string;

  if (input.manualGrade != null) {
    grade = Math.max(6, Math.min(30, input.manualGrade));
    source = 'manual';
    rationale = 'Manually set by user.';
  } else if (input.scores && (input.scores.R != null || input.scores.S != null || input.scores.E != null)) {
    grade = computeAxiomeraGrade(input.scores);
    source = 'rse_sum';
    const r = input.scores.R ?? 0;
    const s = input.scores.S ?? 0;
    const e = input.scores.E ?? 0;
    rationale = `Grade = round((R+S+E)/50) = round((${r}+${s}+${e})/50) = ${grade}`;
  } else if (input.overallScore != null) {
    grade = overallScoreToGrade(input.overallScore);
    source = 'overall_proxy';
    rationale = `Proxy from overallScore ${input.overallScore}% — explicit R/S/E breakdown not available.`;
  } else {
    return null;
  }

  const band = getBand(grade);
  if (!band) return null;

  return {
    grade,
    bandCode: gradeToBandCode(grade),
    bandLabel: band.label,
    bandColor: band.color,
    source,
    rationale,
  };
}

export { AXIOMERA_BANDS, gradeToBandCode };
