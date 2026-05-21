/**
 * JD Evaluation Readiness — Claude-powered analysis.
 *
 * Scores a job description against the six minimum gradeability elements
 * required for a proper job evaluation:
 *   1. Role purpose
 *   2. Top responsibilities
 *   3. Decision rights / authority
 *   4. Scope of impact
 *   5. Reporting relationships
 *   6. Critical requirements
 *
 * Output is a structured readiness record with scores, flags,
 * recommended questions for HR, and improvement suggestions.
 *
 * The LLM must cite text from the source; it cannot invent reporting lines,
 * salary, grade, or team membership without explicit evidence.
 */

import { AI_MODEL } from '@/lib/ai';
import type { JDEvaluationReadiness, EvidenceItem, EvidenceStrength } from './types';

const TIMEOUT_MS = 60_000;
const MAX_DESC_CHARS = 12_000;

const SYSTEM_PROMPT = `You are a senior job evaluation analyst. Your task is to assess a job description for evaluation readiness.

Evaluate whether the JD provides sufficient evidence for each of the six minimum gradeability elements:
1. Role purpose — does it state WHY this role exists?
2. Top responsibilities — are the main accountabilities clearly listed?
3. Decision rights — what authority does the role have? Budget? Hiring? Strategy?
4. Scope of impact — what is the scale? (FTEs managed, budget, geography, customer impact)
5. Reporting relationships — who does this role report to? Who reports to it?
6. Critical requirements — what experience/qualifications are truly required vs nice-to-have?

Output STRICT JSON only:
{
  "rolePurpose": { "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null },
  "topResponsibilities": [{ "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null }],
  "decisionRights": { "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null },
  "scopeOfImpact": { "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null },
  "reportingRelationships": { "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null },
  "criticalRequirements": [{ "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null }],
  "skillsEvidence": [{ "text": string, "strength": "DIRECT"|"INFERRED"|"MISSING", "sourceNote": string|null }],
  "missingEvidence": string[],
  "ambiguityFlags": string[],
  "recruitmentCopyWarning": boolean,
  "evaluationReadinessScore": number,
  "confidenceScore": number,
  "recommendedQuestionsForHR": string[],
  "recommendedImprovements": string[]
}

Rules:
- strength "DIRECT": text is explicitly stated in the JD
- strength "INFERRED": text can be reasonably inferred from context (explain how)
- strength "MISSING": this element is absent
- evaluationReadinessScore: 0-100. >70 = evaluation-ready. <40 = recruitment copy only.
- confidenceScore: 0-100. Your confidence in the assessment.
- recruitmentCopyWarning: true if the document reads more like a recruitment advert than an evaluation-grade JD.
- NEVER invent reporting lines, salary, grade, or headcount not present in the source.
- NEVER guess the manager's name.
- sourceNote: quote the exact phrase from the JD that supports your claim (max 80 chars), or null.
- Output JSON only. No prose. No markdown fences.`;

async function callClaude(userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    const e = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(e.error?.message || `Anthropic ${res.status}`);
  }
  const data = await res.json() as { content?: Array<{ text?: string }> };
  return (data.content?.[0]?.text || '').trim();
}

function parseJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

function safeEvidence(raw: unknown): EvidenceItem {
  const r = raw as Partial<EvidenceItem> | null;
  if (!r || typeof r !== 'object') {
    return { text: '', strength: 'MISSING', sourceNote: null };
  }
  return {
    text: String(r.text || ''),
    strength: (['DIRECT', 'INFERRED', 'MISSING'].includes(r.strength as string) ? r.strength : 'MISSING') as EvidenceStrength,
    sourceNote: r.sourceNote ? String(r.sourceNote) : null,
  };
}

function safeEvidenceArray(raw: unknown): EvidenceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(safeEvidence).filter((e) => e.text);
}

function safeStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

