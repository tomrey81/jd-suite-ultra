import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude, JD_SYSTEM_PROMPT } from '@/lib/ai';
import { endForNowRequestSchema } from '@jd-suite/types';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = endForNowRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { jdText, dqs } = parsed.data;

    const raw = await callClaude(
      JD_SYSTEM_PROMPT,
      `Generate end-of-session summary. JD: ${jdText} DQS: ${dqs}%
Return JSON: {"sessionSummary":"2-3 sentence plain text summary","completedWell":["fields well developed"],"mustComplete":[{"field":"name","why":"reason"}],"questionsForNextSession":["specific questions"],"aiEnhancements":["2-3 improvements"],"estimatedQualityGain":"plain text estimate"}`,
      2000,
      { operation: 'jd.endSession.summary', context: { orgId: session?.orgId, userId: session?.user?.id } });

    const result = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error('AI end session error:', error);
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 500 });
  }
}
