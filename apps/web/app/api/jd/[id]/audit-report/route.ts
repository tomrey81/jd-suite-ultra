import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { analyseBias } from '@/lib/bias/engine';
import { lexiconVersion } from '@/lib/bias/loader';
import { CRITERIA, EVAL_CATEGORIES, type JDStatus } from '@jd-suite/types';
import { AI_MODEL, JD_SYSTEM_PROMPT } from '@/lib/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface JDRecord {
  id: string;
  jobTitle: string;
  status: JDStatus | string;
  data: Record<string, string | undefined> | null;
  folder: string | null;
  createdAt: Date;
  updatedAt: Date;
  orgId: string;
  ownerId: string | null;
}

const SECTION_ORDER: Array<{ id: string; label: string; fields: Array<{ key: string; label: string }> }> = [
  { id: 'A', label: 'Identification', fields: [
    { key: 'jobTitle', label: 'Job title' },
    { key: 'jobCode', label: 'Job code' },
    { key: 'orgUnit', label: 'Organisational unit' },
    { key: 'jobFamily', label: 'Job family' },
  ]},
  { id: 'B', label: 'Job purpose', fields: [
    { key: 'jobPurpose', label: 'Purpose' },
    { key: 'positionType', label: 'Position type' },
  ]},
  { id: 'C', label: 'Knowledge & qualifications', fields: [
    { key: 'minEducation', label: 'Minimum education' },
    { key: 'minExperience', label: 'Minimum experience' },
    { key: 'keyKnowledge', label: 'Key knowledge' },
    { key: 'languageReqs', label: 'Languages' },
  ]},
  { id: 'D', label: 'Key responsibilities', fields: [
    { key: 'responsibilities', label: 'Responsibilities' },
  ]},
  { id: 'E', label: 'Problem complexity & planning', fields: [
    { key: 'problemComplexity', label: 'Typical problems solved' },
    { key: 'planningScope', label: 'Planning horizon' },
  ]},
  { id: 'F', label: 'Communication & stakeholders', fields: [
    { key: 'internalStakeholders', label: 'Internal stakeholders' },
    { key: 'externalContacts', label: 'External contacts' },
    { key: 'communicationMode', label: 'Highest communication mode' },
  ]},
  { id: 'G', label: 'Tools & systems', fields: [
    { key: 'systems', label: 'Systems / software' },
    { key: 'physicalSkills', label: 'Physical / manual skills' },
  ]},
  { id: 'H', label: 'Responsibility — people, budget, impact', fields: [
    { key: 'peopleManagement', label: 'People management' },
    { key: 'budgetAuthority', label: 'Budget authority' },
    { key: 'impactScope', label: 'Impact scope' },
  ]},
  { id: 'I', label: 'Working conditions', fields: [
    { key: 'workLocation', label: 'Location / arrangement' },
    { key: 'travelReqs', label: 'Travel' },
    { key: 'workingConditions', label: 'Specific conditions' },
  ]},
];

interface AxisSummary {
  key: string;
  label: string;
  color: string;
  score: number;
  status: 'sufficient' | 'partial' | 'insufficient';
  ok: number;
  partial: number;
  gap: number;
  gapItems: Array<{ id: number; name: string; gap: string }>;
}

const AXIS_LABEL: Record<string, string> = {
  'Knowledge and Skills': 'Skills',
  'Effort': 'Effort',
  'Responsibility': 'Responsibility',
  'Work Environment': 'Working Conditions',
};

interface EvalResult {
  overallCompleteness: number;
  summary: string;
  criteria: Array<{ id: number; name?: string; status: 'sufficient' | 'partial' | 'insufficient'; gaps?: string[] }>;
}

async function runEvaluation(jdText: string): Promise<EvalResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !jdText.trim()) return null;

  const systemPrompt = `${JD_SYSTEM_PROMPT}

You are now in JD-audit mode. Score this JD against the 16-criterion ILO/EIGE framework. Output STRICT JSON only:
{
  "overallCompleteness": number (0..100),
  "summary": "1-2 sentence verdict",
  "criteria": [
    { "id": 1..16, "name": "<criterion>", "status": "sufficient"|"partial"|"insufficient", "gaps": ["short bullet"] }
  ]
}
Return all 16 criteria, in order. JSON only.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: jdText.slice(0, 20_000) }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let text = (data.content?.[0]?.text || '').trim();
    if (text.startsWith('```')) text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    if (a >= 0 && b > a) text = text.slice(a, b + 1);
    return JSON.parse(text) as EvalResult;
  } catch {
    return null;
  }
}

function scoreFromStatus(s: 'sufficient' | 'partial' | 'insufficient'): number {
  return s === 'sufficient' ? 100 : s === 'partial' ? 55 : 15;
}

