import { NextRequest, NextResponse } from 'next/server';
import { runLint } from '@/lib/lint/score';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { text = '', fields = {} } = await req.json();
    if (typeof text !== 'string') return NextResponse.json({ error: 'text must be a string' }, { status: 400 });
    const result = runLint(text, fields);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'lint failed' }, { status: 500 });
  }
}
