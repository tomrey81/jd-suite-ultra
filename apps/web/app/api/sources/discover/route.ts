/**
 * POST /api/sources/discover
 *
 * Discovers job postings from a given source input (URL, company name, etc.)
 * using the best available connector (API → schema.org → HTML fallback).
 *
 * Body:
 *   { input: string, connectorId?: string, options?: Record<string, unknown> }
 *
 * Returns discovered postings + diagnostics + detected connector.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { detectConnector, getConnector } from '@/lib/sources/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    input?: string;
    connectorId?: string;
    options?: Record<string, unknown>;
  } | null;

  if (!body?.input?.trim()) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  const input = body.input.trim();
  const connector = body.connectorId
    ? getConnector(body.connectorId)
    : detectConnector(input);

  if (!connector) {
    return NextResponse.json({
      error: 'No connector could handle this input.',
      hint: 'Provide a valid URL or ATS board slug.',
    }, { status: 400 });
  }

  try {
    const result = await connector.discover(input, body.options);
    return NextResponse.json({
      ok: true,
      connectorId: connector.id,
      connectorName: connector.name,
      sourceKind: connector.sourceKind,
      postings: result.postings,
      totalCount: result.totalCount,
      hasMore: result.hasMore,
      diagnostics: result.diagnostics,
    });
  } catch (err) {
    return NextResponse.json({
      error: (err as Error).message || 'Discovery failed',
    }, { status: 500 });
  }
}
