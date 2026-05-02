/**
 * Axiomera orchestrator. Runs the full R/S/E/WC pipeline on a JD and
 * persists the result to AxiomeraRun + AxiomeraCriterionScore + AxiomeraValidationGate.
 *
 * Flow per Whitepaper §Architektura systemu Axiomera:
 *   1. R-zone classification (Claude + 19 hypotheses)
 *   2. S-classification (Edu × Exp matrix; ESCO/ISCO_2 fallback)
 *   3. E-extraction (Claude + 45 hypotheses)
 *   4. WC-determination (ISCO_2 lookup)
 *   5. Composite (Grade = round((R+S+E)/50))
 *   6. Confidence + contradiction flags
 *   7. Persist
 */

import { db } from '@jd-suite/db';
import { extractR } from './extract-r';
import { extractE } from './extract-e';
import {
  AXIOMERA_RSE_WEIGHTS,
  computeGrade,
  gradeToBand,
  computeCiGlobal,
  isContradiction,
  needsReview,
  ciFromConfidence,
} from './compose';
import { sPointsFromEduExp, sPointsFromJobZone, type SLevel } from './hypotheses/s-scale';
import { wcPointsFromIsco2, wcLevelFromPoints } from './hypotheses/wc-scale';
import type { CallAiContext } from '../ai/call-ai';

export interface AxiomeraRunInput {
  jdId: string;
  jdText: string;
  /** Declared Edu (1-5). If absent, S falls back to ESCO/ISCO_2. */
  declaredEdu?: SLevel;
  /** Declared Exp (1-5). */
  declaredExp?: SLevel;
  /** Declared ISCO_2 code (e.g., 24 for "Specialists in business and administration"). */
  declaredIsco2?: number;
  /** Declared ESCO Job Zone (1-5). */
  declaredJobZone?: SLevel;
  jdVersionId?: string;
  programId?: string;
  context?: CallAiContext;
  createdById?: string;
}

export interface AxiomeraRunOutput {
  runId: string;
  rPkt: number;
  rZone: number;
  rConfidence: number;
  sPkt: number;
  sLevel: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  sSource: 'primary' | 'esco' | 'isco_median';
  ePkt: number;
  eScore: number;
  cogScore: number;
  emoScore: number;
  phyScore: number;
  eConfidence: number;
  wcPkt: number;
  wcLevel: 'W1' | 'W2' | 'W3' | 'W4' | 'W5';
  totalRSE: number;
  grade: number;
  band: string;
  ciGlobal: number;
  contradictionFlag: boolean;
  needsReview: boolean;
  rActiveKeys: string[];
  eActiveKeys: string[];
  rContradictions: string[];
}

function sLevelFromPoints(pts: number): 'S1' | 'S2' | 'S3' | 'S4' | 'S5' {
  if (pts >= 333) return 'S5';
  if (pts >= 230) return 'S4';
  if (pts >= 150) return 'S3';
  if (pts >= 90) return 'S2';
  return 'S1';
}

