import { z } from 'zod';

// ── Template Field Schema ────────────────────────────────────────────────────
export const templateFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'select', 'radio', 'date']),
  required: z.boolean().optional().default(false),
  ai: z.boolean().optional(),
  hint: z.string().optional().default(''),
  priority: z.enum(['must', 'helpful', 'nice']).optional().default('must'),
  rows: z.number().min(1).max(20).optional(),
  opts: z.array(z.string()).optional(),
});
export type TemplateField = z.infer<typeof templateFieldSchema>;

// ── Template Section Schema ──────────────────────────────────────────────────
export const templateSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  desc: z.string().default(''),
  required: z.boolean().default(true),
  fields: z.array(templateFieldSchema).min(1),
});
export type TemplateSection = z.infer<typeof templateSectionSchema>;

// ── Template Schema ──────────────────────────────────────────────────────────
export const templateDataSchema = z.object({
  name: z.string().min(1).max(200),
  purpose: z.enum(['general', 'evaluation', 'recruitment', 'career', 'skills', 'custom']),
  description: z.string().max(1000).default(''),
  sections: z.array(templateSectionSchema).min(1).max(26),
});
export type TemplateData = z.infer<typeof templateDataSchema>;

// ── JD Field Values ──────────────────────────────────────────────────────────
export const jdDataSchema = z.record(z.string(), z.string().or(z.null())).default({});
export type JDData = z.infer<typeof jdDataSchema>;

// ── AI Analyse Input Response ────────────────────────────────────────────────
export const fieldScoreSchema = z.object({
  score: z.number().min(0).max(100),
  badge: z.enum(['good', 'needs-work', 'missing']),
  note: z.string(),
});
export type FieldScore = z.infer<typeof fieldScoreSchema>;

export const escoMatchSchema = z.object({
  code: z.string().nullable(),
  title: z.string().nullable(),
  confidence: z.enum(['high', 'medium', 'low']).nullable(),
  note: z.string().optional(),
});
export type EscoMatch = z.infer<typeof escoMatchSchema>;

export const analyseResponseSchema = z.object({
  extractedFields: z.record(z.string(), z.string()),
  dqsScore: z.number().min(0).max(100),
  ersScore: z.number().min(0).max(100),
  summaryGood: z.string(),
  summaryMissing: z.string(),
  summaryNextSteps: z.string(),
  escoMatch: escoMatchSchema,
  iscoMatch: z
    .object({
      code: z.string().nullable(),
      title: z.string().nullable(),
    })
    .optional(),
  readyForEvaluation: z.boolean(),
  missingCritical: z.array(z.string()),
  fieldScores: z.record(z.string(), fieldScoreSchema),
});
export type AnalyseResponse = z.infer<typeof analyseResponseSchema>;

// ── Evaluation Criterion Result ──────────────────────────────────────────────
export const criterionResultSchema = z.object({
  id: z.number().min(1).max(16),
  name: z.string(),
  status: z.enum(['sufficient', 'partial', 'insufficient']),
  assessedLevel: z.number().nullable(),
  maxLevel: z.number(),
  gaps: z.array(z.string()),
  followUpQuestion: z.string(),
});
export type CriterionResult = z.infer<typeof criterionResultSchema>;

export const evaluationResultSchema = z.object({
  overallCompleteness: z.number().min(0).max(100),
  summary: z.string(),
  criteria: z.array(criterionResultSchema),
});
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

// ── Honest Review Response ───────────────────────────────────────────────────
export const honestReviewSchema = z.object({
  verdict: z.enum(['Ready', 'Needs work', 'Not ready']),
  verdictReason: z.string(),
  drivesDecisionToday: z.enum(['yes', 'no', 'conditional']),
  drivesDecisionReason: z.string(),
  topWeaknesses: z.array(
    z.object({
      field: z.string(),
      issue: z.string(),
      fix: z.string(),
    }),
  ),
  auditorObjections: z.array(z.string()),
  topPriority: z.string(),
  overallNarrative: z.string(),
});
export type HonestReview = z.infer<typeof honestReviewSchema>;

// ── API Request Schemas ──────────────────────────────────────────────────────
export const analyseInputRequestSchema = z.object({
  text: z.string().min(20).max(50000),
  templateFieldIds: z.array(z.string()),
});

export const generateFieldRequestSchema = z.object({
  fieldLabel: z.string().min(1),
  jdText: z.string(),
});

export const evaluateRequestSchema = z.object({
  jdText: z.string().min(20),
});

export const honestReviewRequestSchema = z.object({
  jdText: z.string().min(20),
  dcScore: z.number().min(0).max(100),
  ersScore: z.number().min(0).max(100).nullable(),
  evalResult: evaluationResultSchema.nullable(),
});

export const endForNowRequestSchema = z.object({
  jdText: z.string().min(1),
  dqs: z.number().min(0).max(100),
});

// ── Guest Token Request ──────────────────────────────────────────────────────
export const createGuestTokenSchema = z.object({
  jdId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['VIEWER', 'REVIEWER']),
  expiryHours: z.number().min(1).max(720),
});

// ── JD Comment ───────────────────────────────────────────────────────────────
export const createCommentSchema = z.object({
  jdId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  fieldId: z.string().nullable().optional(),
});

// ── Company Profile ──────────────────────────────────────────────────────────
export const companyProfileSchema = z.object({
  name: z.string().max(200),
  country: z.string().max(10),
  size: z.enum(['micro', 'small', 'medium', 'large']),
  fte: z.string().max(20),
  industry: z.string().max(200),
  prevEval: z.boolean(),
  prevMethod: z.string().max(200),
  prevYear: z.string().max(10),
  goal: z.enum([
    'eu_directive_compliance',
    'pay_equity_audit',
    'restructuring',
    'new_system',
    'other',
  ]),
});
export type CompanyProfile = z.infer<typeof companyProfileSchema>;
