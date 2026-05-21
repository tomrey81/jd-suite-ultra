/**
 * POST /api/sources/org-inference
 *
 * Infers a draft org structure from a set of normalised job postings.
 *
 * Body: { postings: NormalizedJobPosting[], signals?: OrgStructureSignal[] }
 *
 * Returns OrgInferenceResult with disclaimer, nodes, edges, unresolved signals.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { inferOrgStructure } from '@/lib/sources/org-inference';
import type { NormalizedJobPosting, OrgStructureSignal } from '@/lib/sources/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    postings?: NormalizedJobPosting[];
    signals?: OrgStructureSignal[];
  } | null;

  if (!body?.postings || !Array.isArray(body.postings) || body.postings.length === 0) {
    return NextResponse.json({ error: 'postings array is required' }, { status: 400 });
  }
  if (body.postings.length > 500) {
    return NextResponse.json({ error: 'Too many postings (max 500)' }, { status: 400 });
  }

  try {
    const result = inferOrgStructure(body.postings, body.signals ?? []);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
