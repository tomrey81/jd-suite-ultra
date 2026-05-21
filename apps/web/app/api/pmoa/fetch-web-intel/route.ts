import { NextRequest, NextResponse } from 'next/server';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';
import { scrapeCompanyIntel } from '@/lib/pmoa/web-scraper';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const body = await req.json().catch(() => ({}));
  const { websiteUrl, companyName, isPublicCompany } = body as {
    websiteUrl?: string;
    companyName?: string;
    isPublicCompany?: boolean;
  };

  if (!websiteUrl) {
    return NextResponse.json({ error: 'websiteUrl is required' }, { status: 400 });
  }

  let normalised: URL;
  try {
    normalised = new URL(websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    const intel = await scrapeCompanyIntel({
      baseUrl: normalised.origin,
      companyName: companyName || normalised.hostname,
      isPublicCompany: !!isPublicCompany,
    });
    return NextResponse.json({ ok: true, intel });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'Scraping failed' }, { status: 502 });
  }
}
