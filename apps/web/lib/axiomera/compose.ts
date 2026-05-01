/**
 * Axiomera composite scoring per Whitepaper v1.0 (April 2026).
 *
 * Grade = round((R + S + E) / 50). WC is a separate compensation, not part of grade.
 *
 * Default weights from Whitepaper Table 14:
 *   R: 47.2%
 *   S: 33.3%
 *   E: 19.5%
 *
 * R points come from Table 12 geometric scale (R_ZONE_POINTS).
 * S points from Table 14 5×5 matrix (50/90/150/230/333).
 * E points = E_score × 430.
 * WC points 50–350 per Table 20 (ISCO_2 lookup).
 */

export interface RSEWeights {
  R: number;
  S: number;
  E: number;
}

export const AXIOMERA_RSE_WEIGHTS: RSEWeights = {
  R: 0.472,
  S: 0.333,
  E: 0.195,
};

export const SENSITIVITY_EFFORT_BOOSTED: RSEWeights = {
  R: 0.45,
  S: 0.25,
  E: 0.30,
};

export const SENSITIVITY_SETS: Record<
  string,
  { label: string; weights: RSEWeights; use_case: string }
> = {
  effort_boosted: {
    label: '45 / 25 / 30 — Effort-boosted',
    weights: SENSITIVITY_EFFORT_BOOSTED,
    use_case: 'Stress-test for emotionally or physically demanding roles.',
  },
};

/**
 * Compute grade composite points from R, S, E points.
 * Grade = round((R_pkt + S_pkt + E_pkt) / 50) — Axiomera Whitepaper Table 14.
 */
export function computeGrade(R_pkt: number, S_pkt: number, E_pkt: number): number {
  return Math.round((R_pkt + S_pkt + E_pkt) / 50);
}

/**
 * Map a grade number to its band label per Whitepaper Table 11.
 *   A1–A5 = grades 6–10
 *   B1–B5 = grades 11–15
 *   C1–C5 = grades 16–20
 *   D1–D5 = grades 21–25
 *   E1–E5 = grades 26–30
 * Out-of-range grades return 'A1' (low) or 'E5' (high).
 */
export function gradeToBand(grade: number): string {
  if (grade < 6) return 'A1';
  if (grade > 30) return 'E5';
  const bands = ['A', 'B', 'C', 'D', 'E'];
  const offset = grade - 6;
  const bandIndex = Math.floor(offset / 5);
  const slot = (offset % 5) + 1;
  return `${bands[bandIndex]}${slot}`;
}

/** Compute global confidence interval per Whitepaper §EU AI Act mapping. */
export function computeCiGlobal(ci_R: number, ci_E: number): number {
  return 0.65 * ci_R + 0.35 * ci_E;
}

/** Whitepaper risk-management rule: contradiction if |CI_R - CI_E| > 0.30. */
export function isContradiction(ci_R: number, ci_E: number): boolean {
  return Math.abs(ci_R - ci_E) > 0.30;
}

/** Threshold below which expert review is required. */
export const CI_REVIEW_THRESHOLD = 0.6;

export function needsReview(ciGlobal: number, contradictionFlag: boolean): boolean {
  return contradictionFlag || ciGlobal < CI_REVIEW_THRESHOLD;
}

function confidenceLevelToNumeric(level: 'high' | 'medium' | 'low'): number {
  if (level === 'high') return 0.85;
  if (level === 'medium') return 0.65;
  return 0.40;
}

export function ciFromConfidence(level: 'high' | 'medium' | 'low'): number {
  return confidenceLevelToNumeric(level);
}

/**
 * JDQ Quality layer composite (Pro Max heritage).
 * Composite 0–100 + per-layer traffic light + overall light.
 */
export interface JDQWeights {
  structure: number;
  language: number;
  factors: number;
  decision: number;
}

export const DEFAULT_JDQ_WEIGHTS: JDQWeights = {
  structure: 0.25,
  language: 0.25,
  factors: 0.25,
  decision: 0.25,
};

export type TrafficLight = 'green' | 'amber' | 'red';

export interface JDQInput {
  structure_coverage: number;
  language_score: number;
  factors_score: number;
  decision_score: number;
}

export interface JDQResult {
  weights: JDQWeights;
  per_layer: {
    structure: { score: number; light: TrafficLight };
    language: { score: number; light: TrafficLight };
    factors: { score: number; light: TrafficLight };
    decision: { score: number; light: TrafficLight };
  };
  composite: number;
  overall_light: TrafficLight;
}

function light(score: number): TrafficLight {
  if (score >= 75) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

export function composeJDQ(
  input: JDQInput,
  weights: JDQWeights = DEFAULT_JDQ_WEIGHTS,
): JDQResult {
  const total = weights.structure + weights.language + weights.factors + weights.decision;
  const w = {
    structure: weights.structure / total,
    language: weights.language / total,
    factors: weights.factors / total,
    decision: weights.decision / total,
  };
  const composite =
    input.structure_coverage * w.structure +
    input.language_score * w.language +
    input.factors_score * w.factors +
    input.decision_score * w.decision;
  return {
    weights,
    per_layer: {
      structure: { score: input.structure_coverage, light: light(input.structure_coverage) },
      language: { score: input.language_score, light: light(input.language_score) },
      factors: { score: input.factors_score, light: light(input.factors_score) },
      decision: { score: input.decision_score, light: light(input.decision_score) },
    },
    composite: Math.round(composite * 10) / 10,
    overall_light: light(composite),
  };
}
