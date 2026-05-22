import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude } from '@/lib/ai';
import { evaluateRequestSchema, evaluationResultSchema } from '@jd-suite/types';

export const maxDuration = 30;
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = evaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { jdText } = parsed.data;

  try {
    const raw = await callClaude(
      'You are a senior pay equity specialist. Return ONLY valid JSON, no markdown.',
      `Evaluate this JD against all 16 pay equity criteria.

JD:
${jdText}

Return: {"overallCompleteness":0-100,"summary":"brief plain text assessment","criteria":[{"id":1,"name":"Knowledge and Experience","status":"sufficient|partial|insufficient","assessedLevel":null,"maxLevel":9,"gaps":["gap1"],"followUpQuestion":"question (plain text)"}]}

All 16 in order: Knowledge and Experience, Finding Solutions, Planning and Organisation, Communication and Inclusion Skills, Practical Skills, Physical Effort, Mental Effort, Emotional Effort, Initiative and Independence, Responsibility for Welfare of People and Society, Management Responsibility, Responsibility for Information and Confidentiality, Responsibility for Physical and Financial Resources, Responsibility for Strategic Planning, Responsibility for Equality and Inclusion, Working Conditions.`,
      4000,
      { operation: 'jd.evaluate.16criterion', context: { orgId: session?.orgId, userId: session?.user?.id } });

    let raw_parsed: unknown;
    try {
      raw_parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      console.error('AI evaluate: malformed JSON from model', raw.slice(0, 500));
      return NextResponse.json(
        { error: 'AI returned malformed JSON. Try again.' },
        { status: 502 },
      );
    }

    const validated = evaluationResultSchema.safeParse(raw_parsed);
    if (!validated.success) {
      console.error('AI evaluate: shape mismatch', validated.error.flatten());
      return NextResponse.json(
        {
          error: 'AI response did not match expected shape. Try again.',
          details: validated.error.flatten(),
        },
        { status: 502 },
      );
    }

    return NextResponse.json(validated.data);
  } catch (error) {
    console.error('AI evaluate error:', error);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
