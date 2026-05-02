import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude, JD_SYSTEM_PROMPT } from '@/lib/ai';
import { analyseInputRequestSchema } from '@jd-suite/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = analyseInputRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { text, templateFieldIds } = parsed.data;
    const fieldList = templateFieldIds.join(', ');

    const raw = await callClaude(
      JD_SYSTEM_PROMPT,
      `Analyse this job description input. Extract structured data for the following fields: ${fieldList}

INPUT:
${text}

Return JSON only (no markdown):
{
  "extractedFields": { "fieldId": "extracted value or empty string" },
  "dqsScore": 0-100,
  "ersScore": 0-100,
  "summaryGood": "1-2 sentences: what is already good (plain text)",
  "summaryMissing": "1-2 sentences: key information missing (plain text)",
  "summaryNextSteps": "1-2 sentences: what to do next (plain text)",
  "escoMatch": {"code":"ESCO code or null","title":"ESCO title or null","confidence":"high/medium/low","note":"brief note"},
  "iscoMatch": {"code":"ISCO-08 code or null","title":"ISCO title or null"},
  "readyForEvaluation": true or false,
  "missingCritical": ["list of critical missing field names"],
  "fieldScores": { "fieldId": {"score":0-100,"badge":"good|needs-work|missing","note":"one plain text sentence"} }
}`,
      5000,
      {
        operation: 'jd.analyse',
        context: { orgId: session.orgId, userId: session.user.id },
      },
    );

    const result = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI analyse error:', error);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