export async function runAxiomera(input: AxiomeraRunInput): Promise<AxiomeraRunOutput> {
  const ctx: CallAiContext = {
    ...(input.context ?? {}),
    jdId: input.jdId,
    programId: input.programId,
  };

  // 1 + 3. Run R and E extractions in parallel (independent)
  const [rResult, eResult] = await Promise.all([
    extractR(input.jdText, ctx),
    extractE(input.jdText, ctx),
  ]);

  // 2. S — Skills
  let sPkt: number;
  let sSource: 'primary' | 'esco' | 'isco_median';
  if (input.declaredEdu && input.declaredExp) {
    sPkt = sPointsFromEduExp(input.declaredEdu, input.declaredExp);
    sSource = 'primary';
  } else if (input.declaredJobZone) {
    sPkt = sPointsFromJobZone(input.declaredJobZone);
    sSource = 'esco';
  } else {
    // Conservative default if nothing declared: S2 (basic qualifications)
    sPkt = 90;
    sSource = 'isco_median';
  }
  const sLevel = sLevelFromPoints(sPkt);

  // 4. WC — Working Conditions
  let wcPkt: number;
  if (input.declaredIsco2 !== undefined) {
    wcPkt = wcPointsFromIsco2(input.declaredIsco2);
  } else {
    // Default for "knowledge worker" baseline (ISCO_2 ~24)
    wcPkt = 50;
  }
  const wcLevel = wcLevelFromPoints(wcPkt);

  // 5. Composite — Grade = round((R + S + E) / 50)
  const totalRSE = rResult.r_points + sPkt + eResult.e_pkt;
  const grade = computeGrade(rResult.r_points, sPkt, eResult.e_pkt);
  const band = gradeToBand(grade);

  // 6. Confidence + contradictions
  const ciR = ciFromConfidence(rResult.confidence);
  const ciE = ciFromConfidence(eResult.confidence);
  const ciGlobal = computeCiGlobal(ciR, ciE);
  const contradictionFlag = isContradiction(ciR, ciE) || rResult.contradictions.length > 0;
  const needsReviewFlag = needsReview(ciGlobal, contradictionFlag);

  // 7. Persist
  // Cast to any until prisma client regenerates with new models
  const dbAny = db as unknown as {
    axiomeraRun: {
      create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    };
    axiomeraCriterionScore: {
      createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>;
    };
    axiomeraValidationGate: {
      createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>;
    };
  };

  const run = await dbAny.axiomeraRun.create({
    data: {
      jdId: input.jdId,
      jdVersionId: input.jdVersionId ?? null,
      programId: input.programId ?? null,
      engineVersion: 'axiomera-v1.0',
      promptVersionR: 'v1.0.0',
      promptVersionE: 'v1.0.0',
      rPkt: rResult.r_points,
      rZone: rResult.rounded_zone,
      rConfidence: ciR,
      rActiveKeys: rResult.active_keys,
      rEvidence: rResult.evidence,
      rContradictions: rResult.contradictions,
      sPkt,
      sLevel,
      sSource,
      sEdu: input.declaredEdu ?? null,
      sExp: input.declaredExp ?? null,
      sIscoCode: input.declaredIsco2 ? String(input.declaredIsco2) : null,
      ePkt: eResult.e_pkt,
      eScore: eResult.e_score,
      cogScore: eResult.cog,
      emoScore: eResult.emo,
      phyScore: eResult.phy,
      eConfidence: ciE,
      eActiveKeys: eResult.active_keys,
      eEvidence: eResult.evidence,
      wcPkt,
      wcLevel,
      wcIscoCode: input.declaredIsco2 ? String(input.declaredIsco2) : null,
      totalRSE,
      grade,
      band,
      ciGlobal,
      contradictionFlag,
      needsReview: needsReviewFlag,
      createdById: input.createdById ?? null,
    },
  });

  // Per-dimension breakdown
  await dbAny.axiomeraCriterionScore.createMany({
    data: [
      {
        runId: run.id,
        dimension: 'R',
        rawScore: rResult.r_points,
        normalizedScore: (rResult.r_points / 635) * 100,
        pointsContribution: rResult.r_points,
        weight: AXIOMERA_RSE_WEIGHTS.R,
      },
      {
        runId: run.id,
        dimension: 'S',
        rawScore: sPkt,
        normalizedScore: (sPkt / 333) * 100,
        pointsContribution: sPkt,
        weight: AXIOMERA_RSE_WEIGHTS.S,
      },
      {
        runId: run.id,
        dimension: 'E_COG',
        rawScore: eResult.cog,
        normalizedScore: eResult.cog,
        pointsContribution: Math.round(eResult.cog * 0.45 * 4.3),
        weight: 0.45,
      },
      {
        runId: run.id,
        dimension: 'E_EMO',
        rawScore: eResult.emo,
        normalizedScore: eResult.emo,
        pointsContribution: Math.round(eResult.emo * 0.25 * 4.3),
        weight: 0.25,
      },
      {
        runId: run.id,
        dimension: 'E_PHY',
        rawScore: eResult.phy,
        normalizedScore: eResult.phy,
        pointsContribution: Math.round(eResult.phy * 0.30 * 4.3),
        weight: 0.30,
      },
      {
        runId: run.id,
        dimension: 'WC',
        rawScore: wcPkt,
        normalizedScore: ((wcPkt - 50) / 300) * 100,
        pointsContribution: wcPkt,
        weight: 0,
      },
    ],
  });

  // Validation gates
  const gates: Array<Record<string, unknown>> = [
    {
      runId: run.id,
      gateName: 'CI_global_threshold_0.6',
      passed: ciGlobal >= 0.6,
      threshold: 0.6,
      observed: ciGlobal,
      message: ciGlobal < 0.6 ? 'Global confidence below threshold; expert review required.' : null,
    },
    {
      runId: run.id,
      gateName: 'CI_R_E_diff_0.3',
      passed: !isContradiction(ciR, ciE),
      threshold: 0.3,
      observed: Math.abs(ciR - ciE),
      message: isContradiction(ciR, ciE)
        ? 'R and E confidence diverge by more than 0.30; cross-check evidence.'
        : null,
    },
    {
      runId: run.id,
      gateName: 'R_no_contradictions',
      passed: rResult.contradictions.length === 0,
      threshold: 0,
      observed: rResult.contradictions.length,
      message: rResult.contradictions.length > 0 ? rResult.contradictions.join('; ') : null,
    },
  ];
  await dbAny.axiomeraValidationGate.createMany({ data: gates });

  return {
    runId: run.id,
    rPkt: rResult.r_points,
    rZone: rResult.rounded_zone,
    rConfidence: ciR,
    sPkt,
    sLevel,
    sSource,
    ePkt: eResult.e_pkt,
    eScore: eResult.e_score,
    cogScore: eResult.cog,
    emoScore: eResult.emo,
    phyScore: eResult.phy,
    eConfidence: ciE,
    wcPkt,
    wcLevel,
    totalRSE,
    grade,
    band,
    ciGlobal,
    contradictionFlag,
    needsReview: needsReviewFlag,
    rActiveKeys: rResult.active_keys,
    eActiveKeys: eResult.active_keys,
    rContradictions: rResult.contradictions,
  };
}
