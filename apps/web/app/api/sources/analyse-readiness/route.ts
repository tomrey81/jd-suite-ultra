/**
 * POST /api/sources/analyse-readiness
 *
 * Runs JD Evaluation Readiness analysis on a job description text.
 *
 * Body:
 *   { title: string, description: string, companyName?: string, location?: string }
 *
 * Returns a JDEvaluationReadiness object with scores, evidence, and recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { analyseJDReadiness, quickReadinessScore } from '@/lib/sources/jd-readiness';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    title?: string;
    description?: string;
    companyName?: string;
    location?: string;
    quickOnly?: boolean;
  } | null;

  if (!body?.description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  if (!body?.title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (body.description.length > 50_000) {
    return NextResponse.json({ error: 'description too long (max 50,000 characters)' }, { status: 400 });
  }

  // Quick score is cheap — always return it
  const quickScore = quickReadinessScore(body.description);

  if (body.quickOnly) {
    return NextResponse.json({ ok: true, quickScore });
  }

  try {
    const readiness = await analyseJDReadiness({
      title: body.title,
      description: body.description,
      companyName: body.companyName,
      location: body.location,
    });
    return NextResponse.json({ ok: true, quickScore, readiness });
  } catch (err) {
    return NextResponse.json({
      error: (err as Error).message || 'Readiness analysis failed',
      quickScore,
    }, { status: 500 });
  }
}
