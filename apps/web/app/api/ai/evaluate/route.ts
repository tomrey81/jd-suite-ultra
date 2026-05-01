import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude } from '@/lib/ai';
import { evaluateRequestSchema } from '@jd-suite/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = evaluateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { jdText } = parsed.data;

    const raw = await callClaude(
      'You are a senior pay equity specialist. Return ONLY valid JSON, no markdown.',
      `Evaluate this JD against all 16 pay equity criteria.

JD:
${jdText}

Return: {"overallCompleteness":0-100,"summary":"brief plain text assessment","criteria":[{"id":1,"name":"Knowledge and Experience","status":"sufficient|partial|insufficient","assessedLevel":null,"maxLevel":9,"gaps":["gap1"],"followUpQuestion":"question (plain text)"}]}

All 16 in order: Knowledge and Experience, Finding Solutions, Planning and Organisation, Communication and Inclusion Skills, Practical Skills, Physical Effort, Mental Effort, Emotional Effort, Initiative and Independence, Responsibility for Welfare of People and Society, Management Responsibility, Responsibility for Information and Confidentiality, Responsibility for Physical and Financial Resources, Responsibility for Strategic Planning, Responsibility for Equality and Inclusion, Working Conditions.`,
      4000,
      { operation: 'jd.evaluate.16criterion', context: { orgId: session?.orgId, userId: session?.user?.id } });

    const result = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI evaluate error:', error);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}
