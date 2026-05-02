import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude, JD_SYSTEM_PROMPT } from '@/lib/ai';
import { honestReviewRequestSchema } from '@jd-suite/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = honestReviewRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { jdText, dcScore, ersScore, evalResult } = parsed.data;
    const criteria = evalResult?.criteria || [];
    const gaps = criteria.filter((c) => c.status === 'insufficient').length;
    const partial = criteria.filter((c) => c.status === 'partial').length;

    const raw = await callClaude(
      JD_SYSTEM_PROMPT,
      `Give an honest, direct assessment of this job description. Be specific and candid — not diplomatic padding.

JD CONTENT:
${jdText}

SCORES:
- Document Completeness: ${dcScore}%
- Evaluation Readiness: ${ersScore || 'not yet scored'}%
- 16-Criteria: ${criteria.length > 0 ? `${criteria.length - gaps - partial} sufficient, ${partial} partial, ${gaps} gaps` : 'not evaluated'}

Assess honestly:
1. Is this JD good enough to drive a hiring, pay equity, or grading decision TODAY? (yes / no / conditional)
2. What are the 2-3 most significant weaknesses — be specific, name the exact field or section.
3. What would a senior HR professional or pay equity auditor object to?
4. If you had to assign a single verdict: "Ready", "Needs work", or "Not ready" — which is it and why in one sentence?
5. What is the single most important thing to fix before this JD is used for any people decision?

Return JSON only:
{
  "verdict": "Ready|Needs work|Not ready",
  "verdictReason": "one direct sentence",
  "drivesDecisionToday": "yes|no|conditional",
  "drivesDecisionReason": "one sentence",
  "topWeaknesses": [{"field":"field name or section","issue":"specific problem","fix":"specific fix"}],
  "auditorObjections": ["specific objection 1","specific objection 2"],
  "topPriority": "single most important fix as plain text",
  "overallNarrative": "3-4 sentence honest narrative, plain text"
}`,
      3000,
      { operation: 'jd.honestReview', context: { orgId: session?.orgId, userId: session?.user?.id } });

    const result = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI honest review error:', error);
    return NextResponse.json({ error: 'Review failed' }, { status: 500 });
  }
}
