import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude } from '@/lib/ai';
import { HYPOTHESES, type HypothesisResult, type HypothesesTestReport, type HypothesisCategory, CATEGORY_LABELS } from '@/lib/hypotheses';

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert in job description analysis using a binary-hypothesis methodology aligned with the EU Pay Transparency Directive (EUPTD 2023/970) and the Axiomera/PRISM evaluation framework.

You evaluate one job description against a fixed set of structured hypotheses about the role. Each hypothesis is a single statement that is either TRUE, FALSE, or UNKNOWN based on the evidence in the JD.

Rules:
1. Base every verdict on the JD text only. Do not invent facts.
2. UNKNOWN is the correct verdict when the JD is silent or ambiguous about a hypothesis. Do not guess.
3. TRUE requires direct or strongly implied evidence in the text.
4. FALSE requires the text to contradict the hypothesis or describe the opposite explicitly.
5. For each hypothesis, return a confidence 0-100 reflecting how clear the evidence is.
6. When TRUE or FALSE, quote a SHORT evidence span (max ~120 chars) from the JD.
7. When UNKNOWN, give a one-line rationale explaining what is missing.

Output strict JSON only. No commentary outside the JSON.`;

interface RequestBody {
  jdText: string;
  jdId?: string;
  language?: 'pl' | 'en';
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { jdText, jdId, language = 'pl' } = body;
  if (!jdText || jdText.trim().length < 50) {
    return NextResponse.json({ error: 'JD text too short — provide at least 50 characters' }, { status: 400 });
  }

  // Build a numbered list of hypotheses (Polish text — matches the methodology source)
  const hypothesesPrompt = HYPOTHESES
    .map((h) => `${h.id}. [${h.key}] ${h.pl}`)
    .join('\n');

  const userMessage = `Job Description text:
"""
${jdText.slice(0, 12000)}
"""

For each of the following ${HYPOTHESES.length} hypotheses, return a verdict (TRUE | FALSE | UNKNOWN), confidence (0-100), and short evidence quote (if TRUE/FALSE) or rationale (if UNKNOWN).

Hypotheses:
${hypothesesPrompt}

Return JSON in this exact shape:
{
  "results": [
    { "id": 1, "key": "follows_fixed_procedures", "verdict": "TRUE|FALSE|UNKNOWN", "confidence": 0-100, "evidence": "short quote from JD or null", "rationale": "if UNKNOWN, what is missing" },
    ... (one entry per hypothesis, in order, all ${HYPOTHESES.length})
  ]
}`;

  let parsed: { results: HypothesisResult[] };
  try {
    const response = await callClaude(SYSTEM_PROMPT, userMessage, 8000,
      { operation: 'jd.testHypotheses', context: { orgId: session?.orgId, userId: session?.user?.id } });
    // Strip markdown code fences if present
    const cleaned = response
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'AI response could not be parsed as JSON', details: err.message },
      { status: 502 },
    );
  }

  if (!Array.isArray(parsed.results)) {
    return NextResponse.json({ error: 'Malformed AI response — missing results array' }, { status: 502 });
  }

  // Normalise + ensure every hypothesis has a result
  const resultMap = new Map<number, HypothesisResult>();
  for (const r of parsed.results) {
    if (typeof r.id !== 'number') continue;
    const verdict = (r.verdict?.toUpperCase() || 'UNKNOWN') as HypothesisResult['verdict'];
    resultMap.set(r.id, {
      id: r.id,
      key: r.key,
      verdict: verdict === 'TRUE' || verdict === 'FALSE' ? verdict : 'UNKNOWN',
      confidence: Math.max(0, Math.min(100, Number(r.confidence) || 0)),
      evidence: r.evidence || undefined,
      rationale: r.rationale || undefined,
    });
  }
  const results: HypothesisResult[] = HYPOTHESES.map(
    (h) =>
      resultMap.get(h.id) || {
        id: h.id,
        key: h.key,
        verdict: 'UNKNOWN' as const,
        confidence: 0,
        rationale: 'No response received from AI for this hypothesis.',
      },
  );

  // Aggregate counts
  let trueCount = 0, falseCount = 0, unknownCount = 0;
  for (const r of results) {
    if (r.verdict === 'TRUE') trueCount++;
    else if (r.verdict === 'FALSE') falseCount++;
    else unknownCount++;
  }

  // Aggregate by category
  const byCategory: HypothesesTestReport['byCategory'] = {} as any;
  for (const cat of Object.keys(CATEGORY_LABELS) as HypothesisCategory[]) {
    byCategory[cat] = { total: 0, trueCount: 0, falseCount: 0, unknownCount: 0, pctTrue: 0 };
  }
  for (const h of HYPOTHESES) {
    const r = resultMap.get(h.id);
    const bucket = byCategory[h.category];
    bucket.total++;
    if (r?.verdict === 'TRUE') bucket.trueCount++;
    else if (r?.verdict === 'FALSE') bucket.falseCount++;
    else bucket.unknownCount++;
  }
  for (const cat of Object.keys(byCategory) as HypothesisCategory[]) {
    const b = byCategory[cat];
    b.pctTrue = b.total > 0 ? Math.round((b.trueCount / b.total) * 100) : 0;
  }

  const report: HypothesesTestReport = {
    jdId,
    testedAt: new Date().toISOString(),
    language,
    totalHypotheses: HYPOTHESES.length,
    trueCount,
    falseCount,
    unknownCount,
    results,
    byCategory,
  };

  return NextResponse.json(report);
}