function detectLanguage(jdText: string): 'en' | 'pl' {
  // Lightweight heuristic — Polish-specific letters present?
  return /[ąćęłńóśźż]/i.test(jdText) ? 'pl' : 'en';
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  if (!membership) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  const { id } = await params;
  const jd = await db.jobDescription.findFirst({
    where: { id, orgId: membership.orgId },
    select: {
      id: true, jobTitle: true, status: true, data: true, folder: true,
      createdAt: true, updatedAt: true, orgId: true, ownerId: true,
    },
  }) as JDRecord | null;
  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const data = (jd.data || {}) as Record<string, string | undefined>;

  // Build flat text for evaluators
  const jdText = SECTION_ORDER
    .flatMap((sec) => sec.fields.map((f) => {
      const v = data[f.key];
      return v ? `${f.label}: ${v}` : null;
    }))
    .filter(Boolean)
    .join('\n');

  const url = new URL(req.url);
  const skipAI = url.searchParams.get('skipAI') === '1';

  // Per-section completeness
  const sectionsWithCounts = SECTION_ORDER.map((sec) => {
    const filled = sec.fields.filter((f) => (data[f.key] || '').trim().length > 0).length;
    return {
      ...sec,
      filled,
      total: sec.fields.length,
      completeness: sec.fields.length === 0 ? 0 : Math.round((filled / sec.fields.length) * 100),
    };
  });
  const overallCompleteness = Math.round(
    sectionsWithCounts.reduce((a, b) => a + b.completeness, 0) / sectionsWithCounts.length,
  );

  // Bias scan — runs locally, no AI
  const language = detectLanguage(jdText);
  const bias = analyseBias(jdText, language);

  // EUPTD evaluation — AI call, may be skipped or fail gracefully
  const evalRes = skipAI ? null : await runEvaluation(jdText);

  const axes: AxisSummary[] = EVAL_CATEGORIES.map((cat) => {
    const items = (evalRes?.criteria || []).filter((c) => (cat.ids as readonly number[]).includes(c.id));
    if (items.length === 0) {
      return {
        key: cat.name, label: AXIS_LABEL[cat.name] || cat.name, color: cat.col,
        score: 0, status: 'insufficient', ok: 0, partial: 0, gap: 0, gapItems: [],
      };
    }
    const score = Math.round(items.reduce((a, c) => a + scoreFromStatus(c.status), 0) / items.length);
    const status = score >= 75 ? 'sufficient' : score >= 50 ? 'partial' : 'insufficient';
    return {
      key: cat.name, label: AXIS_LABEL[cat.name] || cat.name, color: cat.col,
      score, status,
      ok: items.filter((c) => c.status === 'sufficient').length,
      partial: items.filter((c) => c.status === 'partial').length,
      gap: items.filter((c) => c.status === 'insufficient').length,
      gapItems: items.filter((c) => c.status !== 'sufficient').map((c) => {
        const meta = CRITERIA.find((x) => x.id === c.id);
        return { id: c.id, name: c.name || meta?.name || `Criterion ${c.id}`, gap: c.gaps?.[0] || '' };
      }),
    };
  });

  // Verdict
  const minAxis = axes.length > 0 ? Math.min(...axes.map((a) => a.score)) : 0;
  const totalGaps = axes.reduce((a, b) => a + b.gap, 0);
  const overallEval = axes.length > 0
    ? Math.round(axes.reduce((a, b) => a + b.score, 0) / axes.length)
    : 0;
  const combined = Math.round(overallEval * 0.7 + overallCompleteness * 0.3);

  let verdict: { level: 'ready' | 'review' | 'not_ready'; headline: string; detail: string };
  if (!evalRes) {
    verdict = {
      level: 'review',
      headline: 'Document completeness only',
      detail: `EUPTD AI evaluation skipped or unavailable. Document completeness: ${overallCompleteness}%.`,
    };
  } else if (totalGaps === 0 && minAxis >= 75 && combined >= 80) {
    verdict = { level: 'ready', headline: 'Looks good', detail: 'All four EUPTD axes are covered. Regulator-defensible.' };
  } else if (minAxis < 50 || totalGaps >= 4) {
    verdict = {
      level: 'not_ready',
      headline: 'Needs significant work',
      detail: `${totalGaps} criteria missing across ${axes.filter((a) => a.gap > 0).length} axes.`,
    };
  } else {
    const weakest = axes.reduce((w, a) => a.score < w.score ? a : w, axes[0]);
    verdict = {
      level: 'review',
      headline: 'Needs review',
      detail: `${weakest.label} is the weakest axis (${weakest.score}%). Fix the items below before sign-off.`,
    };
  }

  return NextResponse.json({
    ok: true,
    jd: {
      id: jd.id,
      jobTitle: jd.jobTitle,
      status: jd.status,
      folder: jd.folder,
      createdAt: jd.createdAt.toISOString(),
      updatedAt: jd.updatedAt.toISOString(),
    },
    overall: {
      combined, overallCompleteness, overallEval,
    },
    verdict,
    axes,
    sections: sectionsWithCounts.map((s) => ({
      id: s.id, label: s.label, completeness: s.completeness, filled: s.filled, total: s.total,
      missingFields: s.fields.filter((f) => !(data[f.key] || '').trim()).map((f) => f.label),
    })),
    bias: {
      language: bias.language,
      lexiconVersion: lexiconVersion(language),
      agenticCount: bias.agenticCount,
      communalCount: bias.communalCount,
      skewScore: bias.skewScore,
      skewLevel: bias.skewLevel,
      flagsCount: bias.flags.length,
      eigeCoverage: bias.eigeCoverage,
      implicit: bias.implicit,
      topFlags: bias.flags.slice(0, 8).map((f) => ({
        category: f.category, severity: f.severity, matched: f.matched, notes: f.notes,
      })),
    },
    eval: evalRes ? {
      summary: evalRes.summary,
      criteria: evalRes.criteria.map((c) => ({
        id: c.id, status: c.status, gaps: c.gaps || [],
      })),
    } : null,
    generatedAt: new Date().toISOString(),
  });
}