interface RawReadiness {
  rolePurpose?: unknown;
  topResponsibilities?: unknown;
  decisionRights?: unknown;
  scopeOfImpact?: unknown;
  reportingRelationships?: unknown;
  criticalRequirements?: unknown;
  skillsEvidence?: unknown;
  missingEvidence?: unknown;
  ambiguityFlags?: unknown;
  recruitmentCopyWarning?: unknown;
  evaluationReadinessScore?: unknown;
  confidenceScore?: unknown;
  recommendedQuestionsForHR?: unknown;
  recommendedImprovements?: unknown;
}

export async function analyseJDReadiness(opts: {
  title: string;
  description: string;
  companyName?: string;
  location?: string;
}): Promise<JDEvaluationReadiness> {
  const desc = opts.description.slice(0, MAX_DESC_CHARS);

  const userMessage = [
    opts.companyName ? `Company: ${opts.companyName}` : null,
    `Title: ${opts.title}`,
    opts.location ? `Location: ${opts.location}` : null,
    '',
    '=== JOB DESCRIPTION ===',
    desc,
  ]
    .filter((l) => l !== null)
    .join('\n');

  const raw = await callClaude(userMessage);
  let parsed: RawReadiness;
  try {
    parsed = parseJson(raw) as RawReadiness;
  } catch {
    // Return a degraded result rather than throwing
    return {
      rolePurpose: { text: '', strength: 'MISSING', sourceNote: null },
      topResponsibilities: [],
      decisionRights: { text: '', strength: 'MISSING', sourceNote: null },
      scopeOfImpact: { text: '', strength: 'MISSING', sourceNote: null },
      reportingRelationships: { text: '', strength: 'MISSING', sourceNote: null },
      criticalRequirements: [],
      skillsEvidence: [],
      missingEvidence: ['AI analysis failed — manual review required'],
      ambiguityFlags: [],
      recruitmentCopyWarning: false,
      evaluationReadinessScore: 0,
      confidenceScore: 0,
      recommendedQuestionsForHR: [],
      recommendedImprovements: ['Request a structured JD from HR using the JD evaluation template.'],
    };
  }

  return {
    rolePurpose: safeEvidence(parsed.rolePurpose),
    topResponsibilities: safeEvidenceArray(parsed.topResponsibilities),
    decisionRights: safeEvidence(parsed.decisionRights),
    scopeOfImpact: safeEvidence(parsed.scopeOfImpact),
    reportingRelationships: safeEvidence(parsed.reportingRelationships),
    criticalRequirements: safeEvidenceArray(parsed.criticalRequirements),
    skillsEvidence: safeEvidenceArray(parsed.skillsEvidence),
    missingEvidence: safeStrings(parsed.missingEvidence),
    ambiguityFlags: safeStrings(parsed.ambiguityFlags),
    recruitmentCopyWarning: !!parsed.recruitmentCopyWarning,
    evaluationReadinessScore: Math.max(0, Math.min(100, Number(parsed.evaluationReadinessScore) || 0)),
    confidenceScore: Math.max(0, Math.min(100, Number(parsed.confidenceScore) || 0)),
    recommendedQuestionsForHR: safeStrings(parsed.recommendedQuestionsForHR),
    recommendedImprovements: safeStrings(parsed.recommendedImprovements),
  };
}

/** Compute a fast readiness score without AI (deterministic heuristics). */
export function quickReadinessScore(description: string): number {
  if (!description || description.length < 100) return 0;
  let score = 0;

  // Length is a rough proxy for content
  if (description.length > 500) score += 10;
  if (description.length > 1500) score += 10;
  if (description.length > 3000) score += 10;

  // Check for key evaluation elements
  const lower = description.toLowerCase();
  if (/report\s+to|reporting\s+to|reports\s+to/i.test(lower)) score += 15;
  if (/responsible\s+for|responsibilities|accountab/i.test(lower)) score += 15;
  if (/decision|authorit|approv|budget|sign-?off/i.test(lower)) score += 15;
  if (/scope|geography|region|country|global|headcount|fte|team of/i.test(lower)) score += 10;
  if (/require|qualification|experience|degree|certification/i.test(lower)) score += 10;
  if (/purpose|mission|objective|why this role/i.test(lower)) score += 5;

  return Math.min(100, score);
}
