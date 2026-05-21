import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { callClaude, JD_SYSTEM_PROMPT } from '@/lib/ai';
import { generateFieldRequestSchema } from '@jd-suite/types';
import { JD_IMPORT_RULES } from '@/lib/ai/import-rules';

export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = generateFieldRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { fieldLabel, jdText } = parsed.data;

    const text = await callClaude(
      JD_SYSTEM_PROMPT,
      `Draft the "${fieldLabel}" field for this job description.
EXISTING JD DATA:
${jdText}

SECTION ROUTING RULES (apply when drafting):
${JD_IMPORT_RULES}

Rules: professional HR language, plain text only, no markdown, gender-neutral, do not invent facts, place content only in the correct section per routing rules, return text content only.`,
      600,
      { operation: 'jd.generateField', context: { orgId: session?.orgId, userId: session?.user?.id } });

    return NextResponse.json({ content: text.trim() });
  } catch (error) {
    console.error('AI generate field error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}
