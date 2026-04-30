import { NextResponse } from 'next/server';
import { POLICY_PACKS } from '@/lib/bias/policy-packs';

export const dynamic = 'force-dynamic';

/** Public list of available policy packs (just metadata — no secrets). */
export async function GET() {
  return NextResponse.json({
    packs: POLICY_PACKS.map((p) => ({
      id: p.id,
      label: p.label,
      short: p.short,
      description: p.description,
      source: p.source,
    })),
  });
}
