/**
 * POST /api/sources/preflight
 *
 * Runs preflight checks on a source URL without fetching job data:
 * - robots.txt compliance
 * - API availability detection
 * - Authentication/CAPTCHA detection
 *
 * Body: { input: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { detectConnector, getConnector, CONNECTOR_META } from '@/lib/sources/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { input?: string } | null;
  if (!body?.input?.trim()) {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  const input = body.input.trim();

  // Detect connectors that can handle this input
  const detected = detectConnector(input);

  try {
    const diag = detected ? await detected.preflight(input) : {
      status: 'UNSUPPORTED_ATS',
      reason: 'No connector recognised this input.',
      robotsAllowed: null,
      authRequired: false,
      captchaDetected: false,
      rateLimited: false,
      apiAvailable: false,
      recommendedAlternative: 'Try a Greenhouse, Ashby, or Lever URL, or paste a careers page URL.',
      userActionNeeded: null,
      errorCode: null,
      technicalDetails: null,
    };

    const connectorMeta = detected ? CONNECTOR_META.find((m) => m.id === detected.id) : null;

    return NextResponse.json({
      ok: true,
      detectedConnector: detected ? {
        id: detected.id,
        name: detected.name,
        sourceKind: detected.sourceKind,
        priority: connectorMeta?.priority,
        description: connectorMeta?.description,
        requiresApiKey: connectorMeta?.requiresApiKey,
        complianceNote: connectorMeta?.complianceNote,
      } : null,
      diagnostics: diag,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** GET /api/sources/preflight — return available connectors list */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json({
    ok: true,
    connectors: CONNECTOR_META,
  });
}
