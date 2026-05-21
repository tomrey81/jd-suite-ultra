/**
 * POST /api/sources/ats-keywords
 *
 * Analyses a job posting for ATS keywords.
 *
 * Body: { title: string, description: string, jobFamily?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { analyseAtsKeywords } from '@/lib/sources/ats-keywords';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    title?: string;
    description?: string;
    jobFamily?: string;
  } | null;

  if (!body?.title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  if (!body?.description?.trim()) return NextResponse.json({ error: 'description is required' }, { status: 400 });
  if (body.description.length > 50_000) return NextResponse.json({ error: 'description too long' }, { status: 400 });

  const result = analyseAtsKeywords(body.title, body.description, body.jobFamily);
  return NextResponse.json({ ok: true, result });
}
